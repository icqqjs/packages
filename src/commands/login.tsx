import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import zod from "zod";
import { option } from "pastel";
import type { Platform } from "@icqqjs/icqq";
import { LoginFlow } from "@/components/LoginFlow.js";
import { LoginWizard } from "@/components/LoginWizard.js";
import { Spinner } from "@/components/Spinner.js";
import { resolveIcqq } from "@/lib/icqq-resolve.js";
import {
  loadConfig,
  getAccountConfig,
  type AccountConfig,
  type IcqqConfig,
} from "@/lib/config.js";
import { runPostLoginSetup } from "@/lib/account-bootstrap.js";
import {
  DEFAULT_NETWORK_SETUP,
  accountNetworkDefaultsFromConfig,
  isGlobalNetworkConfigured,
  type NetworkSetupChoice,
} from "@/lib/login-network-setup.js";
import {
  getAccountDir,
  getTmpDir,
} from "@/lib/paths.js";
import { isDaemonRunning, spawnDaemon } from "@/daemon/lifecycle.js";
import fs from "node:fs/promises";
import path from "node:path";

export const description = "登录 QQ 账号并启动守护进程";

export const options = zod.object({
  q: zod
    .number()
    .optional()
    .describe(
      option({
        description: "QQ号（扫码可不指定）",
        alias: "q",
      }),
    ),
  p: zod
    .boolean()
    .default(false)
    .describe(
      option({
        description: "密码登录（交互式输入密码）",
        alias: "p",
      }),
    ),
  c: zod
    .string()
    .optional()
    .describe(
      option({
        description: "配置文件路径",
        alias: "c",
      }),
    ),
  r: zod
    .boolean()
    .default(false)
    .describe(
      option({
        description: "快速重连（使用已保存的 token，跳过登录向导）",
        alias: "r",
      }),
    ),
});

type Props = {
  options: zod.infer<typeof options>;
};

type Status = "wizard" | "login" | "post-login" | "starting-daemon" | "done" | "error";

/* ── Main Login component ───────────────────────────────── */

export default function Login({ options: opts }: Props) {
  const { exit } = useApp();
  const [status, setStatus] = useState<Status>("wizard");
  const [error, setError] = useState("");
  const [errorDwellMs, setErrorDwellMs] = useState(2000);
  const [client, setClient] = useState<any>(null);
  const [dataDir, setDataDir] = useState("");
  const [savedAccount, setSavedAccount] = useState<AccountConfig | undefined>();
  const [resolvedQQ, setResolvedQQ] = useState<number | undefined>(opts.q);
  const [networkDefaults, setNetworkDefaults] = useState(DEFAULT_NETWORK_SETUP);
  const [firstNetworkSetup, setFirstNetworkSetup] = useState(true);
  const [appConfig, setAppConfig] = useState<IcqqConfig>({ accounts: {} });
  const [networkSavedScope, setNetworkSavedScope] = useState<
    "global" | "account" | null
  >(null);
  const [assignedPortNote, setAssignedPortNote] = useState("");
  const [finalOpts, setFinalOpts] = useState<{
    qq?: number;
    password?: string;
    platform: number;
    signApiUrl: string;
    ver: string;
    network: NetworkSetupChoice;
  }>({ platform: 1, signApiUrl: "", ver: "", network: DEFAULT_NETWORK_SETUP });

  // Load config on mount & check if already running
  useEffect(() => {
    void (async () => {
      try {
        // Resolve target uin: explicit -q or fallback to currentUin
        const config = await loadConfig();
        const targetUin = opts.q ?? config.currentUin;

        // Check if daemon already running
        if (targetUin && await isDaemonRunning(targetUin)) {
          setError(`账号 ${targetUin} 的守护进程已在运行中`);
          setStatus("error");
          return;
        }

        let account: AccountConfig | undefined;
        if (opts.c) {
          // External config file
          const raw = await fs.readFile(path.resolve(opts.c), "utf-8");
          const cfg = JSON.parse(raw) as Record<string, unknown>;
          account = {
            platform: (cfg.platform as number) ?? (cfg.plm as number) ?? 1,
            signApiUrl: (cfg.sign_api_url as string) ?? (cfg.sign_api_addr as string) ?? (cfg.sau as string) ?? "",
            ver: cfg.ver as string | undefined,
          };
        } else if (targetUin) {
          if (!opts.q) setResolvedQQ(targetUin);
          account = getAccountConfig(config, targetUin);
        }
        if (account) setSavedAccount(account);

        setFirstNetworkSetup(!isGlobalNetworkConfigured(config));
        setAppConfig(config);
        setNetworkDefaults(
          isGlobalNetworkConfigured(config)
            ? accountNetworkDefaultsFromConfig(config, targetUin)
            : DEFAULT_NETWORK_SETUP,
        );

        // Quick reconnect: skip wizard, directly spawn daemon with cached token
        if (opts.r) {
          if (!targetUin) {
            setError("快速重连需要指定 QQ 号 (-q) 或已设置 currentUin");
            setStatus("error");
            return;
          }
          // Already checked not running above
          if (!getAccountConfig(config, targetUin)) {
            setError(`账号 ${targetUin} 无已保存的配置，请先完整登录一次`);
            setStatus("error");
            return;
          }
          setStatus("starting-daemon");
          await spawnDaemon(targetUin);
          setStatus("done");
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "配置文件无效或无法读取");
        setStatus("error");
      }
    })();
  }, [opts.c, opts.q, opts.r]);

  useEffect(() => {
    if (status === "done" || status === "error") {
      if (status === "error") process.exitCode = 1;
      const timer = setTimeout(() => exit(), status === "error" ? errorDwellMs : 300);
      return () => clearTimeout(timer);
    }
  }, [status, exit, errorDwellMs]);

  const handleWizardComplete = async (result: {
    qq?: number;
    platform: number;
    signApiUrl: string;
    ver: string;
    password?: string;
    network: NetworkSetupChoice;
  }) => {
    const merged = { ...result };
    setFinalOpts(merged);

    // Check if this uin's daemon is already running
    if (merged.qq && await isDaemonRunning(merged.qq)) {
      setError(`账号 ${merged.qq} 的守护进程已在运行中`);
      setStatus("error");
      return;
    }

    setStatus("login");

    // 扫码登录走临时目录，避免账号目录里残留 token 导致先卡 token 登录
    const dir =
      merged.password && merged.qq
        ? getAccountDir(merged.qq)
        : getTmpDir();
    await fs.mkdir(dir, { recursive: true });
    const { createClient } = await resolveIcqq();
    const c = createClient({
      platform: merged.platform as Platform,
      sign_api_addr: merged.signApiUrl || undefined,
      ver: merged.ver || savedAccount?.ver || undefined,
      data_dir: dir,
      log_level: "warn",
    });
    setClient(c);
    setDataDir(dir);
  };

  const handleLoginComplete = async () => {
    if (!client) return;
    setStatus("post-login");

    try {
      const result = await runPostLoginSetup({
        client,
        dataDir,
        finalOpts,
        savedAccount,
        firstNetworkSetup,
      });
      setNetworkSavedScope(result.networkSavedScope);
      setAssignedPortNote(result.assignedPortNote);
      setStatus("starting-daemon");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      try {
        client.terminate();
      } catch {
        /* ignore */
      }
    }
  };

  const handleLoginError = (err: Error) => {
    setErrorDwellMs(
      /验证|ticket|237|设备|滑块/i.test(err.message) ? 15000 : 2000,
    );
    setError(err.message);
    setStatus("error");
    try {
      client?.terminate();
    } catch {
      /* ignore */
    }
  };

  return (
    <Box flexDirection="column">
      {status === "wizard" && (
        <LoginWizard
          onComplete={(r) => void handleWizardComplete(r)}
          initialQQ={resolvedQQ}
          needPassword={opts.p}
          savedAccount={savedAccount}
          networkDefaults={networkDefaults}
          firstNetworkSetup={firstNetworkSetup}
          appConfig={appConfig}
          scopeUin={resolvedQQ}
        />
      )}

      {status === "login" && !client && <Spinner label="初始化…" />}

      {status === "login" && client && (
        <LoginFlow
          client={client}
          dataDir={dataDir}
          uin={finalOpts.qq}
          password={finalOpts.password}
          qrOnly={!finalOpts.password}
          onComplete={() => void handleLoginComplete()}
          onError={handleLoginError}
        />
      )}

      {status === "post-login" && <Spinner label="正在保存配置…" />}

      {status === "starting-daemon" && (
        <Spinner label="正在启动守护进程…" />
      )}

      {status === "done" && (
        <Box flexDirection="column">
          <Text color="green">✔ 登录成功，守护进程已启动。</Text>
          {networkSavedScope === "global" ? (
            <Text dimColor>MCP/RPC 开关已写入全局，端口已写入账号配置</Text>
          ) : networkSavedScope === "account" ? (
            <Text dimColor>MCP/RPC 已写入当前账号配置</Text>
          ) : null}
          {assignedPortNote ? <Text dimColor>{assignedPortNote}</Text> : null}
        </Box>
      )}

      {status === "error" && <Text color="red">✖ {error}</Text>}
    </Box>
  );
}
