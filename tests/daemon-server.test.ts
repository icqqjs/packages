import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import net from "node:net";
import fs from "node:fs/promises";
import { createHmac, randomBytes } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DaemonContext } from "../src/daemon/daemon-context.js";
import { DaemonServer } from "../src/daemon/server.js";
import { Actions } from "../src/daemon/protocol.js";

const handleRequest = vi.fn();

vi.mock("../src/daemon/handlers.js", () => ({
  handleRequest: (...args: unknown[]) => handleRequest(...args),
}));

let testDir = "";
let socketPath = "";
let rpcPortPath = "";
const UIN = 424242;
const IPC_TOKEN = randomBytes(16).toString("hex");

vi.mock("@/lib/paths.js", () => ({
  getSocketPath: () => socketPath,
  getRpcPortPath: () => rpcPortPath,
}));

function writeLine(socket: net.Socket, data: unknown) {
  socket.write(JSON.stringify(data) + "\n");
}

function readLine(socket: net.Socket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      socket.removeListener("data", onData);
      try {
        resolve(JSON.parse(buf.slice(0, nl)));
      } catch (e) {
        reject(e);
      }
    };
    socket.on("data", onData);
    setTimeout(() => {
      socket.removeListener("data", onData);
      reject(new Error("readLine timeout"));
    }, 5000);
  });
}

function createContext(): DaemonContext {
  const client = {
    em: vi.fn(),
  };
  return {
    uin: UIN,
    client: client as never,
    notifications: { notifyMessage: vi.fn() },
    pushWebhook: vi.fn(async () => {}),
  } as unknown as DaemonContext;
}

async function authIpc(socket: net.Socket) {
  writeLine(socket, {
    id: "auth-1",
    action: "auth",
    params: { token: IPC_TOKEN },
  });
  const resp = (await readLine(socket)) as { ok: boolean; data?: { authed: boolean } };
  expect(resp.ok).toBe(true);
  expect(resp.data?.authed).toBe(true);
}

describe("DaemonServer", () => {
  beforeEach(async () => {
    handleRequest.mockReset();
    testDir = await fs.mkdtemp(join(tmpdir(), "icqq-daemon-server-"));
    socketPath = join(testDir, "daemon.sock");
    rpcPortPath = join(testDir, "rpc.json");
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("authenticates IPC token and processes requests", async () => {
    handleRequest.mockResolvedValue({ id: "req-1", ok: true, data: { pong: true } });

    const server = new DaemonServer(createContext(), IPC_TOKEN, null);
    await server.start();

    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect(socketPath);
      s.once("connect", () => resolve(s));
      s.once("error", reject);
    });

    await authIpc(socket);
    writeLine(socket, { id: "req-1", action: Actions.PING, params: {} });
    const resp = (await readLine(socket)) as { ok: boolean; data: { pong: boolean } };
    expect(resp.ok).toBe(true);
    expect(resp.data).toEqual({ pong: true });
    expect(handleRequest).toHaveBeenCalled();

    socket.destroy();
    await server.stop();
  });

  it("rejects invalid IPC token", async () => {
    const server = new DaemonServer(createContext(), IPC_TOKEN, null);
    await server.start();

    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect(socketPath);
      s.once("connect", () => resolve(s));
      s.once("error", reject);
    });

    writeLine(socket, {
      id: "bad",
      action: "auth",
      params: { token: "wrong" },
    });
    const resp = (await readLine(socket)) as { ok: boolean; error: string };
    expect(resp.ok).toBe(false);
    expect(resp.error).toBe("认证失败");

    await new Promise((resolve) => socket.on("close", resolve));
    await server.stop();
  });

  it("authenticates RPC via HMAC challenge-response", async () => {
    const server = new DaemonServer(createContext(), IPC_TOKEN, {
      enabled: true,
      host: "127.0.0.1",
      port: 0,
    });
    await server.start();
    const rpcPort = server.getRpcPort();
    expect(rpcPort).toBeGreaterThan(0);

    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect(rpcPort, "127.0.0.1");
      s.once("connect", () => resolve(s));
      s.once("error", reject);
    });

    const challengeMsg = (await readLine(socket)) as { challenge: string };
    const digest = createHmac("sha256", IPC_TOKEN)
      .update(challengeMsg.challenge)
      .digest("hex");

    writeLine(socket, {
      id: "rpc-auth",
      action: "auth",
      params: { digest },
    });
    const resp = (await readLine(socket)) as { ok: boolean; data?: { authed: boolean } };
    expect(resp.ok).toBe(true);
    expect(resp.data?.authed).toBe(true);

    socket.destroy();
    await server.stop();
  });

  it("rate-limits repeated RPC auth failures", async () => {
    const server = new DaemonServer(createContext(), IPC_TOKEN, {
      enabled: true,
      host: "127.0.0.1",
      port: 0,
    });
    await server.start();
    const rpcPort = server.getRpcPort();

    for (let i = 0; i < 5; i++) {
      const socket = await new Promise<net.Socket>((resolve, reject) => {
        const s = net.connect(rpcPort, "127.0.0.1");
        s.once("connect", () => resolve(s));
        s.once("error", reject);
      });
      await readLine(socket);
      writeLine(socket, {
        id: `bad-${i}`,
        action: "auth",
        params: { digest: "00" },
      });
      await new Promise((resolve) => socket.on("close", resolve));
    }

    const blocked = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect(rpcPort, "127.0.0.1");
      s.once("connect", () => resolve(s));
      s.once("error", reject);
    });
    const resp = (await readLine(blocked)) as { ok: boolean; error: string };
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain("认证失败次数过多");
    blocked.destroy();
    await server.stop();
  });

  it("fans out icqq events to authenticated IPC sockets", async () => {
    const ctx = createContext();
    const server = new DaemonServer(ctx, IPC_TOKEN, null);
    await server.start();

    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect(socketPath);
      s.once("connect", () => resolve(s));
      s.once("error", reject);
    });
    await authIpc(socket);

    const eventPromise = readLine(socket);
    (ctx.client as { em: (name: string, data?: unknown) => void }).em("message.private", {
      user_id: 2,
      message: "hi",
    });

    const eventMsg = (await eventPromise) as { event: string };
    expect(eventMsg.event).toBe("message.private");
    expect(ctx.pushWebhook).toHaveBeenCalled();
    expect(ctx.notifications.notifyMessage).toHaveBeenCalled();

    socket.destroy();
    await server.stop();
  });

  it("falls back to port 0 when configured RPC port is in use", async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(39999, "127.0.0.1", resolve));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const server = new DaemonServer(createContext(), IPC_TOKEN, {
      enabled: true,
      host: "127.0.0.1",
      port: 39999,
    });
    await server.start();
    expect(server.getRpcPort()).not.toBe(39999);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    await server.stop();
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  });
});
