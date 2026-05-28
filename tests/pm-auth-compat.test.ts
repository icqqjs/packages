import { describe, it, expect } from "vitest";
import {
  buildAuthEnv,
  buildInstallExtraArgs,
  describeAuthCompat,
  shouldFallbackToNpm,
} from "../src/lib/pm-auth-compat.js";
import { parseSemverMajor, isWithinSupportedMajorWindow } from "../src/lib/pm-version.js";
import { githubInstallInvocation } from "../src/lib/icqq-install.js";

describe("pm-version", () => {
  it("parseSemverMajor", () => {
    expect(parseSemverMajor("11.4.0")).toBe(11);
    expect(parseSemverMajor("v10.9.2")).toBe(10);
    expect(parseSemverMajor("1.22.22")).toBe(1);
  });

  it("isWithinSupportedMajorWindow", () => {
    expect(isWithinSupportedMajorWindow(11, 11)).toBe(true);
    expect(isWithinSupportedMajorWindow(9, 11)).toBe(true);
    expect(isWithinSupportedMajorWindow(8, 11)).toBe(false);
  });
});

describe("pm-auth-compat", () => {
  it("pnpm 11 sets pnpm_config and npm_config", () => {
    const env = buildAuthEnv("pnpm", "tok", 11);
    expect(env.GITHUB_TOKEN).toBe("tok");
    expect(env["pnpm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
    expect(env["npm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
  });

  it("pnpm 9 sets npm_config only in env layer", () => {
    const env = buildAuthEnv("pnpm", "tok", 9);
    expect(env["npm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
    expect(env["pnpm_config_//npm.pkg.github.com/:_authToken"]).toBeUndefined();
  });

  it("pnpm 10 same as 9 for env", () => {
    const env = buildAuthEnv("pnpm", "tok", 10);
    expect(env["npm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
    expect(env["pnpm_config_//npm.pkg.github.com/:_authToken"]).toBeUndefined();
  });

  it("npm 10 uses npm_config", () => {
    const env = buildAuthEnv("npm", "tok", 10);
    expect(env["npm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
  });

  it("null major enables broad compat for pnpm", () => {
    const env = buildAuthEnv("pnpm", "tok", null);
    expect(env["pnpm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
    expect(env["npm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
  });

  it("shouldFallbackToNpm on auth only", () => {
    expect(shouldFallbackToNpm("pnpm", "auth")).toBe(true);
    expect(shouldFallbackToNpm("npm", "auth")).toBe(false);
    expect(shouldFallbackToNpm("pnpm", "other")).toBe(false);
  });
});

describe("githubInstallInvocation versions", () => {
  it("pnpm 11 args", () => {
    const { args, authProfile } = githubInstallInvocation("pnpm", { majorVersion: 11 });
    expect(args).toContain("--config.@icqqjs:registry=https://npm.pkg.github.com");
    expect(args.join(" ")).toContain("_authToken");
    expect(authProfile).toContain("pnpm@11");
  });

  it("pnpm 9 args", () => {
    const { args } = githubInstallInvocation("pnpm", { majorVersion: 9 });
    expect(args.join(" ")).toContain("${GITHUB_TOKEN}");
  });

  it("yarn 1 uses npm command", () => {
    const { cmd } = githubInstallInvocation("yarn", { majorVersion: 1 });
    expect(cmd).toBe("npm");
  });

  it("yarn 4 uses yarn npm", () => {
    const { cmd, args } = githubInstallInvocation("yarn", { majorVersion: 4 });
    expect(cmd).toBe("yarn");
    expect(args[0]).toBe("npm");
  });

  it("cnpm registry flag", () => {
    const { args } = githubInstallInvocation("cnpm", { majorVersion: 9 });
    expect(args.some((a) => a.includes("@icqqjs:registry"))).toBe(true);
  });
});

describe("buildInstallExtraArgs", () => {
  it("describeAuthCompat yarn 1", () => {
    expect(describeAuthCompat("yarn", 1)).toContain("npm");
  });
});
