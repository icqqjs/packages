import React, { useState, useEffect, useCallback } from "react";
import { Text, Box, useApp, useInput } from "ink";
import { isIcqqAvailable, getIcqqPath } from "@/lib/icqq-resolve.js";
import { saveGithubToken } from "@/lib/github-token.js";
import {
  detectPackageManager,
  discoverIcqq,
  runGithubPackagesGlobalInstall,
  resolveSetupTokenWithSource,
  formatGithubInstallCommand,
  formatInstallEnvironment,
  ICQQ_PACKAGE,
  IcqqInstallError,
  type PackageManager,
  type SetupTokenSource,
} from "@/lib/icqq-install.js";
import { pushTokenHelpLogs } from "@/lib/icqq-setup-hint.js";
import { applyTextInputKey } from "@/lib/step-flow-input.js";
import { FlowLog, useFlowLog } from "@/components/FlowLog.js";
import { StepFlowMaskedInput } from "@/components/StepFlow.js";

export type IcqqPackageFlowMode = "setup" | "update";

type Phase =
  | "init"
  | "ready"
  | "need-token"
  | "installing"
  | "done"
  | "fatal";

export type IcqqGithubPackageFlowProps = {
  title: string;
  mode: IcqqPackageFlowMode;
  tokenOption?: string;
  readyMessage: string;
  doneMessage: string;
  retryCommand: string;
};

function tokenSourceLabel(source: SetupTokenSource): string {
  switch (source) {
    case "flag":
      return "命令行 --token";
    case "env-github":
      return "环境变量 GITHUB_TOKEN";
    case "env-icqq":
      return "环境变量 ICQQ_GITHUB_TOKEN";
    case "saved":
      return "~/.icqq/github.token";
    default:
      return "";
  }
}

export function IcqqGithubPackageFlow({
  title,
  mode,
  tokenOption,
  readyMessage,
  doneMessage,
  retryCommand,
}: IcqqGithubPackageFlowProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("init");
  const [pm, setPm] = useState<PackageManager>("npm");
  const [activeToken, setActiveToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [reinstall, setReinstall] = useState(false);
  const [fatalMessage, setFatalMessage] = useState("");
  const { logs, pushLog } = useFlowLog();

  const finish = useCallback(
    (code?: number) => {
      if (code) process.exitCode = code;
      setTimeout(() => exit(), code ? 200 : 120);
    },
    [exit],
  );

  const enterNeedToken = useCallback(
    (retryNote?: string) => {
      if (retryNote) {
        pushLog("③ 重新输入 Token …", "warn");
        pushTokenHelpLogs(pushLog, retryNote);
      }
      setPhase("need-token");
    },
    [pushLog],
  );

  const beginTokenPhase = useCallback(
    (stepLabel: string) => {
      pushLog(stepLabel);
      const resolved = resolveSetupTokenWithSource(tokenOption);
      if (resolved.token) {
        pushLog(`   → Token 来源：${tokenSourceLabel(resolved.source)}`, "ok");
        setActiveToken(resolved.token);
        setPhase("installing");
        return;
      }
      pushLog("   → 未提供 Token，请按下列说明获取后粘贴", "warn");
      pushTokenHelpLogs(pushLog);
      pushLog("   → 等待输入 Token：", "ok");
      enterNeedToken();
    },
    [tokenOption, pushLog, enterNeedToken],
  );

  useEffect(() => {
    if (phase !== "init") return;
    void (async () => {
      pushLog("① 检测包管理器 …");
      const detected = detectPackageManager();
      setPm(detected);
      pushLog(`   → 将使用 ${detected}（与当前 icqq CLI 的安装方式一致）`, "ok");

      if (mode === "setup") {
        pushLog("② 查找 @icqqjs/icqq …");
        const found = await discoverIcqq((msg) => pushLog(msg));
        setReinstall(found.listedButUnloadable);
        if (found.found) {
          await getIcqqPath();
          pushLog("   → 已可正常加载，跳过安装", "ok");
          setPhase("ready");
          return;
        }
        beginTokenPhase("③ 准备安装 …");
        return;
      }

      beginTokenPhase("② 准备升级 @icqqjs/icqq …");
    })();
  }, [phase, mode, pushLog, beginTokenPhase]);

  useEffect(() => {
    if (phase !== "installing" || !activeToken) return;
    void (async () => {
      const installCmd = formatGithubInstallCommand(pm, ICQQ_PACKAGE);
      const installStep = mode === "update" ? "③ 从 GitHub Packages 全局升级 …" : "④ 从 GitHub Packages 全局安装 …";
      const verifyStep = mode === "update" ? "④ 验证能否加载 @icqqjs/icqq …" : "⑤ 验证能否加载 @icqqjs/icqq …";
      pushLog(installStep);
      pushLog(`   → 执行：${installCmd}`);
      pushLog(`   → 环境：${formatInstallEnvironment(pm)}`);
      pushLog("   → 认证：临时 userconfig + GITHUB_TOKEN env（不修改 ~/.npmrc）");
      if (reinstall) {
        pushLog("   → 检测到全局登记但无法加载，将先卸载再重装", "warn");
      }
      pushLog("   → 下方为包管理器输出：");
      try {
        runGithubPackagesGlobalInstall(pm, activeToken, ICQQ_PACKAGE, { reinstall });
        pushLog("   → 安装命令已结束", "ok");

        pushLog(verifyStep);
        if (await isIcqqAvailable()) {
          const p = await getIcqqPath();
          pushLog(p ? `   → 验证通过（${p}）` : "   → 验证通过", "ok");
          setPhase("done");
          return;
        }
        pushLog("   → 验证失败：已安装但无法加载", "err");
        setFatalMessage(
          "安装命令已成功，但仍无法加载 @icqqjs/icqq。\n" +
            `请确认使用与 icqq CLI 相同的全局包管理器，然后重新运行 ${retryCommand}。`,
        );
        setPhase("fatal");
      } catch (e) {
        if (e instanceof IcqqInstallError && e.kind === "auth") {
          pushLog(`   → ${e.message}`, "warn");
          pushLog("   → 返回 ③，请重新获取 Token", "warn");
          setActiveToken("");
          setTokenInput("");
          enterNeedToken(e.message);
          return;
        }
        const msg =
          e instanceof IcqqInstallError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
        pushLog(`   → ${msg}`, "err");
        if (e instanceof IcqqInstallError && e.detail) {
          for (const line of e.detail.split("\n").filter(Boolean).slice(-6)) {
            if (line.startsWith("认证策略：")) continue;
            pushLog(`   │ ${line}`, "err");
          }
        }
        setFatalMessage(
          `${msg}\n\n可检查网络、包管理器是否可用，或稍后重试 ${retryCommand}。`,
        );
        setPhase("fatal");
      }
    })();
  }, [phase, pm, activeToken, mode, reinstall, pushLog, enterNeedToken, retryCommand]);

  useEffect(() => {
    if (phase === "ready" || phase === "done") finish();
    if (phase === "fatal") finish(1);
  }, [phase, finish]);

  useInput(
    (input, key) => {
      if (phase !== "need-token") return;

      if (key.ctrl && input === "c") {
        pushLog("已取消", "warn");
        finish(1);
        return;
      }

      const textResult = applyTextInputKey(tokenInput, input, key);
      if (textResult.type === "append") {
        setTokenInput(textResult.value);
        return;
      }
      if (textResult.type === "backspace") {
        setTokenInput(textResult.value);
        return;
      }
      if (textResult.type !== "submit") return;

      const t = tokenInput.trim();
      if (!t) {
        pushLog("   → Token 为空，请重新输入", "warn");
        return;
      }
      void (async () => {
        await saveGithubToken(t);
        pushLog("   → 已接收 Token（交互输入，已保存到 ~/.icqq/github.token）", "ok");
        setActiveToken(t);
        setPhase("installing");
      })();
    },
    { isActive: phase === "need-token" },
  );

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Text bold>{title}</Text>

      <FlowLog entries={logs} />

      {phase === "init" && <Text dimColor>进行中 …</Text>}

      {phase === "ready" && <Text color="green">{readyMessage}</Text>}

      {phase === "need-token" && (
        <Box flexDirection="column" marginTop={1}>
          <StepFlowMaskedInput value={tokenInput} char="•" />
        </Box>
      )}

      {phase === "installing" && (
        <Text dimColor>{mode === "update" ? "正在升级，请稍候 …" : "正在安装，请稍候 …"}</Text>
      )}

      {phase === "done" && <Text color="green">{doneMessage}</Text>}

      {phase === "fatal" && <Text color="red">{fatalMessage}</Text>}
    </Box>
  );
}
