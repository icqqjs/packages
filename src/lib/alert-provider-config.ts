import type {
  AlertProviderConfig,
  AlertProviderType,
  AlertProvidersMap,
} from "@/daemon/alert/types.js";
import type { IcqqConfig } from "./config.js";

export type {
  AlertProvidersMap,
} from "@/daemon/alert/types.js";

export const ALERT_PROVIDER_TYPES = [
  "bark",
  "wecom",
  "dingtalk",
  "feishu",
  "telegram",
  "pushdeer",
  "serverchan",
  "generic",
  "peer",
] as const satisfies readonly AlertProviderType[];

export const ALERT_PROVIDER_FIELDS = {
  bark: ["deviceKey", "server", "enabled"] as const,
  wecom: ["webhookKey", "enabled"] as const,
  dingtalk: ["webhook", "secret", "enabled"] as const,
  feishu: ["webhook", "secret", "enabled"] as const,
  telegram: ["botToken", "chatId", "enabled"] as const,
  pushdeer: ["pushkey", "server", "enabled"] as const,
  serverchan: ["sendkey", "enabled"] as const,
  generic: ["url", "enabled"] as const,
  peer: ["host", "port", "token", "userId", "groupId", "enabled"] as const,
} satisfies Record<AlertProviderType, readonly string[]>;

export function listAlertProviderConfigKeys(): string[] {
  return ALERT_PROVIDER_TYPES.flatMap((type) =>
    ALERT_PROVIDER_FIELDS[type].map((field) => `alerts.providers.${type}.${field}`),
  );
}

export function parseAlertProviderConfigKey(
  key: string,
): { type: AlertProviderType; field: string } | null {
  const match = /^alerts\.providers\.([a-z]+)\.([A-Za-z]+)$/.exec(key);
  if (!match) return null;
  const type = match[1] as AlertProviderType;
  const field = match[2]!;
  if (!ALERT_PROVIDER_TYPES.includes(type)) return null;
  if (!(ALERT_PROVIDER_FIELDS[type] as readonly string[]).includes(field)) {
    return null;
  }
  return { type, field };
}

export function isAlertProviderEnabledField(field: string): boolean {
  return field === "enabled";
}

export function getAlertProvidersMap(config: IcqqConfig): AlertProvidersMap {
  return config.alerts?.providers ?? {};
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return undefined;
}

/** 将 map 展平为运行时 provider 列表（满足必填字段且未禁用） */
export function flattenAlertProviders(
  map: AlertProvidersMap | undefined,
): AlertProviderConfig[] {
  if (!map) return [];

  const out: AlertProviderConfig[] = [];
  const {
    bark,
    wecom,
    dingtalk,
    feishu,
    telegram,
    pushdeer,
    serverchan,
    generic,
    peer,
  } = map;

  if (bark && isNonEmpty(bark.deviceKey) && bark.enabled !== false) {
    out.push({
      type: "bark",
      deviceKey: bark.deviceKey.trim(),
      server: bark.server?.trim(),
    });
  }
  if (wecom && isNonEmpty(wecom.webhookKey) && wecom.enabled !== false) {
    out.push({ type: "wecom", webhookKey: wecom.webhookKey.trim() });
  }
  if (dingtalk && isNonEmpty(dingtalk.webhook) && dingtalk.enabled !== false) {
    out.push({
      type: "dingtalk",
      webhook: dingtalk.webhook.trim(),
      secret: dingtalk.secret?.trim(),
    });
  }
  if (feishu && isNonEmpty(feishu.webhook) && feishu.enabled !== false) {
    out.push({
      type: "feishu",
      webhook: feishu.webhook.trim(),
      secret: feishu.secret?.trim(),
    });
  }
  if (
    telegram &&
    isNonEmpty(telegram.botToken) &&
    isNonEmpty(telegram.chatId) &&
    telegram.enabled !== false
  ) {
    out.push({
      type: "telegram",
      botToken: telegram.botToken.trim(),
      chatId: telegram.chatId.trim(),
    });
  }
  if (pushdeer && isNonEmpty(pushdeer.pushkey) && pushdeer.enabled !== false) {
    out.push({
      type: "pushdeer",
      pushkey: pushdeer.pushkey.trim(),
      server: pushdeer.server?.trim(),
    });
  }
  if (serverchan && isNonEmpty(serverchan.sendkey) && serverchan.enabled !== false) {
    out.push({ type: "serverchan", sendkey: serverchan.sendkey.trim() });
  }
  if (generic && isNonEmpty(generic.url) && generic.enabled !== false) {
    out.push({ type: "generic", url: generic.url.trim() });
  }
  if (peer && peer.enabled !== false) {
    const host = peer.host?.trim();
    const port = positiveInt(peer.port);
    const token = peer.token?.trim();
    const userId = positiveInt(peer.userId);
    const groupId = positiveInt(peer.groupId);
    if (host && port && token && (userId != null || groupId != null)) {
      out.push({
        type: "peer",
        host,
        port,
        token,
        ...(userId != null ? { userId } : {}),
        ...(groupId != null ? { groupId } : {}),
      });
    }
  }
  return out;
}

export function getAlertProviderFieldValue(
  config: IcqqConfig,
  type: AlertProviderType,
  field: string,
): unknown {
  const map = getAlertProvidersMap(config);
  const entry = map[type] as Record<string, unknown> | undefined;
  return entry?.[field];
}
