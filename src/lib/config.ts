/**
 * 配置管理模块。
 *
 * 配置文件位于 ~/.icqq/config.json，权限 0o600。
 * 存储全局设置（当前 UIN、Webhook）和各账号的独立配置。
 *
 * @module config
 */
import type { AlertsConfig, LoginConfig } from "@/daemon/alert/types.js";
import fs from "node:fs/promises";
import { getConfigPath, getIcqqHome } from "./paths.js";

/** 单个账号的配置（platform/signApiUrl 由 login 写入；rpc/mcp 可单独覆盖全局） */
export interface AccountConfig {
  platform: number;
  signApiUrl: string;
  ver?: string;
  logLevel?: string;
  /** 覆盖全局 rpc（未设字段继承 config.rpc） */
  rpc?: Partial<RpcConfig>;
  /** 覆盖全局 mcp（未设字段继承 config.mcp） */
  mcp?: Omit<Partial<McpConfig>, "http"> & { http?: Partial<McpHttpConfig> };
}

/** RPC（TCP 远程连接）配置 */
export interface RpcConfig {
  /** 是否启用 RPC TCP 监听（默认 false） */
  enabled: boolean;
  /** 监听地址（默认 "127.0.0.1"，仅需远程访问时改为 "0.0.0.0"） */
  host: string;
  /** 监听端口（默认 0 = 自动分配） */
  port: number;
}

/** MCP（守护进程内 HTTP）配置 */
export interface McpHttpConfig {
  host: string;
  port: number;
  token?: string;
}

export interface McpConfig {
  /** 是否在守护进程内启动 MCP HTTP（默认 false） */
  enabled: boolean;
  http: McpHttpConfig;
  /** 额外 MCP 插件模块路径或包名 */
  plugins?: string[];
}

/** 解析后的 MCP 配置（含默认值） */
export type ResolvedMcpConfig = McpConfig;

/** 全局配置结构（~/.icqq/config.json） */
export interface IcqqConfig {
  /** 当前操作的默认账号（可被 -u 或 ICQQ_CURRENT_UIN 覆盖） */
  currentUin?: number;
  /** Webhook 推送地址（仅支持 http/https） */
  webhookUrl?: string;
  /** 是否启用系统桌面通知 */
  notifyEnabled?: boolean;
  /** RPC TCP 远程连接配置 */
  rpc?: Partial<RpcConfig>;
  /** MCP HTTP 配置 */
  mcp?: Omit<Partial<McpConfig>, "http"> & { http?: Partial<McpHttpConfig> };
  /** 各账号配置，key 为 QQ 号字符串 */
  accounts: Record<string, AccountConfig>;
  /** 无人值守告警（headless） */
  alerts?: AlertsConfig;
  /** 远程 Login Web / waiting */
  login?: LoginConfig;
}

/** 读取配置文件，不存在时返回默认值。自动执行 defaultUin → currentUin 向后兼容迁移。 */
export async function loadConfig(): Promise<IcqqConfig> {
  try {
    const data = await fs.readFile(getConfigPath(), "utf-8");
    const raw = JSON.parse(data) as IcqqConfig & { defaultUin?: number };
    // Backward compat: migrate defaultUin → currentUin
    if (raw.defaultUin && !raw.currentUin) {
      raw.currentUin = raw.defaultUin;
    }
    delete raw.defaultUin;
    return raw;
  } catch {
    return { accounts: {} };
  }
}

/** 保存配置文件到 ~/.icqq/config.json（权限 0o600，目录 0o700）。 */
export async function saveConfig(config: IcqqConfig): Promise<void> {
  await fs.mkdir(getIcqqHome(), { recursive: true, mode: 0o700 });
  await fs.writeFile(getConfigPath(), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

export function getAccountConfig(
  config: IcqqConfig,
  uin: number,
): AccountConfig | undefined {
  return config.accounts[String(uin)];
}

export function setAccountConfig(
  config: IcqqConfig,
  uin: number,
  account: AccountConfig,
): void {
  config.accounts[String(uin)] = account;
}

/** 解析 RPC 配置，填充默认值 */
export function resolveRpcConfig(partial?: Partial<RpcConfig>): RpcConfig {
  return {
    enabled: partial?.enabled ?? false,
    host: partial?.host ?? "127.0.0.1",
    port: partial?.port ?? 0,
  };
}

/** 解析 MCP 配置，填充默认值（partial 可含 port，全局层不应传入 port） */
export function resolveMcpConfig(
  partial?: IcqqConfig["mcp"],
): ResolvedMcpConfig {
  return {
    enabled: partial?.enabled ?? false,
    http: {
      host: partial?.http?.host ?? "127.0.0.1",
      port: partial?.http?.port ?? 0,
      token: partial?.http?.token,
    },
    plugins: partial?.plugins,
  };
}

/**
 * 合并全局与账号 MCP：enabled/token/host/plugins 继承全局；
 * **端口仅来自账号配置**（全局 port 不参与）。
 */
export function resolveMcpConfigForUin(
  config: IcqqConfig,
  uin: number,
): ResolvedMcpConfig {
  const global = config.mcp;
  const account = config.accounts[String(uin)]?.mcp;
  return {
    enabled: account?.enabled ?? global?.enabled ?? false,
    http: {
      host: account?.http?.host ?? global?.http?.host ?? "127.0.0.1",
      port: account?.http?.port ?? 0,
      token: account?.http?.token ?? global?.http?.token,
    },
    plugins: account?.plugins ?? global?.plugins,
  };
}

/**
 * 合并全局与账号 RPC：enabled/host 继承全局；
 * **端口仅来自账号配置**。
 */
export function resolveRpcConfigForUin(
  config: IcqqConfig,
  uin: number,
): RpcConfig {
  const global = config.rpc;
  const account = config.accounts[String(uin)]?.rpc;
  return {
    enabled: account?.enabled ?? global?.enabled ?? false,
    host: account?.host ?? global?.host ?? "127.0.0.1",
    port: account?.port ?? 0,
  };
}

/** `-u` / ICQQ_CURRENT_UIN：config set/get 的账号作用域 */
export function resolveConfigScopeUin(): number | undefined {
  const envUin = process.env.ICQQ_CURRENT_UIN;
  if (!envUin) return undefined;
  const n = Number(envUin);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n;
}

/**
 * Resolve the target uin from (in priority order):
 *   ICQQ_CURRENT_UIN env  →  config.currentUin
 * Throws if nothing is found.
 */
export async function resolveUin(): Promise<number> {
  const envUin = process.env.ICQQ_CURRENT_UIN;
  if (envUin) {
    const n = Number(envUin);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const config = await loadConfig();
  if (config.currentUin) return config.currentUin;
  throw new Error("未找到已登录账号，请先执行 icqq login");
}
