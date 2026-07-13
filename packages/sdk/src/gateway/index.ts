export {
  loadConfig,
  saveConfig,
  getAccountConfig,
  setAccountConfig,
} from "@icqqjs/cli/config";

export type { AccountConfig, IcqqConfig } from "@icqqjs/cli/config";

export {
  getIcqqHome,
  getAccountDir,
  getLogPath,
} from "@icqqjs/cli/paths";

export {
  spawnDaemon,
  stopDaemon,
  forceStopDaemon,
  isDaemonRunning,
} from "@icqqjs/cli/daemon/supervisor";

export { LoginActions } from "@icqqjs/cli/daemon/login-actions";
export { IpcClient } from "@icqqjs/cli/ipc-client";
