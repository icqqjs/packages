import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LoginSession } from "../src/daemon/login-session.js";

let accountDir = "";

vi.mock("@/lib/paths.js", () => ({
  getAccountDir: () => accountDir,
}));

vi.mock("@/lib/render-qrcode.js", () => ({
  renderQrcodeAscii: vi.fn(async () => ["██", "██"]),
}));

type Listener = (...args: unknown[]) => void;

function createClient() {
  const listeners = new Map<string, Listener[]>();
  return {
    on: (event: string, fn: Listener) => {
      const list = listeners.get(event) ?? [];
      list.push(fn);
      listeners.set(event, list);
    },
    off: (event: string, fn: Listener) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((x) => x !== fn),
      );
    },
    emit(event: string, payload?: unknown) {
      for (const fn of listeners.get(event) ?? []) fn(payload);
    },
  };
}

describe("LoginSession", () => {
  beforeEach(async () => {
    accountDir = await fs.mkdtemp(join(tmpdir(), "icqq-login-session-"));
  });

  afterEach(async () => {
    await fs.rm(accountDir, { recursive: true, force: true });
  });

  it("tracks interactive login phases and waits for online", async () => {
    const client = createClient();
    const session = new LoginSession(client as never, 99, 60_000, 10);
    const states: string[] = [];
    session.subscribe((s) => states.push(s.phase));

    session.start();
    expect(session.isActive()).toBe(true);

    client.emit("system.login.slider", { url: "https://slider" });
    expect(session.getState().phase).toBe("slider");

    client.emit("system.login.device", { url: "https://device", phone: "138" });
    expect(session.getState().phase).toBe("device");

    client.emit("system.login.auth", { url: "https://auth" });
    expect(session.getState().phase).toBe("auth");

    const online = session.waitForOnline();
    client.emit("system.online");
    await online;
    expect(session.isActive()).toBe(false);
    expect(states).toContain("online");
  });

  it("writes qrcode file and handles login error", async () => {
    const client = createClient();
    const session = new LoginSession(client as never, 88, 60_000, 10);
    session.start();

    client.emit("system.login.qrcode", { image: Buffer.from("png") });
    await vi.waitUntil(() => session.getState().qrcodePath != null);
    expect(session.getState().qrcodePath).toContain("qrcode.png");
    expect(session.getState().qrcodeAscii).toContain("██");

    client.emit("system.login.error", new Error("bad"));
    expect(session.getState().phase).toBe("error");

    session.stop();
    expect(session.isActive()).toBe(false);
  });

  it("rate limits submit", () => {
    const session = new LoginSession(createClient() as never, 1, 60_000, 1);
    expect(session.checkSubmitRateLimit()).toBeNull();
    expect(session.checkSubmitRateLimit()).toMatch(/频繁/);
  });

  it("requires start before waitForOnline", async () => {
    const session = new LoginSession(createClient() as never, 1, 60_000, 1);
    await expect(session.waitForOnline()).rejects.toThrow("not started");
  });
});
