import type { Client } from "@icqqjs/icqq";
import type { DaemonContext } from "./daemon-context.js";
import type { EventBridge } from "./event-bridge.js";
import type { DaemonEventDispatcher } from "./event-dispatcher.js";

export type EventPayload = {
  event: string;
  data: unknown;
};

export type EventFanOut = (eventName: string, eventData: unknown) => void;

/**
 * 事件副作用管道：webhook → 桌面通知 → IPC 扇出。
 */
export class EventPipeline {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ctx: DaemonContext,
    private readonly fanOut: EventFanOut,
  ) {}

  handle(payload: EventPayload): void {
    void this.ctx.pushWebhook({
      event: payload.event,
      data: payload.data,
    });
    this.ctx.notifications.notifyMessage(
      this.ctx.client,
      payload.event,
      payload.data,
    );
    this.fanOut(payload.event, payload.data);
  }

  attachToDispatcher(dispatcher: DaemonEventDispatcher, client: Client, ctx: DaemonContext): void {
    dispatcher.attach(client, ctx);
    this.unsubscribe?.();
    this.unsubscribe = dispatcher.subscribe((payload) => this.handle(payload));
  }

  /** @deprecated 使用 attachToDispatcher */
  attachToEventBridge(bridge: EventBridge, client: Client): void {
    bridge.attach(client);
    this.unsubscribe?.();
    this.unsubscribe = bridge.subscribe((payload) => this.handle(payload));
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
