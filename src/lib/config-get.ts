/**
 * config get 键解析与展示。
 */
import type { IcqqConfig } from "./config.js";
import { resolveMcpConfig, resolveRpcConfig } from "./config.js";
import { CONFIG_SET_KEYS, type ConfigSetKey } from "./config-set.js";

/** 与 config set 相同的点分键 */
export const CONFIG_GET_DOT_KEYS = CONFIG_SET_KEYS.filter(
  (k) => k.includes("."),
) as ConfigSetKey[];

const TOP_LEVEL_GET_KEYS = ["currentUin", "webhookUrl", "notifyEnabled", "accounts"] as const;

/** 可单独查询的分组前缀 */
export const CONFIG_GET_GROUPS = ["mcp", "rpc"] as const;

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

/** 列出全部配置项（摘要） */
export function listAllConfigEntries(config: IcqqConfig): [string, string][] {
  const mcp = resolveMcpConfig(config.mcp);
  const rpc = resolveRpcConfig(config.rpc);

  return [
    ["currentUin", config.currentUin != null ? String(config.currentUin) : unset()],
    ["webhookUrl", config.webhookUrl || unset()],
    ["notifyEnabled", formatBool(config.notifyEnabled ?? false)],
    [
      "accounts",
      Object.keys(config.accounts).length > 0
        ? Object.keys(config.accounts).join(", ")
        : "(无)",
    ],
    ["mcp.enabled", formatBool(mcp.enabled)],
    ["mcp.http.host", mcp.http.host],
    ["mcp.http.port", formatPort(mcp.http.port)],
    ["mcp.http.token", formatToken(mcp.http.token)],
    ["mcp.plugins", formatPlugins(mcp.plugins)],
    ["rpc.enabled", formatBool(rpc.enabled)],
    ["rpc.host", rpc.host],
    ["rpc.port", formatPort(rpc.port)],
  ];
}

/** 列出 mcp / rpc 分组下所有项 */
export function listGroupConfigEntries(
  config: IcqqConfig,
  group: ConfigGetGroup,
): [string, string][] {
  return listAllConfigEntries(config).filter(([k]) => k.startsWith(`${group}.`));
}

/** 读取单个配置项的展示值 */
export function getConfigDisplayValue(config: IcqqConfig, key: ConfigGetKey): string {
  const mcp = resolveMcpConfig(config.mcp);
  const rpc = resolveRpcConfig(config.rpc);

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
      return formatBool(mcp.enabled);
    case "mcp.http.host":
      return mcp.http.host;
    case "mcp.http.port":
      return formatPort(mcp.http.port);
    case "mcp.http.token":
      return formatToken(mcp.http.token);
    case "mcp.plugins":
      return formatPlugins(mcp.plugins);
    case "rpc.enabled":
      return formatBool(rpc.enabled);
    case "rpc.host":
      return rpc.host;
    case "rpc.port":
      return formatPort(rpc.port);
    default:
      return "";
  }
}

export function isConfigGetKey(key: string): key is ConfigGetKey {
  return (CONFIG_GET_KEYS as readonly string[]).includes(key);
}

export function isConfigGetGroup(key: string): key is ConfigGetGroup {
  return (CONFIG_GET_GROUPS as readonly string[]).includes(key);
}

export function isConfigGetQuery(key: string): key is ConfigGetQuery {
  return isConfigGetKey(key) || isConfigGetGroup(key);
}

export function availableConfigGetKeysHint(): string {
  return [...CONFIG_GET_KEYS, ...CONFIG_GET_GROUPS].join(", ");
}
