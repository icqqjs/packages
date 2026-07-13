/**
 * MCP 层统一入口：HTTP 宿主、工具注册、策略与调用。
 */
export { McpHost, type McpEndpointInfo } from "./host.js";
export {
  createMcpServer,
} from "./create-server.js";
export {
  createMcpPluginContext,
  registerCoreMcpTools,
  formatMcpResult,
  okMcpResponse,
  errorMcpResponse,
  normalizeInvokeMcpResult,
  type McpToolResponse,
} from "./exposure-contract.js";
export {
  invokeMcpAction,
  getMcpActionContract,
  listMcpActionContracts,
  formatMcpActionResult,
  type InvokeMcpActionResult,
  type McpActionContract,
} from "./action-contract.js";
export {
  MCP_BLOCKED_ACTIONS,
  validateMcpAction,
  listMcpDiscoverableActions,
  isPilotMcpAction,
} from "./policy.js";

/** @deprecated 使用 invokeMcpAction */
export { invokeMcpAction as invokeAction } from "./action-contract.js";

/** @deprecated 使用 validateMcpAction */
export { validateMcpAction as validateAction } from "./policy.js";
