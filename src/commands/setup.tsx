import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, Box, useApp, useInput } from "ink";
import zod from "zod";
import { option } from "pastel";
import { isIcqqAvailable, getIcqqPath } from "@/lib/icqq-resolve.js";
import {
  detectPackageManager,
  discoverIcqq,
  runGithubPackagesGlobalInstall,
  resolveSetupToken,
  formatGithubInstallCommand,
  IcqqInstallError,
  type PackageManager,
} from "@/lib/icqq-install.js";
import { TOKEN_HELP } from "@/lib/icqq-setup-hint.js";

export const description = "检查并安装 @icqqjs/icqq 依赖（不修改 ~/.npmrc）";

export const options = zod.object({
  token: zod
    .string()
    .optional()
    .describe(
      option({
        description: "GitHub PAT（read:packages）；未提供时将交互输入或使用 GITHUB_TOKEN",
        alias: "t",
      }),
    ),
});

type Phase =
  | "init"
  | "ready"
  | "need-token"
  | "installing"
  | "done"
  | "fatal";

type LogTone = "dim" | "ok" | "warn" | "err";

type LogEntry = {
  text: string;
  tone: LogTone;
};

type Props = {
  options: zod.infer<typeof options>;
};

function SetupLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Box flexDirection="column" marginBottom={1}>
      {entries.map((entry, i) => {
        const color =
          entry.tone === "ok"
            ? "green"
            : entry.tone === "warn"
              ? "yellow"
              : entry.tone === "err"
                ? "red"
                : undefined;
        return (
          <Text key={`${i}-${entry.text}`} color={color} dimColor={entry.tone === "dim"}>
            {entry.text}
          </Text>
        );
      })}
    </Box>
  );
}

function TokenHelpPanel() {
  return (
    <Box
      flexDirection="column"
      gap={0}
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginBottom={1}
    >
      <Text bold color="cyan">
        {TOKEN_HELP.title}
      </Text>
      <Text>{TOKEN_HELP.intro}</Text>
      <Box flexDirection="column" marginTop={1}>
        {TOKEN_HELP.steps.map((line) => (
          <Text key={line} wrap="wrap">
            {line}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{TOKEN_HELP.alt}</Text>
      </Box>
    </Box>
  );
}

export default function Setup({ options: cliOptions }: Props) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("init");
  const [pm, setPm] = useState<PackageManager>("npm");
  const [icqqPath, setIcqqPath] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [retryNote, setRetryNote] = useState("");
  const [fatalMessage, setFatalMessage] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  const pushLog = useCallback((text: string, tone: LogTone = "dim") => {
    const entry = { text, tone };
    logsRef.current = [...logsRef.current, entry];
    setLogs(logsRef.current);
  }, []);

  const finish = useCallback(
    (code?: number) => {
      if (code) process.exitCode = code;
      setTimeout(() => exit(), code ? 200 : 120);
    },
    [exit],
  );

  // 1–2：检测包管理器并查找已安装的 icqq
  useEffect(() => {
    if (phase !== "init") return;
    void (async () => {
      pushLog("① 检测包管理器 …");
      const detected = detectPackageManager();
      setPm(detected);
      pushLog(`   → 将使用 ${detected}（与当前 icqq CLI 的安装方式一致）`, "ok");

      pushLog("② 查找 @icqqjs/icqq …");
      const found = await discoverIcqq((msg) => pushLog(msg));
      if (found.found) {
        const p = found.path ?? (await getIcqqPath());
        setIcqqPath(p);
        pushLog("   → 已可正常加载，跳过安装", "ok");
        setPhase("ready");
        return;
      }

      pushLog("③ 准备安装 …");
      const preset = resolveSetupToken(cliOptions.token);
      if (preset) {
        if (cliOptions.token?.trim()) {
          pushLog("   → Token 来源：命令行 --token", "ok");
        } else if (process.env.GITHUB_TOKEN?.trim()) {
          pushLog("   → Token 来源：环境变量 GITHUB_TOKEN", "ok");
        } else {
          pushLog("   → Token 来源：环境变量 ICQQ_GITHUB_TOKEN", "ok");
        }
        setActiveToken(preset);
        setPhase("installing");
      } else {
        pushLog("   → 未提供 Token，需要交互输入（见下方获取说明）", "warn");
        setPhase("need-token");
      }
    })();
  }, [phase, cliOptions.token, pushLog]);

  // 5–7：使用 token 全局安装
  useEffect(() => {
    if (phase !== "installing" || !activeToken) return;
    void (async () => {
      const installCmd = formatGithubInstallCommand(pm);
      pushLog("④ 从 GitHub Packages 全局安装 …");
      pushLog(`   → 执行：${installCmd}`);
      pushLog("   → 认证：环境变量（不写入 ~/.npmrc）");
      pushLog("   → 下方为包管理器输出：");
      try {
        runGithubPackagesGlobalInstall(pm, activeToken);
        pushLog("   → 安装命令已结束", "ok");

        pushLog("⑤ 验证能否加载 @icqqjs/icqq …");
        if (await isIcqqAvailable()) {
          const p = await getIcqqPath();
          setIcqqPath(p);
          pushLog(p ? `   → 验证通过（${p}）` : "   → 验证通过", "ok");
          setPhase("done");
          return;
        }
        pushLog("   → 验证失败：已安装但无法加载", "err");
        setFatalMessage(
          "安装命令已成功，但仍无法加载 @icqqjs/icqq。\n" +
            "请确认使用与 icqq CLI 相同的全局包管理器，然后重新运行 icqq setup。",
        );
        setPhase("fatal");
      } catch (e) {
        if (e instanceof IcqqInstallError && e.kind === "auth") {
          pushLog(`   → ${e.message}`, "warn");
          pushLog("   → 将返回 Token 输入步骤", "warn");
          setRetryNote(e.message);
          setActiveToken("");
          setTokenInput("");
          setPhase("need-token");
          return;
        }
        const msg =
          e instanceof IcqqInstallError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
        pushLog(`   → ${msg}`, "err");
        setFatalMessage(
          `${msg}\n\n可检查网络、包管理器是否可用，或稍后重试 icqq setup。`,
        );
        setPhase("fatal");
      }
    })();
  }, [phase, pm, activeToken, pushLog]);

  useEffect(() => {
    if (phase === "ready" || phase === "done") finish();
    if (phase === "fatal") finish(1);
  }, [phase, finish]);

  useInput(
    (input, key) => {
      if (phase !== "need-token") return;

      if (key.return) {
        const t = tokenInput.trim();
        if (!t) {
          pushLog("   → Token 为空，请重新输入", "warn");
          return;
        }
        pushLog("   → 已接收 Token（交互输入）", "ok");
        setRetryNote("");
        setActiveToken(t);
        setPhase("installing");
        return;
      }
      if (key.backspace || key.delete) {
        setTokenInput((v) => v.slice(0, -1));
        return;
      }
      if (key.ctrl && input === "c") {
        pushLog("已取消", "warn");
        finish(1);
        return;
      }
      if (!key.ctrl && !key.meta && input) {
        setTokenInput((v) => v + input);
      }
    },
    { isActive: phase === "need-token" },
  );

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Text bold>icqq setup</Text>

      {phase === "need-token" ? (
        <>
          {retryNote && (
            <Box marginBottom={1}>
              <Text color="yellow">
                ⚠ {retryNote}（请按下方说明重新获取或检查 Token 权限）
              </Text>
            </Box>
          )}
          <TokenHelpPanel />
          <SetupLog entries={logs} />
          <Box flexDirection="column" marginTop={1}>
            <Text bold>粘贴 Token：</Text>
            <Box>
              <Text color="cyan">❯ </Text>
              <Text>
                {"•".repeat(tokenInput.length)}
                <Text color="cyan">█</Text>
              </Text>
            </Box>
          </Box>
        </>
      ) : (
        <SetupLog entries={logs} />
      )}

      {phase === "init" && <Text dimColor>进行中 …</Text>}

      {phase === "ready" && (
        <Text color="green">✓ 完成：@icqqjs/icqq 已可正常加载。</Text>
      )}

      {phase === "installing" && (
        <Text dimColor>正在安装，请稍候 …</Text>
      )}

      {phase === "done" && (
        <Text color="green">✓ 完成：可以运行 icqq login 了。</Text>
      )}

      {phase === "fatal" && <Text color="red">{fatalMessage}</Text>}
    </Box>
  );
}
