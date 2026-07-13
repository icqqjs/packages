/** @deprecated 使用 host-agent/instances */
export {
  createLocalDaemon,
  getLoginState,
  probeInstanceStatus,
  reloginLocalDaemon,
  sendLoginSms,
  submitLogin,
} from "./host-agent/instances.js";
export type {
  InstanceState,
  LoginPhase,
  LoginStateView,
} from "./host-agent/types.js";
