import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GITHUB_ALWAYS_AUTH_KEY,
  GITHUB_PACKAGES_AUTH_KEY,
  ICQQ_GITHUB_REGISTRY,
  ICQQ_SCOPE_REGISTRY_KEY,
} from "./pm-auth-compat.js";

/** 临时 user-level .npmrc（通过 NPM_CONFIG_USERCONFIG 注入，不修改 ~/.npmrc）。 */
export function buildEphemeralNpmrcEnv(token: string): {
  env: Record<string, string>;
  cleanup: () => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "icqq-auth-"));
  const rcPath = path.join(dir, ".npmrc");
  const content = [
    `${ICQQ_SCOPE_REGISTRY_KEY}=${ICQQ_GITHUB_REGISTRY}`,
    `${GITHUB_PACKAGES_AUTH_KEY}=${token}`,
    `${GITHUB_ALWAYS_AUTH_KEY}=true`,
  ].join("\n");
  fs.writeFileSync(rcPath, `${content}\n`, { mode: 0o600 });

  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };

  return {
    env: { NPM_CONFIG_USERCONFIG: rcPath },
    cleanup,
  };
}
