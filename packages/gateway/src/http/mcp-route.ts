import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createCentralMcpServer } from "../mcp/central.js";
import type { GatewayStore } from "../db/store.js";
import { resolveApiUser } from "./auth.js";

/**
 * 处理 POST /:uin/mcp：按 API token 解析用户，校验其是否拥有该 UIN，
 * 再用 central MCP 转发到目标实例守护进程。
 */
export async function handleMcpRequest(
  store: GatewayStore,
  uin: number,
  req: Request,
  res: Response,
): Promise<void> {
  const user = resolveApiUser(store, req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!store.userOwnsUin(user.id, uin)) {
    res.status(403).json({ error: "无权访问该 UIN" });
    return;
  }
  const instance = store.getInstanceByUin(uin);
  if (!instance) {
    res.status(404).json({ error: "实例不存在" });
    return;
  }
  if (instance.host_id) {
    const host = store.getHostById(instance.host_id);
    if (host && !host.is_local && !host.proxy_data_plane) {
      res.status(400).json({
        error: "远程 host 未开启数据面代理",
      });
      return;
    }
  }

  const server = createCentralMcpServer(store, instance);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error("[gateway] MCP 请求处理失败:", error);
    void transport.close();
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}
