/**
 * icqq service status — 查询系统服务与守护进程状态。
 * 不指定 QQ 号时默认列出所有已配置账号。
 */
import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import {
  queryService,
  resolveServiceUins,
  type ServiceState,
} from "./_helpers.js";
import { readMcpEndpoint, formatMcpUrl } from "@/lib/paths.js";
import { resolveMcpConfigForUin, loadConfig } from "@/lib/config.js";
import { formatServiceError } from "@/lib/cli-errors.js";
import { getDaemonPid, isDaemonRunning } from "@/daemon/supervisor.js";

export const description = "查看系统服务状态（默认全部已配置账号；可指定 QQ 号）";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "仅查看该 QQ 号（不指定则查看全部已配置账号）",
    }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

type AccountStatus = ServiceState & {
  daemonRunning: boolean;
  daemonPid: number | null;
  mcpUrl: string | null;
  isCurrent: boolean;
  pidMismatch: boolean;
  serviceDaemonDrift: boolean;
};

function StatusLine({ s }: { s: AccountStatus }) {
  const tag = s.isCurrent ? "*" : " ";
  const svc = s.installed
    ? s.running
      ? "服务:运行中"
      : "服务:已停止"
    : s.daemonRunning
      ? "服务:未安装(手动守护)"
      : "服务:未安装";
  const daemon = s.daemonRunning
    ? `守护:运行中${s.daemonPid ? ` PID:${s.daemonPid}` : ""}`
    : "守护:未运行";
  return (
    <Text>
      <Text dimColor>{tag} </Text>
      <Text color={s.isCurrent ? "cyan" : undefined} bold={s.isCurrent}>
        [{s.uin}]
      </Text>
      {" "}
      <Text color={s.installed ? "green" : s.daemonRunning ? "yellow" : "red"}>{svc}</Text>
      {s.installed && s.running && s.pid !== null ? (
        <Text dimColor> svcPID:{s.pid}</Text>
      ) : null}
      {!s.running && s.lastExitCode !== null ? (
        <Text color={s.lastExitCode !== 0 ? "red" : undefined}>
          {" "}退出:{s.lastExitCode}
        </Text>
      ) : null}
      {" "}
      <Text color={s.daemonRunning ? "green" : "yellow"}>{daemon}</Text>
      {s.mcpUrl ? <Text color="cyan"> MCP:{s.mcpUrl}</Text> : null}
      {s.pidMismatch ? <Text color="red"> ⚠服务PID与守护进程不一致</Text> : null}
      {s.serviceDaemonDrift ? <Text color="red"> ⚠服务在跑但守护进程未就绪</Text> : null}
    </Text>
  );
}

function StatusDetail({ s }: { s: AccountStatus }) {
  return (
    <Box flexDirection="column">
      {s.isCurrent ? <Text dimColor>（currentUin）</Text> : null}
      <Box gap={1}>
        <Text bold>系统服务已安装：</Text>
        <Text color={s.installed ? "green" : "red"}>{s.installed ? "是" : "否"}</Text>
      </Box>
      {s.installed && (
        <>
          <Box gap={1}>
            <Text bold>服务运行中：</Text>
            <Text color={s.running ? "green" : "yellow"}>{s.running ? "是" : "否"}</Text>
          </Box>
          {s.running && s.pid !== null && (
            <Box gap={1}><Text bold>服务 PID：</Text><Text>{s.pid}</Text></Box>
          )}
          {!s.running && s.lastExitCode !== null && (
            <Box gap={1}>
              <Text bold>上次退出码：</Text>
              <Text color={s.lastExitCode === 0 ? "green" : "red"}>{s.lastExitCode}</Text>
            </Box>
          )}
          <Box gap={1}><Text bold>服务文件：</Text><Text dimColor>{s.filePath}</Text></Box>
        </>
      )}
      <Box gap={1}>
        <Text bold>守护进程：</Text>
        <Text color={s.daemonRunning ? "green" : "yellow"}>
          {s.daemonRunning ? "运行中" : "未运行"}
        </Text>
        {s.daemonPid !== null && <Text dimColor> (PID {s.daemonPid})</Text>}
      </Box>
      {s.mcpUrl ? (
        <Box gap={1}><Text bold>MCP：</Text><Text color="cyan">{s.mcpUrl}</Text></Box>
      ) : null}
      {s.pidMismatch ? (
        <Text color="red">服务 PID 与守护进程 PID 不一致，可能处于崩溃循环</Text>
      ) : null}
      {s.serviceDaemonDrift ? (
        <Text color="red">系统服务显示运行中，但守护进程 socket 不可达</Text>
      ) : null}
    </Box>
  );
}

export default function ServiceStatus({ args: [argUin] }: Props) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<AccountStatus[]>([]);
  const [fatalError, setFatalError] = useState("");

  useEffect(() => {
    void (async () => {
      const platform = process.platform;
      if (platform !== "darwin" && platform !== "linux") {
        setFatalError(`不支持当前平台: ${platform}。仅支持 macOS 和 Linux。`);
        setLoading(false);
        return;
      }
      try {
        const uins = await resolveServiceUins(argUin);
        const config = await loadConfig();

        const out: AccountStatus[] = [];
        for (const uin of uins) {
          const svc = await queryService(uin);
          const mcpCfg = resolveMcpConfigForUin(config, uin);
          const daemonRunning = await isDaemonRunning(uin);
          const daemonPid = daemonRunning ? await getDaemonPid(uin) : null;
          let mcpUrl: string | null = null;
          if (mcpCfg.enabled && daemonRunning) {
            const ep = await readMcpEndpoint(uin);
            if (ep) mcpUrl = formatMcpUrl(ep);
          }
          out.push({
            ...svc,
            daemonRunning,
            daemonPid,
            mcpUrl,
            isCurrent: config.currentUin === uin,
            pidMismatch:
              svc.running &&
              svc.pid !== null &&
              daemonPid !== null &&
              svc.pid !== daemonPid,
            serviceDaemonDrift: svc.running && !daemonRunning,
          });
        }

        const mcpUrls = out.map((s) => s.mcpUrl).filter(Boolean) as string[];
        const dupMcp =
          mcpUrls.length > 1 && new Set(mcpUrls).size < mcpUrls.length;
        if (dupMcp) {
          for (const row of out) {
            if (row.mcpUrl) row.mcpUrl = `${row.mcpUrl} ⚠端口冲突/过期`;
          }
        }
        setResults(out);
      } catch (e) {
        setFatalError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
  }, [argUin]);

  useEffect(() => {
    if (!loading) {
      if (fatalError) process.exitCode = 1;
      setTimeout(exit, 0);
    }
  }, [loading, fatalError, exit]);

  if (loading) return <Spinner label="查询服务状态…" />;
  if (fatalError) return <Text color="red">{formatServiceError(fatalError)}</Text>;

  if (results.length === 1) {
    return <StatusDetail s={results[0]!} />;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>共 {results.length} 个账号（* 为 currentUin）</Text>
      {results.map((s) => (
        <StatusLine key={s.uin} s={s} />
      ))}
    </Box>
  );
}
