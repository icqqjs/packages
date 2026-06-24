import type { Client } from "@icqqjs/icqq";
import type { DaemonContext } from "./daemon-context.js";
import { EventBridge, type EventBridgeListener } from "./event-bridge.js";
import type { NotificationService } from "./notification-service.js";

function registerSocialRequestHandlers(
  client: Client,
  notifications: NotificationService,
): Array<() => void> {
  const handlers: Array<[string, (...args: never[]) => void]> = [
    [
      "request.friend.add",
      (e: { nickname: string; user_id: number; comment?: string }) => {
        notifications.notifyFriendRequest(e);
      },
    ],
    [
      "request.group.invite",
      (e: {
        nickname?: string;
        user_id: number;
        group_name?: string;
        group_id: number;
      }) => {
        notifications.notifyGroupInvite(e);
      },
    ],
    [
      "request.group.add",
      (e: {
        nickname?: string;
        user_id: number;
        group_name?: string;
        group_id: number;
        comment?: string;
      }) => {
        notifications.notifyGroupJoinRequest(e);
      },
    ],
  ];

  for (const [event, handler] of handlers) {
    client.on(event, handler as never);
  }

  return handlers.map(([event, handler]) => () => client.off(event, handler as never));
}

/**
 * 统一 icqq 事件分发：消息类事件经 EventBridge，社交请求直接注册。
 */
export class DaemonEventDispatcher {
  private readonly bridge = new EventBridge();
  private readonly listeners = new Set<EventBridgeListener>();
  private socialCleanups: Array<() => void> = [];

  attach(client: Client, ctx: DaemonContext): void {
    this.bridge.attach(client);
    this.socialCleanups = registerSocialRequestHandlers(
      client,
      ctx.notifications,
    );
  }

  subscribe(listener: EventBridgeListener): () => void {
    this.listeners.add(listener);
    const bridgeUnsub = this.bridge.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      bridgeUnsub();
    };
  }

  detach(): void {
    for (const cleanup of this.socialCleanups) {
      cleanup();
    }
    this.socialCleanups = [];
    this.listeners.clear();
  }
}
