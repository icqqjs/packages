import net from "node:net";
import fs from "node:fs/promises";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IpcRequest, IpcMessage } from "./protocol.js";
import { Actions } from "./protocol.js";
import { handleRequest } from "./handlers.js";
import { icqqEventJsonReplacer } from "@/lib/serialize-icqq-event.js";
import type { RpcConfig } from "@/lib/config.js";
import { getSocketPath, getRpcPortPath } from "@/lib/paths.js";
import type { DaemonContext } from "./daemon-context.js";
import { EventBridge } from "./event-bridge.js";

/** Per-IP auth failure tracker for RPC rate limiting */
type AuthFailure = { count: number; firstAttempt: number };

/** IP rate limiting window: 5 failures within 5 minutes → block */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 5;

/**
 * 守护进程传输层 — IPC/RPC 监听、认证、请求 demux、事件 fan-out。
 * 业务 action 与守护进程状态由 handlers + DaemonContext 处理。
 */
export class DaemonServer {
  private ipcServer: net.Server;
  private rpcServer: net.Server | null = null;
  private rpcConfig: RpcConfig | null;
  private rpcPort = 0;
  private ctx: DaemonContext;
  private ipcToken: string;
  private eventBridge: EventBridge;
  private sockets = new Map<string, net.Socket>();
  private authedSockets = new Set<string>();
  private pendingChallenges = new Map<string, string>();
  private authFailures = new Map<string, AuthFailure>();
  private nextSocketId = 0;
  private unsubscribeEvents: (() => void) | null = null;

  constructor(
    ctx: DaemonContext,
    ipcToken: string,
    rpcConfig?: RpcConfig | null,
  ) {
    this.ctx = ctx;
    this.ipcToken = ipcToken;
    this.rpcConfig = rpcConfig ?? null;
    this.eventBridge = new EventBridge();
    this.eventBridge.attach(ctx.client);
    this.unsubscribeEvents = this.eventBridge.subscribe((payload) => {
      void this.ctx.pushWebhook({
        event: payload.event,
        data: payload.data,
      });
      this.ctx.notifications.notifyMessage(
        this.ctx.client,
        payload.event,
        payload.data,
      );
      this.fanOutEvent(payload.event, payload.data);
    });
    this.ipcServer = net.createServer((socket) =>
      this.handleConnection(socket, "ipc"),
    );
  }

  getRpcPort(): number {
    return this.rpcPort;
  }

  private fanOutEvent(eventName: string, eventData: unknown): void {
    for (const socketId of this.authedSockets) {
      const socket = this.sockets.get(socketId);
      if (!socket || socket.destroyed) continue;
      this.sendToSocket(socket, {
        id: "*",
        event: eventName,
        data: eventData,
      });
    }
  }

  private sendToSocket(socket: net.Socket, msg: IpcMessage) {
    if (!socket.destroyed) {
      socket.write(JSON.stringify(msg, icqqEventJsonReplacer) + "\n");
    }
  }

  private isRateLimited(ip: string): boolean {
    const record = this.authFailures.get(ip);
    if (!record) return false;
    if (Date.now() - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      this.authFailures.delete(ip);
      return false;
    }
    return record.count >= RATE_LIMIT_MAX_FAILURES;
  }

  private recordAuthFailure(ip: string): void {
    const now = Date.now();
    const record = this.authFailures.get(ip);
    if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      this.authFailures.set(ip, { count: 1, firstAttempt: now });
    } else {
      record.count++;
    }
  }

  private clearAuthFailure(ip: string): void {
    this.authFailures.delete(ip);
  }

  private handleConnection(socket: net.Socket, mode: "ipc" | "rpc") {
    const socketId = String(this.nextSocketId++);
    this.sockets.set(socketId, socket);
    let buffer = "";

    const remoteIp = socket.remoteAddress ?? "unknown";

    if (mode === "rpc") {
      if (this.isRateLimited(remoteIp)) {
        socket.write(
          JSON.stringify({ id: "", ok: false, error: "认证失败次数过多，请稍后重试" }) + "\n",
        );
        socket.destroy();
        this.sockets.delete(socketId);
        return;
      }
      const challenge = randomBytes(32).toString("hex");
      this.pendingChallenges.set(socketId, challenge);
      socket.write(JSON.stringify({ challenge }) + "\n");
    }

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (!this.authedSockets.has(socketId) && buffer.length > 4096) {
        socket.destroy();
        return;
      }
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line) as IpcRequest;

          if (!this.authedSockets.has(socketId)) {
            if (mode === "ipc") {
              this.handleIpcAuth(socketId, socket, req);
            } else {
              this.handleRpcAuth(socketId, socket, req, remoteIp);
            }
            continue;
          }

          void this.processRequest(socket, req);
        } catch {
          // ignore malformed JSON
        }
      }
    });

    socket.on("close", () => {
      this.sockets.delete(socketId);
      this.authedSockets.delete(socketId);
      this.pendingChallenges.delete(socketId);
    });

    socket.on("error", () => {
      this.sockets.delete(socketId);
      this.authedSockets.delete(socketId);
      this.pendingChallenges.delete(socketId);
    });
  }

  private handleIpcAuth(socketId: string, socket: net.Socket, req: IpcRequest) {
    if (req.action === "auth" && req.params.token === this.ipcToken) {
      this.authedSockets.add(socketId);
      this.sendToSocket(socket, { id: req.id, ok: true, data: { authed: true } });
    } else {
      this.sendToSocket(socket, { id: req.id, ok: false, error: "认证失败" });
      socket.destroy();
    }
  }

  private handleRpcAuth(
    socketId: string,
    socket: net.Socket,
    req: IpcRequest,
    remoteIp: string,
  ) {
    const challenge = this.pendingChallenges.get(socketId);
    if (!challenge) {
      this.sendToSocket(socket, { id: req.id, ok: false, error: "认证流程异常" });
      socket.destroy();
      return;
    }

    if (req.action !== "auth" || typeof req.params.digest !== "string") {
      this.sendToSocket(socket, { id: req.id, ok: false, error: "认证失败" });
      this.recordAuthFailure(remoteIp);
      socket.destroy();
      return;
    }

    const expected = createHmac("sha256", this.ipcToken)
      .update(challenge)
      .digest("hex");

    const digestBuf = Buffer.from(req.params.digest as string, "hex");
    const expectedBuf = Buffer.from(expected, "hex");

    if (
      digestBuf.length !== expectedBuf.length ||
      !timingSafeEqual(digestBuf, expectedBuf)
    ) {
      this.recordAuthFailure(remoteIp);
      console.error(`[rpc] 认证失败: ${remoteIp}`);
      this.sendToSocket(socket, { id: req.id, ok: false, error: "认证失败" });
      socket.destroy();
      return;
    }

    this.pendingChallenges.delete(socketId);
    this.clearAuthFailure(remoteIp);
    this.authedSockets.add(socketId);
    this.sendToSocket(socket, { id: req.id, ok: true, data: { authed: true } });
  }

  private async processRequest(socket: net.Socket, req: IpcRequest) {
    try {
      const response = await handleRequest(this.ctx.client, req);
      this.sendToSocket(socket, response);
    } catch (err) {
      this.sendToSocket(socket, {
        id: req.id,
        ok: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async start(): Promise<void> {
    const sockPath = getSocketPath(this.ctx.uin);
    try {
      await fs.unlink(sockPath);
    } catch {
      /* ignore */
    }

    await new Promise<void>((resolve, reject) => {
      this.ipcServer.on("error", reject);
      this.ipcServer.listen(sockPath, async () => {
        try {
          await fs.chmod(sockPath, 0o600);
        } catch {
          /* ignore */
        }
        resolve();
      });
    });

    if (this.rpcConfig?.enabled) {
      this.rpcServer = net.createServer((socket) =>
        this.handleConnection(socket, "rpc"),
      );

      const { host, port } = this.rpcConfig;

      await new Promise<void>((resolve, reject) => {
        this.rpcServer!.on("error", (err) => {
          console.error(`[rpc] TCP 服务启动失败: ${err.message}`);
          reject(err);
        });
        this.rpcServer!.listen(port, host, () => {
          const addr = this.rpcServer!.address() as net.AddressInfo;
          this.rpcPort = addr.port;
          console.log(`[rpc] TCP 服务已启动: ${host}:${this.rpcPort}`);
          resolve();
        });
      });

      await fs.writeFile(
        getRpcPortPath(this.ctx.uin),
        JSON.stringify({ host: this.rpcConfig.host, port: this.rpcPort }),
        { mode: 0o600 },
      );
    }
  }

  async stop(): Promise<void> {
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;

    for (const socket of this.sockets.values()) {
      socket.destroy();
    }
    this.sockets.clear();
    this.authedSockets.clear();
    this.pendingChallenges.clear();
    this.authFailures.clear();

    const closeServer = (server: net.Server) =>
      new Promise<void>((resolve) => server.close(() => resolve()));

    await closeServer(this.ipcServer);
    if (this.rpcServer) {
      await closeServer(this.rpcServer);
    }

    try {
      await fs.unlink(getRpcPortPath(this.ctx.uin));
    } catch {
      /* ignore */
    }
  }
}
