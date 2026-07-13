export const SDK_VERSION = "0.1.0";

export const SDK_CAPABILITIES = [
  "account.config",
  "account.paths",
  "daemon.lifecycle",
  "daemon.login",
  "ipc.client",
  "rpc.client",
  "mcp.contract",
] as const;

export type SdkCapability = (typeof SDK_CAPABILITIES)[number];

export function capabilities(): SdkCapability[] {
  return [...SDK_CAPABILITIES];
}

export function assertSdkCompatible(required: {
  capabilities?: SdkCapability[];
}): void {
  const have = new Set(capabilities());
  for (const cap of required.capabilities ?? []) {
    if (!have.has(cap)) {
      throw new Error(`SDK 缺少能力: ${cap}`);
    }
  }
}
