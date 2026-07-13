export type LoginPhase =
  | "connecting"
  | "qrcode"
  | "slider"
  | "device"
  | "auth"
  | "online"
  | "error";

export type InstanceState =
  | "online"
  | "login_waiting"
  | "offline"
  | "unknown"
  | "config_missing"
  | "daemon_down";

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

export type DiscoveredInstance = {
  uin: number;
  hasConfig: boolean;
  daemonRunning: boolean;
  status: LoginStateView;
};

export type CreateLocalInput = {
  uin: number;
  platform?: number;
  signApiUrl?: string;
  ver?: string;
};

export interface HostAgent {
  health(): Promise<{ ok: boolean; version: string }>;
  discoverInstances(): Promise<DiscoveredInstance[]>;
  createLocal(input: CreateLocalInput): Promise<LoginStateView>;
  relogin(uin: number): Promise<LoginStateView>;
  getStatus(uin: number): Promise<LoginStateView>;
  getLoginState(uin: number): Promise<LoginStateView>;
  submitLogin(
    uin: number,
    kind: string,
    value?: string,
  ): Promise<{ ok: boolean; error?: string }>;
  sendLoginSms(uin: number): Promise<{ ok: boolean; error?: string }>;
  tailLogs(uin: number, lines?: number): Promise<string>;
  ipcRequest(
    uin: number,
    action: string,
    params?: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: unknown; error?: string; id?: string }>;
}
