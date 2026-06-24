import { describe, expect, it, vi } from "vitest";
import { DaemonEventDispatcher } from "../src/daemon/event-dispatcher.js";

describe("DaemonEventDispatcher", () => {
  it("forwards bridge events to subscribers", () => {
    const client = {
      em: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as never;
    const notifications = {
      notifyFriendRequest: vi.fn(),
      notifyGroupInvite: vi.fn(),
      notifyGroupJoinRequest: vi.fn(),
    };

    const dispatcher = new DaemonEventDispatcher();
    dispatcher.attach(client, { notifications } as never);

    const received: string[] = [];
    dispatcher.subscribe(({ event }) => {
      received.push(event);
    });

    (client as { em: (name: string) => void }).em("message.private");
    expect(received).toContain("message.private");
    expect(client.on).toHaveBeenCalledWith(
      "request.friend.add",
      expect.any(Function),
    );

    const friendHandler = client.on.mock.calls.find(
      ([event]) => event === "request.friend.add",
    )?.[1] as (e: unknown) => void;
    const inviteHandler = client.on.mock.calls.find(
      ([event]) => event === "request.group.invite",
    )?.[1] as (e: unknown) => void;
    const joinHandler = client.on.mock.calls.find(
      ([event]) => event === "request.group.add",
    )?.[1] as (e: unknown) => void;

    friendHandler({ nickname: "n", user_id: 1, comment: "hi" });
    inviteHandler({ nickname: "i", user_id: 2, group_id: 3, group_name: "g" });
    joinHandler({
      nickname: "j",
      user_id: 4,
      group_id: 5,
      group_name: "gg",
      comment: "join",
    });

    expect(notifications.notifyFriendRequest).toHaveBeenCalled();
    expect(notifications.notifyGroupInvite).toHaveBeenCalled();
    expect(notifications.notifyGroupJoinRequest).toHaveBeenCalled();
  });
});
