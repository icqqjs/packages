import fs from "node:fs/promises";
import path from "node:path";

type RuntimeClient = {
  login(uin: number): Promise<void>;
  logout(): Promise<void>;
  terminate(): void;
  on(event: string, listener: (...args: any[]) => void): unknown;
  once(event: string, listener: (...args: any[]) => void): unknown;
};

type RuntimeServer = {
  start(): Promise<void>;
  stop(): Promise<void>;
  getRpcPort(): number;
};

type RuntimeMcpHost = {
  start(): Promise<void>;
  stop(): Promise<void>;
  getEndpointUrl(): string | null;
};

type RuntimeProcess = Pick<NodeJS.Process, "on" | "send" | "disconnect" | "exit"> & {
  connected?: boolean;
  _icqqLogoutDone?: boolean;
};

type RuntimeFs = Pick<typeof fs, "unlink" | "writeFile" | "mkdir">;

export type ReconnectExhaustAction = "exit" | "stay-offline";

export type ManagedRuntimeOptions = {
  uin: number;
  socketPath: string;
  client: RuntimeClient;
  server: RuntimeServer;
  rpcConfig?: { enabled: boolean; host: string } | null;
  mcpHost?: RuntimeMcpHost | null;
  cleanupPaths?: string[];
  stoppedFlagPath?: string;
  fsOps?: RuntimeFs;
  processRef?: RuntimeProcess;
  logger?: Pick<Console, "log">;
  sleep?: (ms: number) => Promise<void>;
  awaitReconnectOutcome?: (client: RuntimeClient) => Promise<void>;
  reconnectPolicy?: {
    maxRetries: number;
    delaysSeconds: number[];
  };
  reconnectExhaustAction?: ReconnectExhaustAction;
};

export type ManagedRuntimeLifecycleNotifications = {
  notifyOfflineNetwork(message: string): void;
  notifyOfflineKickoff(message: string): void;
  notifyReconnectSuccess(): void;
  notifyReconnectFailed(): void;
};

export type ManagedRuntimeStartInfo = {
  socketPath: string;
  rpcAddress: string | null;
  mcpUrl: string | null;
};

/** 重连时监听交互式登录事件，避免静默耗尽重试次数 */
export function createInteractiveLoginAwaitOutcome(
  timeoutMs = 15000,
): (client: RuntimeClient) => Promise<void> {
  return (client) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("重连超时")), timeoutMs);
      const finish = (fn: () => void) => {
        clearTimeout(timer);
        fn();
      };

      client.once("system.online", () => finish(resolve));
      client.once("system.login.error", (event: { message: string }) => {
        finish(() => reject(new Error(event.message)));
      });
      client.once("system.login.qrcode", () => {
        finish(() => reject(new Error("需要扫码验证，请执行 icqq login")));
      });
      client.once("system.login.slider", () => {
        finish(() => reject(new Error("需要滑块验证，请执行 icqq login")));
      });
      client.once("system.login.device", () => {
        finish(() => reject(new Error("需要设备验证，请执行 icqq login")));
      });
      client.once("system.login.auth", () => {
        finish(() => reject(new Error("需要身份验证，请执行 icqq login")));
      });
    });
}

export class ManagedRuntime {
  private readonly uin: number;
  private readonly socketPath: string;
  private readonly client: RuntimeClient;
  private readonly server: RuntimeServer;
  private readonly rpcConfig: { enabled: boolean; host: string } | null;
  private mcpHost: RuntimeMcpHost | null;
  private readonly cleanupPaths: string[];
  private readonly stoppedFlagPath: string | null;
  private readonly fsOps: RuntimeFs;
  private readonly processRef: RuntimeProcess;
  private readonly logger: Pick<Console, "log">;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly awaitReconnectOutcome: (client: RuntimeClient) => Promise<void>;
  private readonly reconnectPolicy: {
    maxRetries: number;
    delaysSeconds: number[];
  };
  private readonly reconnectExhaustAction: ReconnectExhaustAction;
  private shutdownPromise: Promise<void> | null = null;
  private reconnectPromise: Promise<void> | null = null;
  private reconnectAborted = false;

  constructor(options: ManagedRuntimeOptions) {
    this.uin = options.uin;
    this.socketPath = options.socketPath;
    this.client = options.client;
    this.server = options.server;
    this.rpcConfig = options.rpcConfig ?? null;
    this.mcpHost = options.mcpHost ?? null;
    this.cleanupPaths = options.cleanupPaths ?? [];
    this.stoppedFlagPath = options.stoppedFlagPath ?? null;
    this.fsOps = options.fsOps ?? fs;
    this.processRef = options.processRef ?? process;
    this.logger = options.logger ?? console;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.awaitReconnectOutcome =
      options.awaitReconnectOutcome ?? createInteractiveLoginAwaitOutcome();
    this.reconnectPolicy = options.reconnectPolicy ?? {
      maxRetries: 5,
      delaysSeconds: [5, 10, 30, 60, 120],
    };
    this.reconnectExhaustAction = options.reconnectExhaustAction ?? "stay-offline";
  }

  async start(): Promise<ManagedRuntimeStartInfo> {
    await this.server.start();

    let mcpUrl: string | null = null;
    if (this.mcpHost) {
      await this.mcpHost.start();
      mcpUrl = this.mcpHost.getEndpointUrl();
    }

    return {
      socketPath: this.socketPath,
      rpcAddress: this.rpcConfig?.enabled
        ? `${this.rpcConfig.host}:${this.server.getRpcPort()}`
        : null,
      mcpUrl,
    };
  }

  notifyReady(): void {
    if (this.processRef.send) {
      this.processRef.send("ready");
      if (this.processRef.connected) {
        this.processRef.disconnect?.();
      }
    }
  }

  attachSignalHandlers(): void {
    this.processRef.on("SIGTERM", () => void this.shutdown("SIGTERM"));
    this.processRef.on("SIGINT", () => void this.shutdown("SIGINT"));
  }

  attachLifecycleHandlers(
    notifications: ManagedRuntimeLifecycleNotifications,
  ): void {
    this.client.on("system.offline.network", async (event: { message: string }) => {
      this.logger.log("[daemon] 网络掉线:", event.message);
      notifications.notifyOfflineNetwork(event.message);
      await this.reconnectOnNetworkLoss(notifications);
    });

    this.client.on("system.offline.kickoff", (event: { message: string }) => {
      this.logger.log("[daemon] 被踢下线:", event.message);
      notifications.notifyOfflineKickoff(event.message);
    });
  }

  reconnectOnNetworkLoss(
    notifications: Pick<
      ManagedRuntimeLifecycleNotifications,
      "notifyReconnectSuccess" | "notifyReconnectFailed"
    >,
  ): Promise<void> {
    if (this.reconnectPromise) return this.reconnectPromise;

    this.reconnectPromise = (async () => {
      for (let i = 0; i < this.reconnectPolicy.maxRetries; i++) {
        if (this.reconnectAborted) return;

        const delay = this.reconnectPolicy.delaysSeconds[i]!;
        this.logger.log(`[daemon] ${delay}s 后尝试第 ${i + 1} 次重连…`);
        await this.sleep(delay * 1000);
        if (this.reconnectAborted) return;

        try {
          await this.client.login(this.uin);
          await this.awaitReconnectOutcome(this.client);
          this.logger.log("[daemon] 重连成功");
          notifications.notifyReconnectSuccess();
          return;
        } catch (error) {
          this.logger.log(
            `[daemon] 第 ${i + 1} 次重连失败: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      this.logger.log(
        `[daemon] ${this.reconnectPolicy.maxRetries} 次重连均失败，放弃重连`,
      );
      notifications.notifyReconnectFailed();
      if (this.reconnectExhaustAction === "exit") {
        this.processRef.exit(1);
      }
    })().finally(() => {
      this.reconnectPromise = null;
    });

    return this.reconnectPromise;
  }

  shutdown(signal: string): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;

    this.reconnectAborted = true;
    this.shutdownPromise = (async () => {
      this.logger.log(`[daemon] 收到 ${signal}，正在关闭…`);

      if (this.mcpHost) {
        await this.mcpHost.stop();
        this.mcpHost = null;
      }

      await this.server.stop();

      if (this.processRef._icqqLogoutDone !== true) {
        try {
          await this.client.logout();
        } catch {
          /* ignore */
        }
      }

      this.client.terminate();

      if (this.stoppedFlagPath) {
        try {
          await this.fsOps.mkdir(path.dirname(this.stoppedFlagPath), {
            recursive: true,
            mode: 0o700,
          });
          await this.fsOps.writeFile(this.stoppedFlagPath, `${Date.now()}\n`, {
            mode: 0o600,
          });
        } catch {
          /* ignore */
        }
      }

      for (const path of this.cleanupPaths) {
        try {
          await this.fsOps.unlink(path);
        } catch {
          /* ignore */
        }
      }

      this.processRef.exit(0);
    })();

    return this.shutdownPromise;
  }

  getUin(): number {
    return this.uin;
  }
}
