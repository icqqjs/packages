import net from "node:net";
import fs from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import type { Client } from "@icqqjs/icqq";
import type { IpcMessage, IpcRequest } from "./protocol.js";
import { handleRequest } from "./request-router.js";
import { appendAndSplitLines, formatIpcMessageLine, parseJsonLine } from "@/lib/json-line-framing.js";
import { getSocketPath } from "@/lib/paths.js";
import type { LoginSession } from "./login-session.js";

/**
 * login_waiting 阶段的受限 IPC：仅 auth + 门控 login actions。
 */
export class LoginIpcServer {
  private server: net.Server;
  private sockets = new Map<string, net.Socket>();
  private authedSockets = new Set<string>();
  private pendingChallenges = new Map<string, string>();
  private nextSocketId = 0;

  constructor(
    private readonly uin: number,
    private readonly ipcToken: string,
    private readonly client: Client,
    private readonly loginSession: LoginSession,
  ) {
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  private sendToSocket(socket: net.Socket, msg: IpcMessage) {
    if (!socket.destroyed) {
      socket.write(formatIpcMessageLine(msg));
    }
  }

  private handleConnection(socket: net.Socket) {
    const socketId = String(++this.nextSocketId);
    this.sockets.set(socketId, socket);
    let buffer = "";

    socket.on("data", (chunk) => {
      const split = appendAndSplitLines(buffer, chunk.toString());
      buffer = split.remainder;
      for (const line of split.lines) {
        void this.onLine(socket, socketId, line);
      }
    });

    socket.on("close", () => {
      this.sockets.delete(socketId);
      this.authedSockets.delete(socketId);
      this.pendingChallenges.delete(socketId);
    });
  }

  private async onLine(socket: net.Socket, socketId: string, line: string) {
    try {
      const req = parseJsonLine<IpcRequest>(line);
      if (!this.authedSockets.has(socketId)) {
        if (req.action === "auth") {
          this.handleAuth(socket, socketId, req);
          return;
        }
        this.sendToSocket(socket, { id: req.id, ok: false, error: "未认证" });
        socket.destroy();
        return;
      }
      const response = await handleRequest(
        this.client,
        req,
        null,
        this.loginSession,
      );
      this.sendToSocket(socket, response);
    } catch {
      /* ignore malformed */
    }
  }

  private handleAuth(socket: net.Socket, socketId: string, req: IpcRequest) {
    const token = String(req.params.token ?? "");
    if (
      token.length === this.ipcToken.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(this.ipcToken))
    ) {
      this.authedSockets.add(socketId);
      this.sendToSocket(socket, { id: req.id, ok: true, data: { authed: true } });
      return;
    }
    this.sendToSocket(socket, { id: req.id, ok: false, error: "认证失败" });
    socket.destroy();
  }

  async start(): Promise<void> {
    const sockPath = getSocketPath(this.uin);
    try {
      await fs.unlink(sockPath);
    } catch {
      /* ignore */
    }
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(sockPath, async () => {
        try {
          await fs.chmod(sockPath, 0o600);
        } catch {
          /* ignore */
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets.values()) socket.destroy();
    this.sockets.clear();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    try {
      await fs.unlink(getSocketPath(this.uin));
    } catch {
      /* ignore */
    }
  }
}
