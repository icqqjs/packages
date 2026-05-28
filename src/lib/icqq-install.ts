/**
 * 全局安装 @icqqjs/icqq，不修改 ~/.npmrc。
 */
import { execFileSync, execSync } from "node:child_process";
import {
  buildAuthEnv,
  buildInstallExtraArgs,
  describeAuthCompat,
  isWrongRegistry404,
  shouldFallbackToNpm,
  ICQQ_GITHUB_REGISTRY,
  GITHUB_PACKAGES_AUTH_KEY,
} from "./pm-auth-compat.js";
import {
  getPackageManagerMajor,
  isWithinSupportedMajorWindow,
  PM_MAJOR_WINDOWS,
} from "./pm-version.js";
import { PACKAGE_MANAGERS, type PackageManager } from "./package-manager.js";
import {
  collectGlobalNodeModulesRoots,
  getIcqqPath,
  isIcqqAvailable,
  resolveIcqqEntryPath,
  resolveIcqqPackageRoot,
} from "./icqq-resolve.js";

export {
  ICQQ_GITHUB_REGISTRY,
  GITHUB_PACKAGES_AUTH_KEY,
  PACKAGE_MANAGERS,
  type PackageManager,
};

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

export type InstallInvocationOptions = {
  /** 测试注入：跳过 `pm --version` 探测 */
  majorVersion?: number | null;
};

export type GithubInstallInvocation = {
  cmd: string;
  args: string[];
  /** 认证策略描述（日志） */
  authProfile: string;
  majorVersion: number | null;
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

/** 用于日志展示的安装命令（不含 Token，单行） */
export function formatGithubInstallCommand(
  pm: PackageManager,
  options?: InstallInvocationOptions,
): string {
  const { cmd, args } = githubInstallInvocation(pm, options);
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

function resolveMajor(
  pm: PackageManager,
  options?: InstallInvocationOptions,
): number | null {
  if (options && "majorVersion" in options) {
    return options.majorVersion ?? null;
  }
  return getPackageManagerMajor(pm);
}

function installSubcommand(pm: PackageManager, yarnMajor: number | null): {
  cmd: string;
  args: string[];
} {
  switch (pm) {
    case "pnpm":
      return { cmd: "pnpm", args: ["add", "-g", "@icqqjs/icqq"] };
    case "cnpm":
      return { cmd: "cnpm", args: ["install", "-g", "@icqqjs/icqq"] };
    case "yarn":
      // Yarn 1 无可靠的不落盘 registry 全局安装；Yarn 2+ 用 yarn npm
      if (yarnMajor !== null && yarnMajor >= 2) {
        return {
          cmd: "yarn",
          args: ["npm", "install", "-g", "@icqqjs/icqq"],
        };
      }
      return {
        cmd: "npm",
        args: ["install", "-g", "@icqqjs/icqq"],
      };
    case "npm":
    default:
      return { cmd: "npm", args: ["install", "-g", "@icqqjs/icqq"] };
  }
}

/** Yarn 1 全局安装走 npm 子进程，认证与参数按 npm 处理 */
function effectiveAuthPm(pm: PackageManager, major: number | null): PackageManager {
  if (pm === "yarn" && major !== null && major < 2) return "npm";
  return pm;
}

export function githubInstallInvocation(
  pm: PackageManager,
  options?: InstallInvocationOptions,
): GithubInstallInvocation {
  const major = resolveMajor(pm, options);
  const yarnMajor = pm === "yarn" ? major : null;
  const authPm = effectiveAuthPm(pm, major);
  const { cmd, args: baseArgs } = installSubcommand(pm, yarnMajor);
  const extra = buildInstallExtraArgs(authPm, authPm === pm ? major : getPackageManagerMajor("npm"));
  const authProfile = describeAuthCompat(pm, major);

  return {
    cmd,
    args: [...baseArgs, ...extra],
    authProfile,
    majorVersion: major,
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
  if (isWrongRegistry404(detail)) {
    return "安装失败：请求到了 npmjs.org 而非 GitHub Packages，请确认 @icqqjs scope registry 已生效。";
  }
  if (kind === "auth") {
    return "认证失败：Token 无效、已过期或缺少 read:packages 权限。";
  }
  const first = detail.split("\n").find((l) => l.trim())?.trim();
  return first ? `安装失败：${first.slice(0, 200)}` : "安装失败，请检查网络与包管理器配置。";
}

function pmVersionWarning(pm: PackageManager, major: number | null): string | null {
  const win = PM_MAJOR_WINDOWS[pm];
  if (major === null) return null;
  if (isWithinSupportedMajorWindow(major, win.latest)) return null;
  return `${pm}@${major} 不在最近维护的大版本窗口（${win.min}–${win.latest}），将尝试兼容安装`;
}

function execGithubInstall(
  pm: PackageManager,
  token: string,
  options?: InstallInvocationOptions,
): void {
  const major = resolveMajor(pm, options);
  const authPm = effectiveAuthPm(pm, major);
  const authMajor =
    authPm === pm ? major : getPackageManagerMajor("npm");
  const { cmd, args, authProfile } = githubInstallInvocation(pm, {
    majorVersion: major,
  });
  const env = {
    ...process.env,
    ...buildAuthEnv(authPm, token, authMajor),
  };

  try {
    execFileSync(cmd, args, {
      stdio: ["inherit", "inherit", "pipe"],
      timeout: 120_000,
      env,
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
    const hint = pmVersionWarning(pm, major);
    const profileNote = `认证策略：${authProfile}`;
    const fullDetail = [hint, profileNote, detail].filter(Boolean).join("\n");
    throw new IcqqInstallError(
      summarizeInstallFailure(kind, detail),
      kind,
      fullDetail,
    );
  }
}

/** 使用 GitHub Packages 全局安装（不修改 ~/.npmrc）；认证失败时对非 npm 再试 npm */
export function runGithubPackagesGlobalInstall(
  pm: PackageManager,
  token: string,
): void {
  try {
    execGithubInstall(pm, token);
  } catch (e: unknown) {
    if (
      e instanceof IcqqInstallError &&
      shouldFallbackToNpm(pm, e.kind)
    ) {
      try {
        execGithubInstall("npm", token);
        return;
      } catch (fallbackErr: unknown) {
        if (fallbackErr instanceof IcqqInstallError) {
          throw new IcqqInstallError(
            `${e.message}（已用 npm 重试仍失败：${fallbackErr.message}）`,
            fallbackErr.kind,
            `${e.detail}\n--- npm fallback ---\n${fallbackErr.detail}`,
          );
        }
        throw fallbackErr;
      }
    }
    throw e;
  }
}

/** 供 setup 日志：包管理器版本与认证策略 */
export function formatInstallEnvironment(pm: PackageManager): string {
  const major = getPackageManagerMajor(pm);
  const warn = pmVersionWarning(pm, major);
  const auth = describeAuthCompat(pm, major);
  const ver = major === null ? "?" : String(major);
  return [warn, `${pm}@${ver}，${auth}`].filter(Boolean).join("；");
}
