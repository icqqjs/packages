import { describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runLoginWaitingRuntime: vi.fn(async () => {}),
  sendDaemonAlert: vi.fn(async () => {}),
}));

vi.mock("../src/daemon/login-waiting-runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/daemon/login-waiting-runtime.js")>();
  return {
    ...actual,
    runLoginWaitingRuntime: runtimeMocks.runLoginWaitingRuntime,
  };
});

vi.mock("../src/daemon/alert/dispatcher.js", () => ({
  sendDaemonAlert: runtimeMocks.sendDaemonAlert,
}));

import { ManagedRuntime } from "../src/daemon/managed-runtime.js";

function createProcessStub() {
  return {
    connected: true,
    send: vi.fn(),
    disconnect: vi.fn(),
    exit: vi.fn(),
    on: vi.fn(),
    _icqqLogoutDone: false,
  };
}

function createClientStub() {
  const listeners = new Map<string, (...args: any[]) => void>();
  return {
    listeners,
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    terminate: vi.fn(),
    on: vi.fn((event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
    }),
    once: vi.fn(),
  };
}

function createNotificationsStub() {
  return {
    notifyOfflineNetwork: vi.fn(),
    notifyOfflineKickoff: vi.fn(),
    notifyReconnectSuccess: vi.fn(),
    notifyReconnectFailed: vi.fn(),
  };
}

describe("ManagedRuntime", () => {
  it("starts server and optional mcp host, then reports startup endpoints", async () => {
    const steps: string[] = [];
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client: {
        login: vi.fn(async () => {}),
        logout: vi.fn(async () => {}),
        terminate: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
      },
      server: {
        start: vi.fn(async () => { steps.push("server.start"); }),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 9000),
      },
      rpcConfig: { enabled: true, host: "127.0.0.1" },
      mcpHost: {
        start: vi.fn(async () => { steps.push("mcp.start"); }),
        stop: vi.fn(async () => {}),
        getEndpointUrl: vi.fn(() => "http://127.0.0.1:9100/mcp"),
      },
    });

    await expect(runtime.start()).resolves.toEqual({
      socketPath: "/tmp/icqq.sock",
      rpcAddress: "127.0.0.1:9000",
      mcpUrl: "http://127.0.0.1:9100/mcp",
    });
    expect(steps).toEqual(["server.start", "mcp.start"]);
  });

  it("notifies the parent process when runtime is ready", () => {
    const processRef = createProcessStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client: {
        login: vi.fn(async () => {}),
        logout: vi.fn(async () => {}),
        terminate: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
      },
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      processRef,
    });

    runtime.notifyReady();

    expect(processRef.send).toHaveBeenCalledWith("ready");
    expect(processRef.disconnect).toHaveBeenCalledTimes(1);
  });

  it("shuts down mcp, server, client and cleanup paths in order", async () => {
    const steps: string[] = [];
    const processRef = createProcessStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client: {
        login: vi.fn(async () => {}),
        logout: vi.fn(async () => { steps.push("client.logout"); }),
        terminate: vi.fn(() => { steps.push("client.terminate"); }),
        on: vi.fn(),
        once: vi.fn(),
      },
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => { steps.push("server.stop"); }),
        getRpcPort: vi.fn(() => 0),
      },
      mcpHost: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => { steps.push("mcp.stop"); }),
        getEndpointUrl: vi.fn(() => null),
      },
      cleanupPaths: ["/tmp/a", "/tmp/b"],
      fsOps: {
        unlink: vi.fn(async (path: string) => { steps.push(`unlink:${path}`); }),
        mkdir: vi.fn(async (dir: string) => { steps.push(`mkdir:${dir}`); }),
        writeFile: vi.fn(async (file: string) => { steps.push(`writeFile:${file}`); }),
      },
      stoppedFlagPath: "/tmp/icqq/stopped",
      processRef,
      logger: { log: vi.fn((msg: string) => { steps.push(msg); }) },
    });

    await runtime.shutdown("SIGTERM");

    expect(steps).toEqual([
      "[daemon] 收到 SIGTERM，正在关闭…",
      "mcp.stop",
      "server.stop",
      "client.logout",
      "client.terminate",
      "mkdir:/tmp/icqq",
      "writeFile:/tmp/icqq/stopped",
      "unlink:/tmp/a",
      "unlink:/tmp/b",
    ]);
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it("skips duplicate logout when handlers already logged out and remains idempotent", async () => {
    const processRef = createProcessStub();
    processRef._icqqLogoutDone = true;
    const client = {
      login: vi.fn(async () => {}),
      logout: vi.fn(async () => {}),
      terminate: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
    };
    const server = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      getRpcPort: vi.fn(() => 0),
    };
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server,
      processRef,
    });

    await Promise.all([
      runtime.shutdown("SIGINT"),
      runtime.shutdown("SIGTERM"),
    ]);

    expect(client.logout).not.toHaveBeenCalled();
    expect(client.terminate).toHaveBeenCalledTimes(1);
    expect(server.stop).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledTimes(1);
  });

  it("reconnects after network loss and reports success once online resumes", async () => {
    const steps: string[] = [];
    const client = createClientStub();
    const notifications = createNotificationsStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      sleep: vi.fn(async () => { steps.push("sleep"); }),
      awaitReconnectOutcome: vi.fn(async () => { steps.push("online"); }),
      logger: { log: vi.fn((msg: string, ...rest: unknown[]) => {
        steps.push(rest.length ? `${msg} ${rest.join(" ")}` : msg);
      }) },
      reconnectPolicy: { maxRetries: 3, delaysSeconds: [1, 2, 3] },
    });

    runtime.attachLifecycleHandlers(notifications);
    await client.listeners.get("system.offline.network")?.({ message: "lost" });

    expect(notifications.notifyOfflineNetwork).toHaveBeenCalledWith("lost");
    expect(client.login).toHaveBeenCalledWith(123);
    expect(notifications.notifyReconnectSuccess).toHaveBeenCalledTimes(1);
    expect(notifications.notifyReconnectFailed).not.toHaveBeenCalled();
    expect(steps).toEqual([
      "[daemon] 网络掉线: lost",
      "[daemon] 1s 后尝试第 1 次重连…",
      "sleep",
      "online",
      "[daemon] 重连成功",
    ]);
  });

  it("reconnects on token expiry just like network loss", async () => {
    const steps: string[] = [];
    const client = createClientStub();
    const notifications = createNotificationsStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      sleep: vi.fn(async () => { steps.push("sleep"); }),
      awaitReconnectOutcome: vi.fn(async () => { steps.push("online"); }),
      logger: { log: vi.fn((msg: string, ...rest: unknown[]) => {
        steps.push(rest.length ? `${msg} ${rest.join(" ")}` : msg);
      }) },
      reconnectPolicy: { maxRetries: 3, delaysSeconds: [1, 2, 3] },
    });

    runtime.attachLifecycleHandlers(notifications);
    await client.listeners.get("system.token.expire")?.();

    expect(notifications.notifyOfflineNetwork).toHaveBeenCalledWith("登录态过期");
    expect(client.login).toHaveBeenCalledWith(123);
    expect(notifications.notifyReconnectSuccess).toHaveBeenCalledTimes(1);
    expect(steps).toEqual([
      "[daemon] 登录态过期，尝试重新登录…",
      "[daemon] 1s 后尝试第 1 次重连…",
      "sleep",
      "online",
      "[daemon] 重连成功",
    ]);
  });

  it("reports reconnect exhaustion after retry failures", async () => {
    const steps: string[] = [];
    const client = createClientStub();
    const notifications = createNotificationsStub();
    client.login.mockRejectedValue(new Error("boom"));
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      sleep: vi.fn(async () => { steps.push("sleep"); }),
      logger: { log: vi.fn((msg: string, ...rest: unknown[]) => {
        steps.push(rest.length ? `${msg} ${rest.join(" ")}` : msg);
      }) },
      reconnectPolicy: { maxRetries: 2, delaysSeconds: [1, 2] },
    });

    runtime.attachLifecycleHandlers(notifications);
    await client.listeners.get("system.offline.network")?.({ message: "lost" });

    expect(client.login).toHaveBeenCalledTimes(2);
    expect(notifications.notifyReconnectSuccess).not.toHaveBeenCalled();
    expect(notifications.notifyReconnectFailed).toHaveBeenCalledTimes(1);
    expect(steps).toEqual([
      "[daemon] 网络掉线: lost",
      "[daemon] 1s 后尝试第 1 次重连…",
      "sleep",
      "[daemon] 第 1 次重连失败: boom",
      "[daemon] 2s 后尝试第 2 次重连…",
      "sleep",
      "[daemon] 第 2 次重连失败: boom",
      "[daemon] 2 次重连均失败，放弃重连",
    ]);
  });

  it("keeps kickoff handling distinct from reconnect-on-network-loss", async () => {
    const steps: string[] = [];
    const client = createClientStub();
    const notifications = createNotificationsStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      logger: { log: vi.fn((msg: string, ...rest: unknown[]) => {
        steps.push(rest.length ? `${msg} ${rest.join(" ")}` : msg);
      }) },
    });

    runtime.attachLifecycleHandlers(notifications);
    client.listeners.get("system.offline.kickoff")?.({ message: "bye" });
    await Promise.resolve();

    expect(notifications.notifyOfflineKickoff).toHaveBeenCalledWith("bye");
    expect(client.login).not.toHaveBeenCalled();
    expect(notifications.notifyReconnectSuccess).not.toHaveBeenCalled();
    expect(notifications.notifyReconnectFailed).not.toHaveBeenCalled();
    expect(steps).toEqual(["[daemon] 被踢下线: bye"]);
  });

  it("deduplicates concurrent reconnect attempts", async () => {
    const client = createClientStub();
    const notifications = createNotificationsStub();
    let resolveSleep: (() => void) | null = null;
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      sleep: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSleep = resolve;
          }),
      ),
      awaitReconnectOutcome: vi.fn(async () => {}),
      reconnectPolicy: { maxRetries: 3, delaysSeconds: [1, 2, 3] },
    });

    runtime.attachLifecycleHandlers(notifications);
    const first = client.listeners.get("system.offline.network")?.({ message: "lost" });
    const second = client.listeners.get("system.offline.network")?.({ message: "lost again" });
    resolveSleep?.();
    await Promise.all([first, second]);

    expect(client.login).toHaveBeenCalledTimes(1);
    expect(notifications.notifyReconnectSuccess).toHaveBeenCalledTimes(1);
  });

  it("aborts in-flight reconnect when shutdown is requested", async () => {
    const client = createClientStub();
    const notifications = createNotificationsStub();
    let resolveSleep: (() => void) | null = null;
    const processRef = createProcessStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      sleep: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSleep = resolve;
          }),
      ),
      awaitReconnectOutcome: vi.fn(async () => {}),
      reconnectPolicy: { maxRetries: 3, delaysSeconds: [1, 2, 3] },
      processRef,
    });

    runtime.attachLifecycleHandlers(notifications);
    const reconnect = client.listeners.get("system.offline.network")?.({ message: "lost" });
    await runtime.shutdown("SIGTERM");
    resolveSleep?.();
    await reconnect;

    expect(client.login).not.toHaveBeenCalled();
    expect(notifications.notifyReconnectSuccess).not.toHaveBeenCalled();
    expect(notifications.notifyReconnectFailed).not.toHaveBeenCalled();
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it("exits process when reconnect exhaust action is exit", async () => {
    const client = createClientStub();
    const notifications = createNotificationsStub();
    const processRef = createProcessStub();
    client.login.mockRejectedValue(new Error("boom"));
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      sleep: vi.fn(async () => {}),
      reconnectPolicy: { maxRetries: 1, delaysSeconds: [1] },
      reconnectExhaustAction: "exit",
      processRef,
    });

    runtime.attachLifecycleHandlers(notifications);
    await client.listeners.get("system.offline.network")?.({ message: "lost" });

    expect(notifications.notifyReconnectFailed).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it("enters login_waiting on interactive reconnect failure", async () => {
    runtimeMocks.runLoginWaitingRuntime.mockClear();
    const client = createClientStub();
    const notifications = createNotificationsStub();
    const server = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      getRpcPort: vi.fn(() => 0),
    };
    const mcpHost = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      getEndpointUrl: vi.fn(() => null),
    };
    client.login.mockRejectedValueOnce(new Error("需要滑块验证，请执行 icqq login"));

    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client,
      server,
      mcpHost,
      config: {
        accounts: {},
        alerts: { enabled: true, providers: { bark: { deviceKey: "k" } } },
      },
      ipcToken: "token",
      sleep: vi.fn(async () => {}),
      awaitReconnectOutcome: vi.fn(async () => {}),
      reconnectPolicy: { maxRetries: 1, delaysSeconds: [0] },
    });

    runtime.attachLifecycleHandlers(notifications);
    await client.listeners.get("system.offline.network")?.({ message: "lost" });

    expect(server.stop).toHaveBeenCalled();
    expect(mcpHost.stop).toHaveBeenCalled();
    expect(runtimeMocks.runLoginWaitingRuntime).toHaveBeenCalled();
    expect(server.start).toHaveBeenCalled();
    expect(mcpHost.start).toHaveBeenCalled();
    expect(notifications.notifyReconnectSuccess).toHaveBeenCalled();
  });

  it("sends online alert on system.online when alerts enabled", async () => {
    runtimeMocks.sendDaemonAlert.mockClear();
    const client = createClientStub();
    const runtime = new ManagedRuntime({
      uin: 321,
      socketPath: "/tmp/icqq.sock",
      client,
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      config: {
        accounts: {},
        alerts: { enabled: true, providers: { bark: { deviceKey: "k" } } },
      },
    });

    runtime.attachLifecycleHandlers(createNotificationsStub());
    client.listeners.get("system.online")?.();
    expect(runtimeMocks.sendDaemonAlert).toHaveBeenCalledWith(
      "online",
      { uin: 321 },
      expect.objectContaining({ config: expect.any(Object) }),
    );
  });
});

describe("createInteractiveLoginAwaitOutcome", () => {
  it("resolves on system.online", async () => {
    const { createInteractiveLoginAwaitOutcome } = await import(
      "../src/lib/account-bootstrap.js"
    );
    const listeners = new Map<string, (event?: unknown) => void>();
    const client = {
      once: vi.fn((event: string, listener: (event?: unknown) => void) => {
        listeners.set(event, listener);
      }),
    };

    const awaitOutcome = createInteractiveLoginAwaitOutcome(5000);
    const outcome = awaitOutcome(client);
    listeners.get("system.online")?.();
    await expect(outcome).resolves.toBeUndefined();
  });

  it("rejects on interactive login events and errors", async () => {
    const { createInteractiveLoginAwaitOutcome } = await import(
      "../src/lib/account-bootstrap.js"
    );

    const cases: Array<[string, unknown, string]> = [
      ["system.login.error", { message: "bad" }, "bad"],
      ["system.login.qrcode", undefined, "需要扫码验证"],
      ["system.login.slider", undefined, "需要滑块验证"],
      ["system.login.device", undefined, "需要设备验证"],
      ["system.login.auth", undefined, "需要身份验证"],
    ];

    for (const [event, payload, message] of cases) {
      const listeners = new Map<string, (event?: unknown) => void>();
      const client = {
        once: vi.fn((name: string, listener: (event?: unknown) => void) => {
          listeners.set(name, listener);
        }),
      };
      const outcome = createInteractiveLoginAwaitOutcome(5000)(client);
      listeners.get(event)?.(payload);
      await expect(outcome).rejects.toThrow(message);
    }
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();
    const { createInteractiveLoginAwaitOutcome } = await import(
      "../src/lib/account-bootstrap.js"
    );
    const client = { once: vi.fn() };
    const outcome = createInteractiveLoginAwaitOutcome(1000)(client);
    const assertion = expect(outcome).rejects.toThrow("重连超时");
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });

  it("attaches signal handlers", () => {
    const processRef = createProcessStub();
    const runtime = new ManagedRuntime({
      uin: 123,
      socketPath: "/tmp/icqq.sock",
      client: createClientStub(),
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
      processRef,
    });

    runtime.attachSignalHandlers();
    expect(processRef.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(processRef.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
  });

  it("returns configured uin", () => {
    const runtime = new ManagedRuntime({
      uin: 999,
      socketPath: "/tmp/icqq.sock",
      client: createClientStub(),
      server: {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        getRpcPort: vi.fn(() => 0),
      },
    });
    expect(runtime.getUin()).toBe(999);
  });
});