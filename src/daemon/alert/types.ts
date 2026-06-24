export type AlertKind =
  | "daemon_ready"
  | "login_waiting"
  | "offline_network"
  | "offline_kickoff"
  | "online";

export type AlertProviderType =
  | "bark"
  | "wecom"
  | "dingtalk"
  | "feishu"
  | "telegram"
  | "pushdeer"
  | "serverchan"
  | "generic";

export type AlertProviderConfig =
  | { type: "bark"; deviceKey: string; server?: string; enabled?: boolean }
  | { type: "wecom"; webhookKey: string; enabled?: boolean }
  | { type: "dingtalk"; webhook: string; secret?: string; enabled?: boolean }
  | { type: "feishu"; webhook: string; secret?: string; enabled?: boolean }
  | { type: "telegram"; botToken: string; chatId: string; enabled?: boolean }
  | { type: "pushdeer"; pushkey: string; server?: string; enabled?: boolean }
  | { type: "serverchan"; sendkey: string; enabled?: boolean }
  | { type: "generic"; url: string; enabled?: boolean };

/** config.json 中按 type 分组的告警渠道（CLI: alerts.providers.<type>.<field>） */
export type AlertProvidersMap = {
  bark?: { deviceKey?: string; server?: string; enabled?: boolean };
  wecom?: { webhookKey?: string; enabled?: boolean };
  dingtalk?: { webhook?: string; secret?: string; enabled?: boolean };
  feishu?: { webhook?: string; secret?: string; enabled?: boolean };
  telegram?: { botToken?: string; chatId?: string; enabled?: boolean };
  pushdeer?: { pushkey?: string; server?: string; enabled?: boolean };
  serverchan?: { sendkey?: string; enabled?: boolean };
  generic?: { url?: string; enabled?: boolean };
};

export type AlertsConfig = {
  enabled?: boolean;
  cooldownMs?: number;
  providers?: AlertProvidersMap;
};

export type LoginHttpConfig = {
  host?: string;
  port?: number;
  publicUrl?: string;
};

export type LoginConfig = {
  http?: LoginHttpConfig;
  waitingTimeoutMs?: number;
  submitRateLimit?: { windowMs?: number; maxAttempts?: number };
};

export type DaemonAlertPayload = {
  uin: number;
  ts: number;
  reason?: string;
  phase?: string;
  loginUrl?: string;
  suggestedCli: string;
  message?: string;
};

export type FormattedAlert = {
  title: string;
  body: string;
  markdown?: string;
};

export type AlertProvider = {
  type: AlertProviderType;
  send(formatted: FormattedAlert, payload: DaemonAlertPayload, kind: AlertKind): Promise<void>;
};
