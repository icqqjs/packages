import { describe, it, expect, afterEach, vi } from "vitest";
import http from "node:http";
import { LoginWebHost } from "../src/daemon/login-web-host.js";
import { LoginSession } from "../src/daemon/login-session.js";
import { resolveLoginConfig } from "../src/lib/alert-config.js";
import type { Client } from "@icqqjs/icqq";

const hosts: LoginWebHost[] = [];

function mockClient(): Client {
  return { on: () => {}, off: () => {} } as unknown as Client;
}

describe("LoginWebHost", () => {
  afterEach(async () => {
    while (hosts.length) {
      await hosts.pop()!.stop();
    }
  });

  it("serves auth form and protects /login", async () => {
    const token = "a".repeat(64);
    const session = new LoginSession(mockClient(), 123, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      mockClient(),
      123,
      token,
      session,
      resolveLoginConfig({ accounts: {} }),
    );
    hosts.push(host);
    await host.start();
    const port = host.getPort();
    expect(port).toBeGreaterThan(0);

    const authPage = await fetch(`http://127.0.0.1:${port}/login/auth`);
    expect(authPage.status).toBe(200);
    expect(await authPage.text()).toContain("daemon.token");

    const loginRedirect = await fetch(`http://127.0.0.1:${port}/login`, {
      redirect: "manual",
    });
    expect(loginRedirect.status).toBe(302);
    session.stop();
  });

  it("accepts token via auth form", async () => {
    const token = "b".repeat(64);
    const session = new LoginSession(mockClient(), 456, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      mockClient(),
      456,
      token,
      session,
      resolveLoginConfig({ accounts: {} }),
    );
    hosts.push(host);
    await host.start();
    const port = host.getPort();

    const post = await fetch(`http://127.0.0.1:${port}/login/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(token)}`,
      redirect: "manual",
    });
    expect(post.status).toBe(302);
    const cookie = post.headers.get("set-cookie");
    expect(cookie).toContain("icqq_login=");

    const login = await fetch(`http://127.0.0.1:${port}/login`, {
      headers: { Cookie: cookie!.split(";")[0]! },
    });
    expect(login.status).toBe(200);
    session.stop();
  });

  it("accepts bearer token and submit API", async () => {
    const token = "c".repeat(64);
    const client = {
      submitSlider: vi.fn(async () => {}),
      on: () => {},
      off: () => {},
    } as unknown as Client;
    const session = new LoginSession(client, 789, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      client,
      789,
      token,
      session,
      resolveLoginConfig({ accounts: {} }),
    );
    hosts.push(host);
    await host.start();
    const port = host.getPort();

    const submit = await fetch(`http://127.0.0.1:${port}/login/api/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind: "slider", value: "ticket" }),
    });
    expect(submit.status).toBe(200);
    expect((client as { submitSlider: ReturnType<typeof vi.fn> }).submitSlider).toHaveBeenCalled();
    session.stop();
  });

  it("rejects invalid auth token and protects SSE", async () => {
    const token = "d".repeat(64);
    const session = new LoginSession(mockClient(), 111, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      mockClient(),
      111,
      token,
      session,
      resolveLoginConfig({ accounts: {} }),
    );
    hosts.push(host);
    await host.start();
    const port = host.getPort();

    const bad = await fetch(`http://127.0.0.1:${port}/login/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "token=wrong",
    });
    expect(bad.status).toBe(401);

    const sse = await fetch(`http://127.0.0.1:${port}/login/api/state`, {
      redirect: "manual",
    });
    expect(sse.status).toBe(302);

    const submit = await fetch(`http://127.0.0.1:${port}/login/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "send_sms" }),
      redirect: "manual",
    });
    expect(submit.status).toBe(302);
    session.stop();
  });

  it("routes send_sms submit when authenticated", async () => {
    const token = "g".repeat(64);
    const client = {
      sendSmsCode: vi.fn(async () => {}),
      on: () => {},
      off: () => {},
    } as unknown as Client;
    const session = new LoginSession(client, 444, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      client,
      444,
      token,
      session,
      resolveLoginConfig({ accounts: {} }),
    );
    hosts.push(host);
    await host.start();
    const port = host.getPort();

    const submit = await fetch(`http://127.0.0.1:${port}/login/api/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind: "send_sms" }),
    });
    expect(submit.status).toBe(200);
    expect((client as { sendSmsCode: ReturnType<typeof vi.fn> }).sendSmsCode).toHaveBeenCalled();
    session.stop();
  });

  it("streams session state over SSE", async () => {
    const token = "e".repeat(64);
    const session = new LoginSession(mockClient(), 222, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      mockClient(),
      222,
      token,
      session,
      resolveLoginConfig({ accounts: {} }),
    );
    hosts.push(host);
    await host.start();
    const port = host.getPort();

    const res = await fetch(`http://127.0.0.1:${port}/login/api/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain("connecting");
    reader.cancel();
    session.stop();
  });

  it("warns when binding to 0.0.0.0", async () => {
    const token = "f".repeat(64);
    const session = new LoginSession(mockClient(), 333, 60_000, 10);
    session.start();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const host = new LoginWebHost(
      mockClient(),
      333,
      token,
      session,
      resolveLoginConfig({
        accounts: {},
        login: { http: { host: "0.0.0.0", port: 0 } },
      }),
    );
    hosts.push(host);
    await host.start();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("0.0.0.0"));
    warnSpy.mockRestore();
    session.stop();
  });

  it("falls back to ephemeral port when configured port is busy", async () => {
    const blocker = http.createServer();
    const busyPort = await new Promise<number>((resolve) => {
      blocker.listen(0, "127.0.0.1", () => {
        const addr = blocker.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });

    const token = "h".repeat(64);
    const session = new LoginSession(mockClient(), 555, 60_000, 10);
    session.start();
    const host = new LoginWebHost(
      mockClient(),
      555,
      token,
      session,
      resolveLoginConfig({
        accounts: {},
        login: { http: { host: "127.0.0.1", port: busyPort } },
      }),
    );
    hosts.push(host);
    await host.start();
    expect(host.getPort()).not.toBe(busyPort);
    session.stop();
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  });
});
