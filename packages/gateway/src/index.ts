export { GatewayStore } from "./db/store.js";
export type { UserRow, InstanceRow, GatewaySettings } from "./db/store.js";
export { runPairApprove } from "./host-agent/pairing.js";
export type { PairApproveInput, PairApproveResult } from "./host-agent/pairing.js";
export { GatewayRuntime } from "./gateway.js";
export type { GatewayRuntimeOptions } from "./gateway.js";
export { runGatewayInit } from "./init.js";
export type { GatewayInitOptions, GatewayInitResult } from "./init.js";
export { startGateway } from "./entry.js";
export {
  installGatewayService,
  uninstallGatewayService,
  startGatewayService,
  stopGatewayService,
  queryGatewayService,
} from "./service-supervisor.js";
export type { GatewayServiceState } from "./service-supervisor.js";
export {
  getGatewayDbPath,
  getGatewayKeyPath,
  getGatewayPidPath,
  getGatewayLogPath,
  getGatewayStoppedPath,
} from "./lib/paths.js";
