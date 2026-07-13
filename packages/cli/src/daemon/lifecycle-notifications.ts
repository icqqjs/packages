import type { IcqqConfig } from "@/lib/config.js";
import { resolveAlertsConfig } from "@/lib/alert-config.js";
import { sendDaemonAlert } from "@/daemon/alert/dispatcher.js";
import type { NotificationService } from "@/daemon/notification-service.js";
import type { ManagedRuntimeLifecycleNotifications } from "@/daemon/managed-runtime.js";

export function createLifecycleNotifications(
  uin: number,
  config: IcqqConfig,
  desktop: NotificationService,
): ManagedRuntimeLifecycleNotifications {
  const alertsOn = resolveAlertsConfig(config).enabled;

  return {
    notifyOfflineNetwork(message: string) {
      if (alertsOn) {
        void sendDaemonAlert("offline_network", { uin, reason: message }, { config });
      }
      desktop.notifyOfflineNetwork(message);
    },
    notifyOfflineKickoff(message: string) {
      if (alertsOn) {
        void sendDaemonAlert("offline_kickoff", { uin, reason: message }, { config });
      }
      desktop.notifyOfflineKickoff(message);
    },
    notifyReconnectSuccess() {
      desktop.notifyReconnectSuccess();
    },
    notifyReconnectFailed() {
      desktop.notifyReconnectFailed();
    },
  };
}
