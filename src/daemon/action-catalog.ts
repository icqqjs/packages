import type { ActionCatalogEntry } from "./action-types.js";
import {
  ALL_ACTION_ENTRIES,
  PILOT_ACTION_ENTRIES,
  MESSAGE_ACTION_ENTRIES,
  DEPRECATED_ACTION_ENTRIES,
} from "./executors/index.js";

export type { ActionCatalogEntry, ActionExecutor } from "./action-types.js";

export const PILOT_ACTION_CATALOG = PILOT_ACTION_ENTRIES;
export const MESSAGE_ACTION_CATALOG = MESSAGE_ACTION_ENTRIES;
export const DEPRECATED_ACTION_CATALOG = DEPRECATED_ACTION_ENTRIES;
export const ACTION_CATALOG: readonly ActionCatalogEntry[] = ALL_ACTION_ENTRIES;

const ACTION_CATALOG_MAP = new Map(
  ACTION_CATALOG.map((entry) => [entry.action, entry]),
);

const PILOT_ACTION_MAP = new Map(
  PILOT_ACTION_CATALOG.map((entry) => [entry.action, entry]),
);

export function getActionCatalogEntry(
  action: string,
): ActionCatalogEntry | null {
  return ACTION_CATALOG_MAP.get(action) ?? null;
}

export function getPilotActionCatalogEntry(
  action: string,
): ActionCatalogEntry | null {
  return PILOT_ACTION_MAP.get(action) ?? null;
}
