import type { IpcEvent, IpcResponse } from "@icqqjs/sdk/protocol";
import type { HostAgent } from "./host-agent/types.js";
import type { GatewayStore, InstanceRow } from "./db/store.js";
import { IpcClient } from "@icqqjs/sdk/protocol";
import { resolveHostAgent } from "./hosts/executor.js";

/** 经 host-agent 代理的 IPC 客户端（用于远程数据面） */
export class AgentIpcClient {
  private eventHandlers: Array<(event: IpcEvent) => void> = [];

  constructor(
    private readonly agent: HostAgent,
    private readonly uin: number,
  ) {}

  request(
    action: string,
    params: Record<string, unknown> = {},
    _timeoutMs?: number,
  ): Promise<IpcResponse> {
    return this.agent.ipcRequest(this.uin, action, params).then((resp: {
      id?: string;
      ok: boolean;
      data?: unknown;
      error?: string;
    }) => ({
      id: resp.id ?? "",
      ok: resp.ok,
      data: resp.data,
      error: resp.error,
    }));
  }

  onEvent(handler: (event: IpcEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  close(): void {
    this.eventHandlers = [];
  }
}

export interface InstanceConnector {
  request(
    action: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<IpcResponse>;
  onEvent(handler: (event: IpcEvent) => void): () => void;
  close(): void;
}

/**
 * 打开到某个 icqq 实例守护进程的连接。
 * - 本机 host：Unix socket
 * - 远程 host + proxy_data_plane：经 host-agent IPC 代理
 * - 遗留 remote 实例：RPC TCP
 */
export async function connectToInstance(
  store: GatewayStore,
  instance: InstanceRow,
): Promise<InstanceConnector> {
  if (instance.host_id) {
    const host = store.getHostById(instance.host_id);
    if (!host) throw new Error("实例关联的主机不存在");
    if (host.is_local) {
      return IpcClient.connect(instance.uin);
    }
    if (!host.proxy_data_plane) {
      throw new Error(
        "远程 host 未开启数据面代理，请在主机设置中启用 proxy_data_plane",
      );
    }
    const agent = resolveHostAgent(store, host);
    return new AgentIpcClient(agent, instance.uin);
  }

  if (instance.kind === "local") {
    return IpcClient.connect(instance.uin);
  }
  if (!instance.rpc_host || !instance.rpc_port) {
    throw new Error(`远程实例 ${instance.uin} 缺少 RPC 端点配置`);
  }
  const token = store.getInstanceRpcToken(instance);
  if (!token) {
    throw new Error(`远程实例 ${instance.uin} 缺少 RPC token`);
  }
  return IpcClient.connectRpc({
    host: instance.rpc_host,
    port: instance.rpc_port,
    token,
  });
}
