import { execSync } from "node:child_process";
import type { PackageManager } from "./package-manager.js";

/** 解析 `pnpm 11.4.0` / `10.9.2` 等输出中的主版本号 */
export function parseSemverMajor(versionOutput: string): number | null {
  const trimmed = versionOutput.trim();
  const m = trimmed.match(/^v?(\d+)(?:\.|$)/i);
  if (!m) return null;
  const major = Number(m[1]);
  return Number.isFinite(major) ? major : null;
}

const VERSION_CMD: Record<PackageManager, string> = {
  pnpm: "pnpm",
  npm: "npm",
  cnpm: "cnpm",
  yarn: "yarn",
};

/** 执行 `pm --version` 并返回主版本；失败返回 null */
export function getPackageManagerMajor(pm: PackageManager): number | null {
  const cmd = VERSION_CMD[pm];
  try {
    const out = execSync(`${cmd} --version`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    });
    return parseSemverMajor(out);
  } catch {
    return null;
  }
}

/** 是否落在「最近 3 个大版本」窗口内（用于日志提示，不阻断安装） */
export function isWithinSupportedMajorWindow(
  major: number | null,
  latestMajor: number,
): boolean {
  if (major === null) return true;
  return major >= latestMajor - 2 && major <= latestMajor + 1;
}

/** 文档/测试用：各包管理器当前维护的大版本窗口（需随上游发布手动更新） */
export const PM_MAJOR_WINDOWS = {
  pnpm: { latest: 11, min: 9 },
  npm: { latest: 11, min: 8 },
  yarn: { latest: 4, min: 1 },
  cnpm: { latest: 9, min: 7 },
} as const;
