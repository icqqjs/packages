import type { Client } from "@icqqjs/icqq";
import { serializeIcqqEvent } from "@/lib/serialize-icqq-event.js";

export type IcqqEventPayload = {
  event: string;
  data: unknown;
};

export type EventBridgeListener = (payload: IcqqEventPayload) => void;

/**
 * icqq 事件桥 — hook client.em，序列化后分发给订阅方。
 * Interface：attach 一次，subscribe 多处（IPC fan-out、Webhook、通知）。
 */
export class EventBridge {
  private listeners = new Set<EventBridgeListener>();
  private attached = false;

  attach(client: Client): void {
    if (this.attached) return;
    this.attached = true;

    const emClient = client as Client & {
      em: (name?: string, data?: unknown) => void;
    };
    const originalEm = emClient.em.bind(emClient);

    emClient.em = (name = "", data?: unknown) => {
      originalEm(name, data);
      if (!name) return;
      this.dispatch(name, data);
    };
  }

  subscribe(listener: EventBridgeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private dispatch(eventName: string, rawData: unknown): void {
    const data = serializeIcqqEvent(rawData);
    const payload: IcqqEventPayload = { event: eventName, data };
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
