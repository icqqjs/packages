/**
 * 路径常量工具。
 *
 * 所有数据存放于 ~/.icqq/ 目录下，结构如下：
 *
 *   ~/.icqq/
 *     config.json          全局配置（0o600）
 *     github.token         GitHub PAT
 *     .tmp/                临时文件目录
 *     <uin>/               各账号独立目录（0o700）
 *       daemon.pid         守护进程 PID
 *       daemon.sock        Unix Domain Socket
 *       daemon.log         守护进程日志（>5MB 自动轮转为 .log.old）
 *       daemon.token       IPC 认证 Token（0o600）
 *       daemon.mcp         MCP HTTP 端点信息（启用 mcp 时）
 *       device.json        设备信息
 *       token              QQ 登录 token
 *     supervisor.pid       已废弃（勿使用）
 *     supervisor.log       已废弃（勿使用）
 *
 * @module paths
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export function getIcqqHome(): string {
  return path.join(os.homedir(), ".icqq");
}

export function getAccountDir(uin: number): string {
  return path.join(getIcqqHome(), String(uin));
}

export function getTmpDir(): string {
  return path.join(getIcqqHome(), ".tmp");
}

export function getSocketPath(uin: number): string {
  return path.join(getAccountDir(uin), "daemon.sock");
}

export function getPidPath(uin: number): string {
  return path.join(getAccountDir(uin), "daemon.pid");
}

export function getLogPath(uin: number): string {
  return path.join(getAccountDir(uin), "daemon.log");
}

export function getTokenPath(uin: number): string {
  return path.join(getAccountDir(uin), "daemon.token");
}

export function getRpcPortPath(uin: number): string {
  return path.join(getAccountDir(uin), "daemon.rpc");
}

export function getMcpEndpointPath(uin: number): string {
  return path.join(getAccountDir(uin), "daemon.mcp");
}

export type McpEndpointFile = {
  host: string;
  port: number;
  basePath: string;
};

/** 读取守护进程写入的 MCP 端点信息（不存在时返回 null） */
export async function readMcpEndpoint(
  uin: number,
): Promise<McpEndpointFile | null> {
  try {
    const raw = await fs.readFile(getMcpEndpointPath(uin), "utf-8");
    return JSON.parse(raw) as McpEndpointFile;
  } catch {
    return null;
  }
}

export function formatMcpUrl(endpoint: McpEndpointFile): string {
  return `http://${endpoint.host}:${endpoint.port}${endpoint.basePath}`;
}

export function getConfigPath(): string {
  return path.join(getIcqqHome(), "config.json");
}

export function getGithubTokenPath(): string {
  return path.join(getIcqqHome(), "github.token");
}

