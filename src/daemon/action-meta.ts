/**
 * IPC / MCP action 元数据（供 icqq_list_actions 使用）。
 */
import { Actions } from "./protocol.js";
import { ACTION_CATALOG } from "./action-catalog.js";

export type ActionMeta = {
  description: string;
  paramsHint?: string;
};

/** MCP 禁止调用的 action（避免 AI 关闭守护进程、泄漏密钥、执行破坏性操作等） */
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
]);

export const ACTION_VALUES = Object.values(Actions) as string[];

const ACTION_CATALOG_META: Record<string, ActionMeta> = Object.fromEntries(
  ACTION_CATALOG.map(({ action, description, paramsHint }) => [
    action,
    { description, paramsHint },
  ]),
);

export const ACTION_META: Record<string, ActionMeta> = Object.fromEntries(
  ACTION_VALUES.map((action) => {
    const meta = ACTION_CATALOG_META[action] ?? {
      description: action,
      paramsHint: "见 protocol Actions",
    };
    return [action, meta];
  }),
);

export function getActionMeta(action: string): ActionMeta | null {
  return ACTION_META[action] ?? null;
}

export function listActionMetaEntries(): Array<
  { action: string } & ActionMeta
> {
  return Object.entries(ACTION_META).map(([action, meta]) => ({
    action,
    ...meta,
  }));
}
