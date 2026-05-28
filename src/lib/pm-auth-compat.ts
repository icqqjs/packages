import type { PackageManager } from "./package-manager.js";

export const ICQQ_GITHUB_REGISTRY = "https://npm.pkg.github.com";
export const GITHUB_PACKAGES_AUTH_KEY = "//npm.pkg.github.com/:_authToken";

export type AuthCompatProfile = {
  /** 日志用标识，如 pnpm11、npm10 */
  id: string;
  env: Record<string, string>;
  /** 追加到 install 子命令后的 CLI 参数（token 用 ${GITHUB_TOKEN} 占位，由 env 注入） */
  extraArgs: string[];
};

const AUTH_PLACEHOLDER = "${GITHUB_TOKEN}";
const REGISTRY_SCOPE_ARG = `@icqqjs:registry=${ICQQ_GITHUB_REGISTRY}`;
const PNPM_REGISTRY_CONFIG = `--config.${REGISTRY_SCOPE_ARG}`;
const PNPM_AUTH_CONFIG = `--config.${GITHUB_PACKAGES_AUTH_KEY}=${AUTH_PLACEHOLDER}`;

function baseTokenEnv(token: string): Record<string, string> {
  return {
    GITHUB_TOKEN: token,
    NODE_AUTH_TOKEN: token,
  };
}

/** npm_config_*（pnpm 9–10、npm 8–11、cnpm 均适用） */
function npmConfigAuthEnv(token: string): Record<string, string> {
  return {
    [`npm_config_${GITHUB_PACKAGES_AUTH_KEY}`]: token,
  };
}

/** pnpm 11+ 读取 pnpm_config_*，不再读 npm_config_* 作为配置项（仍可同时设置以防混用） */
function pnpmConfigAuthEnv(token: string): Record<string, string> {
  return {
    [`pnpm_config_${GITHUB_PACKAGES_AUTH_KEY}`]: token,
  };
}

/**
 * 按包管理器主版本生成认证环境变量（合并策略，单次安装即可）。
 * major 为 null 时采用「全量兼容」：同时设置 npm_config 与 pnpm_config。
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
      Object.assign(env, npmConfigAuthEnv(token));
      break;
    case "yarn":
      // Yarn 2+ 的 `yarn npm` 子命令走 npm 协议与 env
      Object.assign(env, npmConfigAuthEnv(token));
      break;
    default:
      Object.assign(env, npmConfigAuthEnv(token));
  }

  return env;
}

/**
 * 安装命令额外参数（registry + 可选 auth config）。
 */
export function buildInstallExtraArgs(
  pm: PackageManager,
  major: number | null,
): string[] {
  switch (pm) {
    case "pnpm": {
      const args = [PNPM_REGISTRY_CONFIG];
      // pnpm 9+ 支持 --config.//host/:_authToken=${VAR}
      if (major === null || major >= 9) {
        args.push(PNPM_AUTH_CONFIG);
      }
      return args;
    }
    case "cnpm":
      return [`--${REGISTRY_SCOPE_ARG}`];
    case "yarn": {
      // Yarn 1 无稳定的不写配置全局 GitHub 安装路径，由 icqq-install 走 npm
      if (major !== null && major >= 2) {
        return [`--${REGISTRY_SCOPE_ARG}`];
      }
      return [`--${REGISTRY_SCOPE_ARG}`];
    }
    case "npm":
    default:
      return [`--${REGISTRY_SCOPE_ARG}`];
  }
}

export function describeAuthCompat(pm: PackageManager, major: number | null): string {
  const ver = major === null ? "unknown" : String(major);
  switch (pm) {
    case "pnpm":
      if (major !== null && major >= 11) {
        return `pnpm@${ver}（pnpm_config + CLI config）`;
      }
      if (major !== null && major >= 9) {
        return `pnpm@${ver}（npm_config + CLI config）`;
      }
      return `pnpm@${ver}（npm_config）`;
    case "yarn":
      return major !== null && major === 1
        ? `yarn@${ver}（经 npm 安装）`
        : `yarn@${ver}（yarn npm → npm 认证）`;
    case "cnpm":
      return `cnpm@${ver}（npm_config）`;
    default:
      return `npm@${ver}（npm_config）`;
  }
}

/** 安装失败时是否值得换用 npm 再试（pnpm/yarn/cnpm 认证失败） */
export function shouldFallbackToNpm(
  primary: PackageManager,
  kind: "auth" | "other",
): boolean {
  return kind === "auth" && primary !== "npm";
}
