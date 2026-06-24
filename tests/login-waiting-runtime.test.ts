import { describe, it, expect, vi, beforeEach } from "vitest";
import { LOGIN_INTERACTIVE_ERRORS } from "../src/lib/account-bootstrap.js";

const mocks = vi.hoisted(() => ({
  ipcStart: vi.fn(async () => {}),
  ipcStop: vi.fn(async () => {}),
  webStart: vi.fn(async () => {}),
  webStop: vi.fn(async () => {}),
  webPort: 8787,
  sendDaemonAlert: vi.fn(async () => {}),
  waitForOnline: vi.fn(async () => {}),
  sessionStart: vi.fn(),
  sessionStop: vi.fn(),
}));

vi.mock("../src/daemon/login-ipc-server.js", () => ({
  LoginIpcServer: class {
    start = mocks.ipcStart;
    stop = mocks.ipcStop;
  },
}));

vi.mock("../src/daemon/login-web-host.js", () => ({
  LoginWebHost: class {
    start = mocks.webStart;
    stop = mocks.webStop;
    getPort = () => mocks.webPort;
  },
}));

vi.mock("../src/daemon/alert/dispatcher.js", () => ({
  sendDaemonAlert: mocks.sendDaemonAlert,
}));

vi.mock("../src/daemon/login-session.js", () => ({
  LoginSession: class {
    start = mocks.sessionStart;
    stop = mocks.sessionStop;
    waitForOnline = mocks.waitForOnline;
  },
}));

import {
  isInteractiveLoginRequired,
  runLoginWaitingRuntime,
} from "../src/daemon/login-waiting-runtime.js";

describe("login-waiting-runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orchestrates IPC, web host, alerts and login", async () => {
    const onReady = vi.fn();
    const client = { login: vi.fn(async () => {}) };

    await runLoginWaitingRuntime({
      client: client as never,
      uin: 123,
      ipcToken: "t".repeat(64),
      config: {
        accounts: {},
        alerts: { enabled: true, providers: { bark: { deviceKey: "k" } } },
        login: { http: { publicUrl: "https://qq.example.com" } },
      },
      reason: "需要滑块",
      onReady,
    });

    expect(mocks.sessionStart).toHaveBeenCalled();
    expect(mocks.ipcStart).toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();
    expect(mocks.webStart).toHaveBeenCalled();
    expect(client.login).toHaveBeenCalledWith(123);
    expect(mocks.waitForOnline).toHaveBeenCalled();
    expect(mocks.sendDaemonAlert).toHaveBeenCalledWith(
      "daemon_ready",
      expect.objectContaining({ uin: 123 }),
      expect.any(Object),
    );
    expect(mocks.sendDaemonAlert).toHaveBeenCalledWith(
      "login_waiting",
      expect.objectContaining({
        uin: 123,
        loginUrl: "https://qq.example.com/login",
      }),
      expect.any(Object),
    );
    expect(mocks.sendDaemonAlert).toHaveBeenCalledWith(
      "online",
      { uin: 123 },
      expect.any(Object),
    );
    expect(mocks.webStop).toHaveBeenCalled();
    expect(mocks.ipcStop).toHaveBeenCalled();
    expect(mocks.sessionStop).toHaveBeenCalled();
  });

  it("warns when publicUrl is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await runLoginWaitingRuntime({
      client: { login: vi.fn(async () => {}) } as never,
      uin: 1,
      ipcToken: "x",
      config: { accounts: {} },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("publicUrl"));
    warn.mockRestore();
  });

  it.each([
    LOGIN_INTERACTIVE_ERRORS.daemon.qrcode,
    LOGIN_INTERACTIVE_ERRORS.reconnect.slider,
  ])("detects interactive login error: %s", (message) => {
    expect(isInteractiveLoginRequired(new Error(message))).toBe(true);
  });

  it("rejects non-interactive errors", () => {
    expect(isInteractiveLoginRequired("string")).toBe(false);
    expect(isInteractiveLoginRequired(new Error("other"))).toBe(false);
  });
});
