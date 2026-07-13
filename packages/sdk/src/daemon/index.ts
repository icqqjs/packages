export {
  spawnDaemon,
  stopDaemon,
  forceStopDaemon,
  isDaemonRunning,
  getDaemonPid,
  janitorStaleDaemonArtifacts,
} from "@icqqjs/cli/daemon/supervisor";

export {
  getIcqqHome,
  getAccountDir,
  getLogPath,
  getSocketPath,
  getTokenPath,
  getPidPath,
} from "@icqqjs/cli/paths";
