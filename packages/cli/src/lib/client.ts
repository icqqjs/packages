import type { Client, Platform } from "@icqqjs/icqq";
import { getAccountDir } from "./paths.js";
import type { AccountConfig } from "./config.js";
import { resolveIcqq } from "./icqq-resolve.js";

export async function createIcqqClient(
  uin: number,
  account: AccountConfig,
): Promise<Client> {
  const { createClient } = await resolveIcqq();
  return createClient({
    platform: account.platform as Platform,
    sign_api_addr: account.signApiUrl || undefined,
    ver: account.ver || undefined,
    data_dir: getAccountDir(uin),
    log_level: (account.logLevel ?? "warn") as any,
  });
}
