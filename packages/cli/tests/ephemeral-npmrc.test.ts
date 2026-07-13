import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildEphemeralNpmrcEnv } from "../src/lib/ephemeral-npmrc.js";

describe("ephemeral-npmrc", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  });

  it("writes scope registry and auth to a temp userconfig file", () => {
    const { env, cleanup } = buildEphemeralNpmrcEnv("ghp_test");
    cleanups.push(cleanup);

    const rcPath = env.NPM_CONFIG_USERCONFIG;
    expect(rcPath).toBeTruthy();
    expect(fs.existsSync(rcPath)).toBe(true);

    const content = fs.readFileSync(rcPath, "utf-8");
    expect(content).toContain("@icqqjs:registry=https://npm.pkg.github.com");
    expect(content).toContain("//npm.pkg.github.com/:_authToken=ghp_test");
    expect(content).toContain("//npm.pkg.github.com/:always-auth=true");
    expect((fs.statSync(rcPath).mode & 0o777)).toBe(0o600);
    expect(rcPath.startsWith(os.tmpdir())).toBe(true);
  });

  it("cleanup removes temp directory", () => {
    const { env, cleanup } = buildEphemeralNpmrcEnv("ghp_test");
    const rcPath = env.NPM_CONFIG_USERCONFIG;
    cleanup();
    expect(fs.existsSync(path.dirname(rcPath))).toBe(false);
  });
});
