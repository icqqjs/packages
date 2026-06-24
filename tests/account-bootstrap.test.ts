import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import {
  awaitLoginOutcome,
  bindInteractiveLoginHandlers,
  LOGIN_INTERACTIVE_ERRORS,
  runPostLoginSetup,
  waitForLoginOutcome,
} from "../src/lib/account-bootstrap.js";

const bootstrapMocks = vi.hoisted(() => ({
  loadConfig: vi.fn(async () => ({ accounts: {} })),
  saveConfig: vi.fn(async () => {}),
  setAccountConfig: vi.fn(),
  findNetworkPortConflict: vi.fn(() => null as string | null),
  persistGlobalNetworkSetup: vi.fn(),
  persistAccountNetworkSetup: vi.fn(),
  syncAssignedPortsToAccount: vi.fn(async () => ({ mcpPort: 9000, rpcPort: 9100 })),
  isDaemonRunning: vi.fn(async () => false),
  stopDaemon: vi.fn(async () => {}),
  spawnDaemon: vi.fn(async () => {}),
  tmpDir: "",
  accountDirs: [] as string[],
}));

vi.mock("@/lib/config.js", () => ({
  loadConfig: bootstrapMocks.loadConfig,
  saveConfig: bootstrapMocks.saveConfig,
  setAccountConfig: bootstrapMocks.setAccountConfig,
}));

vi.mock("@/lib/login-network-setup.js", () => ({
  findNetworkPortConflict: bootstrapMocks.findNetworkPortConflict,
  persistGlobalNetworkSetup: bootstrapMocks.persistGlobalNetworkSetup,
  persistAccountNetworkSetup: bootstrapMocks.persistAccountNetworkSetup,
  syncAssignedPortsToAccount: bootstrapMocks.syncAssignedPortsToAccount,
}));

vi.mock("@/daemon/supervisor.js", () => ({
  isDaemonRunning: bootstrapMocks.isDaemonRunning,
  stopDaemon: bootstrapMocks.stopDaemon,
  spawnDaemon: bootstrapMocks.spawnDaemon,
}));

vi.mock("@/lib/paths.js", () => ({
  getTmpDir: () => bootstrapMocks.tmpDir,
  getAccountDir: (uin: number) => {
    const dir = join(dirname(bootstrapMocks.tmpDir), `icqq-account-${uin}`);
    bootstrapMocks.accountDirs.push(dir);
    return dir;
  },
}));

function createLoginClient() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    login: vi.fn(async () => undefined),
    once: emitter.once.bind(emitter),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
  });
}

describe("account-bootstrap", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    bootstrapMocks.tmpDir = await fs.mkdtemp(join(tmpdir(), "icqq-bootstrap-"));
    bootstrapMocks.accountDirs = [];
    vi.clearAllMocks();
    bootstrapMocks.loadConfig.mockResolvedValue({ accounts: {} });
    bootstrapMocks.findNetworkPortConflict.mockReturnValue(null);
    bootstrapMocks.syncAssignedPortsToAccount.mockResolvedValue({
      mcpPort: 9000,
      rpcPort: 9100,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(bootstrapMocks.tmpDir, { recursive: true, force: true });
    for (const dir of bootstrapMocks.accountDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("reject policy resolves on system.online", async () => {
    const client = createLoginClient();
    const promise = awaitLoginOutcome(client, "reject", () => client.login(123), {
      errorVariant: "daemon",
    });
    client.emit("system.online");
    await expect(promise).resolves.toBeUndefined();
  });

  it("reject policy rejects all five interactive events for daemon", async () => {
    const client = createLoginClient();
    const events = [
      ["system.login.qrcode", LOGIN_INTERACTIVE_ERRORS.daemon.qrcode],
      ["system.login.slider", LOGIN_INTERACTIVE_ERRORS.daemon.slider],
      ["system.login.device", LOGIN_INTERACTIVE_ERRORS.daemon.device],
      ["system.login.auth", LOGIN_INTERACTIVE_ERRORS.daemon.auth],
    ] as const;

    for (const [event, message] of events) {
      const c = createLoginClient();
      const promise = awaitLoginOutcome(c, "reject", () => c.login(1), {
        errorVariant: "daemon",
      });
      c.emit(event);
      await expect(promise).rejects.toThrow(message);
    }
  });

  it("waitForLoginOutcome times out for reconnect", async () => {
    const client = createLoginClient();
    const promise = waitForLoginOutcome(client, {
      errorVariant: "reconnect",
      timeoutMs: 1000,
    });
    vi.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow(LOGIN_INTERACTIVE_ERRORS.reconnect.timeout);
  });

  it("bindInteractiveLoginHandlers forwards events to callbacks", () => {
    const client = createLoginClient();
    const onQrcode = vi.fn();
    const dispose = bindInteractiveLoginHandlers(client, {
      onOnline: vi.fn(),
      onLoginError: vi.fn(),
      onQrcode,
      onSlider: vi.fn(),
      onDevice: vi.fn(),
      onAuth: vi.fn(),
    });

    client.emit("system.login.qrcode", { image: Buffer.from("x") });
    expect(onQrcode).toHaveBeenCalled();
    dispose();
    client.emit("system.login.qrcode", { image: Buffer.from("y") });
    expect(onQrcode).toHaveBeenCalledTimes(1);
  });

  it("awaitLoginOutcome propagates loginFn failures", async () => {
    const client = createLoginClient();
    const promise = awaitLoginOutcome(
      client,
      "reject",
      () => Promise.reject(new Error("login boom")),
      { errorVariant: "daemon" },
    );
    await expect(promise).rejects.toThrow("login boom");
  });

  it("awaitLoginOutcome times out for daemon when configured", async () => {
    const client = createLoginClient();
    const promise = awaitLoginOutcome(client, "reject", () => client.login(1), {
      errorVariant: "daemon",
      timeoutMs: 500,
    });
    vi.advanceTimersByTime(500);
    await expect(promise).rejects.toThrow(LOGIN_INTERACTIVE_ERRORS.daemon.timeout);
  });

  it("runPostLoginSetup migrates tmp data and starts daemon", async () => {
    const actualUin = 424242;
    const accountDir = join(dirname(bootstrapMocks.tmpDir), `icqq-account-${actualUin}`);
    await fs.writeFile(join(bootstrapMocks.tmpDir, "session.dat"), "data", "utf8");

    const client = {
      uin: actualUin,
      terminate: vi.fn(),
    };

    const result = await runPostLoginSetup({
      client: client as never,
      dataDir: bootstrapMocks.tmpDir,
      finalOpts: {
        platform: 3,
        signApiUrl: "https://sign.example.com",
        ver: "2.0",
        network: { mcpPort: 0, rpcPort: 0 },
      },
      firstNetworkSetup: true,
    });

    expect(await fs.readFile(join(accountDir, "session.dat"), "utf8")).toBe("data");
    expect(bootstrapMocks.persistGlobalNetworkSetup).toHaveBeenCalled();
    expect(bootstrapMocks.spawnDaemon).toHaveBeenCalledWith(actualUin);
    expect(result).toEqual({
      uin: actualUin,
      networkSavedScope: "global",
      assignedPortNote: "端口已写入账号配置：MCP 9000，RPC 9100",
    });
  });

  it("runPostLoginSetup uses account network scope on subsequent setup", async () => {
    const client = { uin: 111, terminate: vi.fn() };
    const result = await runPostLoginSetup({
      client: client as never,
      dataDir: "/var/other",
      finalOpts: {
        platform: 1,
        signApiUrl: "",
        ver: "",
        network: { mcpPort: 0, rpcPort: 0 },
      },
      firstNetworkSetup: false,
    });
    expect(bootstrapMocks.persistGlobalNetworkSetup).not.toHaveBeenCalled();
    expect(bootstrapMocks.persistAccountNetworkSetup).toHaveBeenCalled();
    expect(result.networkSavedScope).toBe("account");
  });

  it("runPostLoginSetup throws on port conflict", async () => {
    bootstrapMocks.findNetworkPortConflict.mockReturnValue("端口冲突");
    await expect(
      runPostLoginSetup({
        client: { uin: 1, terminate: vi.fn() } as never,
        dataDir: "/x",
        finalOpts: {
          platform: 1,
          signApiUrl: "",
          ver: "",
          network: { mcpPort: 1, rpcPort: 2 },
        },
        firstNetworkSetup: false,
      }),
    ).rejects.toThrow("端口冲突");
  });
});
