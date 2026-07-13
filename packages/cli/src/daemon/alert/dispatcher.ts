import { loadConfig, type IcqqConfig } from "@/lib/config.js";
import { mergeAlertsFromEnv, resolveAlertsConfig } from "@/lib/alert-config.js";
import type { AlertKind, DaemonAlertPayload } from "./types.js";
import { buildProviders, formatForProvider } from "./providers.js";

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const lastSent = new Map<string, number>();

function cooldownKey(uin: number, kind: AlertKind): string {
  return `${uin}:${kind}`;
}

function shouldSend(uin: number, kind: AlertKind, cooldownMs: number): boolean {
  const key = cooldownKey(uin, kind);
  const now = Date.now();
  const prev = lastSent.get(key);
  if (prev != null && now - prev < cooldownMs) return false;
  lastSent.set(key, now);
  return true;
}

export function resetAlertCooldownForTests(): void {
  lastSent.clear();
}

export type SendAlertOptions = {
  config?: IcqqConfig;
  skipCooldown?: boolean;
};

export async function sendDaemonAlert(
  kind: AlertKind,
  partial: Omit<DaemonAlertPayload, "ts" | "suggestedCli"> & {
    suggestedCli?: string;
  },
  options: SendAlertOptions = {},
): Promise<void> {
  const config = options.config ?? (await loadConfig());
  mergeAlertsFromEnv(config);
  const alerts = resolveAlertsConfig(config);
  if (!alerts.enabled) return;

  const cooldownMs = alerts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  if (!options.skipCooldown && !shouldSend(partial.uin, kind, cooldownMs)) {
    return;
  }

  const payload: DaemonAlertPayload = {
    ...partial,
    ts: Date.now(),
    suggestedCli: partial.suggestedCli ?? `icqq login -q ${partial.uin}`,
  };

  const providers = buildProviders(alerts.providers ?? []);
  if (providers.length === 0) return;

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const formatted = formatForProvider(kind, payload, provider.type);
      await provider.send(formatted, payload, kind);
    }),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[alert] provider failed: ${msg}`);
    }
  }
}
