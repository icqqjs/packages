import { readFile } from "node:fs/promises";
import path from "node:path";
import { IpcClient } from "@icqqjs/sdk/protocol";
import { getAccountDir, getLogPath } from "@icqqjs/sdk/daemon";
import {
  loadConfig,
  saveConfig,
  getAccountConfig,
  setAccountConfig,
} from "@icqqjs/sdk/gateway";
import {
  spawnDaemon,
  isDaemonRunning,
  forceStopDaemon,
} from "@icqqjs/sdk/daemon";
import { LoginActions } from "@icqqjs/sdk/protocol";
import type {
  CreateLocalInput,
  DiscoveredInstance,
  InstanceState,
  LoginPhase,
  LoginStateView,
} from "./types.js";

const CONNECT_TIMEOUT = 6000;
const PACKAGE_VERSION = "0.1.0";

export async function tailDaemonLog(uin: number, lines = 40): Promise<string> {
  try {
    const content = await readFile(getLogPath(uin), "utf-8");
    return content.split("\n").slice(-lines).join("\n").trim();
  } catch {
    return "";
  }
}

async function tryConnect(
  uin: number,
): Promise<Awaited<ReturnType<typeof IpcClient.connect>> | null> {
  try {
    return await IpcClient.connect(uin);
  } catch {
    return null;
  }
}

async function readQrcodeDataUrl(uin: number): Promise<string | undefined> {
  try {
    const buf = await readFile(path.join(getAccountDir(uin), "qrcode.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

type RawLoginState = {
  phase?: LoginPhase;
  detail?: string;
  sliderUrl?: string;
  deviceUrl?: string;
  devicePhone?: string;
  authUrl?: string;
  lastError?: string;
};

export async function probeInstanceStatus(uin: number): Promise<LoginStateView> {
  const config = await loadConfig();
  if (!getAccountConfig(config, uin)) {
    return { ok: false, state: "config_missing", error: "缺少账号配置" };
  }
  const client = await tryConnect(uin);
  if (!client) {
    const logTail = await tailDaemonLog(uin);
    return {
      ok: false,
      state: "daemon_down",
      error: "daemon 未运行或不可达",
      logTail: logTail || undefined,
    };
  }
  try {
    const status = await client.request("get_status", {}, CONNECT_TIMEOUT);
    if (status.ok) {
      const data = status.data as { online?: boolean; nickname?: string };
      return {
        ok: true,
        state: data?.online ? "online" : "unknown",
        online: Boolean(data?.online),
        nickname: data?.nickname,
      };
    }
    const login = await client.request(
      LoginActions.LOGIN_GET_STATE,
      {},
      CONNECT_TIMEOUT,
    );
    if (login.ok) {
      const s = login.data as RawLoginState;
      if (s.phase === "online") return { ok: true, state: "online", online: true };
      return {
        ok: true,
        state: "login_waiting",
        phase: s.phase,
        detail: s.detail,
      };
    }
    return { ok: false, state: "unknown" };
  } catch {
    return { ok: false, state: "unknown" };
  } finally {
    client.close();
  }
}

export async function getLoginState(uin: number): Promise<LoginStateView> {
  const base = await probeInstanceStatus(uin);
  if (base.state === "config_missing" || base.state === "daemon_down") {
    return base;
  }
  const client = await tryConnect(uin);
  if (!client) return base;
  try {
    const status = await client.request("get_status", {}, CONNECT_TIMEOUT);
    if (status.ok) {
      const data = status.data as { online?: boolean; nickname?: string };
      if (data?.online) {
        return {
          ok: true,
          state: "online",
          phase: "online",
          online: true,
          nickname: data.nickname,
        };
      }
    }
    const login = await client.request(
      LoginActions.LOGIN_GET_STATE,
      {},
      CONNECT_TIMEOUT,
    );
    if (!login.ok) {
      return { ok: false, state: "unknown", lastError: login.error };
    }
    const s = login.data as RawLoginState;
    const view: LoginStateView = {
      ok: true,
      state: s.phase === "online" ? "online" : "login_waiting",
      phase: s.phase,
      detail: s.detail,
      sliderUrl: s.sliderUrl,
      deviceUrl: s.deviceUrl,
      devicePhone: s.devicePhone,
      authUrl: s.authUrl,
      lastError: s.lastError,
    };
    if (s.phase === "qrcode") {
      view.qrcodeDataUrl = await readQrcodeDataUrl(uin);
    }
    return view;
  } finally {
    client.close();
  }
}

async function requestOnce(
  uin: number,
  action: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const client = await tryConnect(uin);
  if (!client) {
    return { ok: false, error: "daemon 未运行或不可达" };
  }
  try {
    const resp = await client.request(action, params, CONNECT_TIMEOUT);
    return { ok: resp.ok, error: resp.error };
  } finally {
    client.close();
  }
}

export function submitLogin(
  uin: number,
  kind: string,
  value?: string,
): Promise<{ ok: boolean; error?: string }> {
  return requestOnce(uin, LoginActions.LOGIN_SUBMIT, { kind, value });
}

export function sendLoginSms(
  uin: number,
): Promise<{ ok: boolean; error?: string }> {
  return requestOnce(uin, LoginActions.LOGIN_SEND_SMS, {});
}

export async function ipcRequest(
  uin: number,
  action: string,
  params: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: unknown; error?: string; id?: string }> {
  const client = await tryConnect(uin);
  if (!client) {
    return { ok: false, error: "daemon 未运行或不可达", id: "" };
  }
  try {
    const resp = await client.request(action, params);
    return { ok: resp.ok, data: resp.data, error: resp.error, id: resp.id };
  } finally {
    client.close();
  }
}

async function ensureDaemonHealthy(uin: number): Promise<LoginStateView | null> {
  const tryReach = async (): Promise<boolean> => {
    const client = await tryConnect(uin);
    if (!client) return false;
    client.close();
    return true;
  };

  if (!(await isDaemonRunning(uin))) {
    try {
      await spawnDaemon(uin);
    } catch (err) {
      const logTail = await tailDaemonLog(uin);
      return {
        ok: false,
        state: "daemon_down",
        error: err instanceof Error ? err.message : String(err),
        logTail: logTail || undefined,
      };
    }
    if (!(await tryReach())) {
      const logTail = await tailDaemonLog(uin);
      return {
        ok: false,
        state: "daemon_down",
        error: "daemon 启动后仍不可达",
        logTail: logTail || undefined,
      };
    }
    return null;
  }

  if (await tryReach()) return null;

  try {
    await forceStopDaemon(uin);
    await spawnDaemon(uin);
  } catch (err) {
    const logTail = await tailDaemonLog(uin);
    return {
      ok: false,
      state: "daemon_down",
      error: err instanceof Error ? err.message : String(err),
      logTail: logTail || undefined,
    };
  }

  if (!(await tryReach())) {
    const logTail = await tailDaemonLog(uin);
    return {
      ok: false,
      state: "daemon_down",
      error: "强制重启后 daemon 仍不可达（可能 IPC 认证失败或端口冲突）",
      logTail: logTail || undefined,
    };
  }

  return null;
}

export async function createLocalDaemon(
  input: CreateLocalInput,
): Promise<LoginStateView> {
  const config = await loadConfig();
  const existing = getAccountConfig(config, input.uin);
  setAccountConfig(config, input.uin, {
    platform: input.platform ?? existing?.platform ?? 1,
    signApiUrl: input.signApiUrl ?? existing?.signApiUrl ?? "",
    ver: input.ver ?? existing?.ver,
    logLevel: existing?.logLevel,
  });
  await saveConfig(config);

  const boot = await ensureDaemonHealthy(input.uin);
  if (boot) return boot;
  return getLoginState(input.uin);
}

export async function reloginLocalDaemon(uin: number): Promise<LoginStateView> {
  const config = await loadConfig();
  if (!getAccountConfig(config, uin)) {
    return {
      ok: false,
      state: "config_missing",
      error: `账号 ${uin} 缺少本地配置，无法恢复登录`,
    };
  }
  const boot = await ensureDaemonHealthy(uin);
  if (boot) return boot;
  return getLoginState(uin);
}

export async function discoverLocalInstances(): Promise<DiscoveredInstance[]> {
  const config = await loadConfig();
  const out: DiscoveredInstance[] = [];
  for (const key of Object.keys(config.accounts)) {
    const uin = Number(key);
    if (!Number.isInteger(uin) || uin <= 0) continue;
    const status = await probeInstanceStatus(uin);
    out.push({
      uin,
      hasConfig: true,
      daemonRunning: status.state !== "daemon_down" && status.state !== "offline",
      status,
    });
  }
  return out;
}

export function hostAgentVersion(): string {
  return PACKAGE_VERSION;
}
