import type { Client } from "@icqqjs/icqq";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  invokeMcpAction,
  listMcpDiscoverableActions,
  type InvokeMcpActionResult,
} from "./action-contract.js";
import type { IcqqMcpPluginContext } from "./plugins/types.js";

type McpTextContent = { type: "text"; text: string };

export type McpToolResponse = {
  content: McpTextContent[];
  isError?: boolean;
};

export function formatMcpResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function okMcpResponse(data: unknown): McpToolResponse {
  return {
    content: [{ type: "text", text: formatMcpResult(data) }],
  };
}

export function errorMcpResponse(error: string): McpToolResponse {
  return {
    content: [{ type: "text", text: error }],
    isError: true,
  };
}

export function normalizeInvokeMcpResult(result: InvokeMcpActionResult): McpToolResponse {
  return result.ok ? okMcpResponse(result.data) : errorMcpResponse(result.error);
}

export function createMcpPluginContext(options: {
  server: McpServer;
  client: Client;
  uin: number;
}): IcqqMcpPluginContext {
  const { server, client, uin } = options;
  return {
    server,
    client,
    uin,
    invokeAction: (action: string, params?: Record<string, unknown>) =>
      invokeMcpAction(client, action, params),
    listActions: () => listMcpDiscoverableActions(),
    formatResult: formatMcpResult,
    ok: okMcpResponse,
    error: errorMcpResponse,
  };
}

export function registerCoreMcpTools(
  server: McpServer,
  ctx: IcqqMcpPluginContext,
): void {
  server.registerTool(
    "icqq_invoke",
    {
      title: "调用 QQ IPC 操作",
      description:
        "执行单个 IPC action（如 send_private_msg、list_friends）。params 为 JSON 对象。",
      inputSchema: {
        action: z.string().describe("IPC action 名称"),
        params: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("操作参数，默认 {}"),
      },
    },
    async ({ action, params }) => normalizeInvokeMcpResult(
      await ctx.invokeAction(action, params ?? {}),
    ),
  );

  server.registerTool(
    "icqq_list_actions",
    {
      title: "列出可用 IPC actions",
      description: "返回所有可传给 icqq_invoke 的 action 及说明",
      inputSchema: {},
    },
    async () => ctx.ok(ctx.listActions()),
  );
}