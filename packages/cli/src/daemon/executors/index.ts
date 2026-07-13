import { PILOT_ACTION_ENTRIES, DEPRECATED_ACTION_ENTRIES } from "./basic.js";
import { MESSAGE_ACTION_ENTRIES } from "./messaging.js";
import { LEGACY_ACTION_ENTRIES } from "./legacy.js";

export const ALL_ACTION_ENTRIES = [
  ...PILOT_ACTION_ENTRIES,
  ...MESSAGE_ACTION_ENTRIES,
  ...DEPRECATED_ACTION_ENTRIES,
  ...LEGACY_ACTION_ENTRIES,
] as const;

export { PILOT_ACTION_ENTRIES, DEPRECATED_ACTION_ENTRIES } from "./basic.js";
export { MESSAGE_ACTION_ENTRIES } from "./messaging.js";
export { LEGACY_ACTION_ENTRIES } from "./legacy.js";
