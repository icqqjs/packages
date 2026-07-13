import type { Client } from "@icqqjs/icqq";
import {
  ACTION_CATALOG,
  getActionCatalogEntry,
} from "@/daemon/action-catalog.js";
import type { DaemonContext } from "@/daemon/daemon-context.js";
import {
  validateMcpAction,
  listMcpDiscoverableActions,
  isPilotMcpAction,
} from "./policy.js";

export type McpActionContract = {
  action: string;
  description: string;
  paramsHint?: string;
  execute: (
    client: Client,
    params: Record<string, unknown>,
    ctx: DaemonContext,
  ) => Promise<unknown>;
};

export type InvokeMcpActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export {
  validateMcpAction,
  listMcpDiscoverableActions,
  isPilotMcpAction,
};

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

export async function invokeMcpAction(
  client: Client,
  action: string,
  params: Record<string, unknown> = {},
  ctx: DaemonContext,
): Promise<InvokeMcpActionResult> {
  const error = validateMcpAction(action);
  if (error) return { ok: false, error };

  const contract = getMcpActionContract(action);
  if (!contract) {
    return {
      ok: false,
      error: `未知 action: ${action}，请使用 icqq_list_actions 查看可用列表`,
    };
  }

  try {
    const data = await contract.execute(client, params ?? {}, ctx);
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
