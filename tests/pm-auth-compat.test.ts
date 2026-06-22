import { describe, it, expect } from "vitest";
import {
  buildAuthEnv,
  buildInstallExtraArgs,
  describeAuthCompat,
  isWrongRegistry404,
  shouldFallbackToNpm,
  ICQQ_SCOPE_REGISTRY_KEY,
} from "../src/lib/pm-auth-compat.js";
import { parseSemverMajor, isWithinSupportedMajorWindow } from "../src/lib/pm-version.js";
import { githubInstallInvocation, ICQQ_PACKAGE } from "../src/lib/icqq-install.js";

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
  it("pnpm 11 sets pnpm_config registry and auth", () => {
    const env = buildAuthEnv("pnpm", "tok", 11);
    expect(env.GITHUB_TOKEN).toBe("tok");
    expect(env[`pnpm_config_${ICQQ_SCOPE_REGISTRY_KEY}`]).toBe(
      "https://npm.pkg.github.com",
    );
    expect(env[`pnpm_config_//npm.pkg.github.com/:_authToken`]).toBe("tok");
    expect(env[`pnpm_config_//npm.pkg.github.com/:always-auth`]).toBe("true");
  });

  it("pnpm 9 sets npm_config registry", () => {
    const env = buildAuthEnv("pnpm", "tok", 9);
    expect(env[`npm_config_${ICQQ_SCOPE_REGISTRY_KEY}`]).toBe(
      "https://npm.pkg.github.com",
    );
    expect(env["pnpm_config_//npm.pkg.github.com/:_authToken"]).toBeUndefined();
  });

  it("pnpm install uses --config scope registry flag", () => {
    expect(buildInstallExtraArgs("pnpm", 11)).toEqual([
      "--config.@icqqjs:registry=https://npm.pkg.github.com",
    ]);
  });

  it("npm install uses --@icqqjs:registry flag", () => {
    const args = buildInstallExtraArgs("npm", 10);
    expect(args[0]).toBe("--@icqqjs:registry=https://npm.pkg.github.com");
  });

  it("null major enables broad compat for pnpm", () => {
    const env = buildAuthEnv("pnpm", "tok", null);
    expect(env["pnpm_config_//npm.pkg.github.com/:_authToken"]).toBe("tok");
    expect(env[`npm_config_${ICQQ_SCOPE_REGISTRY_KEY}`]).toBe(
      "https://npm.pkg.github.com",
    );
  });

  it("shouldFallbackToNpm on auth only", () => {
    expect(shouldFallbackToNpm("pnpm", "auth")).toBe(true);
    expect(shouldFallbackToNpm("npm", "auth")).toBe(false);
  });

  it("shouldFallbackToNpm on wrong registry 404", () => {
    expect(
      shouldFallbackToNpm(
        "pnpm",
        "other",
        "GET https://registry.npmjs.org/@icqqjs%2Ficqq: Not Found - 404",
      ),
    ).toBe(true);
    expect(shouldFallbackToNpm("npm", "other", "404 registry.npmjs.org @icqqjs")).toBe(
      false,
    );
  });

  it("isWrongRegistry404", () => {
    expect(
      isWrongRegistry404(
        "GET https://registry.npmjs.org/@icqqjs%2Ficqq: Not Found - 404",
      ),
    ).toBe(true);
    expect(
      isWrongRegistry404("GET https://npm.pkg.github.com/@icqqjs%2Ficqq: 401"),
    ).toBe(false);
  });
});

describe("githubInstallInvocation versions", () => {
  it("pnpm 11 args include scope registry config flag", () => {
    const { args, authProfile } = githubInstallInvocation("pnpm", ICQQ_PACKAGE, {
      majorVersion: 11,
    });
    expect(args).toEqual([
      "add",
      "-g",
      ICQQ_PACKAGE,
      "--config.@icqqjs:registry=https://npm.pkg.github.com",
    ]);
    expect(authProfile).toContain("pnpm@11");
  });

  it("pnpm 9 args", () => {
    const { args } = githubInstallInvocation("pnpm", ICQQ_PACKAGE, { majorVersion: 9 });
    expect(args).toEqual([
      "add",
      "-g",
      ICQQ_PACKAGE,
      "--config.@icqqjs:registry=https://npm.pkg.github.com",
    ]);
  });

  it("yarn 1 uses npm command", () => {
    const { cmd } = githubInstallInvocation("yarn", ICQQ_PACKAGE, { majorVersion: 1 });
    expect(cmd).toBe("npm");
  });

  it("yarn 4 uses yarn npm", () => {
    const { cmd, args } = githubInstallInvocation("yarn", ICQQ_PACKAGE, { majorVersion: 4 });
    expect(cmd).toBe("yarn");
    expect(args[0]).toBe("npm");
  });

  it("npm has registry flag", () => {
    const { args } = githubInstallInvocation("npm", ICQQ_PACKAGE, { majorVersion: 10 });
    expect(args.some((a) => a.startsWith("--@icqqjs:registry="))).toBe(true);
  });
});

describe("buildInstallExtraArgs", () => {
  it("describeAuthCompat yarn 1", () => {
    expect(describeAuthCompat("yarn", 1)).toContain("npm");
  });
});
