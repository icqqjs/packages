import type { WebSocket } from "ws";
import type { IpcEvent, IpcResponse } from "@icqqjs/sdk/protocol";
import type { InstanceConnector } from "../daemon-link.js";
import { connectToInstance } from "../daemon-link.js";
import type { GatewayStore, InstanceRow } from "../db/store.js";

type IncomingRpc = {
  id?: string;
  action?: string;
  params?: Record<string, unknown>;
};

/**
 * 把一条 WebSocket 连接桥接到目标实例守护进程 RPC。
 * WS 入站消息映射为 IpcRequest；守护进程事件推送回 WS。
 */
export async function bridgeRpcWebSocket(
  ws: WebSocket,
  store: GatewayStore,
  instance: InstanceRow,
): Promise<void> {
  let client: InstanceConnector;
  try {
    client = await connectToInstance(store, instance);
  } catch (err) {
    ws.send(
      JSON.stringify({
        id: "",
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    ws.close();
    return;
  }

  const offEvent = client.onEvent((event: IpcEvent) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });

  ws.on("message", (raw) => {
    let msg: IncomingRpc;
    try {
      msg = JSON.parse(raw.toString()) as IncomingRpc;
    } catch {
      ws.send(JSON.stringify({ id: "", ok: false, error: "无效 JSON" }));
      return;
    }
    if (!msg.action) {
      ws.send(
        JSON.stringify({ id: msg.id ?? "", ok: false, error: "缺少 action" }),
      );
      return;
    }
    void client
      .request(msg.action, msg.params ?? {})
      .then((resp: IpcResponse) => {
        ws.send(JSON.stringify({ ...resp, id: msg.id ?? resp.id }));
      })
      .catch((err: unknown) => {
        ws.send(
          JSON.stringify({
            id: msg.id ?? "",
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });
  });

  const cleanup = () => {
    offEvent();
    client.close();
  };
  ws.on("close", cleanup);
  ws.on("error", cleanup);
}
