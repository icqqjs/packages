import type { HostAgent } from "./types.js";
import {
  createLocalDaemon,
  discoverLocalInstances,
  getLoginState,
  hostAgentVersion,
  ipcRequest as ipcRequestLocal,
  probeInstanceStatus,
  reloginLocalDaemon,
  sendLoginSms,
  submitLogin,
  tailDaemonLog,
} from "./instances.js";

/** 本机 host-agent：进程内直接调用 icqq supervisor / IPC */
export class HostAgentLocal implements HostAgent {
  health() {
    return Promise.resolve({ ok: true, version: hostAgentVersion() });
  }

  discoverInstances() {
    return discoverLocalInstances();
  }

  createLocal(input: Parameters<typeof createLocalDaemon>[0]) {
    return createLocalDaemon(input);
  }

  relogin(uin: number) {
    return reloginLocalDaemon(uin);
  }

  getStatus(uin: number) {
    return probeInstanceStatus(uin);
  }

  getLoginState(uin: number) {
    return getLoginState(uin);
  }

  submitLogin(uin: number, kind: string, value?: string) {
    return submitLogin(uin, kind, value);
  }

  sendLoginSms(uin: number) {
    return sendLoginSms(uin);
  }

  tailLogs(uin: number, lines = 40) {
    return tailDaemonLog(uin, lines);
  }

  ipcRequest(uin: number, action: string, params?: Record<string, unknown>) {
    return ipcRequestLocal(uin, action, params);
  }
}

export const hostAgentLocal = new HostAgentLocal();
