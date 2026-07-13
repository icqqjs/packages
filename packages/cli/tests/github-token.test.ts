import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveGithubToken } from "../src/lib/github-token.js";

describe("github-token", () => {
  const prevHome = process.env.HOME;

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    vi.restoreAllMocks();
  });

  it("saves token to ~/.icqq/github.token with restricted permissions", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-home-"));
    process.env.HOME = tmpHome;

    await saveGithubToken("ghp_test_token_123");

    const tokenPath = path.join(tmpHome, ".icqq", "github.token");
    await expect(fs.readFile(tokenPath, "utf-8")).resolves.toBe("ghp_test_token_123\n");
    const mode = (await fs.stat(tokenPath)).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

describe("resolveSetupTokenWithSource saved token", () => {
  const prevHome = process.env.HOME;
  const prevGithub = process.env.GITHUB_TOKEN;
  const prevIcqq = process.env.ICQQ_GITHUB_TOKEN;

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevGithub === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevGithub;
    if (prevIcqq === undefined) delete process.env.ICQQ_GITHUB_TOKEN;
    else process.env.ICQQ_GITHUB_TOKEN = prevIcqq;
    vi.resetModules();
  });

  it("reads saved token when no flag or env is set", async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-home-"));
    process.env.HOME = tmpHome;
    delete process.env.GITHUB_TOKEN;
    delete process.env.ICQQ_GITHUB_TOKEN;

    const icqqDir = path.join(tmpHome, ".icqq");
    await fs.mkdir(icqqDir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(icqqDir, "github.token"), "ghp_saved\n", {
      mode: 0o600,
    });

    vi.resetModules();
    const { resolveSetupTokenWithSource } = await import("../src/lib/icqq-install.js");
    expect(resolveSetupTokenWithSource()).toEqual({
      token: "ghp_saved",
      source: "saved",
    });
  });
});
