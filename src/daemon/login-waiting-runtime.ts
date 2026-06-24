import type { Client } from "@icqqjs/icqq";
import type { IcqqConfig } from "@/lib/config.js";
import {
  buildLoginPublicUrl,
  resolveLoginConfig,
} from "@/lib/alert-config.js";
import { sendDaemonAlert } from "@/daemon/alert/dispatcher.js";
import { LoginIpcServer } from "@/daemon/login-ipc-server.js";
import { LoginSession } from "@/daemon/login-session.js";
import { LoginWebHost } from "@/daemon/login-web-host.js";
import { LOGIN_INTERACTIVE_ERRORS } from "@/lib/account-bootstrap.js";

export type RunLoginWaitingRuntimeOptions = {
  client: Client;
  uin: number;
  ipcToken: string;
  config: IcqqConfig;
  reason?: string;
  onReady?: () => void;
};

export async function runLoginWaitingRuntime(
  options: RunLoginWaitingRuntimeOptions,
): Promise<void> {
  const { client, uin, ipcToken, config, reason, onReady } = options;
  const loginConfig = resolveLoginConfig(config);

  const session = new LoginSession(
    client,
    uin,
    loginConfig.submitRateLimit.windowMs,
    loginConfig.submitRateLimit.maxAttempts,
  );
  session.start();

  const ipcServer = new LoginIpcServer(uin, ipcToken, client, session);
  const webHost = new LoginWebHost(client, uin, ipcToken, session, loginConfig);

  await ipcServer.start();
  onReady?.();

  await sendDaemonAlert(
    "daemon_ready",
    { uin, reason: "IPC 已就绪" },
    { config, skipCooldown: true },
  );

  await webHost.start();

  const loginUrl = buildLoginPublicUrl(config, webHost.getPort());
  if (!loginConfig.http.publicUrl) {
    console.warn(
      "[login-waiting] 未配置 login.http.publicUrl，告警将不含可点击外链",
    );
  }

  await sendDaemonAlert(
    "login_waiting",
    {
      uin,
      reason: reason ?? LOGIN_INTERACTIVE_ERRORS.daemon.qrcode,
      loginUrl,
    },
    { config },
  );

  const timeout = setTimeout(() => {
    console.error("[login-waiting] 等待登录超时");
    process.exit(1);
  }, loginConfig.waitingTimeoutMs);

  try {
    await client.login(uin);
    await session.waitForOnline();
    await sendDaemonAlert("online", { uin }, { config });
  } finally {
    clearTimeout(timeout);
    session.stop();
    await webHost.stop();
    await ipcServer.stop();
  }
}

export function isInteractiveLoginRequired(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const all = [
    ...Object.values(LOGIN_INTERACTIVE_ERRORS.daemon),
    ...Object.values(LOGIN_INTERACTIVE_ERRORS.reconnect),
  ];
  return (all as string[]).includes(error.message);
}
