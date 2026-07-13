import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../src/daemon/notification-service.js";

const lifecycleMocks = vi.hoisted(() => ({
  sendDaemonAlert: vi.fn(async () => {}),
}));

vi.mock("../src/daemon/alert/dispatcher.js", () => ({
  sendDaemonAlert: lifecycleMocks.sendDaemonAlert,
}));

import { createLifecycleNotifications } from "../src/daemon/lifecycle-notifications.js";

describe("createLifecycleNotifications", () => {
  beforeEach(() => {
    lifecycleMocks.sendDaemonAlert.mockClear();
  });

  it("sends alerts when enabled and always delegates to desktop", () => {
    const desktop = new NotificationService(123, true);
    const notifySpy = vi.spyOn(desktop, "notifyOfflineNetwork");
    const kickSpy = vi.spyOn(desktop, "notifyOfflineKickoff");
    const okSpy = vi.spyOn(desktop, "notifyReconnectSuccess");
    const failSpy = vi.spyOn(desktop, "notifyReconnectFailed");

    const hooks = createLifecycleNotifications(123, {
      accounts: {},
      alerts: { enabled: true, providers: { bark: { deviceKey: "k" } } },
    }, desktop);

    hooks.notifyOfflineNetwork("net down");
    hooks.notifyOfflineKickoff("kicked");
    hooks.notifyReconnectSuccess();
    hooks.notifyReconnectFailed();

    expect(lifecycleMocks.sendDaemonAlert).toHaveBeenCalledWith(
      "offline_network",
      { uin: 123, reason: "net down" },
      expect.any(Object),
    );
    expect(lifecycleMocks.sendDaemonAlert).toHaveBeenCalledWith(
      "offline_kickoff",
      { uin: 123, reason: "kicked" },
      expect.any(Object),
    );
    expect(notifySpy).toHaveBeenCalledWith("net down");
    expect(kickSpy).toHaveBeenCalledWith("kicked");
    expect(okSpy).toHaveBeenCalled();
    expect(failSpy).toHaveBeenCalled();
    expect(lifecycleMocks.sendDaemonAlert).not.toHaveBeenCalledWith("online", expect.anything(), expect.anything());
  });

  it("skips alerts when disabled", () => {
    const desktop = new NotificationService(456, false);
    const hooks = createLifecycleNotifications(456, {
      accounts: {},
      alerts: { enabled: false },
    }, desktop);

    hooks.notifyOfflineNetwork("x");
    expect(lifecycleMocks.sendDaemonAlert).not.toHaveBeenCalled();
  });
});
