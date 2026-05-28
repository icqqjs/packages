/**
 * 全局安装 @icqqjs/icqq，不修改 ~/.npmrc。
 */
import { execFileSync, execSync } from "node:child_process";
import {
  collectGlobalNodeModulesRoots,
  getIcqqPath,
  isIcqqAvailable,
  resolveIcqqEntryPath,
  resolveIcqqPackageRoot,
} from "./icqq-resolve.js";

export const ICQQ_GITHUB_REGISTRY = "https://npm.pkg.github.com";

export const PACKAGE_MANAGERS = ["pnpm", "npm", "cnpm", "yarn"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type InstallFailureKind = "auth" | "other";

export class IcqqInstallError extends Error {
  readonly kind: InstallFailureKind;
  readonly detail: string;

  constructor(message: string, kind: InstallFailureKind, detail: string) {
    super(message);
    this.name = "IcqqInstallError";
    this.kind = kind;
    this.detail = detail;
  }
}

/** 检测安装本 CLI 时使用的包管理器 */
export function detectPackageManager(): PackageManager {
  const selfPath = process.argv[1] ?? "";
  if (selfPath.includes("/pnpm/") || selfPath.includes("\\pnpm\\")) return "pnpm";
  if (selfPath.includes("/cnpm/") || selfPath.includes("\\cnpm\\")) return "cnpm";
  if (selfPath.includes("/yarn/") || selfPath.includes("\\yarn\\")) return "yarn";
  for (const [env, cmd, name] of [
    ["PNPM_HOME", "pnpm", "pnpm"],
    ["CNPM_HOME", "cnpm", "cnpm"],
    ["YARN_GLOBAL_FOLDER", "yarn", "yarn"],
  ] as const) {
    if (process.env[env]) {
      try {
        execSync(`${cmd} --version`, { stdio: "ignore" });
        return name as PackageManager;
      } catch {
        /* try next */
      }
    }
  }
  return "npm";
}

/** CLI --token 或环境变量 GITHUB_TOKEN */
export function resolveSetupToken(explicit?: string): string | undefined {
  const t =
    explicit?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.ICQQ_GITHUB_TOKEN?.trim();
  return t || undefined;
}

export type IcqqDiscovery = {
  found: boolean;
  path: string | null;
};

/**
 * 查找 @icqqjs/icqq。
 * 仅当运行时能成功加载时视为 found（pnpm 全局列表里有但 CLI 加载不到不算就绪）。
 */
export async function discoverIcqq(
  log?: (message: string) => void,
): Promise<IcqqDiscovery> {
  const say = (message: string) => log?.(message);

  say("   检查运行时能否加载 @icqqjs/icqq …");
  if (await isIcqqAvailable()) {
    const p = await getIcqqPath();
    say(p ? `   → 可以加载（${p}）` : "   → 可以加载");
    return { found: true, path: p };
  }
  say("   → 当前无法加载");

  say("   扫描全局 node_modules 目录 …");
  const roots = collectGlobalNodeModulesRoots();
  const onDisk = resolveIcqqPackageRoot(roots);
  const entry = resolveIcqqEntryPath(roots);
  if (onDisk && entry) {
    say(`   → 找到包目录（${onDisk}）但未能加载，将尝试重新安装`);
  } else if (onDisk) {
    say(`   → 找到不完整安装（${onDisk}），将尝试重新安装`);
  } else {
    say(`   → 已扫描 ${roots.length} 个目录，未发现可解析的包文件`);
  }

  let listedButUnloadable = false;
  for (const pkgPm of PACKAGE_MANAGERS) {
    say(`   查询 ${pkgPm} 全局是否已登记 …`);
    if (isPackageInstalledGlobally(pkgPm, "@icqqjs/icqq")) {
      listedButUnloadable = true;
      say(
        `   → ${pkgPm} 列表中有 @icqqjs/icqq，但 icqq 仍加载不到（pnpm 全局隔离常见）`,
      );
    } else {
      say(`   → ${pkgPm} 未登记`);
    }
  }

  if (listedButUnloadable) {
    say("   → 结论：需重新安装以修复（全局列表有记录但无法加载）");
  } else {
    say("   → 结论：需要安装");
  }
  return { found: false, path: onDisk };
}

/** 用于日志展示的安装命令（不含 Token） */
export function formatGithubInstallCommand(pm: PackageManager): string {
  const { cmd, args } = githubInstallInvocation(pm);
  return [cmd, ...args].join(" ");
}

function isPackageInstalledGlobally(pm: PackageManager, name: string): boolean {
  try {
    switch (pm) {
      case "pnpm":
        execSync(`pnpm list -g ${name} --depth=0`, {
          stdio: "pipe",
          timeout: 15_000,
        });
        return true;
      case "npm":
        execSync(`npm list -g ${name} --depth=0`, {
          stdio: "pipe",
          timeout: 15_000,
        });
        return true;
      case "cnpm":
        execSync(`cnpm list -g ${name} --depth=0`, {
          stdio: "pipe",
          timeout: 15_000,
        });
        return true;
      case "yarn":
        execSync(`yarn global list --pattern ${name}`, {
          stdio: "pipe",
          timeout: 15_000,
        });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function authEnv(token: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GITHUB_TOKEN: token,
    "npm_config_//npm.pkg.github.com/:_authToken": token,
  };
}

export function classifyInstallFailure(detail: string): InstallFailureKind {
  const s = detail.toLowerCase();
  if (
    /401|403|unauthorized|forbidden|e401|e403|not auth|authentication|bad credentials|permission denied|read:packages/.test(
      s,
    )
  ) {
    return "auth";
  }
  return "other";
}

export function summarizeInstallFailure(
  kind: InstallFailureKind,
  detail: string,
): string {
  if (kind === "auth") {
    return "认证失败：Token 无效、已过期或缺少 read:packages 权限。";
  }
  const first = detail.split("\n").find((l) => l.trim())?.trim();
  return first ? `安装失败：${first.slice(0, 200)}` : "安装失败，请检查网络与包管理器配置。";
}

export function githubInstallInvocation(pm: PackageManager): {
  cmd: string;
  args: string[];
} {
  const reg = ICQQ_GITHUB_REGISTRY;
  switch (pm) {
    case "pnpm":
      return {
        cmd: "pnpm",
        args: ["add", "-g", "@icqqjs/icqq", `--config.@icqqjs:registry=${reg}`],
      };
    case "cnpm":
      return {
        cmd: "cnpm",
        args: ["install", "-g", "@icqqjs/icqq", `--@icqqjs:registry=${reg}`],
      };
    case "yarn":
      return {
        cmd: "npm",
        args: ["install", "-g", "@icqqjs/icqq", `--@icqqjs:registry=${reg}`],
      };
    default:
      return {
        cmd: "npm",
        args: ["install", "-g", "@icqqjs/icqq", `--@icqqjs:registry=${reg}`],
      };
  }
}

/** 使用 GitHub Packages 全局安装（不修改 ~/.npmrc） */
export function runGithubPackagesGlobalInstall(
  pm: PackageManager,
  token: string,
): void {
  const { cmd, args } = githubInstallInvocation(pm);
  try {
    execFileSync(cmd, args, {
      stdio: ["inherit", "inherit", "pipe"],
      timeout: 120_000,
      env: authEnv(token),
    });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detail =
      (typeof err.stderr === "string"
        ? err.stderr
        : err.stderr?.toString("utf8")) ||
      err.message ||
      String(e);
    const kind = classifyInstallFailure(detail);
    throw new IcqqInstallError(
      summarizeInstallFailure(kind, detail),
      kind,
      detail,
    );
  }
}
