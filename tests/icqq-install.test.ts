import { describe, it, expect } from "vitest";
import {
  classifyInstallFailure,
  githubInstallInvocation,
  resolveSetupToken,
  summarizeInstallFailure,
} from "../src/lib/icqq-install.js";

describe("icqq-install", () => {
  it("github install sets scope registry and pnpm 11 auth config", () => {
    const { args } = githubInstallInvocation("pnpm", { majorVersion: 11 });
    expect(args).toContain("--config.@icqqjs:registry=https://npm.pkg.github.com");
    expect(args.some((a) => a.includes("_authToken"))).toBe(true);
    expect(args.join(" ")).toContain("${GITHUB_TOKEN}");
  });

  it("classifies auth errors", () => {
    expect(classifyInstallFailure("npm ERR! code E401")).toBe("auth");
    expect(classifyInstallFailure("network timeout")).toBe("other");
  });

  it("summarize auth failure", () => {
    expect(summarizeInstallFailure("auth", "")).toContain("read:packages");
  });

  it("resolveSetupToken prefers flag over env", () => {
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "from-env";
    expect(resolveSetupToken("from-flag")).toBe("from-flag");
    if (prev === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prev;
  });
});
