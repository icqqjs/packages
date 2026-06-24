import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationService } from "../src/daemon/notification-service.js";

vi.mock("../src/lib/notify.js", () => ({
  sendNotification: vi.fn(),
}));

import { sendNotification } from "../src/lib/notify.js";

const UIN = 12345;

describe("NotificationService", () => {
  beforeEach(() => {
    vi.mocked(sendNotification).mockClear();
  });

  it("respects enabled flag for all notification types", () => {
    const svc = new NotificationService(UIN, false);
    svc.notifyFriendRequest({ nickname: "A", user_id: 1 });
    expect(sendNotification).not.toHaveBeenCalled();

    svc.setEnabled(true);
    svc.notifyFriendRequest({ nickname: "A", user_id: 1 });
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it("notifyMessage skips when disabled", () => {
    const svc = new NotificationService(UIN, false);
    const client = { gl: new Map() } as never;
    svc.notifyMessage(client, "message.private.friend", {
      message_type: "private",
      raw_message: "hi",
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("supports generic notify and enabled flag accessors", () => {
    const svc = new NotificationService(UIN);
    expect(svc.isEnabled()).toBe(false);

    svc.notify({ title: "ignored", body: "ignored" });
    expect(sendNotification).not.toHaveBeenCalled();

    svc.setEnabled(true);
    expect(svc.isEnabled()).toBe(true);
    svc.notify({ title: "hello", subtitle: "sub", body: "body" });
    expect(sendNotification).toHaveBeenCalledWith({
      title: "hello",
      subtitle: "sub",
      body: "body",
    });
  });

  it("notifies private messages with sender fallback", () => {
    const svc = new NotificationService(UIN, true);
    const client = { gl: new Map() } as never;

    svc.notifyMessage(client, "message.private.friend", {
      message_type: "private",
      from_id: 12345,
      raw_message: "hi [dice]",
    });

    expect(sendNotification).toHaveBeenCalledWith({
      title: `icqq ${UIN} · 12345`,
      body: "hi [骰子·不支持查看]",
    });
  });

  it("notifies group messages with group name and sender card", () => {
    const svc = new NotificationService(UIN, true);
    const client = {
      gl: new Map([[123, { group_name: "测试群" }]]),
    } as never;

    svc.notifyMessage(client, "message.group.normal", {
      message_type: "group",
      group_id: 123,
      raw_message: "[reply:abc] hello",
      sender: { card: "群名片", nickname: "昵称" },
    });

    expect(sendNotification).toHaveBeenCalledWith({
      title: `icqq ${UIN} · 测试群`,
      subtitle: "群名片",
      body: "[引用:abc] hello",
    });
  });

  it("skips non-message events and empty raw messages", () => {
    const svc = new NotificationService(UIN, true);
    const client = { gl: new Map() } as never;

    svc.notifyMessage(client, "notice.friend.recall", { raw_message: "hi" });
    svc.notifyMessage(client, "message.private.friend", {
      message_type: "private",
      raw_message: "",
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends offline and reconnect notifications", () => {
    const svc = new NotificationService(UIN, true);

    svc.notifyOfflineNetwork("timeout");
    svc.notifyOfflineKickoff("kickoff");
    svc.notifyReconnectSuccess();
    svc.notifyReconnectFailed();

    expect(sendNotification).toHaveBeenNthCalledWith(1, {
      title: `icqq ${UIN}`,
      body: "网络掉线: timeout",
    });
    expect(sendNotification).toHaveBeenNthCalledWith(4, {
      title: `icqq ${UIN}`,
      body: `重连失败，请手动执行 icqq login -q ${UIN} -r`,
    });
  });

  it("sends friend, invite, and join request notifications", () => {
    const svc = new NotificationService(UIN, true);

    svc.notifyFriendRequest({ nickname: "A", user_id: 1, comment: "你好" });
    svc.notifyGroupInvite({ nickname: "B", user_id: 2, group_name: "开发群", group_id: 100 });
    svc.notifyGroupJoinRequest({ nickname: undefined, user_id: 3, group_name: undefined, group_id: 200, comment: "申请" });

    expect(sendNotification).toHaveBeenNthCalledWith(1, {
      title: `icqq ${UIN} · 好友请求`,
      body: "A(1) 请求添加好友: 你好",
    });
  });
});
