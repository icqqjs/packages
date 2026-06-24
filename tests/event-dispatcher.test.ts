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
  });
});
