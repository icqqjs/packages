/**
 * 全局安装 @icqqjs/icqq，不修改 ~/.npmrc。
 */
import { readFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
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
import { getGithubTokenPath } from "./paths.js";
import { buildEphemeralNpmrcEnv } from "./ephemeral-npmrc.js";

export const ICQQ_PACKAGE = "@icqqjs/icqq";
export const CLI_PACKAGE = "@icqqjs/cli";

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

export type SetupTokenSource =
  | "flag"
  | "env-github"
  | "env-icqq"
  | "saved"
  | null;

export type ResolvedSetupToken = {
  token?: string;
  source: SetupTokenSource;
};

/** CLI --token、环境变量或 ~/.icqq/github.token */
export function resolveSetupTokenWithSource(
  explicit?: string,
): ResolvedSetupToken {
  if (explicit?.trim()) {
    return { token: explicit.trim(), source: "flag" };
  }
  if (process.env.GITHUB_TOKEN?.trim()) {
    return { token: process.env.GITHUB_TOKEN.trim(), source: "env-github" };
  }
  if (process.env.ICQQ_GITHUB_TOKEN?.trim()) {
    return { token: process.env.ICQQ_GITHUB_TOKEN.trim(), source: "env-icqq" };
  }
  try {
    const saved = readFileSync(getGithubTokenPath(), "utf-8").trim();
    if (saved) return { token: saved, source: "saved" };
  } catch {
    /* no saved token */
  }
  return { source: null };
}

/** CLI --token、环境变量 GITHUB_TOKEN 或已保存的 PAT */
export function resolveSetupToken(explicit?: string): string | undefined {
  return resolveSetupTokenWithSource(explicit).token;
}

export type IcqqDiscovery = {
  found: boolean;
  path: string | null;
  /** 包管理器全局列表有记录但运行时加载不到 */
  listedButUnloadable: boolean;
};

export type GithubInstallOptions = {
  /** 安装前先全局卸载（修复 pnpm 全局登记但无法加载） */
  reinstall?: boolean;
};

export type InstallInvocationOptions = {
  /** 测试注入：跳过 `pm --version` 探测 */
  majorVersion?: number | null;
};

type PmExecOutcome = {
  stdout: string;
  stderr: string;
  status: number | null;
};

/** 运行包管理器命令：stdout/stderr 回显到终端并一并捕获（pnpm 常把错误写到 stdout）。 */
function runPmCommandSync(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeout = 120_000,
): PmExecOutcome {
  const result = spawnSync(cmd, args, {
    env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (result.error) {
    throw result.error;
  }

  return { stdout, stderr, status: result.status };
}

/** 从包管理器输出中提取可读错误行 */
export function extractInstallFailureDetail(detail: string): string {
  const lines = detail
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(
      (l) =>
        !/^command failed:/i.test(l) &&
        !/^认证策略：/.test(l) &&
        !/不在最近维护的大版本窗口/.test(l),
    );

  const errLine = lines.find((l) =>
    /ERR_|npm ERR!|error|401|403|unauthorized|forbidden|ENOENT|EACCES/i.test(l),
  );
  if (errLine) return errLine.slice(0, 300);

  const last = lines.at(-1);
  if (last && !/^pnpm|^npm|^yarn|^cnpm/.test(last)) return last.slice(0, 300);

  return lines.join(" ").slice(0, 300) || detail.slice(0, 300);
}

function pmCommandFailureDetail(
  cmd: string,
  args: string[],
  outcome: PmExecOutcome,
): string {
  return [outcome.stdout, outcome.stderr]
    .filter(Boolean)
    .join("\n")
    .trim() || `Command failed: ${cmd} ${args.join(" ")}`;
}

function throwInstallFailure(
  pm: PackageManager,
  major: number | null,
  authProfile: string | undefined,
  detail: string,
): never {
  const kind = classifyInstallFailure(detail);
  const hint = pmVersionWarning(pm, major);
  const profileNote = authProfile ? `认证策略：${authProfile}` : undefined;
  const fullDetail = [hint, profileNote, detail].filter(Boolean).join("\n");
  throw new IcqqInstallError(
    summarizeInstallFailure(kind, detail),
    kind,
    fullDetail,
  );
}

function execPmOrThrow(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  pm: PackageManager,
  major: number | null,
  authProfile?: string,
): void {
  const outcome = runPmCommandSync(cmd, args, env);
  if (outcome.status === 0) return;
  throwInstallFailure(pm, major, authProfile, pmCommandFailureDetail(cmd, args, outcome));
}

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
    return { found: true, path: p, listedButUnloadable: false };
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
  return { found: false, path: onDisk, listedButUnloadable };
}

/** 用于日志展示的安装命令（不含 Token，单行） */
export function formatGithubInstallCommand(
  pm: PackageManager,
  packageName: string = ICQQ_PACKAGE,
  options?: InstallInvocationOptions,
): string {
  const { cmd, args } = githubInstallInvocation(pm, packageName, options);
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

function installSubcommand(
  pm: PackageManager,
  packageName: string,
  yarnMajor: number | null,
): {
  cmd: string;
  args: string[];
} {
  switch (pm) {
    case "pnpm":
      return { cmd: "pnpm", args: ["add", "-g", packageName] };
    case "cnpm":
      return { cmd: "cnpm", args: ["install", "-g", packageName] };
    case "yarn":
      if (yarnMajor !== null && yarnMajor >= 2) {
        return {
          cmd: "yarn",
          args: ["npm", "install", "-g", packageName],
        };
      }
      return {
        cmd: "npm",
        args: ["install", "-g", packageName],
      };
    case "npm":
    default:
      return { cmd: "npm", args: ["install", "-g", packageName] };
  }
}

function removeGlobalInvocation(
  pm: PackageManager,
  packageName: string,
  yarnMajor: number | null,
): { cmd: string; args: string[] } {
  switch (pm) {
    case "pnpm":
      return { cmd: "pnpm", args: ["remove", "-g", packageName] };
    case "cnpm":
      return { cmd: "cnpm", args: ["uninstall", "-g", packageName] };
    case "yarn":
      if (yarnMajor !== null && yarnMajor >= 2) {
        return { cmd: "yarn", args: ["global", "remove", packageName] };
      }
      return { cmd: "npm", args: ["uninstall", "-g", packageName] };
    case "npm":
    default:
      return { cmd: "npm", args: ["uninstall", "-g", packageName] };
  }
}

/** 全局卸载包（失败时忽略，用于重装前清理） */
export function removeGlobalPackage(
  pm: PackageManager,
  packageName: string,
  options?: InstallInvocationOptions,
): void {
  const major = resolveMajor(pm, options);
  const yarnMajor = pm === "yarn" ? major : null;
  const { cmd, args } = removeGlobalInvocation(pm, packageName, yarnMajor);
  try {
    runPmCommandSync(cmd, args, process.env);
  } catch {
    /* 未安装或卸载失败均可继续 */
  }
}

function publicInstallSubcommand(
  pm: PackageManager,
  packageName: string,
  yarnMajor: number | null,
): {
  cmd: string;
  args: string[];
} {
  const withLatest = packageName.includes("@latest")
    ? packageName
    : `${packageName}@latest`;
  return installSubcommand(pm, withLatest, yarnMajor);
}

/** Yarn 1 全局安装走 npm 子进程，认证与参数按 npm 处理 */
function effectiveAuthPm(pm: PackageManager, major: number | null): PackageManager {
  if (pm === "yarn" && major !== null && major < 2) return "npm";
  return pm;
}

export function githubInstallInvocation(
  pm: PackageManager,
  packageName: string = ICQQ_PACKAGE,
  options?: InstallInvocationOptions,
): GithubInstallInvocation {
  const major = resolveMajor(pm, options);
  const yarnMajor = pm === "yarn" ? major : null;
  const authPm = effectiveAuthPm(pm, major);
  const { cmd, args: baseArgs } = installSubcommand(pm, packageName, yarnMajor);
  const extra = buildInstallExtraArgs(authPm, authPm === pm ? major : getPackageManagerMajor("npm"));
  const authProfile = describeAuthCompat(pm, major);

  return {
    cmd,
    args: [...baseArgs, ...extra],
    authProfile,
    majorVersion: major,
  };
}

export function publicInstallInvocation(
  pm: PackageManager,
  packageName: string = CLI_PACKAGE,
  options?: InstallInvocationOptions,
): { cmd: string; args: string[]; majorVersion: number | null } {
  const major = resolveMajor(pm, options);
  const yarnMajor = pm === "yarn" ? major : null;
  return {
    ...publicInstallSubcommand(pm, packageName, yarnMajor),
    majorVersion: major,
  };
}

export function formatPublicInstallCommand(
  pm: PackageManager,
  packageName: string = CLI_PACKAGE,
  options?: InstallInvocationOptions,
): string {
  const { cmd, args } = publicInstallInvocation(pm, packageName, options);
  return [cmd, ...args].join(" ");
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
    const extracted = extractInstallFailureDetail(detail);
    if (extracted && /ERR_|401|403|unauthorized|forbidden/i.test(extracted)) {
      return `认证失败：${extracted}`;
    }
    return "认证失败：Token 无效、已过期或缺少 read:packages 权限。";
  }
  const extracted = extractInstallFailureDetail(detail);
  return extracted.startsWith("安装失败")
    ? extracted
    : `安装失败：${extracted}`;
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
  packageName: string = ICQQ_PACKAGE,
  options?: InstallInvocationOptions,
): void {
  const major = resolveMajor(pm, options);
  const authPm = effectiveAuthPm(pm, major);
  const authMajor =
    authPm === pm ? major : getPackageManagerMajor("npm");
  const { cmd, args, authProfile } = githubInstallInvocation(pm, packageName, {
    majorVersion: major,
  });
  const { env: npmrcEnv, cleanup } = buildEphemeralNpmrcEnv(token);
  try {
    const env = {
      ...process.env,
      ...buildAuthEnv(authPm, token, authMajor),
      ...npmrcEnv,
    };
    execPmOrThrow(cmd, args, env, pm, major, authProfile);
  } finally {
    cleanup();
  }
}

/** 使用 GitHub Packages 全局安装（不修改 ~/.npmrc）；认证失败时对非 npm 再试 npm */
export function runGithubPackagesGlobalInstall(
  pm: PackageManager,
  token: string,
  packageName: string = ICQQ_PACKAGE,
  options?: GithubInstallOptions,
): void {
  const reinstall = options?.reinstall ?? false;

  const installOnce = (targetPm: PackageManager) => {
    if (reinstall) {
      removeGlobalPackage(targetPm, packageName);
    }
    execGithubInstall(targetPm, token, packageName);
  };

  try {
    installOnce(pm);
  } catch (e: unknown) {
    if (
      e instanceof IcqqInstallError &&
      e.kind !== "auth" &&
      !reinstall
    ) {
      removeGlobalPackage(pm, packageName);
      try {
        execGithubInstall(pm, token, packageName);
        return;
      } catch (retryErr) {
        e = retryErr;
      }
    }

    if (
      e instanceof IcqqInstallError &&
      shouldFallbackToNpm(pm, e.kind, e.detail)
    ) {
      try {
        if (reinstall) {
          removeGlobalPackage("npm", packageName);
        }
        execGithubInstall("npm", token, packageName);
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

function execPublicInstall(
  pm: PackageManager,
  packageName: string = CLI_PACKAGE,
  options?: InstallInvocationOptions,
): void {
  const major = resolveMajor(pm, options);
  const { cmd, args } = publicInstallInvocation(pm, packageName, {
    majorVersion: major,
  });

  execPmOrThrow(cmd, args, process.env, pm, major);
}

/** 从 npmjs 等公网 registry 全局升级包（如 @icqqjs/cli） */
export function runPublicRegistryGlobalInstall(
  pm: PackageManager,
  packageName: string = CLI_PACKAGE,
): void {
  try {
    execPublicInstall(pm, packageName);
  } catch (e: unknown) {
    if (
      e instanceof IcqqInstallError &&
      shouldFallbackToNpm(pm, e.kind, e.detail)
    ) {
      execPublicInstall("npm", packageName);
      return;
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
