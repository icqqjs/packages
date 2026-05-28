import { describe, it, expect } from "vitest";
import {
  classifyInstallFailure,
  githubInstallInvocation,
  resolveSetupToken,
  summarizeInstallFailure,
} from "../src/lib/icqq-install.js";

describe("icqq-install", () => {
  it("github install sets scope registry via CLI only", () => {
    const { args } = githubInstallInvocation("pnpm");
    expect(args).toContain("--config.@icqqjs:registry=https://npm.pkg.github.com");
    expect(args.join(" ")).not.toContain("_authToken");
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
