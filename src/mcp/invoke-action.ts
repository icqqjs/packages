/**
 * MCP / 进程内 IPC 调用：校验 action 并转发至 handleRequest。
 */
import type { Client } from "@icqqjs/icqq";
import {
  invokeMcpAction,
  validateMcpAction,
  type InvokeMcpActionResult,
} from "./action-contract.js";

export type InvokeActionResult = InvokeMcpActionResult;

export function validateAction(action: string): string | null {
  return validateMcpAction(action);
}

export async function invokeAction(
  client: Client,
  action: string,
  params: Record<string, unknown> = {},
): Promise<InvokeActionResult> {
  return invokeMcpAction(client, action, params);
}
