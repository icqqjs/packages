import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotificationService } from "../src/daemon/notification-service.js";

vi.mock("../src/lib/notify.js", () => ({
  sendNotification: vi.fn(),
}));

import { sendNotification } from "../src/lib/notify.js";

describe("NotificationService", () => {
  beforeEach(() => {
    vi.mocked(sendNotification).mockClear();
  });

  it("respects enabled flag for all notification types", () => {
    const svc = new NotificationService(false);
    svc.notifyFriendRequest({ nickname: "A", user_id: 1 });
    expect(sendNotification).not.toHaveBeenCalled();

    svc.setEnabled(true);
    svc.notifyFriendRequest({ nickname: "A", user_id: 1 });
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it("notifyMessage skips when disabled", () => {
    const svc = new NotificationService(false);
    const client = { gl: new Map() } as never;
    svc.notifyMessage(client, "message.private.friend", {
      message_type: "private",
      raw_message: "hi",
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
