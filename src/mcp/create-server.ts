import type { Client } from "@icqqjs/icqq";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createMcpPluginContext,
  registerCoreMcpTools,
} from "./exposure-contract.js";
import { loadMcpPlugins } from "./plugins/load.js";
import type { ResolvedMcpConfig } from "@/lib/config.js";

const INSTRUCTIONS = `通过 icqq_invoke 调用 QQ 操作。action 必须为协议中定义的值；params 与 IPC 一致。
常用：send_private_msg (user_id, message)、send_group_msg (group_id, message)、send_temp_msg (group_id, user_id, message)、list_friends、get_self_profile。
消息支持 CQ 码：[face:id] [image:path] [at:uid] [at:all]。
先确保账号已登录（icqq login）；改 mcp 配置后执行 icqq service restart。
不确定 action 时先调用 icqq_list_actions。`;

export async function createMcpServer(
  client: Client,
  uin: number,
  config: ResolvedMcpConfig,
): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "icqq",
      version: "1.0.0",
    },
    { instructions: INSTRUCTIONS },
  );

  const pluginContext = createMcpPluginContext({ server, client, uin });
  registerCoreMcpTools(server, pluginContext);

  await loadMcpPlugins(pluginContext, config.plugins);

  return server;
}
