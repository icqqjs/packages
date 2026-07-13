/**
 * IPC / MCP action 元数据（供 icqq_list_actions 使用）。
 */
import { Actions } from "./protocol.js";
import { ACTION_CATALOG } from "./action-catalog.js";

export { MCP_BLOCKED_ACTIONS } from "@/mcp/policy.js";

export type ActionMeta = {
  description: string;
  paramsHint?: string;
};

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
