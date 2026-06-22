import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, Box, useApp } from "ink";
import {
  detectPackageManager,
  runPublicRegistryGlobalInstall,
  formatPublicInstallCommand,
  CLI_PACKAGE,
  IcqqInstallError,
  type PackageManager,
} from "@/lib/icqq-install.js";

export const description = "升级 @icqqjs/cli 到最新版本（npmjs 公网源）";

type Phase = "init" | "done" | "fatal";

type LogTone = "dim" | "ok" | "warn" | "err";

type LogEntry = {
  text: string;
  tone: LogTone;
};

function FlowLog({ entries }: { entries: LogEntry[] }) {
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

export default function CliUpdate() {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("init");
  const [pm] = useState<PackageManager>(() => detectPackageManager());
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

  useEffect(() => {
    if (phase !== "init") return;
    void (async () => {
      pushLog("① 检测包管理器 …");
      pushLog(`   → 将使用 ${pm}（与当前 icqq CLI 的安装方式一致）`, "ok");

      const installCmd = formatPublicInstallCommand(pm, CLI_PACKAGE);
      pushLog("② 从 npmjs 全局升级 @icqqjs/cli …");
      pushLog(`   → 执行：${installCmd}`);
      pushLog("   → 下方为包管理器输出：");
      try {
        runPublicRegistryGlobalInstall(pm, CLI_PACKAGE);
        pushLog("   → 升级命令已结束", "ok");
        pushLog("   → 请重新打开终端或重新运行 icqq 以使用新版本", "ok");
        setPhase("done");
      } catch (e) {
        const msg =
          e instanceof IcqqInstallError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
        pushLog(`   → ${msg}`, "err");
        setFatalMessage(`${msg}\n\n可检查网络与包管理器，或稍后重试 icqq cli-update。`);
        setPhase("fatal");
      }
    })();
  }, [phase, pm, pushLog]);

  useEffect(() => {
    if (phase === "done") finish();
    if (phase === "fatal") finish(1);
  }, [phase, finish]);

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Text bold>icqq cli-update</Text>

      <FlowLog entries={logs} />

      {phase === "init" && <Text dimColor>正在升级，请稍候 …</Text>}

      {phase === "done" && (
        <Text color="green">✓ 完成：@icqqjs/cli 已升级。</Text>
      )}

      {phase === "fatal" && <Text color="red">{fatalMessage}</Text>}
    </Box>
  );
}
