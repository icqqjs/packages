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
  config?: IcqqConfig;
  ipcToken?: string;
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

import type { IcqqConfig } from "@/lib/config.js";
import { createInteractiveLoginAwaitOutcome } from "@/lib/account-bootstrap.js";
import {
  isInteractiveLoginRequired,
  runLoginWaitingRuntime,
} from "@/daemon/login-waiting-runtime.js";
import { resolveAlertsConfig } from "@/lib/alert-config.js";
import { sendDaemonAlert } from "@/daemon/alert/dispatcher.js";
import type { Client } from "@icqqjs/icqq";

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
  private readonly config: IcqqConfig | null;
  private readonly ipcToken: string | null;
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
    this.config = options.config ?? null;
    this.ipcToken = options.ipcToken ?? null;
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
    const alertsOn =
      this.config != null && resolveAlertsConfig(this.config).enabled;

    this.client.on("system.online", () => {
      if (alertsOn && this.config) {
        void sendDaemonAlert("online", { uin: this.uin }, { config: this.config });
      }
    });

    this.client.on("system.offline.network", async (event: { message: string }) => {
      this.logger.log("[daemon] 网络掉线:", event.message);
      notifications.notifyOfflineNetwork(event.message);
      await this.reconnectOnNetworkLoss(notifications);
    });

    // 登录态过期（icqq 在 TCP lost → register 失败时走此路径，而非 offline.network）。
    // 未监听会导致非活跃账号掉线后既不重连也不进入 login_waiting，一直停在离线。
    this.client.on("system.token.expire", async () => {
      this.logger.log("[daemon] 登录态过期，尝试重新登录…");
      notifications.notifyOfflineNetwork("登录态过期");
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
          if (
            this.config &&
            this.ipcToken &&
            isInteractiveLoginRequired(error)
          ) {
            this.logger.log("[daemon] 重连需要交互式登录，进入 login_waiting…");
            await this.server.stop();
            if (this.mcpHost) {
              await this.mcpHost.stop();
            }
            try {
              await runLoginWaitingRuntime({
                client: this.client as Client,
                uin: this.uin,
                ipcToken: this.ipcToken,
                config: this.config,
                reason: error instanceof Error ? error.message : String(error),
              });
              await this.server.start();
              if (this.mcpHost) {
                await this.mcpHost.start();
              }
              this.logger.log("[daemon] 交互式登录完成，重连成功");
              notifications.notifyReconnectSuccess();
              return;
            } catch (waitingError) {
              this.logger.log(
                `[daemon] login_waiting 失败: ${waitingError instanceof Error ? waitingError.message : waitingError}`,
              );
            }
          }
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
