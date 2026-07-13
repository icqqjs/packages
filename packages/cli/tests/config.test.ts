import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs/promises before importing config
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

import fs from "node:fs/promises";
import {
  loadConfig,
  getAccountConfig,
  setAccountConfig,
  saveConfig,
  resolveRpcConfig,
  resolveMcpConfig,
  resolveMcpConfigForUin,
  resolveRpcConfigForUin,
  resolveUin,
  resolveConfigScopeUin,
} from "../src/lib/config.ts";

describe("loadConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns default config when file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    const config = await loadConfig();
    expect(config).toEqual({ accounts: {} });
  });

  it("parses valid config", async () => {
    const data = JSON.stringify({
      currentUin: 12345,
      accounts: { "12345": { platform: 2, signApiUrl: "https://sign.example.com" } },
    });
    vi.mocked(fs.readFile).mockResolvedValue(data);
    const config = await loadConfig();
    expect(config.currentUin).toBe(12345);
    expect(config.accounts["12345"].platform).toBe(2);
  });

  it("migrates defaultUin to currentUin", async () => {
    const data = JSON.stringify({
      defaultUin: 99999,
      accounts: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(data);
    const config = await loadConfig();
    expect(config.currentUin).toBe(99999);
    expect((config as any).defaultUin).toBeUndefined();
  });

  it("prefers currentUin over defaultUin", async () => {
    const data = JSON.stringify({
      defaultUin: 11111,
      currentUin: 22222,
      accounts: {},
    });
    vi.mocked(fs.readFile).mockResolvedValue(data);
    const config = await loadConfig();
    expect(config.currentUin).toBe(22222);
  });
});

describe("getAccountConfig", () => {
  it("returns account config for existing uin", () => {
    const config = {
      currentUin: 123,
      accounts: { "123": { platform: 2, signApiUrl: "https://sign.example.com" } },
    };
    expect(getAccountConfig(config, 123)).toEqual({ platform: 2, signApiUrl: "https://sign.example.com" });
  });

  it("returns undefined for missing uin", () => {
    const config = { accounts: {} };
    expect(getAccountConfig(config, 999)).toBeUndefined();
  });
});

describe("setAccountConfig", () => {
  it("sets account config", () => {
    const config = { accounts: {} as Record<string, any> };
    setAccountConfig(config, 123, { platform: 3, signApiUrl: "https://sign.test" });
    expect(config.accounts["123"]).toEqual({ platform: 3, signApiUrl: "https://sign.test" });
  });
});

describe("saveConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates home dir and writes config with trailing newline", async () => {
    const config = { currentUin: 12345, accounts: {} };

    await saveConfig(config);

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining(".icqq"), {
      recursive: true,
      mode: 0o700,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("config.json"),
      JSON.stringify(config, null, 2) + "\n",
      { mode: 0o600 },
    );
  });
});

describe("resolveRpcConfig", () => {
  it("fills defaults", () => {
    expect(resolveRpcConfig()).toEqual({
      enabled: false,
      host: "127.0.0.1",
      port: 0,
    });
  });

  it("keeps provided values", () => {
    expect(resolveRpcConfig({ enabled: true, host: "0.0.0.0", port: 9100 })).toEqual({
      enabled: true,
      host: "0.0.0.0",
      port: 9100,
    });
  });
});

describe("resolveMcpConfig", () => {
  it("fills defaults", () => {
    expect(resolveMcpConfig()).toEqual({
      enabled: false,
      http: {
        host: "127.0.0.1",
        port: 0,
        token: undefined,
      },
      plugins: undefined,
    });
  });

  it("keeps provided values", () => {
    expect(
      resolveMcpConfig({
        enabled: true,
        http: { host: "0.0.0.0", port: 3920, token: "secret" },
        plugins: ["plugin-a"],
      }),
    ).toEqual({
      enabled: true,
      http: {
        host: "0.0.0.0",
        port: 3920,
        token: "secret",
      },
      plugins: ["plugin-a"],
    });
  });
});

describe("resolveMcpConfigForUin", () => {
  it("merges global switches with account ports only from account", () => {
    const config = {
      mcp: {
        enabled: true,
        http: { host: "127.0.0.1", port: 61500, token: "global" },
      },
      rpc: { enabled: false, host: "127.0.0.1", port: 9000 },
      accounts: {
        "8596238": {
          platform: 3,
          signApiUrl: "https://sign.example.com",
          mcp: { http: { port: 61501 } },
          rpc: { enabled: true, port: 9001 },
        },
      },
    };

    expect(resolveMcpConfigForUin(config, 8596238)).toEqual({
      enabled: true,
      http: { host: "127.0.0.1", port: 61501, token: "global" },
      plugins: undefined,
    });
    expect(resolveRpcConfigForUin(config, 8596238)).toEqual({
      enabled: true,
      host: "127.0.0.1",
      port: 9001,
    });
  });

  it("uses port 0 when account has no port", () => {
    const config = {
      mcp: { enabled: true, http: { host: "127.0.0.1", port: 61500 } },
      accounts: {
        "123": { platform: 3, signApiUrl: "https://sign.example.com" },
      },
    };
    expect(resolveMcpConfigForUin(config, 123).http.port).toBe(0);
  });
});

describe("resolveConfigScopeUin", () => {
  const originalEnv = process.env.ICQQ_CURRENT_UIN;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ICQQ_CURRENT_UIN;
    else process.env.ICQQ_CURRENT_UIN = originalEnv;
  });

  it("returns undefined when env is unset", () => {
    delete process.env.ICQQ_CURRENT_UIN;
    expect(resolveConfigScopeUin()).toBeUndefined();
  });

  it("returns parsed uin from ICQQ_CURRENT_UIN", () => {
    process.env.ICQQ_CURRENT_UIN = "12345";
    expect(resolveConfigScopeUin()).toBe(12345);
  });

  it("returns undefined for invalid env values", () => {
    process.env.ICQQ_CURRENT_UIN = "abc";
    expect(resolveConfigScopeUin()).toBeUndefined();
    process.env.ICQQ_CURRENT_UIN = "0";
    expect(resolveConfigScopeUin()).toBeUndefined();
    process.env.ICQQ_CURRENT_UIN = "-1";
    expect(resolveConfigScopeUin()).toBeUndefined();
  });
});

describe("resolveUin", () => {
  const originalEnv = process.env.ICQQ_CURRENT_UIN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ICQQ_CURRENT_UIN;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ICQQ_CURRENT_UIN;
    else process.env.ICQQ_CURRENT_UIN = originalEnv;
  });

  it("prefers ICQQ_CURRENT_UIN env", async () => {
    process.env.ICQQ_CURRENT_UIN = "24680";

    await expect(resolveUin()).resolves.toBe(24680);
  });

  it("falls back to currentUin in config", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      currentUin: 13579,
      accounts: {},
    }));

    await expect(resolveUin()).resolves.toBe(13579);
  });

  it("throws when no active account exists", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ accounts: {} }));

    await expect(resolveUin()).rejects.toThrow("未找到已登录账号");
  });
});
