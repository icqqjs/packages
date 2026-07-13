import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NETWORK_SETUP,
  accountNetworkDefaultsFromConfig,
  findNetworkPortConflict,
  formatNetworkSetupSummary,
  isGlobalNetworkConfigured,
  parseNetworkPortInput,
  persistAccountNetworkSetup,
  persistGlobalNetworkSetup,
  pickAutoMcpPort,
  pickAutoRpcPort,
  preflightDaemonNetworkPorts,
  resolveNetworkPortInput,
  syncAssignedPortsToAccount,
} from "../src/lib/login-network-setup.js";

vi.mock("../src/lib/port-availability.js", () => ({
  isPortInUse: vi.fn(() => false),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock("../src/lib/paths.js", () => ({
  readMcpEndpoint: vi.fn(),
  getRpcPortPath: vi.fn((uin: number) => `/mock/${uin}/daemon.rpc`),
}));

import fs from "node:fs/promises";
import { readMcpEndpoint } from "../src/lib/paths.js";

import { isPortInUse } from "../src/lib/port-availability.js";

const isPortInUseMock = vi.mocked(isPortInUse);

describe("login-network-setup", () => {
  beforeEach(() => {
    isPortInUseMock.mockReset();
    isPortInUseMock.mockReturnValue(false);
    vi.mocked(readMcpEndpoint).mockReset();
    vi.mocked(fs.readFile).mockReset();
  });

  it("detects first-time global network config", () => {
    expect(isGlobalNetworkConfigured({ accounts: {} })).toBe(false);
    expect(
      isGlobalNetworkConfigured({
        accounts: {},
        mcp: { enabled: true, http: { host: "127.0.0.1" } },
      }),
    ).toBe(true);
  });

  it("persists global without ports on first setup", () => {
    const config = { accounts: {} as Record<string, unknown> };
    persistGlobalNetworkSetup(config, {
      ...DEFAULT_NETWORK_SETUP,
      mcpPort: 61500,
      rpcPort: 9100,
    });
    expect(config.mcp?.enabled).toBe(true);
    expect(config.mcp?.http?.port).toBeUndefined();
    expect(config.rpc?.port).toBeUndefined();
  });

  it("persists account ports on second setup", () => {
    const config = {
      mcp: { enabled: true, http: { host: "127.0.0.1" } },
      rpc: { enabled: false, host: "127.0.0.1" },
      accounts: {
        "12345": { platform: 3, signApiUrl: "https://sign.example.com" },
      },
    };
    persistAccountNetworkSetup(config, 12345, {
      ...DEFAULT_NETWORK_SETUP,
      mcpPort: 61501,
      rpcPort: 9101,
      rpcEnabled: true,
    });
    expect(config.accounts["12345"]?.mcp?.http?.port).toBe(61501);
    expect(config.accounts["12345"]?.rpc?.port).toBe(9101);
    expect(config.mcp?.http?.port).toBeUndefined();
  });

  it("ignores global port when loading account defaults", () => {
    const config = {
      mcp: { enabled: true, http: { host: "127.0.0.1", port: 61500 } },
      accounts: {
        "99": {
          platform: 1,
          signApiUrl: "",
          mcp: { http: { port: 61501 } },
          rpc: { enabled: true, port: 9100 },
        },
      },
    };
    expect(accountNetworkDefaultsFromConfig(config, 99).mcpPort).toBe(61501);
    expect(accountNetworkDefaultsFromConfig(config, 99).rpcPort).toBe(9100);
  });

  it("detects port conflicts with other accounts", () => {
    const config = {
      accounts: {
        "111": {
          platform: 1,
          signApiUrl: "",
          mcp: { http: { port: 61501 } },
          rpc: { port: 9100 },
        },
      },
    };
    expect(
      findNetworkPortConflict(config, 222, {
        mcpEnabled: true,
        mcpPort: 61501,
        rpcEnabled: false,
        rpcPort: 0,
      }),
    ).toContain("61501");
    expect(
      findNetworkPortConflict(config, 222, {
        mcpEnabled: false,
        mcpPort: 0,
        rpcEnabled: true,
        rpcPort: 9100,
      }),
    ).toContain("9100");
  });

  it("detects system process port conflicts", () => {
    isPortInUseMock.mockImplementation((port) => port === 61500 || port === 9100);
    const config = { accounts: {} };
    expect(
      findNetworkPortConflict(config, undefined, {
        mcpEnabled: true,
        mcpPort: 61500,
        rpcEnabled: false,
        rpcPort: 0,
      }),
    ).toContain("系统进程");
    expect(
      findNetworkPortConflict(config, undefined, {
        mcpEnabled: false,
        mcpPort: 0,
        rpcEnabled: true,
        rpcPort: 9100,
      }),
    ).toContain("系统进程");
  });

  it("picks auto ports skipping system-in-use ports", () => {
    isPortInUseMock.mockImplementation((port) => port === 61500);
    const config = { accounts: {} };
    expect(pickAutoMcpPort(config, undefined)).toBe(61501);
  });

  it("parses port input", () => {
    expect(parseNetworkPortInput("")).toBe(0);
    expect(parseNetworkPortInput("3920")).toBe(3920);
    expect(() => parseNetworkPortInput("99999")).toThrow("端口");
  });

  it("picks auto ports avoiding other accounts", () => {
    const config = {
      accounts: {
        "111": {
          platform: 1,
          signApiUrl: "",
          mcp: { http: { port: 61500 } },
          rpc: { port: 9100 },
        },
      },
    };
    expect(pickAutoMcpPort(config, 222)).toBe(61501);
    expect(pickAutoRpcPort(config, 222)).toBe(9101);
    expect(pickAutoMcpPort(config, 222, [9101])).toBe(61501);
    expect(pickAutoRpcPort(config, 222, [61501])).toBe(9101);
  });

  it("resolveNetworkPortInput uses auto pick when empty", () => {
    const config = { accounts: {} };
    expect(
      resolveNetworkPortInput("", () => pickAutoMcpPort(config, undefined)),
    ).toBe(61500);
    expect(resolveNetworkPortInput("61502", () => 61500)).toBe(61502);
    expect(
      resolveNetworkPortInput("0", () => pickAutoMcpPort(config, undefined)),
    ).toBe(61500);
  });

  it("formatNetworkSetupSummary describes mcp/rpc choices", () => {
    expect(
      formatNetworkSetupSummary({
        ...DEFAULT_NETWORK_SETUP,
        mcpPort: 0,
        rpcPort: 0,
      }),
    ).toBe("MCP 开，端口 自动；RPC 关");
    expect(
      formatNetworkSetupSummary({
        ...DEFAULT_NETWORK_SETUP,
        mcpPort: 61501,
        mcpToken: "secret",
        rpcEnabled: true,
        rpcPort: 9101,
      }),
    ).toBe("MCP 开，端口 61501，已设 Token；RPC 开，127.0.0.1:9101");
  });

  it("syncAssignedPortsToAccount writes mcp and rpc ports from daemon files", async () => {
    vi.mocked(readMcpEndpoint).mockResolvedValue({
      host: "127.0.0.1",
      port: 61502,
      basePath: "/mcp",
    });
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ host: "127.0.0.1", port: 9102 }),
    );

    const config = {
      mcp: { enabled: true, http: { host: "127.0.0.1" } },
      rpc: { enabled: true, host: "127.0.0.1" },
      accounts: {
        "12345": { platform: 1, signApiUrl: "" },
      },
    };

    const out = await syncAssignedPortsToAccount(config, 12345);
    expect(out).toEqual({ mcpPort: 61502, rpcPort: 9102 });
    expect(config.accounts["12345"]?.mcp?.http?.port).toBe(61502);
    expect(config.accounts["12345"]?.rpc?.port).toBe(9102);
  });

  it("syncAssignedPortsToAccount skips disabled services", async () => {
    const config = {
      mcp: { enabled: false, http: { host: "127.0.0.1" } },
      rpc: { enabled: false, host: "127.0.0.1" },
      accounts: {},
    };
    const out = await syncAssignedPortsToAccount(config, 99);
    expect(out).toEqual({});
    expect(readMcpEndpoint).not.toHaveBeenCalled();
  });

  it("preflightDaemonNetworkPorts detects configured conflicts", () => {
    const config = {
      mcp: { enabled: true, http: { host: "127.0.0.1" } },
      rpc: { enabled: false, host: "127.0.0.1" },
      accounts: {
        "111": {
          platform: 1,
          signApiUrl: "",
          mcp: { http: { port: 61501 } },
        },
        "222": {
          platform: 1,
          signApiUrl: "",
          mcp: { http: { port: 61501 } },
        },
      },
    };
    expect(preflightDaemonNetworkPorts(config, 222)).toMatch(/61501/);
  });
});
