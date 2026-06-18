import { describe, expect, it, vi } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import {
  ACTION_CATALOG,
  getActionCatalogEntry,
  getPilotActionCatalogEntry,
  MESSAGE_ACTION_CATALOG,
  PILOT_ACTION_CATALOG,
} from "../src/daemon/action-catalog.js";
import {
  ACTION_VALUES,
  getActionMeta,
  listActionMetaEntries,
} from "../src/daemon/action-meta.js";

describe("pilot action catalog", () => {
  it("defines the expected read-only pilot actions", () => {
    expect(PILOT_ACTION_CATALOG.map((entry) => entry.action)).toEqual([
      Actions.PING,
      Actions.GET_STATUS,
      Actions.GET_SELF_PROFILE,
      Actions.LIST_FRIENDS,
    ]);
  });

  it("extends the catalog with the core message action family", () => {
    expect(MESSAGE_ACTION_CATALOG.map((entry) => entry.action)).toEqual([
      Actions.SEND_PRIVATE_MSG,
      Actions.SEND_GROUP_MSG,
      Actions.SEND_TEMP_MSG,
      Actions.RECALL_MSG,
      Actions.GET_MSG,
      Actions.HISTORY_PRIVATE,
      Actions.HISTORY_GROUP,
      Actions.HISTORY_BY_MSG_ID,
      Actions.SEND_LONG_MSG,
      Actions.MARK_READ,
      Actions.DELETE_MSG,
    ]);
    expect(ACTION_CATALOG.length).toBeGreaterThan(
      PILOT_ACTION_CATALOG.length + MESSAGE_ACTION_CATALOG.length,
    );
  });

  it("covers every action through the canonical catalog seam", () => {
    expect(new Set(ACTION_CATALOG.map((entry) => entry.action))).toEqual(
      new Set(ACTION_VALUES),
    );
  });

  it("exposes pilot metadata through the shared action meta source", () => {
    expect(getActionMeta(Actions.PING)).toEqual({
      description: "心跳检测",
      paramsHint: "无",
    });
    expect(getActionMeta(Actions.LIST_FRIENDS)).toEqual({
      description: "获取好友列表",
      paramsHint: "无",
    });
    expect(getActionMeta("not_real_action")).toBeNull();
  });

  it("keeps discovery entries aligned with the shared meta source", () => {
    const actions = listActionMetaEntries().map((entry) => entry.action);
    expect(actions).toContain(Actions.PING);
    expect(actions).toContain(Actions.GET_STATUS);
    expect(actions).toContain(Actions.GET_SELF_PROFILE);
    expect(actions).toContain(Actions.LIST_FRIENDS);
    expect(actions).toContain(Actions.SEND_PRIVATE_MSG);
    expect(actions).toContain(Actions.HISTORY_GROUP);
  });

  it("executes pilot actions through the catalog seam", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T00:00:00Z"));

    const ping = getPilotActionCatalogEntry(Actions.PING);
    const getStatus = getPilotActionCatalogEntry(Actions.GET_STATUS);
    const listFriends = getPilotActionCatalogEntry(Actions.LIST_FRIENDS);

    expect(await ping?.execute({} as never, {})).toEqual({
      pong: true,
      time: new Date("2026-05-30T00:00:00Z").getTime(),
    });

    const client = {
      uin: 123,
      nickname: "bot",
      isOnline: () => true,
      sex: "male",
      age: 18,
      fl: new Map([
        [1, { user_id: 1, nickname: "A", remark: "AR", sex: "female", class_id: 2 }],
      ]),
      gl: new Map([[10, {}]]),
      blacklist: new Set([9]),
    } as never;

    expect(await getStatus?.execute(client, {})).toEqual({
      uin: 123,
      nickname: "bot",
      online: true,
      sex: "male",
      age: 18,
      friendCount: 1,
      groupCount: 1,
    });
    expect(await listFriends?.execute(client, {})).toEqual([
      { user_id: 1, nickname: "A", remark: "AR", sex: "female", class_id: 2 },
    ]);

    vi.useRealTimers();
  });

  it("executes migrated message actions through the catalog seam", async () => {
    const sendPrivate = getActionCatalogEntry(Actions.SEND_PRIVATE_MSG);
    const sendTemp = getActionCatalogEntry(Actions.SEND_TEMP_MSG);
    const historyGroup = getActionCatalogEntry(Actions.HISTORY_GROUP);
    const markRead = getActionCatalogEntry(Actions.MARK_READ);

    const sendMsg = vi.fn(async () => ({ message_id: "pm-1" }));
    const sendTempMsg = vi.fn(async () => ({ message_id: "temp-1" }));
    const getChatHistory = vi.fn(async () => [
      {
        message_id: "g-1",
        user_id: 2,
        group_id: 9,
        sender: { nickname: "群友", card: "名片" },
        message: [{ type: "text", text: "hi" }],
        time: 123,
      },
    ]);
    const reportReaded = vi.fn(async () => undefined);

    const client = {
      pickFriend: vi.fn(() => ({ sendMsg })),
      pickGroup: vi.fn(() => ({ getChatHistory })),
      sendTempMsg,
      reportReaded,
    } as unknown as import("@icqqjs/icqq").Client;

    await expect(
      sendPrivate?.execute(client, { user_id: 1, message: "hello" }),
    ).resolves.toEqual({ message_id: "pm-1" });
    await expect(
      sendTemp?.execute(client, { group_id: 9, user_id: 2, message: "temp hi" }),
    ).resolves.toEqual({ message_id: "temp-1" });
    expect(sendTempMsg).toHaveBeenCalledWith(9, 2, "temp hi");
    await expect(
      historyGroup?.execute(client, { group_id: 9, count: 1 }),
    ).resolves.toEqual([
      {
        message_id: "g-1",
        message_type: "group",
        user_id: 2,
        group_id: 9,
        nickname: "群友",
        card: "名片",
        raw_message: "hi",
        time: 123,
      },
    ]);
    await expect(markRead?.execute(client, { message_id: "msg-1" })).resolves.toEqual({ ok: true });
    expect(reportReaded).toHaveBeenCalledWith("msg-1");
  });
});