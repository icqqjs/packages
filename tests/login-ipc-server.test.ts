import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import net from "node:net";
import fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { LoginIpcServer } from "../src/daemon/login-ipc-server.js";
import { LoginSession } from "../src/daemon/login-session.js";
import { LoginActions } from "../src/daemon/login-actions.js";

const handleRequest = vi.fn();

vi.mock("../src/daemon/request-router.js", () => ({
  handleRequest: (...args: unknown[]) => handleRequest(...args),
}));

let testDir = "";
let socketPath = "";
const UIN = 515151;
const IPC_TOKEN = randomBytes(32).toString("hex");

vi.mock("@/lib/paths.js", () => ({
  getSocketPath: () => socketPath,
}));

function mockClient() {
  return { on: vi.fn(), off: vi.fn() } as never;
}

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
      resolve(JSON.parse(buf.slice(0, nl)));
    };
    socket.on("data", onData);
    setTimeout(() => {
      socket.removeListener("data", onData);
      reject(new Error("timeout"));
    }, 5000);
  });
}

describe("LoginIpcServer", () => {
  let session: LoginSession;

  beforeEach(async () => {
    handleRequest.mockReset();
    testDir = await fs.mkdtemp(join(tmpdir(), "icqq-login-ipc-"));
    socketPath = join(testDir, "daemon.sock");
    session = new LoginSession(mockClient(), UIN, 60_000, 10);
    session.start();
  });

  afterEach(async () => {
    session.stop();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function connect() {
    return new Promise<net.Socket>((resolve, reject) => {
      const s = net.connect(socketPath);
      s.once("connect", () => resolve(s));
      s.once("error", reject);
    });
  }

  it("authenticates with token and routes login actions", async () => {
    handleRequest.mockResolvedValue({
      id: "1",
      ok: true,
      data: { phase: "slider" },
    });

    const server = new LoginIpcServer(UIN, IPC_TOKEN, mockClient(), session);
    await server.start();

    const socket = await connect();
    writeLine(socket, {
      id: "auth",
      action: "auth",
      params: { token: IPC_TOKEN },
    });
    const authResp = (await readLine(socket)) as { ok: boolean };
    expect(authResp.ok).toBe(true);

    writeLine(socket, {
      id: "1",
      action: LoginActions.LOGIN_GET_STATE,
      params: {},
    });
    const resp = (await readLine(socket)) as { ok: boolean; data: { phase: string } };
    expect(resp.ok).toBe(true);
    expect(resp.data.phase).toBe("slider");

    socket.destroy();
    await server.stop();
  });

  it("rejects invalid token and unauthenticated requests", async () => {
    const server = new LoginIpcServer(UIN, IPC_TOKEN, mockClient(), session);
    await server.start();

    const badAuth = await connect();
    writeLine(badAuth, {
      id: "auth",
      action: "auth",
      params: { token: "wrong" },
    });
    const authResp = (await readLine(badAuth)) as { ok: boolean };
    expect(authResp.ok).toBe(false);

    const noAuth = await connect();
    writeLine(noAuth, {
      id: "2",
      action: LoginActions.LOGIN_GET_STATE,
      params: {},
    });
    const resp = (await readLine(noAuth)) as { ok: boolean; error: string };
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain("未认证");

    await server.stop();
  });
});
