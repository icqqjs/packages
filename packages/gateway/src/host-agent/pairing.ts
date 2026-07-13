import type { GatewayStore } from "../db/store.js";

export type PairApproveInput = {
  masterUrl: string;
  code: string;
  remoteBaseUrl?: string;
  name?: string;
};

export type PairApproveResult = {
  hostToken: string;
  remoteBaseUrl: string;
};

/** 远程机执行配对：生成 token、存本地、回推主控 */
export async function runPairApprove(
  store: GatewayStore,
  input: PairApproveInput,
): Promise<PairApproveResult> {
  const settings = store.getSettings();
  const hostToken = store.generateHostToken();
  const remoteBaseUrl =
    input.remoteBaseUrl ??
    `http://${settings.httpHost}:${settings.httpPort}`;

  store.setHostAgentToken(hostToken);

  const masterUrl = input.masterUrl.replace(/\/$/, "");
  const res = await fetch(`${masterUrl}/api/hosts/pairing/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: input.code.toUpperCase(),
      base_url: remoteBaseUrl,
      host_token: hostToken,
      name: input.name ?? "远程主机",
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `配对失败 (${res.status})`);
  }

  return { hostToken, remoteBaseUrl };
}
