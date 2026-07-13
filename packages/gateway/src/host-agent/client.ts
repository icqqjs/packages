import type { CreateLocalInput, DiscoveredInstance, HostAgent, LoginStateView } from "./types.js";

/** 远程 host-agent HTTP 客户端 */
export class HostAgentClient implements HostAgent {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `host-agent 请求失败 (${res.status})`);
    }
    return data;
  }

  health() {
    return this.request<{ ok: boolean; version: string }>("GET", "/host-agent/health");
  }

  discoverInstances() {
    return this.request<DiscoveredInstance[]>("GET", "/host-agent/instances");
  }

  createLocal(input: CreateLocalInput) {
    return this.request<LoginStateView>("POST", "/host-agent/instances/local", input);
  }

  relogin(uin: number) {
    return this.request<LoginStateView>("POST", `/host-agent/instances/${uin}/relogin`);
  }

  getStatus(uin: number) {
    return this.request<LoginStateView>("GET", `/host-agent/instances/${uin}/status`);
  }

  getLoginState(uin: number) {
    return this.request<LoginStateView>("GET", `/host-agent/instances/${uin}/login`);
  }

  submitLogin(uin: number, kind: string, value?: string) {
    return this.request<{ ok: boolean; error?: string }>(
      "POST",
      `/host-agent/instances/${uin}/login/submit`,
      { kind, value },
    );
  }

  sendLoginSms(uin: number) {
    return this.request<{ ok: boolean; error?: string }>(
      "POST",
      `/host-agent/instances/${uin}/login/sms`,
    );
  }

  tailLogs(uin: number, lines = 40) {
    return this.request<string>("GET", `/host-agent/instances/${uin}/logs?lines=${lines}`);
  }

  ipcRequest(uin: number, action: string, params?: Record<string, unknown>) {
    return this.request<{ ok: boolean; data?: unknown; error?: string; id?: string }>(
      "POST",
      `/host-agent/instances/${uin}/ipc`,
      { action, params: params ?? {} },
    );
  }

  shellWebSocketUrl(): string {
    const base = this.baseUrl.replace(/^http/, "ws").replace(/\/$/, "");
    return `${base}/host-agent/shell?token=${encodeURIComponent(this.token)}`;
  }
}
