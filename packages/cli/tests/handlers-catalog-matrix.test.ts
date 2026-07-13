import { describe, expect, it } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import {
  ACTION_CATALOG,
  MESSAGE_ACTION_CATALOG,
  getActionCatalogEntry,
} from "../src/daemon/action-catalog.js";
import { createStubDaemonContext, createBaseClient } from "./helpers/daemon-test-context.js";

describe("action catalog matrix", () => {
  it("has an entry for every catalog action", () => {
    for (const entry of ACTION_CATALOG) {
      expect(getActionCatalogEntry(entry.action)?.action).toBe(entry.action);
    }
  });

  it("rejects invalid ids for message actions", async () => {
    const client = createBaseClient();
    const ctx = createStubDaemonContext(client);
    const invalidCases: Array<[string, Record<string, unknown>]> = [
      [Actions.SEND_PRIVATE_MSG, { user_id: 0, message: "hi" }],
      [Actions.SEND_GROUP_MSG, { group_id: -1, message: "hi" }],
      [Actions.SEND_TEMP_MSG, { group_id: 1, user_id: 0, message: "hi" }],
      [Actions.RECALL_MSG, { message_id: "" }],
      [Actions.GET_MSG, {}],
      [Actions.HISTORY_PRIVATE, { user_id: "bad" }],
      [Actions.HISTORY_GROUP, { group_id: null }],
      [Actions.HISTORY_BY_MSG_ID, { message_id: 123 }],
      [Actions.MARK_READ, { message_id: "" }],
      [Actions.DELETE_MSG, { message_id: "" }],
    ];

    for (const [action, params] of invalidCases) {
      const entry = getActionCatalogEntry(action);
      await expect(entry!.execute(client, params, ctx)).rejects.toThrow();
    }
  });

  it("executes message actions with valid params", async () => {
    const client = createBaseClient();
    const ctx = createStubDaemonContext(client);

    for (const entry of MESSAGE_ACTION_CATALOG) {
      if (entry.action === Actions.SEND_PRIVATE_MSG) {
        await expect(
          entry.execute(client, { user_id: 1, message: "hi" }, ctx),
        ).resolves.toEqual({ message_id: "m1" });
      }
      if (entry.action === Actions.SEND_GROUP_MSG) {
        await expect(
          entry.execute(client, { group_id: 9, message: "hi" }, ctx),
        ).resolves.toEqual({ message_id: "g1" });
      }
      if (entry.action === Actions.SEND_TEMP_MSG) {
        await expect(
          entry.execute(client, { group_id: 9, user_id: 2, message: "hi" }, ctx),
        ).resolves.toEqual({ message_id: "t1" });
      }
      if (entry.action === Actions.RECALL_MSG) {
        await expect(entry.execute(client, { message_id: "abc" }, ctx)).resolves.toEqual({
          ok: true,
        });
      }
      if (entry.action === Actions.GET_MSG) {
        await expect(entry.execute(client, { message_id: "abc" }, ctx)).resolves.toEqual({
          message_id: "x",
        });
      }
      if (entry.action === Actions.HISTORY_PRIVATE) {
        await expect(entry.execute(client, { user_id: 1, count: 1 }, ctx)).resolves.toEqual([]);
      }
      if (entry.action === Actions.HISTORY_GROUP) {
        await expect(entry.execute(client, { group_id: 9, count: 1 }, ctx)).resolves.toEqual([]);
      }
      if (entry.action === Actions.HISTORY_BY_MSG_ID) {
        await expect(
          entry.execute(client, { message_id: "abc", count: 1 }, ctx),
        ).resolves.toEqual([]);
      }
      if (entry.action === Actions.SEND_LONG_MSG) {
        await expect(
          entry.execute(client, { group_id: 9, message: "long" }, ctx),
        ).resolves.toEqual({ message_id: "g1" });
      }
      if (entry.action === Actions.MARK_READ) {
        await expect(entry.execute(client, { message_id: "abc" }, ctx)).resolves.toEqual({
          ok: true,
        });
      }
      if (entry.action === Actions.DELETE_MSG) {
        await expect(entry.execute(client, { message_id: "abc" }, ctx)).resolves.toEqual({
          ok: true,
        });
      }
    }
  });
});
