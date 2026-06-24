import { IpcClient } from "@/lib/ipc-client.js";

export type PeerAlertTarget = {
  host: string;
  port: number;
  token: string;
  userId?: number;
  groupId?: number;
};

export type PeerRpcConnect = (options: {
  host: string;
  port: number;
  token: string;
}) => Promise<IpcClient>;

function formatPeerMessage(title: string, body: string): string {
  return `${title}\n${body}`;
}

async function requestOk(
  client: IpcClient,
  action: string,
  params: Record<string, unknown>,
): Promise<void> {
  const res = await client.request(action, params);
  if (!res.ok) {
    throw new Error(res.error ?? `${action} failed`);
  }
}

/**
 * 经对端守护进程 RPC 发送告警私聊和/或群聊。
 */
export async function sendPeerAlert(
  target: PeerAlertTarget,
  title: string,
  body: string,
  connectRpc: PeerRpcConnect = (opts) => IpcClient.connectRpc(opts),
): Promise<void> {
  const message = formatPeerMessage(title, body);
  const client = await connectRpc({
    host: target.host,
    port: target.port,
    token: target.token,
  });

  try {
    const tasks: Promise<void>[] = [];
    if (target.userId != null) {
      tasks.push(
        requestOk(client, "send_private_msg", {
          user_id: target.userId,
          message,
        }),
      );
    }
    if (target.groupId != null) {
      tasks.push(
        requestOk(client, "send_group_msg", {
          group_id: target.groupId,
          message,
        }),
      );
    }

    const results = await Promise.allSettled(tasks);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length === results.length) {
      const first = failures[0] as PromiseRejectedResult;
      throw first.reason instanceof Error ? first.reason : new Error(String(first.reason));
    }
    for (const failure of failures) {
      if (failure.status === "rejected") {
        const msg =
          failure.reason instanceof Error ? failure.reason.message : String(failure.reason);
        console.error(`[alert] peer partial failure: ${msg}`);
      }
    }
  } finally {
    client.close();
  }
}
