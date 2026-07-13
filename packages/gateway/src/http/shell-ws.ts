import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import { WebSocket as WsClient } from "ws";
import type { GatewayStore } from "../db/store.js";
import { attachPtyToWebSocket, spawnHostShell } from "../host-agent/shell.js";
import { HostAgentClient } from "../host-agent/client.js";
import { resolveSessionUser } from "./auth.js";

export async function handleHostShellWebSocket(
  store: GatewayStore,
  hostId: string,
  req: IncomingMessage,
  ws: WebSocket,
): Promise<void> {
  const user = resolveSessionUser(store, req.headers.cookie);
  if (!user) {
    ws.close(4401, "未登录");
    return;
  }
  const host = store.getHostById(hostId);
  if (!host || host.user_id !== user.id) {
    ws.close(4403, "无权访问该主机");
    return;
  }

  if (host.is_local) {
    try {
      const term = spawnHostShell();
      attachPtyToWebSocket(term, ws);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Shell 启动失败";
      ws.close(1011, message.slice(0, 120));
    }
    return;
  }

  const token = store.getHostToken(host);
  const client = new HostAgentClient(host.base_url, token);
  const remoteUrl = client.shellWebSocketUrl();
  const remote = new WsClient(remoteUrl);

  remote.on("open", () => {
    ws.on("message", (data) => {
      if (remote.readyState === remote.OPEN) remote.send(data);
    });
    remote.on("message", (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });
  });

  remote.on("error", () => ws.close(1011, "远程 shell 连接失败"));
  ws.on("close", () => remote.close());
  remote.on("close", () => ws.close());
}

export async function handleHostAgentShellWebSocket(
  store: GatewayStore,
  token: string | null,
  ws: WebSocket,
): Promise<void> {
  if (!token || !store.validateHostAgentToken(token)) {
    ws.close(4401, "Unauthorized");
    return;
  }
  try {
    const term = spawnHostShell();
    attachPtyToWebSocket(term, ws);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shell 启动失败";
    ws.close(1011, message.slice(0, 120));
  }
}
