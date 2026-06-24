import { Actions } from "@/daemon/protocol.js";
import { LOGIN_ACTION_VALUES } from "@/daemon/login-actions.js";
import {
  ACTION_CATALOG,
  getActionCatalogEntry,
  PILOT_ACTION_CATALOG,
} from "@/daemon/action-catalog.js";

/** MCP 禁止调用的 action */
export const MCP_BLOCKED_ACTIONS = new Set<string>([
  Actions.LOGOUT,
  Actions.GET_CLIENT_KEY,
  Actions.GET_PSKEY,
  Actions.SET_WEBHOOK,
  Actions.FRIEND_DELETE,
  Actions.GROUP_KICK,
  Actions.GROUP_QUIT,
  Actions.GROUP_MUTE,
  Actions.GROUP_MUTE_ALL,
  Actions.DELETE_MSG,
  Actions.RECALL_MSG,
  Actions.DELETE_STAMP,
  Actions.GFS_DELETE,
  ...LOGIN_ACTION_VALUES,
]);

const PILOT_ACTION_SET = new Set(
  PILOT_ACTION_CATALOG.map((entry) => entry.action),
);

export function validateMcpAction(action: string): string | null {
  if (!action || typeof action !== "string") {
    return "缺少参数 action";
  }
  if (MCP_BLOCKED_ACTIONS.has(action)) {
    return `禁止通过 MCP 调用: ${action}`;
  }
  if (!getActionCatalogEntry(action)) {
    return `未知 action: ${action}，请使用 icqq_list_actions 查看可用列表`;
  }
  return null;
}

export function listMcpDiscoverableActions(): Array<{
  action: string;
  description: string;
  paramsHint?: string;
}> {
  return ACTION_CATALOG.map(({ action, description, paramsHint }) => ({
    action,
    description,
    paramsHint,
  }));
}

export function isPilotMcpAction(action: string): boolean {
  return PILOT_ACTION_SET.has(action);
}
