/**
 * config get 键解析与展示。
 */
import type { IcqqConfig } from "./config.js";
import {
  resolveMcpConfig,
  resolveMcpConfigForUin,
  resolveRpcConfig,
  resolveRpcConfigForUin,
} from "./config.js";
import {
  resolveAlertsConfig,
  resolveLoginConfig,
} from "./alert-config.js";
import {
  CONFIG_SET_KEYS,
  isAccountScopedConfigKey,
  type ConfigSetKey,
} from "./config-set.js";
import {
  getAlertProviderFieldValue,
  listAlertProviderConfigKeys,
  parseAlertProviderConfigKey,
} from "./alert-provider-config.js";

/** 与 config set 相同的点分键 */
export const CONFIG_GET_DOT_KEYS = CONFIG_SET_KEYS.filter(
  (k) => k.includes("."),
) as ConfigSetKey[];

const TOP_LEVEL_GET_KEYS = ["currentUin", "webhookUrl", "notifyEnabled", "accounts"] as const;

/** 可单独查询的分组前缀 */
export const CONFIG_GET_GROUPS = ["mcp", "rpc", "alerts", "login"] as const;

export type ConfigGetGroup = (typeof CONFIG_GET_GROUPS)[number];

export const CONFIG_GET_KEYS = [
  ...TOP_LEVEL_GET_KEYS,
  ...CONFIG_GET_DOT_KEYS,
  "mcp.plugins",
] as const;

export type ConfigGetKey = (typeof CONFIG_GET_KEYS)[number];

export type ConfigGetQuery = ConfigGetKey | ConfigGetGroup;

function unset(label = "(未设置)"): string {
  return label;
}

function formatBool(v: boolean): string {
  return String(v);
}

function formatPlugins(plugins: string[] | undefined): string {
  if (!plugins?.length) return "(无)";
  return plugins.join(", ");
}

function formatPort(port: number): string {
  return port === 0 ? "0 (自动分配)" : String(port);
}

function formatToken(token: string | undefined): string {
  return token ?? unset();
}

function formatAlertProviderField(config: IcqqConfig, key: string): string {
  const parsed = parseAlertProviderConfigKey(key);
  if (!parsed) return unset();
  const value = getAlertProviderFieldValue(config, parsed.type, parsed.field);
  if (value === undefined || value === "") return unset();
  if (typeof value === "boolean") return formatBool(value);
  return String(value);
}

function accountOverrideNote(
  config: IcqqConfig,
  uin: number,
  key: ConfigSetKey,
): string {
  if (!isAccountScopedConfigKey(key)) return "";
  const acc = config.accounts[String(uin)];
  if (!acc) return "";

  switch (key) {
    case "mcp.enabled":
      return acc.mcp?.enabled !== undefined ? " [账号覆盖]" : "";
    case "mcp.http.host":
      return acc.mcp?.http?.host !== undefined ? " [账号覆盖]" : "";
    case "mcp.http.port":
      return acc.mcp?.http?.port !== undefined ? " [账号覆盖]" : "";
    case "mcp.http.token":
      return acc.mcp?.http?.token !== undefined ? " [账号覆盖]" : "";
    case "rpc.enabled":
      return acc.rpc?.enabled !== undefined ? " [账号覆盖]" : "";
    case "rpc.host":
      return acc.rpc?.host !== undefined ? " [账号覆盖]" : "";
    case "rpc.port":
      return acc.rpc?.port !== undefined ? " [账号覆盖]" : "";
    default:
      return "";
  }
}

function resolveScopedMcpRpc(config: IcqqConfig, uin?: number) {
  if (uin !== undefined) {
    return {
      mcp: resolveMcpConfigForUin(config, uin),
      rpc: resolveRpcConfigForUin(config, uin),
    };
  }
  return {
    mcp: resolveMcpConfig(config.mcp),
    rpc: resolveRpcConfig(config.rpc),
  };
}

/** 列出全部配置项（摘要）；指定 uin 时 mcp/rpc 为合并后的生效值 */
export function listAllConfigEntries(
  config: IcqqConfig,
  uin?: number,
): [string, string][] {
  const { mcp, rpc } = resolveScopedMcpRpc(config, uin);
  const alerts = resolveAlertsConfig(config);
  const login = resolveLoginConfig(config);
  const suffix = (key: ConfigSetKey) =>
    uin !== undefined ? accountOverrideNote(config, uin, key) : "";

  const entries: [string, string][] = [
    ["currentUin", config.currentUin != null ? String(config.currentUin) : unset()],
    ["webhookUrl", config.webhookUrl || unset()],
    ["notifyEnabled", formatBool(config.notifyEnabled ?? false)],
    [
      "accounts",
      Object.keys(config.accounts).length > 0
        ? Object.keys(config.accounts).join(", ")
        : "(无)",
    ],
    ["mcp.enabled", formatBool(mcp.enabled) + suffix("mcp.enabled")],
    ["mcp.http.host", mcp.http.host + suffix("mcp.http.host")],
    ["mcp.http.port", formatPort(mcp.http.port) + suffix("mcp.http.port")],
    ["mcp.http.token", formatToken(mcp.http.token) + suffix("mcp.http.token")],
    ["mcp.plugins", formatPlugins(mcp.plugins)],
    ["rpc.enabled", formatBool(rpc.enabled) + suffix("rpc.enabled")],
    ["rpc.host", rpc.host + suffix("rpc.host")],
    ["rpc.port", formatPort(rpc.port) + suffix("rpc.port")],
    ["alerts.enabled", formatBool(alerts.enabled)],
    ["alerts.cooldownMs", String(alerts.cooldownMs)],
    ...listAlertProviderConfigKeys().map(
      (k: string) => [k, formatAlertProviderField(config, k)] as [string, string],
    ),
    ["login.http.host", login.http.host],
    ["login.http.port", formatPort(login.http.port)],
    ["login.http.publicUrl", login.http.publicUrl ?? unset()],
    ["login.waitingTimeoutMs", String(login.waitingTimeoutMs)],
    ["login.submitRateLimit.windowMs", String(login.submitRateLimit.windowMs)],
    ["login.submitRateLimit.maxAttempts", String(login.submitRateLimit.maxAttempts)],
  ];

  if (uin !== undefined) {
    entries.unshift([`scope`, `账号 ${uin}（mcp/rpc 为全局默认 + 账号覆盖合并）`]);
  }

  return entries;
}

/** 列出 mcp / rpc 分组下所有项 */
export function listGroupConfigEntries(
  config: IcqqConfig,
  group: ConfigGetGroup,
  uin?: number,
): [string, string][] {
  return listAllConfigEntries(config, uin).filter(([k]) => k.startsWith(`${group}.`));
}

/** 读取单个配置项的展示值 */
export function getConfigDisplayValue(
  config: IcqqConfig,
  key: ConfigGetKey,
  uin?: number,
): string {
  const { mcp, rpc } = resolveScopedMcpRpc(config, uin);
  const alerts = resolveAlertsConfig(config);
  const login = resolveLoginConfig(config);
  const suffix = uin !== undefined && isAccountScopedConfigKey(key as ConfigSetKey)
    ? accountOverrideNote(config, uin, key as ConfigSetKey)
    : "";

  const providerKey = parseAlertProviderConfigKey(key);
  if (providerKey) {
    return formatAlertProviderField(config, key);
  }

  switch (key) {
    case "currentUin":
      return config.currentUin != null ? String(config.currentUin) : unset();
    case "webhookUrl":
      return config.webhookUrl || unset();
    case "notifyEnabled":
      return formatBool(config.notifyEnabled ?? false);
    case "accounts":
      return Object.keys(config.accounts).length > 0
        ? JSON.stringify(config.accounts, null, 2)
        : "(无)";
    case "mcp.enabled":
      return formatBool(mcp.enabled) + suffix;
    case "mcp.http.host":
      return mcp.http.host + suffix;
    case "mcp.http.port":
      return formatPort(mcp.http.port) + suffix;
    case "mcp.http.token":
      return formatToken(mcp.http.token) + suffix;
    case "mcp.plugins":
      return formatPlugins(mcp.plugins);
    case "rpc.enabled":
      return formatBool(rpc.enabled) + suffix;
    case "rpc.host":
      return rpc.host + suffix;
    case "rpc.port":
      return formatPort(rpc.port) + suffix;
    case "alerts.enabled":
      return formatBool(alerts.enabled);
    case "alerts.cooldownMs":
      return String(alerts.cooldownMs);
    case "login.http.host":
      return login.http.host;
    case "login.http.port":
      return formatPort(login.http.port);
    case "login.http.publicUrl":
      return login.http.publicUrl ?? unset();
    case "login.waitingTimeoutMs":
      return String(login.waitingTimeoutMs);
    case "login.submitRateLimit.windowMs":
      return String(login.submitRateLimit.windowMs);
    case "login.submitRateLimit.maxAttempts":
      return String(login.submitRateLimit.maxAttempts);
    default:
      return "";
  }
}

export function isConfigGetKey(key: string): key is ConfigGetKey {
  if ((CONFIG_GET_KEYS as readonly string[]).includes(key)) return true;
  return parseAlertProviderConfigKey(key) !== null;
}

export function isConfigGetGroup(key: string): key is ConfigGetGroup {
  return (CONFIG_GET_GROUPS as readonly string[]).includes(key);
}

export function isConfigGetQuery(key: string): key is ConfigGetQuery {
  return isConfigGetKey(key) || isConfigGetGroup(key);
}

export function availableConfigGetKeysHint(): string {
  return [...CONFIG_GET_KEYS, ...listAlertProviderConfigKeys(), ...CONFIG_GET_GROUPS].join(
    ", ",
  );
}
