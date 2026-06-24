/** @deprecated 使用 @/daemon/supervisor.js */
export {
  buildLaunchdPlist,
  buildSystemdUnit,
  getAllUins,
  getLaunchdLabel,
  getLaunchdPlistPath,
  getSystemdServiceName,
  getSystemdServicePath,
  resolveServiceUins,
  installService,
  uninstallService,
  startService,
  stopService,
  restartService,
  queryService,
  type ServiceState,
} from "@/daemon/supervisor.js";
