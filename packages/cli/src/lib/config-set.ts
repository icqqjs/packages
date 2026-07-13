/**
 * config set 键解析与赋值。
 */
import type { AccountConfig, IcqqConfig } from "./config.js";
import type { AlertProviderType } from "@/daemon/alert/types.js";
import {
  getAlertProvidersMap,
  isAlertProviderEnabledField,
  listAlertProviderConfigKeys,
  parseAlertProviderConfigKey,
  type AlertProvidersMap,
} from "./alert-provider-config.js";

const TOP_LEVEL_KEYS = ["currentUin", "webhookUrl", "notifyEnabled"] as const;

const NESTED_KEYS = [
  "mcp.enabled",
  "mcp.http.host",
  "mcp.http.port",
  "mcp.http.token",
  "rpc.enabled",
  "rpc.host",
  "rpc.port",
  "alerts.enabled",
  "alerts.cooldownMs",
  "login.http.host",
  "login.http.port",
  "login.http.publicUrl",
  "login.waitingTimeoutMs",
  "login.submitRateLimit.windowMs",
  "login.submitRateLimit.maxAttempts",
] as const;

export const CONFIG_SET_KEYS = [...TOP_LEVEL_KEYS, ...NESTED_KEYS] as const;

export type ConfigSetKey = (typeof CONFIG_SET_KEYS)[number];

export const ACCOUNT_SCOPED_CONFIG_KEYS = NESTED_KEYS;

function parseBool(raw: string): boolean {
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error("布尔值必须为 true/false 或 1/0");
}

function parsePort(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error("端口必须为 0–65535 的整数");
  }
  return n;
}

export function isAccountScopedConfigKey(key: ConfigSetKey): boolean {
  return (ACCOUNT_SCOPED_CONFIG_KEYS as readonly string[]).includes(key);
}

function parsePositiveInt(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} 必须为正整数`);
  }
  return n;
}

function parseFixedConfigSetValue(key: ConfigSetKey, raw: string): unknown {
  switch (key) {
    case "currentUin": {
      const n = Number(raw);
      if (Number.isNaN(n) || n <= 0) throw new Error("currentUin 必须为正整数");
      return n;
    }
    case "notifyEnabled":
    case "mcp.enabled":
    case "rpc.enabled":
    case "alerts.enabled":
      return parseBool(raw);
    case "mcp.http.port":
    case "rpc.port":
    case "login.http.port":
      return parsePort(raw);
    case "alerts.cooldownMs":
    case "login.waitingTimeoutMs":
    case "login.submitRateLimit.windowMs":
    case "login.submitRateLimit.maxAttempts":
      return parsePositiveInt(raw, key);
    case "webhookUrl":
    case "mcp.http.host":
    case "mcp.http.token":
    case "rpc.host":
    case "login.http.host":
    case "login.http.publicUrl":
      return raw;
    default:
      return raw;
  }
}

export function parseConfigSetValue(key: string, raw: string): unknown {
  const providerKey = parseAlertProviderConfigKey(key);
  if (providerKey) {
    if (isAlertProviderEnabledField(providerKey.field)) {
      return parseBool(raw);
    }
    if (
      providerKey.type === "peer" &&
      (providerKey.field === "port" ||
        providerKey.field === "userId" ||
        providerKey.field === "groupId")
    ) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`${key} 必须为正整数`);
      }
      return n;
    }
    return raw;
  }
  if (!isFixedConfigSetKey(key)) {
    throw new Error(`未知配置项: ${key}`);
  }
  return parseFixedConfigSetValue(key, raw);
}

function isFixedConfigSetKey(key: string): key is ConfigSetKey {
  return (CONFIG_SET_KEYS as readonly string[]).includes(key);
}

export function isConfigSetKey(key: string): boolean {
  return isFixedConfigSetKey(key) || parseAlertProviderConfigKey(key) !== null;
}

export function availableConfigSetKeysHint(): string {
  return [...CONFIG_SET_KEYS, ...listAlertProviderConfigKeys()].join(", ");
}

function ensureAccountEntry(config: IcqqConfig, uin: number): AccountConfig {
  const key = String(uin);
  const existing = config.accounts[key];
  if (existing) return existing;
  const shell: AccountConfig = { platform: 0, signApiUrl: "" };
  config.accounts[key] = shell;
  return shell;
}

function ensureAlertProvidersMap(config: IcqqConfig): AlertProvidersMap {
  config.alerts ??= {};
  config.alerts.providers ??= {};
  return config.alerts.providers;
}

function applyAlertProviderField(
  config: IcqqConfig,
  type: AlertProviderType,
  field: string,
  value: unknown,
): void {
  const map = ensureAlertProvidersMap(config);
  const entry = (map[type] ??= {}) as Record<string, unknown>;
  entry[field] = value;
}

function applyMcpRpcToScope(
  scope: {
    mcp?: IcqqConfig["mcp"];
    rpc?: IcqqConfig["rpc"];
  },
  key: ConfigSetKey,
  value: unknown,
): void {
  switch (key) {
    case "mcp.enabled":
      scope.mcp ??= {};
      scope.mcp.enabled = value as boolean;
      return;
    case "mcp.http.host":
      scope.mcp ??= {};
      scope.mcp.http ??= { host: "127.0.0.1", port: 0 };
      scope.mcp.http.host = value as string;
      return;
    case "mcp.http.port":
      scope.mcp ??= {};
      scope.mcp.http ??= { host: "127.0.0.1", port: 0 };
      scope.mcp.http.port = value as number;
      return;
    case "mcp.http.token":
      scope.mcp ??= {};
      scope.mcp.http ??= { host: "127.0.0.1", port: 0 };
      scope.mcp.http.token = value as string;
      return;
    case "rpc.enabled":
      scope.rpc ??= {};
      scope.rpc.enabled = value as boolean;
      return;
    case "rpc.host":
      scope.rpc ??= {};
      scope.rpc.host = value as string;
      return;
    case "rpc.port":
      scope.rpc ??= {};
      scope.rpc.port = value as number;
      return;
    default:
      return;
  }
}

function applyAlertsLoginToConfig(
  config: IcqqConfig,
  key: ConfigSetKey,
  value: unknown,
): void {
  switch (key) {
    case "alerts.enabled":
      config.alerts ??= {};
      config.alerts.enabled = value as boolean;
      return;
    case "alerts.cooldownMs":
      config.alerts ??= {};
      config.alerts.cooldownMs = value as number;
      return;
    case "login.http.host":
      config.login ??= {};
      config.login.http ??= {};
      config.login.http.host = value as string;
      return;
    case "login.http.port":
      config.login ??= {};
      config.login.http ??= {};
      config.login.http.port = value as number;
      return;
    case "login.http.publicUrl":
      config.login ??= {};
      config.login.http ??= {};
      config.login.http.publicUrl = value as string;
      return;
    case "login.waitingTimeoutMs":
      config.login ??= {};
      config.login.waitingTimeoutMs = value as number;
      return;
    case "login.submitRateLimit.windowMs":
      config.login ??= {};
      config.login.submitRateLimit ??= {};
      config.login.submitRateLimit.windowMs = value as number;
      return;
    case "login.submitRateLimit.maxAttempts":
      config.login ??= {};
      config.login.submitRateLimit ??= {};
      config.login.submitRateLimit.maxAttempts = value as number;
      return;
    default:
      return;
  }
}

/**
 * 写入配置。指定 uin 时 mcp/rpc 写入账号覆盖，其余键仍写全局。
 */
export function applyConfigSet(
  config: IcqqConfig,
  key: string,
  value: unknown,
  uin?: number,
): void {
  const providerKey = parseAlertProviderConfigKey(key);
  if (providerKey) {
    if (uin !== undefined) {
      throw new Error(`${key} 为全局配置，请去掉 -u 再设置`);
    }
    applyAlertProviderField(config, providerKey.type, providerKey.field, value);
    return;
  }

  if (!isFixedConfigSetKey(key)) {
    throw new Error(`未知配置项: ${key}`);
  }

  if (uin !== undefined && isAccountScopedConfigKey(key)) {
    const account = ensureAccountEntry(config, uin);
    applyMcpRpcToScope(account, key, value);
    return;
  }

  if (uin !== undefined && !isAccountScopedConfigKey(key)) {
    throw new Error(`${key} 为全局配置，请去掉 -u 再设置`);
  }

  switch (key) {
    case "currentUin":
      config.currentUin = value as number;
      return;
    case "webhookUrl":
      config.webhookUrl = value as string;
      return;
    case "notifyEnabled":
      config.notifyEnabled = value as boolean;
      return;
    default:
      if (key.startsWith("alerts.") || key.startsWith("login.")) {
        applyAlertsLoginToConfig(config, key, value);
        return;
      }
      applyMcpRpcToScope(config, key, value);
  }
}
