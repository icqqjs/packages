import type { Client } from "@icqqjs/icqq";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvokeActionResult } from "../invoke-action.js";
import type { McpToolResponse } from "../exposure-contract.js";

export type IcqqMcpPluginContext = {
  server: McpServer;
  client: Client;
  uin: number;
  invokeAction: (
    action: string,
    params?: Record<string, unknown>,
  ) => Promise<InvokeActionResult>;
  listActions: () => Array<{
    action: string;
    description: string;
    paramsHint?: string;
  }>;
  formatResult: (data: unknown) => string;
  ok: (data: unknown) => McpToolResponse;
  error: (message: string) => McpToolResponse;
};

export type IcqqMcpPlugin = {
  name: string;
  register: (ctx: IcqqMcpPluginContext) => void | Promise<void>;
};
