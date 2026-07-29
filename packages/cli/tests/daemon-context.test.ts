import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DaemonContext,
} from "../src/daemon/daemon-context.js";
import { loadConfig, saveConfig } from "@/lib/config.js";

vi.mock("@/lib/config.js", () => ({
  loadConfig: vi.fn(async () => ({
    notifyEnabled: true,
    webhookUrl: "https://example.com/hook",
  })),
  saveConfig: vi.fn(async () => {}),
}));

vi.mock("../src/daemon/webhook.js", () => ({
  validateWebhookUrl: vi.fn((url: string) =>
    url.startsWith("https://") ? null : "必须是 https URL",
  ),
}));

describe("DaemonContext", () => {
  it("creates context with notification settings", () => {
    const ctx = new DaemonContext({} as never, 123, {
      notifyEnabled: true,
      webhookUrl: "https://example.com/hook",
    });
    expect(ctx.uin).toBe(123);
    expect(ctx.getWebhookUrl()).toBe("https://example.com/hook");
    expect(ctx.notifications.isEnabled()).toBe(true);
  });

  it("loads from client via fromClient", async () => {
    const ctx = await DaemonContext.fromClient({} as never, 456);
    expect(ctx.uin).toBe(456);
    expect(ctx.getWebhookUrl()).toBe("https://example.com/hook");
  });

  it("validates webhook url on set", async () => {
    const ctx = new DaemonContext({} as never, 1);
    await expect(ctx.setWebhookUrl("http://bad")).resolves.toBe("必须是 https URL");
    await expect(ctx.setWebhookUrl("https://ok.example/hook")).resolves.toBeNull();
    expect(ctx.getWebhookUrl()).toBe("https://ok.example/hook");
  });

  it("pushes webhook payload when configured", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const ctx = new DaemonContext({} as never, 9, {
      webhookUrl: "https://example.com/hook",
    });
    await ctx.pushWebhook({ event: "test", data: { x: 1 } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ uin: 9, event: "test", data: { x: 1 } }),
      }),
    );

    vi.unstubAllGlobals();
  });


  it("falls back when loadConfig fails in fromClient", async () => {
    vi.mocked(loadConfig).mockRejectedValueOnce(new Error("ENOENT"));
    const ctx = await DaemonContext.fromClient({} as never, 999);
    expect(ctx.uin).toBe(999);
    expect(ctx.getWebhookUrl()).toBe("");
  });

  it("persists notify setting", async () => {
    const ctx = new DaemonContext({} as never, 3);
    await ctx.setNotifyEnabled(true);
    expect(ctx.notifications.isEnabled()).toBe(true);
    expect(saveConfig).toHaveBeenCalled();
  });

  it("skips webhook push when url is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ctx = new DaemonContext({} as never, 1);
    await ctx.pushWebhook({ event: "noop" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("logs webhook fetch failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const ctx = new DaemonContext({} as never, 1, {
      webhookUrl: "https://example.com/hook",
    });
    await ctx.pushWebhook({ event: "fail" });
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("POST failed"));

    errSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("tracks daemon health transitions independently from cached client state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T08:00:00Z"));

    const ctx = new DaemonContext({ isOnline: () => true } as never, 7);
    expect(ctx.getHealth()).toEqual({
      ipc: true,
      qqOnline: true,
      reconnectState: "idle",
      stale: false,
      lastEventAt: null,
      lastOnlineAt: new Date("2026-07-29T08:00:00Z").getTime(),
      lastOfflineAt: null,
      lastReconnectAttemptAt: null,
      lastReconnectSuccessAt: null,
      lastDisconnectReason: null,
    });

    vi.setSystemTime(new Date("2026-07-29T08:05:00Z"));
    ctx.markReconnecting("network lost");
    ctx.markReconnectAttempt();
    ctx.noteProtocolEvent("message.private");

    expect(ctx.getHealth()).toEqual({
      ipc: true,
      qqOnline: false,
      reconnectState: "reconnecting",
      stale: true,
      lastEventAt: new Date("2026-07-29T08:05:00Z").getTime(),
      lastOnlineAt: new Date("2026-07-29T08:00:00Z").getTime(),
      lastOfflineAt: new Date("2026-07-29T08:05:00Z").getTime(),
      lastReconnectAttemptAt: new Date("2026-07-29T08:05:00Z").getTime(),
      lastReconnectSuccessAt: null,
      lastDisconnectReason: "network lost",
    });

    vi.setSystemTime(new Date("2026-07-29T08:06:00Z"));
    ctx.markReconnectSuccess();
    expect(ctx.getHealth()).toEqual({
      ipc: true,
      qqOnline: true,
      reconnectState: "idle",
      stale: false,
      lastEventAt: new Date("2026-07-29T08:05:00Z").getTime(),
      lastOnlineAt: new Date("2026-07-29T08:06:00Z").getTime(),
      lastOfflineAt: new Date("2026-07-29T08:05:00Z").getTime(),
      lastReconnectAttemptAt: new Date("2026-07-29T08:05:00Z").getTime(),
      lastReconnectSuccessAt: new Date("2026-07-29T08:06:00Z").getTime(),
      lastDisconnectReason: null,
    });

    vi.useRealTimers();
  });
});
