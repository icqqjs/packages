import type { Client } from "@icqqjs/icqq";
import type { DaemonContext } from "./daemon-context.js";

export type ActionExecutor = (
  client: Client,
  params: Record<string, unknown>,
  ctx: DaemonContext,
) => Promise<unknown>;

export type ActionCatalogEntry = {
  action: string;
  description: string;
  paramsHint?: string;
  execute: ActionExecutor;
};
