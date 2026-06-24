import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  getAccountConfig: vi.fn(),
  preflightDaemonNetworkPorts: vi.fn(),
  createIcqqClient: vi.fn(),
  cleanupDaemonStartupArtifacts: vi.fn(),
  initIcqqMessageIdBuilders: vi.fn(),
  resolveRpcConfigForUin: vi.fn(),
  resolveMcpConfigForUin: vi.fn(),
  fromClient: vi.fn(),
  managedStart: vi.fn(),
  notifyReady: vi.fn(),
  attachSignalHandlers: vi.fn(),
  attachLifecycleHandlers: vi.fn(),
}));

vi.mock("@/lib/config.js", () => ({
  loadConfig: mocks.loadConfig,
  getAccountConfig: mocks.getAccountConfig,
  resolveRpcConfigForUin: mocks.resolveRpcConfigForUin,
  resolveMcpConfigForUin: mocks.resolveMcpConfigForUin,
}));

vi.mock("@/lib/login-network-setup.js", () => ({
  preflightDaemonNetworkPorts: mocks.preflightDaemonNetworkPorts,
}));

vi.mock("@/lib/client.js", () => ({
  createIcqqClient: mocks.createIcqqClient,
}));

vi.mock("../src/daemon/entry-cleanup.js", () => ({
  cleanupDaemonStartupArtifacts: mocks.cleanupDaemonStartupArtifacts,
}));

vi.mock("@/lib/icqq-message-id.js", () => ({
  initIcqqMessageIdBuilders: mocks.initIcqqMessageIdBuilders,
}));

vi.mock("../src/daemon/daemon-context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/daemon/daemon-context.js")>();
  return {
    ...actual,
    DaemonContext: {
      fromClient: mocks.fromClient,
    },
  };
});

vi.mock("../src/daemon/server.js", () => ({
  DaemonServer: class MockDaemonServer {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});
    getRpcPort = vi.fn(() => 0);
  },
}));

vi.mock("@/mcp/host.js", () => ({
  McpHost: class MockMcpHost {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});
    getEndpointUrl = vi.fn(() => null);
  },
}));

vi.mock("../src/daemon/managed-runtime.js", () => ({
  ManagedRuntime: class MockManagedRuntime {
    start = mocks.managedStart;
    notifyReady = mocks.notifyReady;
    attachSignalHandlers = mocks.attachSignalHandlers;
    attachLifecycleHandlers = mocks.attachLifecycleHandlers;
  },
}));

import { runDaemonEntry } from "../src/daemon/entry.js";

function createLoginClient() {
  const listeners = new Map<string, (event?: unknown) => void>();
  return {
    once: vi.fn((event: string, listener: (event?: unknown) => void) => {
      listeners.set(event, listener);
    }),
    on: vi.fn(),
    login: vi.fn(async () => {
      listeners.get("system.online")?.();
    }),
  };
}

describe("runDaemonEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockResolvedValue({ accounts: { 123: { uin: 123 } } });
    mocks.getAccountConfig.mockReturnValue({ uin: 123 });
    mocks.preflightDaemonNetworkPorts.mockReturnValue(null);
    mocks.createIcqqClient.mockResolvedValue(createLoginClient());
    mocks.resolveRpcConfigForUin.mockReturnValue({ enabled: false, host: "127.0.0.1", port: 0 });
    mocks.resolveMcpConfigForUin.mockReturnValue({ enabled: false });
    mocks.fromClient.mockResolvedValue({
      notifications: { notifyFriendRequest: vi.fn() },
    });
    mocks.managedStart.mockResolvedValue({
      socketPath: "/tmp/icqq.sock",
      rpcAddress: null,
      mcpUrl: null,
    });
  });

  it("bootstraps daemon runtime on success", async () => {
    const runtime = await runDaemonEntry(123);
    expect(runtime).toBeTruthy();
    expect(mocks.managedStart).toHaveBeenCalled();
    expect(mocks.notifyReady).toHaveBeenCalled();
    expect(mocks.cleanupDaemonStartupArtifacts).not.toHaveBeenCalled();
  });

  it("cleans up when account config is missing", async () => {
    mocks.getAccountConfig.mockReturnValue(undefined);
    await expect(runDaemonEntry(123)).rejects.toThrow("未找到账号");
    expect(mocks.cleanupDaemonStartupArtifacts).toHaveBeenCalledWith(123);
  });

  it("cleans up on port conflict", async () => {
    mocks.preflightDaemonNetworkPorts.mockReturnValue("MCP 端口冲突");
    await expect(runDaemonEntry(123)).rejects.toThrow("网络端口冲突");
    expect(mocks.cleanupDaemonStartupArtifacts).toHaveBeenCalledWith(123);
  });

  it("rejects qrcode login during daemon bootstrap", async () => {
    const client = createLoginClient();
    client.login.mockImplementation(async () => {
      client.once.mock.calls.find(([event]) => event === "system.login.qrcode")?.[1]?.();
    });
    mocks.createIcqqClient.mockResolvedValue(client);

    await expect(runDaemonEntry(123)).rejects.toThrow("Token 过期");
    expect(mocks.cleanupDaemonStartupArtifacts).toHaveBeenCalledWith(123);
  });

  it("rejects slider login during daemon bootstrap", async () => {
    const client = createLoginClient();
    client.login.mockImplementation(async () => {
      client.once.mock.calls.find(([event]) => event === "system.login.slider")?.[1]?.();
    });
    mocks.createIcqqClient.mockResolvedValue(client);

    await expect(runDaemonEntry(123)).rejects.toThrow("滑块验证");
  });

  it("starts MCP host when enabled", async () => {
    mocks.resolveMcpConfigForUin.mockReturnValue({ enabled: true });
    mocks.managedStart.mockResolvedValue({
      socketPath: "/tmp/icqq.sock",
      rpcAddress: "127.0.0.1:9000",
      mcpUrl: "http://127.0.0.1:3100",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await runDaemonEntry(123);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("MCP 已启用"));
    logSpy.mockRestore();
  });
});
