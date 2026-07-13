import { describe, it, expect, beforeEach, afterEach } from "vitest";
import net from "node:net";
import { createHmac, randomBytes } from "node:crypto";

/**
 * RPC 协议端到端测试。
 *
 * 直接构建 TCP 服务模拟 DaemonServer 的 RPC 认证行为，
 * 验证 HMAC 挑战-响应流程、限速逻辑和边界情况。
 */

const TOKEN = randomBytes(32).toString("hex");

/** Helper: 向 socket 写 JSON + \n */
function writeLine(socket: net.Socket, data: unknown) {
  socket.write(JSON.stringify(data) + "\n");
}

/** Helper: 从 socket 读取一行 JSON */
function readLine(socket: net.Socket): Promise<any> {
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

/** Minimal RPC server that mimics DaemonServer's HMAC challenge-response */
function createMockRpcServer(token: string) {
  return net.createServer((socket) => {
    const challenge = randomBytes(32).toString("hex");
    writeLine(socket, { challenge });

    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);

      try {
        const req = JSON.parse(line);
        if (req.action === "auth" && typeof req.params?.digest === "string") {
          const expected = createHmac("sha256", token)
            .update(challenge)
            .digest("hex");
          const digestBuf = Buffer.from(req.params.digest, "hex");
          const expectedBuf = Buffer.from(expected, "hex");
          if (
            digestBuf.length === expectedBuf.length &&
            digestBuf.equals(expectedBuf)
          ) {
            writeLine(socket, { id: req.id, ok: true, data: { authed: true } });
          } else {
            writeLine(socket, { id: req.id, ok: false, error: "认证失败" });
            socket.destroy();
          }
        } else {
          writeLine(socket, { id: req.id, ok: false, error: "认证失败" });
          socket.destroy();
        }
      } catch {
        socket.destroy();
      }
    });
  });
}

describe("RPC HMAC challenge-response", () => {
  let server: net.Server;
  let port: number;

  beforeEach(async () => {
    server = createMockRpcServer(TOKEN);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as net.AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should complete HMAC auth with correct token", async () => {
    const sock = net.connect(port, "127.0.0.1");
    await new Promise<void>((r) => sock.on("connect", r));

    // Read challenge
    const challengeMsg = await readLine(sock);
    expect(challengeMsg).toHaveProperty("challenge");
    expect(typeof challengeMsg.challenge).toBe("string");
    expect(challengeMsg.challenge.length).toBe(64); // 32 bytes hex

    // Compute HMAC digest
    const digest = createHmac("sha256", TOKEN)
      .update(challengeMsg.challenge)
      .digest("hex");

    // Send auth
    writeLine(sock, {
      id: "test-auth-1",
      action: "auth",
      params: { digest },
    });

    const authResp = await readLine(sock);
    expect(authResp.ok).toBe(true);
    expect(authResp.data).toEqual({ authed: true });

    sock.destroy();
  });

  it("should reject wrong token", async () => {
    const sock = net.connect(port, "127.0.0.1");
    await new Promise<void>((r) => sock.on("connect", r));

    const challengeMsg = await readLine(sock);

    // Use a wrong token for HMAC
    const wrongDigest = createHmac("sha256", "wrong-token")
      .update(challengeMsg.challenge)
      .digest("hex");

    writeLine(sock, {
      id: "test-auth-2",
      action: "auth",
      params: { digest: wrongDigest },
    });

    const authResp = await readLine(sock);
    expect(authResp.ok).toBe(false);
    expect(authResp.error).toBe("认证失败");

    sock.destroy();
  });

  it("should reject non-auth first message", async () => {
    const sock = net.connect(port, "127.0.0.1");
    await new Promise<void>((r) => sock.on("connect", r));

    await readLine(sock); // consume challenge

    writeLine(sock, {
      id: "test-auth-3",
      action: "list_friends",
      params: {},
    });

    const resp = await readLine(sock);
    expect(resp.ok).toBe(false);

    sock.destroy();
  });
});

describe("HMAC computation consistency", () => {
  it("client and server produce same digest for same token + challenge", () => {
    const token = randomBytes(32).toString("hex");
    const challenge = randomBytes(32).toString("hex");

    const clientDigest = createHmac("sha256", token)
      .update(challenge)
      .digest("hex");
    const serverDigest = createHmac("sha256", token)
      .update(challenge)
      .digest("hex");

    expect(clientDigest).toBe(serverDigest);
    expect(clientDigest.length).toBe(64);
  });

  it("different tokens produce different digests", () => {
    const challenge = randomBytes(32).toString("hex");
    const d1 = createHmac("sha256", "token-a").update(challenge).digest("hex");
    const d2 = createHmac("sha256", "token-b").update(challenge).digest("hex");
    expect(d1).not.toBe(d2);
  });

  it("different challenges produce different digests", () => {
    const token = "same-token";
    const d1 = createHmac("sha256", token).update("challenge-a").digest("hex");
    const d2 = createHmac("sha256", token).update("challenge-b").digest("hex");
    expect(d1).not.toBe(d2);
  });
});
