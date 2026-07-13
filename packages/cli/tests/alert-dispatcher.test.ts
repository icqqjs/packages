import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendDaemonAlert,
  resetAlertCooldownForTests,
} from "../src/daemon/alert/dispatcher.js";
import type { IcqqConfig } from "../src/lib/config.js";

const fetchMock = vi.fn();
const dispatcherMocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  sendPeerAlert: vi.fn(async () => {}),
}));

vi.mock("@/lib/alert-peer-send.js", () => ({
  sendPeerAlert: dispatcherMocks.sendPeerAlert,
}));

vi.mock("@/lib/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/config.js")>();
  return {
    ...actual,
    loadConfig: dispatcherMocks.loadConfig,
  };
});

function enabledConfig(
  providers: IcqqConfig["alerts"] extends infer A ? NonNullable<A>["providers"] : never,
): IcqqConfig {
  return {
    accounts: {},
    alerts: {
      enabled: true,
      cooldownMs: 60_000,
      providers,
    },
  };
}

describe("sendDaemonAlert", () => {
  beforeEach(() => {
    resetAlertCooldownForTests();
    fetchMock.mockReset();
    dispatcherMocks.loadConfig.mockReset();
    dispatcherMocks.sendPeerAlert.mockReset();
    dispatcherMocks.sendPeerAlert.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("skips when alerts disabled", async () => {
    await sendDaemonAlert(
      "login_waiting",
      { uin: 123 },
      {
        config: {
          accounts: {},
          alerts: {
            enabled: false,
            providers: {
              generic: { url: "https://hooks.example.com/icqq" },
            },
          },
        },
      },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("broadcasts to all enabled providers", async () => {
    await sendDaemonAlert(
      "daemon_ready",
      { uin: 123, reason: "ready" },
      {
        config: enabledConfig({
          bark: { deviceKey: "k" },
          wecom: { webhookKey: "w" },
        }),
        skipCooldown: true,
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("applies per-kind cooldown", async () => {
    const config = enabledConfig({
      generic: { url: "https://hooks.example.com/icqq" },
    });
    await sendDaemonAlert("online", { uin: 123 }, { config });
    await sendDaemonAlert("online", { uin: 123 }, { config });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await sendDaemonAlert("offline_network", { uin: 123, reason: "net" }, { config });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends generic webhook envelope", async () => {
    await sendDaemonAlert(
      "login_waiting",
      { uin: 456, reason: "滑块", loginUrl: "https://qq.example.com/login" },
      {
        config: enabledConfig({
          generic: { url: "https://hooks.example.com/icqq" },
        }),
        skipCooldown: true,
      },
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body).toMatchObject({
      type: "login_waiting",
      uin: 456,
      reason: "滑块",
      loginUrl: "https://qq.example.com/login",
    });
  });

  it("logs provider failures", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "err" });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await sendDaemonAlert(
      "online",
      { uin: 1 },
      {
        config: enabledConfig({ generic: { url: "https://hooks.example.com/icqq" } }),
        skipCooldown: true,
      },
    );
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[alert] provider failed"));
    errSpy.mockRestore();
  });

  it("skips when no providers configured", async () => {
    await sendDaemonAlert(
      "online",
      { uin: 1 },
      { config: { accounts: {}, alerts: { enabled: true, providers: {} } } },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads config when options.config is omitted", async () => {
    dispatcherMocks.loadConfig.mockResolvedValue({
      accounts: {},
      alerts: {
        enabled: true,
        providers: { generic: { url: "https://hooks.example.com/icqq" } },
      },
    });
    await sendDaemonAlert("online", { uin: 99 });
    expect(dispatcherMocks.loadConfig).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("peer failure does not block other providers", async () => {
    dispatcherMocks.sendPeerAlert.mockRejectedValueOnce(new Error("rpc down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await sendDaemonAlert(
      "offline_network",
      { uin: 100, reason: "net" },
      {
        config: enabledConfig({
          peer: {
            host: "10.0.0.1",
            port: 9100,
            token: "t",
            userId: 1,
          },
          generic: { url: "https://hooks.example.com/icqq" },
        }),
        skipCooldown: true,
      },
    );
    expect(dispatcherMocks.sendPeerAlert).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[alert] provider failed"));
    errSpy.mockRestore();
  });
});
