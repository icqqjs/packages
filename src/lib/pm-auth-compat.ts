import type { PackageManager } from "./package-manager.js";

export const ICQQ_GITHUB_REGISTRY = "https://npm.pkg.github.com";
export const GITHUB_PACKAGES_AUTH_KEY = "//npm.pkg.github.com/:_authToken";
/** .npmrc / env 中的 scope registry 键名 */
export const ICQQ_SCOPE_REGISTRY_KEY = "@icqqjs:registry";
export const GITHUB_ALWAYS_AUTH_KEY = "//npm.pkg.github.com/:always-auth";

function baseTokenEnv(token: string): Record<string, string> {
  return {
    GITHUB_TOKEN: token,
    NODE_AUTH_TOKEN: token,
  };
}

/** @icqqjs scope 指向 GitHub Packages（npm + pnpm 各一份 env） */
function scopedRegistryEnv(): Record<string, string> {
  return {
    [`npm_config_${ICQQ_SCOPE_REGISTRY_KEY}`]: ICQQ_GITHUB_REGISTRY,
    [`pnpm_config_${ICQQ_SCOPE_REGISTRY_KEY}`]: ICQQ_GITHUB_REGISTRY,
  };
}

/** npm_config_*（pnpm 9–10、npm 8–11、cnpm、yarn npm 子命令） */
function npmConfigAuthEnv(token: string): Record<string, string> {
  return {
    ...scopedRegistryEnv(),
    [`npm_config_${GITHUB_PACKAGES_AUTH_KEY}`]: token,
    [`npm_config_${GITHUB_ALWAYS_AUTH_KEY}`]: "true",
  };
}

/** pnpm 11+ 读取 pnpm_config_* */
function pnpmConfigAuthEnv(token: string): Record<string, string> {
  return {
    ...scopedRegistryEnv(),
    [`pnpm_config_${GITHUB_PACKAGES_AUTH_KEY}`]: token,
    [`pnpm_config_${GITHUB_ALWAYS_AUTH_KEY}`]: "true",
  };
}

/**
 * 按包管理器主版本生成认证环境变量。
 * 不依赖 `--config.${GITHUB_TOKEN}`：execFile 不会展开 shell 变量，会导致 401。
 */
export function buildAuthEnv(
  pm: PackageManager,
  token: string,
  major: number | null,
): Record<string, string> {
  const env: Record<string, string> = {
    ...baseTokenEnv(token),
  };

  switch (pm) {
    case "pnpm": {
      if (major === null || major >= 9) {
        Object.assign(env, npmConfigAuthEnv(token));
      }
      if (major === null || major >= 11) {
        Object.assign(env, pnpmConfigAuthEnv(token));
      } else if (major !== null && major < 9) {
        Object.assign(env, npmConfigAuthEnv(token));
      }
      break;
    }
    case "npm":
    case "cnpm":
    case "yarn":
      Object.assign(env, npmConfigAuthEnv(token));
      break;
    default:
      Object.assign(env, npmConfigAuthEnv(token));
  }

  return env;
}

/**
 * 安装命令额外 CLI 参数。
 * pnpm：registry + auth 仅用 env（见 buildAuthEnv），避免错误 --config 拼接。
 * npm/cnpm/yarn：使用 npm 系 `--@icqqjs:registry=` 写法。
 */
export function buildInstallExtraArgs(
  pm: PackageManager,
  _major: number | null,
): string[] {
  const regFlag = `--${ICQQ_SCOPE_REGISTRY_KEY}=${ICQQ_GITHUB_REGISTRY}`;
  switch (pm) {
    case "pnpm":
      return [];
    case "cnpm":
    case "yarn":
    case "npm":
    default:
      return [regFlag];
  }
}

/** 日志用：展示将执行的命令（不含 token） */
export function formatInstallCommandForLog(
  pm: PackageManager,
  baseArgs: string[],
): string {
  return [pm === "yarn" ? "yarn/npm" : pm, ...baseArgs].join(" ");
}

export function describeAuthCompat(pm: PackageManager, major: number | null): string {
  const ver = major === null ? "unknown" : String(major);
  switch (pm) {
    case "pnpm":
      if (major !== null && major >= 11) {
        return `pnpm@${ver}（pnpm_config + npm_config env）`;
      }
      if (major !== null && major >= 9) {
        return `pnpm@${ver}（npm_config env）`;
      }
      return `pnpm@${ver}（npm_config env）`;
    case "yarn":
      return major !== null && major === 1
        ? `yarn@${ver}（经 npm 安装）`
        : `yarn@${ver}（yarn npm → npm env）`;
    case "cnpm":
      return `cnpm@${ver}（npm_config env）`;
    default:
      return `npm@${ver}（npm_config env）`;
  }
}

/** 安装失败时是否值得换用 npm 再试（pnpm/yarn/cnpm 认证失败） */
export function shouldFallbackToNpm(
  primary: PackageManager,
  kind: "auth" | "other",
): boolean {
  return kind === "auth" && primary !== "npm";
}

/** 404 且请求落在 npmjs → 多半是 scope registry 未生效 */
export function isWrongRegistry404(detail: string): boolean {
  return (
    /404/.test(detail) &&
    /registry\.npmjs\.org/i.test(detail) &&
    /@icqqjs/i.test(detail)
  );
}
