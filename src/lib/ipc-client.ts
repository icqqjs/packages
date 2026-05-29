/**
 * IPC/RPC 客户端 — CLI 侧用于与守护进程通信的客户端。
 *
 * IPC 模式（本地 Unix Socket）：
 *   const client = await IpcClient.connect(uin);
 *
 * RPC 模式（远程 TCP）：
 *   const client = await IpcClient.connectRpc({ host, port, token });
 *
 * 通信协议：JSON + 换行符。
 * IPC 连接使用 Token 直传认证；RPC 使用 HMAC-SHA256 挑战-响应认证。
 *
 * @module ipc-client
 */
import net from "node:net";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getSocketPath, getTokenPath, getRpcPortPath } from "./paths.js";
import type {
  IpcRequest,
  IpcResponse,
  IpcEvent,
  IpcMessage,
} from "@/daemon/protocol.js";
import { wrapSubscribeEventHandler } from "@/lib/ipc-event-filter.js";

export class IpcClient {
  private socket: net.Socket;
  private buffer = "";
  private pending = new Map<
    string,
    { resolve: (v: IpcResponse) => void; reject: (e: Error) => void }
  >();
  private eventHandlers = new Map<string, (event: IpcEvent) => void>();

  private constructor(socket: net.Socket, skipDataHandler = false) {
    this.socket = socket;
    if (!skipDataHandler) {
      this.attachDataHandler();
    }
    this.socket.on("error", (err) => {
      for (const { reject } of this.pending.values()) {
        reject(err);
      }
      this.pending.clear();
    });
  }

  /** 注册数据处理 handler（RPC 模式延迟到 challenge 完成后调用） */
  private attachDataHandler(initialBuffer = "") {
    this.buffer = initialBuffer;
    this.socket.on("data", (chunk) => this.onData(chunk.toString()));
  }

  /**
   * 通过 IPC（Unix Socket）连接守护进程并完成认证。
   * @param uin - 目标账号的 QQ 号
   * @returns 已认证的 IpcClient 实例
   * @throws 守护进程未运行或认证失败时抛出错误
   */
  static async connect(uin: number): Promise<IpcClient> {
    // Read auth token
    let token: string;
    try {
      token = (await readFile(getTokenPath(uin), "utf-8")).trim();
    } catch {
      throw new Error("无法读取认证 token，守护进程可能未运行");
    }

    const client = await new Promise<IpcClient>((resolve, reject) => {
      const sock = net.connect(getSocketPath(uin));
      sock.on("connect", () => resolve(new IpcClient(sock)));
      sock.on("error", reject);
    });

    // Authenticate
    const authResp = await client.request("auth", { token });
    if (!authResp.ok) {
      client.close();
      throw new Error("IPC 认证失败");
    }
    return client;
  }

  /**
   * 通过 RPC（TCP）连接守护进程并完成 HMAC 挑战-响应认证。
   *
   * @param options.host - 远程主机地址
   * @param options.port - 远程端口
   * @param options.token - 认证 token（用于 HMAC 计算，不会明文传输）
   * @returns 已认证的 IpcClient 实例
   */
  static async connectRpc(options: {
    host: string;
    port: number;
    token: string;
  }): Promise<IpcClient> {
    const { host, port, token } = options;

    const client = await new Promise<IpcClient>((resolve, reject) => {
      const sock = net.connect(port, host);
      // skipDataHandler=true: 延迟注册 onData，避免与 challenge 读取冲突
      sock.on("connect", () => resolve(new IpcClient(sock, true)));
      sock.on("error", reject);
    });

    // Wait for challenge from server, with proper buffering for TCP fragmentation
    let challengeRemainder = "";
    const challenge = await new Promise<string>((resolve, reject) => {
      let challengeBuffer = "";
      const timeout = setTimeout(() => {
        client.socket.removeListener("data", onData);
        client.close();
        reject(new Error("RPC 挑战超时"));
      }, 10000);

      const onData = (chunk: Buffer) => {
        challengeBuffer += chunk.toString();
        const nlIdx = challengeBuffer.indexOf("\n");
        if (nlIdx === -1) return;

        clearTimeout(timeout);
        client.socket.removeListener("data", onData);
        challengeRemainder = challengeBuffer.slice(nlIdx + 1);

        try {
          const msg = JSON.parse(challengeBuffer.slice(0, nlIdx)) as {
            challenge?: string;
          };
          if (!msg.challenge) {
            reject(new Error("RPC 服务端未发送挑战"));
            return;
          }
          resolve(msg.challenge);
        } catch {
          reject(new Error("RPC 挑战解析失败"));
        }
      };
      client.socket.on("data", onData);
    });

    client.attachDataHandler(challengeRemainder);

    // Compute HMAC digest and authenticate
    const digest = createHmac("sha256", token)
      .update(challenge)
      .digest("hex");

    const authResp = await client.request("auth", { digest });
    if (!authResp.ok) {
      client.close();
      throw new Error(authResp.error ?? "RPC 认证失败");
    }
    return client;
  }

  /**
   * 通过 RPC 连接守护进程（自动从 daemon.rpc 文件读取地址）。
   * @param uin - 目标账号的 QQ 号
   * @returns 已认证的 IpcClient 实例
   */
  static async connectRpcByUin(uin: number): Promise<IpcClient> {
    let token: string;
    try {
      token = (await readFile(getTokenPath(uin), "utf-8")).trim();
    } catch {
      throw new Error("无法读取认证 token，守护进程可能未运行");
    }

    let rpcInfo: { host: string; port: number };
    try {
      const raw = await readFile(getRpcPortPath(uin), "utf-8");
      rpcInfo = JSON.parse(raw);
    } catch {
      throw new Error("RPC 未启用或守护进程未运行");
    }

    return IpcClient.connectRpc({
      host: rpcInfo.host,
      port: rpcInfo.port,
      token,
    });
  }

  private onData(data: string) {
    this.buffer += data;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as IpcMessage;
        if ("event" in msg) {
          for (const handler of this.eventHandlers.values()) {
            handler(msg as IpcEvent);
          }
        } else {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            p.resolve(msg as IpcResponse);
          }
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  /**
   * 发送 IPC 请求并等待响应。
   * @param action - 操作名称，见 {@link Actions}
   * @param params - 操作参数
   * @param timeoutMs - 超时时间（毫秒），默认 30000
   * @returns IPC 响应
   * @throws 超时或网络错误
   */
  async request(
    action: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30000,
  ): Promise<IpcResponse> {
    const id = randomUUID();
    const req: IpcRequest = { id, action, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`IPC 请求超时 (${timeoutMs}ms): ${action}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.socket.write(JSON.stringify(req) + "\n", (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /**
   * 注册 icqq 事件回调。认证连接后服务端自动推送，断开连接后停止。
   * 每条连接只需注册一次；自行在回调里按 event/data 过滤。
   * @returns 取消注册的函数
   */
  onEvent(onEvent: (event: IpcEvent) => void): () => void {
    const id = randomUUID();
    this.eventHandlers.set(id, onEvent);
    return () => {
      this.eventHandlers.delete(id);
    };
  }

  /**
   * @deprecated 使用 {@link onEvent}。服务端不再维护多条 subscribe，认证后自动推送。
   * 若传入 type/id，仅在客户端按会话过滤（兼容旧调用方式，不会重复推送）。
   */
  subscribe(
    _action: string,
    params: Record<string, unknown> = {},
    onEvent: (event: IpcEvent) => void,
  ): { id: string; unsubscribe: () => Promise<void> } {
    const wrapped = wrapSubscribeEventHandler(params, onEvent);
    const off = this.onEvent(wrapped);
    const id = randomUUID();
    return {
      id,
      unsubscribe: async () => {
        off();
      },
    };
  }

  /** 关闭连接，拒绝所有未完成的请求，释放事件处理器。 */
  close() {
    this.eventHandlers.clear();
    for (const { reject } of this.pending.values()) {
      reject(new Error("连接已关闭"));
    }
    this.pending.clear();
    this.socket.destroy();
  }
}
