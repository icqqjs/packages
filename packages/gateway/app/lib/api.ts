"use client";

export type Me = {
  id: string;
  username: string;
  role: "admin" | "user";
  mustChangePassword?: boolean;
};

export type Host = {
  id: string;
  name: string;
  kind: "local" | "remote";
  base_url: string;
  is_local: boolean;
  proxy_data_plane?: boolean;
  status: "online" | "offline" | "unknown";
  instance_count: number;
  last_seen_at: string | null;
  created_at: string;
};

export type Instance = {
  id: string;
  host_id: string | null;
  uin: number;
  kind: "local" | "remote";
  label: string | null;
  created_at: string;
};

export type ApiToken = {
  id: string;
  label: string | null;
  masked: string;
  created_at: string;
};

export type InstanceState =
  | "online"
  | "login_waiting"
  | "offline"
  | "unknown"
  | "config_missing"
  | "daemon_down";

export type LoginPhase =
  | "connecting"
  | "qrcode"
  | "slider"
  | "device"
  | "auth"
  | "online"
  | "error";

export type LoginStateView = {
  ok?: boolean;
  state: InstanceState;
  phase?: LoginPhase;
  detail?: string;
  online?: boolean;
  nickname?: string;
  qrcodeDataUrl?: string;
  sliderUrl?: string;
  deviceUrl?: string;
  devicePhone?: string;
  authUrl?: string;
  lastError?: string;
  error?: string;
  logTail?: string;
};

export type PairingInfo = {
  code: string;
  master_url: string;
  expires_at: string;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `请求失败 (${res.status})`);
  }
  return (await res.json()) as T;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  return json<T>(
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: body != null ? JSON.stringify(body) : undefined,
    }),
  );
}

export const fetcher = <T>(url: string): Promise<T> =>
  fetch(url, { credentials: "same-origin" }).then((r) => json<T>(r));

export function register(username: string, password: string): Promise<Me> {
  return post<Me>("/api/register", { username, password });
}

export function login(username: string, password: string): Promise<Me> {
  return post<Me>("/api/login", { username, password });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return post("/api/me/password", { currentPassword, newPassword });
}

export function isRegistrationEnabled(): Promise<{ enabled: boolean }> {
  return fetcher("/api/register-enabled");
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
}

export function listHosts(): Promise<Host[]> {
  return fetcher<Host[]>("/api/hosts");
}

export function createPairing(): Promise<PairingInfo> {
  return post<PairingInfo>("/api/hosts/pairing");
}

export async function deleteHost(id: string): Promise<void> {
  await json(
    await fetch(`/api/hosts/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    }),
  );
}

export function syncHost(id: string): Promise<{ synced: number[] }> {
  return post<{ synced: number[] }>(`/api/hosts/${id}/sync`);
}

export function setHostProxyDataPlane(
  id: string,
  enabled: boolean,
): Promise<{ ok: boolean; proxy_data_plane: boolean }> {
  return fetch(`/api/hosts/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ proxy_data_plane: enabled }),
  }).then((r) => json(r));
}

export function createLocalOnHost(
  hostId: string,
  input: {
    uin: number;
    platform?: number;
    signApiUrl?: string;
    ver?: string;
    label?: string;
  },
): Promise<LoginStateView & { id: string; uin: number }> {
  return post(`/api/hosts/${hostId}/instances/local`, input);
}

export async function deleteInstance(id: string): Promise<void> {
  await json(
    await fetch(`/api/instances/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    }),
  );
}

export function getInstanceStatus(id: string): Promise<LoginStateView> {
  return fetcher<LoginStateView>(`/api/instances/${id}/status`);
}

export function getLoginState(id: string): Promise<LoginStateView> {
  return fetcher<LoginStateView>(`/api/instances/${id}/login`);
}

export function submitLogin(
  id: string,
  kind: string,
  value?: string,
): Promise<{ ok: boolean; error?: string }> {
  return post(`/api/instances/${id}/login/submit`, { kind, value });
}

export function sendLoginSms(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  return post(`/api/instances/${id}/login/sms`);
}

export function reloginInstance(id: string): Promise<LoginStateView> {
  return post(`/api/instances/${id}/relogin`);
}

export function fetchInstanceLogs(id: string, lines = 80): Promise<string> {
  return fetch(`/api/instances/${id}/logs?lines=${lines}`, {
    credentials: "same-origin",
  }).then((r) => r.text());
}

export function listTokens(): Promise<ApiToken[]> {
  return fetcher<ApiToken[]>("/api/tokens");
}

export function createToken(label?: string): Promise<{ token: string }> {
  return post<{ token: string }>("/api/tokens", { label });
}

export async function deleteToken(id: string): Promise<void> {
  await json(
    await fetch(`/api/tokens/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    }),
  );
}

export function approvePairingRemote(input: {
  master_url: string;
  code: string;
  remote_base_url?: string;
  name?: string;
}): Promise<{ ok: boolean; hostToken: string; remoteBaseUrl: string }> {
  return post("/host-agent/pair/approve", {
    master_url: input.master_url,
    code: input.code,
    remote_base_url: input.remote_base_url,
    name: input.name,
  });
}
