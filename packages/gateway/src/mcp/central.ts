import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  listMcpDiscoverableActions,
  validateMcpAction,
} from "@icqqjs/sdk/bot";
import { connectToInstance } from "../daemon-link.js";
import type { GatewayStore, InstanceRow } from "../db/store.js";

const INSTRUCTIONS = `通过 icqq_invoke 调用 QQ 操作。action 必须为协议中定义的值；params 与 IPC 一致。
常用：send_private_msg (user_id, message)、send_group_msg (group_id, message)、list_friends、get_self_profile。
不确定 action 时先调用 icqq_list_actions。`;

/**
 * central MCP：不持有 icqq Client，只保证 invokeAction / listActions，
 * 通过目标实例的守护进程 RPC/IPC 转发 action 调用。
 */
export function createCentralMcpServer(
  store: GatewayStore,
  instance: InstanceRow,
): McpServer {
  const server = new McpServer(
    { name: `icqq-${instance.uin}`, version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

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
    async ({ action, params }) => {
      const invalid = validateMcpAction(action);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      const client = await connectToInstance(store, instance);
      try {
        const resp = await client.request(action, params ?? {});
        if (!resp.ok) {
          return {
            content: [{ type: "text", text: resp.error ?? "调用失败" }],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } finally {
        client.close();
      }
    },
  );

  server.registerTool(
    "icqq_list_actions",
    {
      title: "列出可用 IPC actions",
      description: "返回所有可传给 icqq_invoke 的 action 及说明",
      inputSchema: {},
    },
    async () => ({
      content: [
        { type: "text", text: JSON.stringify(listMcpDiscoverableActions(), null, 2) },
      ],
    }),
  );

  return server;
}
