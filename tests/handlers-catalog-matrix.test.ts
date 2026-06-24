import { describe, expect, it, vi } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import {
  ACTION_CATALOG,
  MESSAGE_ACTION_CATALOG,
  getActionCatalogEntry,
} from "../src/daemon/action-catalog.js";

function createBaseClient() {
  return {
    uin: 123,
    nickname: "bot",
    isOnline: () => true,
    sex: "male",
    age: 18,
    fl: new Map(),
    gl: new Map(),
    blacklist: new Set(),
    pickFriend: vi.fn(() => ({
      sendMsg: vi.fn(async () => ({ message_id: "m1" })),
      getChatHistory: vi.fn(async () => []),
    })),
    pickGroup: vi.fn(() => ({
      sendMsg: vi.fn(async () => ({ message_id: "g1" })),
      getChatHistory: vi.fn(async () => []),
      uploadLongMsg: vi.fn(async () => ({ type: "long" })),
    })),
    pickUser: vi.fn(() => ({
      getChatHistory: vi.fn(async () => []),
      uploadLongMsg: vi.fn(async () => ({ type: "long" })),
      sendMsg: vi.fn(async () => ({ message_id: "l1" })),
    })),
    sendTempMsg: vi.fn(async () => ({ message_id: "t1" })),
    deleteMsg: vi.fn(async () => ({ ok: true })),
    getMsg: vi.fn(async () => ({ message_id: "x" })),
    reportReaded: vi.fn(async () => undefined),
    getChatHistory: vi.fn(async () => []),
  } as unknown as import("@icqqjs/icqq").Client;
}

describe("action catalog matrix", () => {
  it("has an entry for every catalog action", () => {
    for (const entry of ACTION_CATALOG) {
      expect(getActionCatalogEntry(entry.action)?.action).toBe(entry.action);
    }
  });

  it("rejects invalid ids for message actions", async () => {
    const client = createBaseClient();
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
      await expect(entry!.execute(client, params)).rejects.toThrow();
    }
  });

  it("executes message actions with valid params", async () => {
    const client = createBaseClient();

    for (const entry of MESSAGE_ACTION_CATALOG) {
      if (entry.action === Actions.SEND_PRIVATE_MSG) {
        await expect(
          entry.execute(client, { user_id: 1, message: "hi" }),
        ).resolves.toEqual({ message_id: "m1" });
      }
      if (entry.action === Actions.SEND_GROUP_MSG) {
        await expect(
          entry.execute(client, { group_id: 9, message: "hi" }),
        ).resolves.toEqual({ message_id: "g1" });
      }
      if (entry.action === Actions.SEND_TEMP_MSG) {
        await expect(
          entry.execute(client, { group_id: 9, user_id: 2, message: "hi" }),
        ).resolves.toEqual({ message_id: "t1" });
      }
      if (entry.action === Actions.RECALL_MSG) {
        await expect(entry.execute(client, { message_id: "abc" })).resolves.toEqual({
          ok: true,
        });
      }
      if (entry.action === Actions.GET_MSG) {
        await expect(entry.execute(client, { message_id: "abc" })).resolves.toEqual({
          message_id: "x",
        });
      }
      if (entry.action === Actions.HISTORY_PRIVATE) {
        await expect(entry.execute(client, { user_id: 1, count: 1 })).resolves.toEqual([]);
      }
      if (entry.action === Actions.HISTORY_GROUP) {
        await expect(entry.execute(client, { group_id: 9, count: 1 })).resolves.toEqual([]);
      }
      if (entry.action === Actions.HISTORY_BY_MSG_ID) {
        await expect(entry.execute(client, { message_id: "abc", count: 1 })).resolves.toEqual(
          [],
        );
      }
      if (entry.action === Actions.SEND_LONG_MSG) {
        await expect(
          entry.execute(client, { group_id: 9, message: "long" }),
        ).resolves.toEqual({ message_id: "g1" });
      }
      if (entry.action === Actions.MARK_READ) {
        await expect(entry.execute(client, { message_id: "abc" })).resolves.toEqual({ ok: true });
      }
      if (entry.action === Actions.DELETE_MSG) {
        await expect(entry.execute(client, { message_id: "abc" })).resolves.toEqual({ ok: true });
      }
    }
  });
});
