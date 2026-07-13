import type { IcqqConfig } from "./config.js";
import {
  flattenAlertProviders,
  getAlertProvidersMap,
  type AlertProvidersMap,
} from "./alert-provider-config.js";

const DEFAULT_WAITING_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export type ResolvedAlertsConfig = {
  enabled: boolean;
  cooldownMs: number;
  providers: ReturnType<typeof flattenAlertProviders>;
};

export type ResolvedLoginConfig = {
  http: { host: string; port: number; publicUrl?: string };
  waitingTimeoutMs: number;
  submitRateLimit: { windowMs: number; maxAttempts: number };
};

export function resolveAlertsConfig(config: IcqqConfig): ResolvedAlertsConfig {
  const alerts = config.alerts ?? {};
  return {
    enabled: alerts.enabled ?? false,
    cooldownMs: alerts.cooldownMs ?? 15 * 60 * 1000,
    providers: flattenAlertProviders(alerts.providers),
  };
}

export function resolveLoginConfig(config: IcqqConfig): ResolvedLoginConfig {
  const login = config.login ?? {};
  return {
    http: {
      host: login.http?.host ?? "127.0.0.1",
      port: login.http?.port ?? 0,
      publicUrl: login.http?.publicUrl,
    },
    waitingTimeoutMs: login.waitingTimeoutMs ?? DEFAULT_WAITING_TIMEOUT_MS,
    submitRateLimit: {
      windowMs: login.submitRateLimit?.windowMs ?? 60_000,
      maxAttempts: login.submitRateLimit?.maxAttempts ?? 10,
    },
  };
}

function ensureProvidersMap(config: IcqqConfig): AlertProvidersMap {
  config.alerts ??= {};
  const map = getAlertProvidersMap(config);
  config.alerts.providers = map;
  return map;
}

/** 从环境变量合并 alert provider（headless 部署） */
export function mergeAlertsFromEnv(config: IcqqConfig): void {
  const map = ensureProvidersMap(config);

  const bark = process.env.ICQQ_ALERT_BARK_KEY?.trim();
  if (bark) {
    map.bark = {
      ...map.bark,
      deviceKey: bark,
      server: process.env.ICQQ_ALERT_BARK_SERVER?.trim() ?? map.bark?.server,
    };
  }
  const wecom = process.env.ICQQ_ALERT_WECOM_WEBHOOK_KEY?.trim();
  if (wecom) map.wecom = { ...map.wecom, webhookKey: wecom };
  const dingtalk = process.env.ICQQ_ALERT_DINGTALK_WEBHOOK?.trim();
  if (dingtalk) {
    map.dingtalk = {
      ...map.dingtalk,
      webhook: dingtalk,
      secret: process.env.ICQQ_ALERT_DINGTALK_SECRET?.trim() ?? map.dingtalk?.secret,
    };
  }
  const feishu = process.env.ICQQ_ALERT_FEISHU_WEBHOOK?.trim();
  if (feishu) {
    map.feishu = {
      ...map.feishu,
      webhook: feishu,
      secret: process.env.ICQQ_ALERT_FEISHU_SECRET?.trim() ?? map.feishu?.secret,
    };
  }
  const tgToken = process.env.ICQQ_ALERT_TELEGRAM_BOT_TOKEN?.trim();
  const tgChat = process.env.ICQQ_ALERT_TELEGRAM_CHAT_ID?.trim();
  if (tgToken && tgChat) {
    map.telegram = { ...map.telegram, botToken: tgToken, chatId: tgChat };
  }
  const pushdeer = process.env.ICQQ_ALERT_PUSHDEER_KEY?.trim();
  if (pushdeer) {
    map.pushdeer = {
      ...map.pushdeer,
      pushkey: pushdeer,
      server: process.env.ICQQ_ALERT_PUSHDEER_SERVER?.trim() ?? map.pushdeer?.server,
    };
  }
  const sct = process.env.ICQQ_ALERT_SERVERCHAN_KEY?.trim();
  if (sct) map.serverchan = { ...map.serverchan, sendkey: sct };
  const generic = process.env.ICQQ_ALERT_WEBHOOK_URL?.trim();
  if (generic) map.generic = { ...map.generic, url: generic };

  const peerHost = process.env.ICQQ_ALERT_PEER_HOST?.trim();
  const peerPort = process.env.ICQQ_ALERT_PEER_PORT?.trim();
  const peerToken = process.env.ICQQ_ALERT_PEER_TOKEN?.trim();
  const peerUserId = process.env.ICQQ_ALERT_PEER_USER_ID?.trim();
  const peerGroupId = process.env.ICQQ_ALERT_PEER_GROUP_ID?.trim();
  if (peerHost || peerPort || peerToken || peerUserId || peerGroupId) {
    map.peer = {
      ...map.peer,
      ...(peerHost ? { host: peerHost } : {}),
      ...(peerPort ? { port: Number(peerPort) } : {}),
      ...(peerToken ? { token: peerToken } : {}),
      ...(peerUserId ? { userId: Number(peerUserId) } : {}),
      ...(peerGroupId ? { groupId: Number(peerGroupId) } : {}),
    };
  }

  if (process.env.ICQQ_ALERTS_ENABLED === "1" || process.env.ICQQ_ALERTS_ENABLED === "true") {
    config.alerts!.enabled = true;
  }
}

export function buildLoginPublicUrl(config: IcqqConfig, port: number): string | undefined {
  const publicUrl = resolveLoginConfig(config).http.publicUrl?.replace(/\/$/, "");
  if (publicUrl) return `${publicUrl}/login`;
  if (resolveLoginConfig(config).http.host === "127.0.0.1" && port > 0) {
    return `http://127.0.0.1:${port}/login`;
  }
  return undefined;
}
