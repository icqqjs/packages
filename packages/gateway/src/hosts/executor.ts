import type { GatewayStore, HostRow } from "../db/store.js";
import { HostAgentClient } from "../host-agent/client.js";
import { hostAgentLocal } from "../host-agent/local.js";
import type { HostAgent } from "../host-agent/types.js";

export function resolveHostAgent(store: GatewayStore, host: HostRow): HostAgent {
  if (host.is_local) return hostAgentLocal;
  const token = store.getHostToken(host);
  return new HostAgentClient(host.base_url, token);
}

export async function probeHostHealth(
  store: GatewayStore,
  host: HostRow,
): Promise<"online" | "offline"> {
  try {
    const agent = resolveHostAgent(store, host);
    await agent.health();
    store.updateHostStatus(host.id, "online");
    return "online";
  } catch {
    store.updateHostStatus(host.id, "offline");
    return "offline";
  }
}
