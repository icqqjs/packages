import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

/** 旧版 gateway 数据目录（与 icqq bot home 共用 ~/.icqq） */
function getLegacyGatewayHome(): string {
  return path.join(os.homedir(), ".icqq");
}

/** gateway 自有数据目录，与 icqq bot runtime (`~/.icqq`) 分离 */
export function getGatewayHome(): string {
  const override = process.env.GATEWAY_HOME?.trim();
  if (override) return override;
  return path.join(os.homedir(), ".icqq-gateway");
}

/** @deprecated 使用 getGatewayHome */
export function getIcqqHome(): string {
  return getGatewayHome();
}

export function getGatewayDbPath(): string {
  return path.join(getGatewayHome(), "gateway.sqlite");
}

export function getGatewayKeyPath(): string {
  return path.join(getGatewayHome(), "gateway.key");
}

export function getGatewayPidPath(): string {
  return path.join(getGatewayHome(), "gateway.pid");
}

export function getGatewayLogPath(): string {
  return path.join(getGatewayHome(), "gateway.log");
}

export function getGatewayStoppedPath(): string {
  return path.join(getGatewayHome(), "gateway.stopped");
}

/** 从旧版 ~/.icqq/gateway.* 迁移到 ~/.icqq-gateway（幂等） */
export async function migrateLegacyGatewayHome(): Promise<void> {
  const legacyHome = getLegacyGatewayHome();
  const nextHome = getGatewayHome();
  if (nextHome === legacyHome) return;

  await fs.mkdir(nextHome, { recursive: true, mode: 0o700 });

  const files = [
    "gateway.sqlite",
    "gateway.sqlite-wal",
    "gateway.sqlite-shm",
    "gateway.key",
    "gateway.pid",
    "gateway.log",
    "gateway.stopped",
  ];

  for (const name of files) {
    const from = path.join(legacyHome, name);
    const to = path.join(nextHome, name);
    try {
      await fs.access(to);
      continue;
    } catch {
      /* target missing */
    }
    try {
      await fs.rename(from, to);
    } catch {
      /* legacy missing */
    }
  }
}

export function isProductionGatewayMode(): boolean {
  if (process.env.GATEWAY_MASTER_KEY?.trim()) return true;
  if (process.env.DOCKER === "true") return true;
  return process.env.NODE_ENV === "production";
}
