import type { Client } from "@icqqjs/icqq";
import {
  ACTION_CATALOG,
  getActionCatalogEntry,
  PILOT_ACTION_CATALOG,
} from "@/daemon/action-catalog.js";
import { MCP_BLOCKED_ACTIONS } from "@/daemon/action-meta.js";

export type McpActionContract = {
  action: string;
  description: string;
  paramsHint?: string;
  execute: (
    client: Client,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
};

export type InvokeMcpActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

const PILOT_ACTION_SET = new Set(
  PILOT_ACTION_CATALOG.map((entry) => entry.action),
);

export function listMcpActionContracts(): McpActionContract[] {
  return ACTION_CATALOG.map(({ action, description, paramsHint, execute }) => ({
    action,
    description,
    paramsHint,
    execute,
  }));
}

export function getMcpActionContract(action: string): McpActionContract | null {
  const catalogEntry = getActionCatalogEntry(action);
  if (catalogEntry) {
    return {
      action: catalogEntry.action,
      description: catalogEntry.description,
      paramsHint: catalogEntry.paramsHint,
      execute: catalogEntry.execute,
    };
  }
  return null;
}

export function validateMcpAction(action: string): string | null {
  if (!action || typeof action !== "string") {
    return "缺少参数 action";
  }
  if (MCP_BLOCKED_ACTIONS.has(action)) {
    return `禁止通过 MCP 调用: ${action}`;
  }
  if (!getMcpActionContract(action)) {
    return `未知 action: ${action}，请使用 icqq_list_actions 查看可用列表`;
  }
  return null;
}

export async function invokeMcpAction(
  client: Client,
  action: string,
  params: Record<string, unknown> = {},
): Promise<InvokeMcpActionResult> {
  const error = validateMcpAction(action);
  if (error) return { ok: false, error };

  const contract = getMcpActionContract(action);
  if (!contract) {
    return { ok: false, error: `未知 action: ${action}，请使用 icqq_list_actions 查看可用列表` };
  }

  try {
    const data = await contract.execute(client, params ?? {});
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function formatMcpActionResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function listMcpDiscoverableActions(): Array<
  Pick<McpActionContract, "action" | "description" | "paramsHint">
> {
  return listMcpActionContracts().map(({ action, description, paramsHint }) => ({
    action,
    description,
    paramsHint,
  }));
}

export function isPilotMcpAction(action: string): boolean {
  return PILOT_ACTION_SET.has(action);
}