import type { Client } from "@icqqjs/icqq";
import { renderDisplayMessage } from "@/lib/parse-message.js";
import { sendNotification } from "@/lib/notify.js";

export type NotificationPayload = {
  title: string;
  subtitle?: string;
  body: string;
};

/**
 * 守护进程桌面通知 — 唯一 notifyEnabled 来源。
 * entry.ts 与 EventBridge 均通过此 Module 发送通知。
 */
export class NotificationService {
  private readonly uin: number;
  private enabled: boolean;

  constructor(uin: number, enabled = false) {
    this.uin = uin;
    this.enabled = enabled;
  }

  private brandedTitle(suffix?: string): string {
    return suffix ? `icqq ${this.uin} · ${suffix}` : `icqq ${this.uin}`;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  notify(payload: NotificationPayload): void {
    if (!this.enabled) return;
    sendNotification(payload);
  }

  /** 聊天消息通知（EventBridge 调用） */
  notifyMessage(client: Client, eventName: string, eventData: unknown): void {
    if (!this.enabled || !eventName.startsWith("message")) return;

    const data = eventData as Record<string, unknown>;
    const rawMessage = data.raw_message;
    if (typeof rawMessage !== "string" || !rawMessage) return;

    const sender = this.displayNickname(data);
    const body = renderDisplayMessage(rawMessage);
    const msgType = data.message_type;

    if (msgType === "group") {
      const groupId = Number(data.group_id);
      const groupName =
        client.gl.get(groupId)?.group_name ?? String(groupId);
      this.notify({
        title: this.brandedTitle(groupName),
        subtitle: sender,
        body,
      });
      return;
    }

    if (msgType === "private") {
      this.notify({ title: this.brandedTitle(sender), body });
    }
  }

  notifyOfflineNetwork(message: string): void {
    this.notify({ title: this.brandedTitle(), body: `网络掉线: ${message}` });
  }

  notifyOfflineKickoff(message: string): void {
    this.notify({ title: this.brandedTitle(), body: `被踢下线: ${message}` });
  }

  notifyReconnectSuccess(): void {
    this.notify({ title: this.brandedTitle(), body: "网络已恢复，重连成功" });
  }

  notifyReconnectFailed(): void {
    this.notify({
      title: this.brandedTitle(),
      body: `重连失败，请手动执行 icqq login -q ${this.uin} -r`,
    });
  }

  notifyFriendRequest(e: {
    nickname: string;
    user_id: number;
    comment?: string;
  }): void {
    this.notify({
      title: this.brandedTitle("好友请求"),
      body: `${e.nickname}(${e.user_id}) 请求添加好友${e.comment ? `: ${e.comment}` : ""}`,
    });
  }

  notifyGroupInvite(e: {
    nickname?: string;
    user_id: number;
    group_name?: string;
    group_id: number;
  }): void {
    this.notify({
      title: this.brandedTitle("群邀请"),
      body: `${e.nickname ?? e.user_id} 邀请你加入群 ${e.group_name ?? e.group_id}`,
    });
  }

  notifyGroupJoinRequest(e: {
    nickname?: string;
    user_id: number;
    group_name?: string;
    group_id: number;
    comment?: string;
  }): void {
    this.notify({
      title: this.brandedTitle("入群申请"),
      body: `${e.nickname ?? e.user_id} 申请加入群 ${e.group_name ?? e.group_id}${e.comment ? `: ${e.comment}` : ""}`,
    });
  }

  private displayNickname(data: Record<string, unknown>): string {
    const sender = data.sender as Record<string, unknown> | undefined;
    return String(
      sender?.card ?? sender?.nickname ?? data.user_id ?? data.from_id ?? "?",
    );
  }
}
