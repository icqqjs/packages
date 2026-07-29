import type { Client } from "@icqqjs/icqq";
import { loadConfig, saveConfig } from "@/lib/config.js";
import { NotificationService } from "./notification-service.js";
import { validateWebhookUrl } from "./webhook.js";

export type DaemonReconnectState =
  | "idle"
  | "reconnecting"
  | "offline"
  | "waiting_login";

export type DaemonHealthSnapshot = {
  ipc: true;
  qqOnline: boolean;
  reconnectState: DaemonReconnectState;
  stale: boolean;
  lastEventAt: number | null;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
  lastReconnectAttemptAt: number | null;
  lastReconnectSuccessAt: number | null;
  lastDisconnectReason: string | null;
};

export type DaemonRuntimeEvent = {
  event: string;
  data: unknown;
};

/**
 * 守护进程运行时状态 — webhook、通知等跨 Module 共享状态的唯一来源。
 */
export class DaemonContext {
  readonly client: Client;
  readonly uin: number;
  readonly notifications: NotificationService;
  private webhookUrl: string;
  private readonly runtimeListeners = new Set<(payload: DaemonRuntimeEvent) => void>();
  private health: DaemonHealthSnapshot;

  constructor(
    client: Client,
    uin: number,
    options: { notifyEnabled?: boolean; webhookUrl?: string } = {},
  ) {
    this.client = client;
    this.uin = uin;
    this.notifications = new NotificationService(uin, options.notifyEnabled ?? false);
    this.webhookUrl = options.webhookUrl ?? "";
    const online = typeof client.isOnline === "function" ? client.isOnline() : false;
    const now = Date.now();
    this.health = {
      ipc: true,
      qqOnline: online,
      reconnectState: "idle",
      stale: !online,
      lastEventAt: null,
      lastOnlineAt: online ? now : null,
      lastOfflineAt: null,
      lastReconnectAttemptAt: null,
      lastReconnectSuccessAt: null,
      lastDisconnectReason: null,
    };
  }

  static async fromClient(client: Client, uin: number): Promise<DaemonContext> {
    try {
      const config = await loadConfig();
      return new DaemonContext(client, uin, {
        notifyEnabled: config.notifyEnabled ?? false,
        webhookUrl: config.webhookUrl ?? "",
      });
    } catch {
      return new DaemonContext(client, uin);
    }
  }

  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  getHealth(): DaemonHealthSnapshot {
    return { ...this.health };
  }

  subscribeRuntimeEvents(
    listener: (payload: DaemonRuntimeEvent) => void,
  ): () => void {
    this.runtimeListeners.add(listener);
    return () => {
      this.runtimeListeners.delete(listener);
    };
  }

  noteProtocolEvent(_event: string): void {
    this.health.lastEventAt = Date.now();
  }

  markOnline(): void {
    const now = Date.now();
    this.health.qqOnline = true;
    this.health.reconnectState = "idle";
    this.health.stale = false;
    this.health.lastOnlineAt = now;
    this.health.lastReconnectSuccessAt = now;
    this.health.lastDisconnectReason = null;
    this.emitRuntimeEvent("daemon.recovered");
  }

  markReconnecting(reason: string): void {
    const now = Date.now();
    this.health.qqOnline = false;
    this.health.reconnectState = "reconnecting";
    this.health.stale = true;
    this.health.lastOfflineAt = now;
    this.health.lastDisconnectReason = reason;
    this.emitRuntimeEvent("daemon.degraded");
  }

  markReconnectAttempt(): void {
    this.health.lastReconnectAttemptAt = Date.now();
  }

  markReconnectSuccess(): void {
    this.markOnline();
  }

  markReconnectFailed(reason: string): void {
    const now = Date.now();
    this.health.qqOnline = false;
    this.health.reconnectState = "offline";
    this.health.stale = true;
    this.health.lastOfflineAt = now;
    this.health.lastDisconnectReason = reason;
    this.emitRuntimeEvent("daemon.degraded");
  }

  markKickoff(reason: string): void {
    const now = Date.now();
    this.health.qqOnline = false;
    this.health.reconnectState = "offline";
    this.health.stale = true;
    this.health.lastOfflineAt = now;
    this.health.lastDisconnectReason = reason;
    this.emitRuntimeEvent("daemon.degraded");
  }

  markLoginWaiting(reason: string): void {
    const now = Date.now();
    this.health.qqOnline = false;
    this.health.reconnectState = "waiting_login";
    this.health.stale = true;
    this.health.lastOfflineAt = now;
    this.health.lastDisconnectReason = reason;
    this.emitRuntimeEvent("daemon.degraded");
  }

  async setWebhookUrl(url: string): Promise<string | null> {
    const err = validateWebhookUrl(url);
    if (err) return err;

    this.webhookUrl = url;
    try {
      const config = await loadConfig();
      config.webhookUrl = url || undefined;
      await saveConfig(config);
    } catch {
      /* ignore */
    }
    return null;
  }

  async pushWebhook(payload: Record<string, unknown>): Promise<void> {
    if (!this.webhookUrl) return;
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uin: this.uin, ...payload }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (e) {
      console.error(
        `[webhook] POST failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  async setNotifyEnabled(enabled: boolean): Promise<void> {
    this.notifications.setEnabled(enabled);
    try {
      const config = await loadConfig();
      config.notifyEnabled = enabled || undefined;
      await saveConfig(config);
    } catch {
      /* ignore */
    }
  }

  private emitRuntimeEvent(event: string): void {
    const payload: DaemonRuntimeEvent = {
      event,
      data: {
        uin: this.uin,
        health: this.getHealth(),
      },
    };
    for (const listener of this.runtimeListeners) {
      listener(payload);
    }
  }
}
