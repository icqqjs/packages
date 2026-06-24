import type { Client } from "@icqqjs/icqq";
import fs from "node:fs/promises";
import path from "node:path";
import {
  loadConfig,
  saveConfig,
  setAccountConfig,
  type AccountConfig,
  type IcqqConfig,
} from "@/lib/config.js";
import {
  findNetworkPortConflict,
  isGlobalNetworkConfigured,
  persistAccountNetworkSetup,
  persistGlobalNetworkSetup,
  syncAssignedPortsToAccount,
  type NetworkSetupChoice,
} from "@/lib/login-network-setup.js";
import { getAccountDir, getTmpDir } from "@/lib/paths.js";
import { isDaemonRunning, spawnDaemon, stopDaemon } from "@/daemon/lifecycle.js";

export type LoginInteractivePolicy = "reject" | "interactive";

export type LoginErrorVariant = "daemon" | "reconnect";

export const LOGIN_INTERACTIVE_ERRORS = {
  daemon: {
    qrcode: "Token 过期，需要扫码。请重新执行 icqq login",
    slider: "需要滑块验证。请重新执行 icqq login",
    device: "需要设备验证。请重新执行 icqq login",
    auth: "需要身份验证。请重新执行 icqq login",
    timeout: "登录超时",
  },
  reconnect: {
    qrcode: "需要扫码验证，请执行 icqq login",
    slider: "需要滑块验证，请执行 icqq login",
    device: "需要设备验证，请执行 icqq login",
    auth: "需要身份验证，请执行 icqq login",
    timeout: "重连超时",
  },
} as const;

export type InteractiveLoginHandlers = {
  onOnline: () => void;
  onLoginError: (event: { message: string }) => void;
  onQrcode: (event: unknown) => void;
  onSlider: (event: { url: string }) => void;
  onDevice: (event: { url: string; phone: string }) => void;
  onAuth: (event: { url: string; device?: unknown }) => void;
};

export type WaitForLoginOutcomeOptions = {
  errorVariant?: LoginErrorVariant;
  timeoutMs?: number;
};

function getLoginErrors(variant: LoginErrorVariant) {
  return LOGIN_INTERACTIVE_ERRORS[variant];
}

function bindRejectLoginListeners(
  client: Client,
  settle: (fn: () => void) => void,
  errors: (typeof LOGIN_INTERACTIVE_ERRORS)[LoginErrorVariant],
): void {
  client.once("system.online", () => settle(() => undefined));
  client.once("system.login.error", (event: { message: string }) => {
    settle(() => {
      throw new Error(event.message);
    });
  });
  client.once("system.login.qrcode", () => {
    settle(() => {
      throw new Error(errors.qrcode);
    });
  });
  client.once("system.login.slider", () => {
    settle(() => {
      throw new Error(errors.slider);
    });
  });
  client.once("system.login.device", () => {
    settle(() => {
      throw new Error(errors.device);
    });
  });
  client.once("system.login.auth", () => {
    settle(() => {
      throw new Error(errors.auth);
    });
  });
}

/** 等待 login() 之后的结果：online 或交互式拒绝（守护进程冷启动 / 重连） */
export function waitForLoginOutcome(
  client: Client,
  options: WaitForLoginOutcomeOptions = {},
): Promise<void> {
  const errors = getLoginErrors(options.errorVariant ?? "reconnect");
  const timeoutMs = options.timeoutMs;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        fn();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const timer =
      timeoutMs != null
        ? setTimeout(() => settle(() => {
            throw new Error(errors.timeout);
          }), timeoutMs)
        : undefined;

    bindRejectLoginListeners(client, settle, errors);
  });
}

/** reject 策略：先注册监听，再执行 loginFn，等待 online 或拒绝 */
export async function awaitLoginOutcome(
  client: Client,
  policy: "reject",
  loginFn: () => Promise<unknown>,
  options?: WaitForLoginOutcomeOptions,
): Promise<void> {
  if (policy !== "reject") {
    throw new Error("interactive policy requires bindInteractiveLoginHandlers");
  }

  const errors = getLoginErrors(options?.errorVariant ?? "daemon");
  const timeoutMs = options?.timeoutMs;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        fn();
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const timer =
      timeoutMs != null
        ? setTimeout(() => settle(() => {
            throw new Error(errors.timeout);
          }), timeoutMs)
        : undefined;

    bindRejectLoginListeners(client, settle, errors);
    void loginFn().catch((error: unknown) =>
      settle(() => {
        throw error instanceof Error ? error : new Error(String(error));
      }),
    );
  });
}

/** interactive 策略：绑定 UI 回调，由调用方自行触发 client.login() */
export function bindInteractiveLoginHandlers(
  client: Client,
  handlers: InteractiveLoginHandlers,
): () => void {
  client.on("system.online", handlers.onOnline);
  client.on("system.login.error", handlers.onLoginError);
  client.on("system.login.qrcode", handlers.onQrcode);
  client.on("system.login.slider", handlers.onSlider);
  client.on("system.login.device", handlers.onDevice);
  client.on("system.login.auth", handlers.onAuth);

  return () => {
    client.off("system.online", handlers.onOnline);
    client.off("system.login.error", handlers.onLoginError);
    client.off("system.login.qrcode", handlers.onQrcode);
    client.off("system.login.slider", handlers.onSlider);
    client.off("system.login.device", handlers.onDevice);
    client.off("system.login.auth", handlers.onAuth);
  };
}

export function createInteractiveLoginAwaitOutcome(
  timeoutMs = 15000,
): (client: Client) => Promise<void> {
  return (client) =>
    waitForLoginOutcome(client, {
      errorVariant: "reconnect",
      timeoutMs,
    });
}

export type RunPostLoginSetupOptions = {
  client: Client;
  dataDir: string;
  finalOpts: {
    platform: number;
    signApiUrl: string;
    ver: string;
    network: NetworkSetupChoice;
  };
  savedAccount?: AccountConfig;
  firstNetworkSetup: boolean;
};

export type RunPostLoginSetupResult = {
  uin: number;
  networkSavedScope: "global" | "account" | null;
  assignedPortNote: string;
};

export async function runPostLoginSetup(
  options: RunPostLoginSetupOptions,
): Promise<RunPostLoginSetupResult> {
  const { client, dataDir, finalOpts, savedAccount, firstNetworkSetup } =
    options;
  const actualUin = client.uin as number;

  const tmpDir = getTmpDir();
  if (path.resolve(dataDir) === path.resolve(tmpDir)) {
    const accountDir = getAccountDir(actualUin);
    await fs.mkdir(accountDir, { recursive: true });
    for (const entry of await fs.readdir(tmpDir, { withFileTypes: true })) {
      const src = path.join(tmpDir, entry.name);
      const dest = path.join(accountDir, entry.name);
      await fs.cp(src, dest, { recursive: true, force: true });
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  const config = await loadConfig();
  setAccountConfig(config, actualUin, {
    platform: finalOpts.platform,
    signApiUrl: finalOpts.signApiUrl ?? "",
    ver: finalOpts.ver || savedAccount?.ver,
  });
  if (config.currentUin == null) {
    config.currentUin = actualUin;
  }

  let networkSavedScope: "global" | "account" | null = null;
  if (firstNetworkSetup) {
    persistGlobalNetworkSetup(config, finalOpts.network);
    networkSavedScope = "global";
  } else {
    networkSavedScope = "account";
  }

  const conflict = findNetworkPortConflict(config, actualUin, finalOpts.network);
  if (conflict) {
    throw new Error(conflict);
  }
  persistAccountNetworkSetup(config, actualUin, finalOpts.network);
  await saveConfig(config);

  try {
    client.terminate();
  } catch {
    /* ignore */
  }

  if (await isDaemonRunning(actualUin)) {
    await stopDaemon(actualUin);
  }

  await spawnDaemon(actualUin);

  const assigned = await syncAssignedPortsToAccount(config, actualUin);
  await saveConfig(config);

  const parts: string[] = [];
  if (assigned.mcpPort) parts.push(`MCP ${assigned.mcpPort}`);
  if (assigned.rpcPort) parts.push(`RPC ${assigned.rpcPort}`);
  const assignedPortNote =
    parts.length > 0 ? `端口已写入账号配置：${parts.join("，")}` : "";

  return { uin: actualUin, networkSavedScope, assignedPortNote };
}
