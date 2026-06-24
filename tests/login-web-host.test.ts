import { describe, it, expect, afterEach } from "vitest";
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
});
