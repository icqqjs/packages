import fs from "node:fs/promises";
import type { IcqqConfig } from "./config.js";
import {
  resolveMcpConfigForUin,
  resolveRpcConfigForUin,
} from "./config.js";
import { getRpcPortPath, readMcpEndpoint } from "./paths.js";
import { isPortInUse } from "./port-availability.js";

export type NetworkSetupChoice = {
  mcpEnabled: boolean;
  mcpToken: string;
  rpcEnabled: boolean;
  rpcHost: string;
  /** 账号级端口；0 表示由守护进程自动分配后写回 */
  mcpPort: number;
  rpcPort: number;
};

const MCP_PORT_BASE = 61500;
const RPC_PORT_BASE = 9100;

export const DEFAULT_NETWORK_SETUP: NetworkSetupChoice = {
  mcpEnabled: true,
  mcpToken: "",
  rpcEnabled: false,
  rpcHost: "127.0.0.1",
  mcpPort: 0,
  rpcPort: 0,
};

/** 是否已完成首次全局 MCP/RPC 引导 */
export function isGlobalNetworkConfigured(config: IcqqConfig): boolean {
  return config.mcp !== undefined || config.rpc !== undefined;
}

/** 二次登录向导默认值（端口仅来自账号配置） */
export function accountNetworkDefaultsFromConfig(
  config: IcqqConfig,
  uin?: number,
): NetworkSetupChoice {
  if (uin === undefined) {
    return {
      mcpEnabled: config.mcp?.enabled ?? DEFAULT_NETWORK_SETUP.mcpEnabled,
      mcpToken: config.mcp?.http?.token ?? "",
      rpcEnabled: config.rpc?.enabled ?? DEFAULT_NETWORK_SETUP.rpcEnabled,
      rpcHost: config.rpc?.host ?? "127.0.0.1",
      mcpPort: 0,
      rpcPort: 0,
    };
  }
  const mcp = resolveMcpConfigForUin(config, uin);
  const rpc = resolveRpcConfigForUin(config, uin);
  return {
    mcpEnabled: mcp.enabled,
    mcpToken: mcp.http.token ?? "",
    rpcEnabled: rpc.enabled,
    rpcHost: rpc.host,
    mcpPort: mcp.http.port,
    rpcPort: rpc.port,
  };
}

export function parseNetworkPortInput(raw: string, fallback = 0): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error("端口必须为 0–65535 的整数");
  }
  return n;
}

/** 收集其他账号已占用的 MCP/RPC 端口 */
export function collectUsedNetworkPorts(
  config: IcqqConfig,
  excludeUin?: number,
): Set<number> {
  const used = new Set<number>();
  for (const [uinKey, account] of Object.entries(config.accounts)) {
    const otherUin = Number(uinKey);
    if (excludeUin !== undefined && otherUin === excludeUin) continue;
    const mcpPort = account.mcp?.http?.port ?? 0;
    const rpcPort = account.rpc?.port ?? 0;
    if (mcpPort > 0) used.add(mcpPort);
    if (rpcPort > 0) used.add(rpcPort);
  }
  return used;
}

/** 从起始端口起选取第一个未占用端口（含本次向导已选端口） */
export function pickAutoNetworkPort(
  config: IcqqConfig,
  excludeUin: number | undefined,
  reserved: Iterable<number> = [],
  start = MCP_PORT_BASE,
): number {
  const used = collectUsedNetworkPorts(config, excludeUin);
  for (const port of reserved) {
    if (port > 0) used.add(port);
  }
  for (let port = start; port <= 65535; port++) {
    if (!used.has(port) && !isPortInUse(port)) return port;
  }
  throw new Error("无可用端口，请手动指定");
}

export function pickAutoMcpPort(
  config: IcqqConfig,
  excludeUin: number | undefined,
  reserved: Iterable<number> = [],
): number {
  return pickAutoNetworkPort(config, excludeUin, reserved, MCP_PORT_BASE);
}

export function pickAutoRpcPort(
  config: IcqqConfig,
  excludeUin: number | undefined,
  reserved: Iterable<number> = [],
): number {
  return pickAutoNetworkPort(config, excludeUin, reserved, RPC_PORT_BASE);
}

/** 留空或 0 → 自动选取；否则解析用户输入 */
export function resolveNetworkPortInput(
  raw: string,
  autoPick: () => number,
): number {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0") return autoPick();
  return parseNetworkPortInput(trimmed);
}

/** 检查账号级端口冲突：跨账号、MCP/RPC 互斥、系统进程占用（0 不参与检测） */
export function findNetworkPortConflict(
  config: IcqqConfig,
  excludeUin: number | undefined,
  choice: Pick<
    NetworkSetupChoice,
    "mcpEnabled" | "mcpPort" | "rpcEnabled" | "rpcPort"
  >,
): string | null {
  if (
    choice.mcpEnabled &&
    choice.rpcEnabled &&
    choice.mcpPort > 0 &&
    choice.rpcPort > 0 &&
    choice.mcpPort === choice.rpcPort
  ) {
    return `MCP 与 RPC 不能使用相同端口 ${choice.mcpPort}`;
  }

  for (const [uinKey, account] of Object.entries(config.accounts)) {
    const otherUin = Number(uinKey);
    if (excludeUin !== undefined && otherUin === excludeUin) continue;

    const otherMcpPort = account.mcp?.http?.port ?? 0;
    const otherRpcPort = account.rpc?.port ?? 0;

    if (
      choice.mcpEnabled &&
      choice.mcpPort > 0 &&
      (choice.mcpPort === otherMcpPort || choice.mcpPort === otherRpcPort)
    ) {
      return `MCP 端口 ${choice.mcpPort} 已被账号 ${otherUin} 占用`;
    }
    if (
      choice.rpcEnabled &&
      choice.rpcPort > 0 &&
      (choice.rpcPort === otherRpcPort || choice.rpcPort === otherMcpPort)
    ) {
      return `RPC 端口 ${choice.rpcPort} 已被账号 ${otherUin} 占用`;
    }
  }

  if (choice.mcpEnabled && choice.mcpPort > 0 && isPortInUse(choice.mcpPort)) {
    return `MCP 端口 ${choice.mcpPort} 已被系统进程占用`;
  }
  if (choice.rpcEnabled && choice.rpcPort > 0 && isPortInUse(choice.rpcPort)) {
    return `RPC 端口 ${choice.rpcPort} 已被系统进程占用`;
  }

  return null;
}

/** 守护进程启动前检查账号 MCP/RPC 端口是否可用 */
export function preflightDaemonNetworkPorts(
  config: IcqqConfig,
  uin: number,
): string | null {
  const mcp = resolveMcpConfigForUin(config, uin);
  const rpc = resolveRpcConfigForUin(config, uin);
  return findNetworkPortConflict(config, uin, {
    mcpEnabled: mcp.enabled,
    mcpPort: mcp.http.port,
    rpcEnabled: rpc.enabled,
    rpcPort: rpc.port,
  });
}

/** 首次登录：仅写入全局开关 / Token（不含端口） */
export function persistGlobalNetworkSetup(
  config: IcqqConfig,
  choice: NetworkSetupChoice,
): void {
  config.mcp = {
    enabled: choice.mcpEnabled,
    http: {
      host: "127.0.0.1",
      token: choice.mcpToken.trim() || undefined,
    },
  };
  config.rpc = {
    enabled: choice.rpcEnabled,
    host: choice.rpcHost.trim() || "127.0.0.1",
  };
}

/** 二次登录：写入当前账号 MCP/RPC（含端口） */
export function persistAccountNetworkSetup(
  config: IcqqConfig,
  uin: number,
  choice: NetworkSetupChoice,
): void {
  const key = String(uin);
  const account = config.accounts[key] ?? { platform: 0, signApiUrl: "" };
  account.mcp = {
    enabled: choice.mcpEnabled,
    http: {
      host: "127.0.0.1",
      port: choice.mcpEnabled ? choice.mcpPort : 0,
      token: choice.mcpToken.trim() || undefined,
    },
  };
  account.rpc = {
    enabled: choice.rpcEnabled,
    host: choice.rpcHost.trim() || "127.0.0.1",
    port: choice.rpcEnabled ? choice.rpcPort : 0,
  };
  config.accounts[key] = account;
}

/** 守护进程启动后，将实际监听端口写回账号配置 */
export async function syncAssignedPortsToAccount(
  config: IcqqConfig,
  uin: number,
): Promise<{ mcpPort?: number; rpcPort?: number }> {
  const key = String(uin);
  const account = config.accounts[key] ?? { platform: 0, signApiUrl: "" };
  const resolvedMcp = resolveMcpConfigForUin(config, uin);
  const resolvedRpc = resolveRpcConfigForUin(config, uin);
  const out: { mcpPort?: number; rpcPort?: number } = {};

  if (resolvedMcp.enabled) {
    account.mcp ??= { enabled: true, http: { host: "127.0.0.1", port: 0 } };
    account.mcp.http ??= { host: "127.0.0.1", port: 0 };
    const ep = await readMcpEndpoint(uin);
    if (ep?.port) {
      account.mcp.http.port = ep.port;
      out.mcpPort = ep.port;
    }
  }

  if (resolvedRpc.enabled) {
    account.rpc ??= {
      enabled: true,
      host: resolvedRpc.host,
      port: 0,
    };
    try {
      const raw = await fs.readFile(getRpcPortPath(uin), "utf-8");
      const info = JSON.parse(raw) as { port?: number };
      if (info.port) {
        account.rpc.port = info.port;
        out.rpcPort = info.port;
      }
    } catch {
      /* daemon.rpc 尚未写入 */
    }
  }

  config.accounts[key] = account;
  return out;
}

export function formatNetworkSetupSummary(choice: NetworkSetupChoice): string {
  const mcp = choice.mcpEnabled
    ? `MCP 开，端口 ${choice.mcpPort === 0 ? "自动" : choice.mcpPort}${choice.mcpToken ? "，已设 Token" : ""}`
    : "MCP 关";
  const rpc = choice.rpcEnabled
    ? `RPC 开，${choice.rpcHost}:${choice.rpcPort === 0 ? "自动" : choice.rpcPort}`
    : "RPC 关";
  return `${mcp}；${rpc}`;
}
