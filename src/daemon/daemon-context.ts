import type { Client } from "@icqqjs/icqq";
import { loadConfig, saveConfig } from "@/lib/config.js";
import { NotificationService } from "./notification-service.js";
import { validateWebhookUrl } from "./webhook.js";

/**
 * 守护进程运行时状态 — webhook、通知等跨 Module 共享状态的唯一来源。
 */
export class DaemonContext {
  readonly client: Client;
  readonly uin: number;
  readonly notifications: NotificationService;
  private webhookUrl: string;

  constructor(
    client: Client,
    uin: number,
    options: { notifyEnabled?: boolean; webhookUrl?: string } = {},
  ) {
    this.client = client;
    this.uin = uin;
    this.notifications = new NotificationService(options.notifyEnabled ?? false);
    this.webhookUrl = options.webhookUrl ?? "";
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
}

let activeContext: DaemonContext | null = null;

export function initDaemonContext(ctx: DaemonContext): void {
  activeContext = ctx;
}

export function getDaemonContext(): DaemonContext {
  if (!activeContext) {
    throw new Error("DaemonContext 未初始化");
  }
  return activeContext;
}

/** 进程内调用（MCP / handlers）；守护进程外返回 null */
export function tryGetDaemonContext(): DaemonContext | null {
  return activeContext;
}
