import { describe, expect, it, vi } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import { getActionCatalogEntry } from "../src/daemon/action-catalog.js";

function makeGroupMessageId(groupId: number, userId: number, seq: number): string {
  const buf = Buffer.allocUnsafe(21);
  buf.writeUInt32BE(groupId);
  buf.writeUInt32BE(userId, 4);
  buf.writeUInt32BE(seq, 8);
  buf.writeUInt32BE(123456, 12);
  buf.writeUInt32BE(1717000000, 16);
  buf.writeUInt8(1, 20);
  return buf.toString("base64");
}

describe("legacy action catalog entries", () => {
  it("derives group reaction target from message_id", async () => {
    const setReaction = vi.fn(async (seq: number, id: string) => ({ seq, id, op: "set" }));
    const delReaction = vi.fn(async (seq: number, id: string) => ({ seq, id, op: "del" }));
    const pickGroup = vi.fn(() => ({ setReaction, delReaction }));
    const messageId = makeGroupMessageId(9, 10001, 321);
    const client = {
      pickGroup,
    } as unknown as import("@icqqjs/icqq").Client;

    await expect(
      getActionCatalogEntry(Actions.GROUP_SET_REACTION)?.execute(client, {
        message_id: messageId,
        id: "128077",
      }),
    ).resolves.toEqual({ seq: 321, id: "128077", op: "set" });
    await expect(
      getActionCatalogEntry(Actions.GROUP_DEL_REACTION)?.execute(client, {
        message_id: messageId,
        id: "128077",
      }),
    ).resolves.toEqual({ seq: 321, id: "128077", op: "del" });

    expect(pickGroup).toHaveBeenCalledTimes(2);
    expect(pickGroup).toHaveBeenNthCalledWith(1, 9);
    expect(pickGroup).toHaveBeenNthCalledWith(2, 9);
    expect(setReaction).toHaveBeenCalledWith(321, "128077");
    expect(delReaction).toHaveBeenCalledWith(321, "128077");
  });

  it("executes legacy list and info actions through the canonical catalog", async () => {
    const getGroupInfo = vi.fn(async () => ({ group_id: 9, group_name: "群" }));
    const getGroupMemberInfo = vi.fn(async () => ({ user_id: 2, nickname: "成员" }));
    const getStrangerInfo = vi.fn(async () => ({ user_id: 8, nickname: "路人" }));
    const client = {
      gl: new Map([
        [9, { group_id: 9, group_name: "群", member_count: 5, max_member_count: 200, owner_id: 1 }],
      ]),
      blacklist: new Set([66]),
      classes: new Map([[1, "默认分组"]]),
      fl: new Map([[7, { user_id: 7, nickname: "好友", remark: "备注" }]]),
      getGroupInfo,
      getGroupMemberInfo,
      getStrangerInfo,
    } as unknown as import("@icqqjs/icqq").Client;

    await expect(
      getActionCatalogEntry(Actions.LIST_GROUPS)?.execute(client, {}),
    ).resolves.toEqual([
      { group_id: 9, group_name: "群", member_count: 5, max_member_count: 200, owner_id: 1 },
    ]);
    await expect(
      getActionCatalogEntry(Actions.LIST_BLACKLIST)?.execute(client, {}),
    ).resolves.toEqual([{ user_id: 66 }]);
    await expect(
      getActionCatalogEntry(Actions.LIST_FRIEND_CLASSES)?.execute(client, {}),
    ).resolves.toEqual([{ id: 1, name: "默认分组" }]);
    await expect(
      getActionCatalogEntry(Actions.GET_FRIEND_INFO)?.execute(client, { user_id: 7 }),
    ).resolves.toEqual({ user_id: 7, nickname: "好友", remark: "备注" });
    await expect(
      getActionCatalogEntry(Actions.GET_GROUP_INFO)?.execute(client, { group_id: 9 }),
    ).resolves.toEqual({ group_id: 9, group_name: "群" });
    await expect(
      getActionCatalogEntry(Actions.GET_GROUP_MEMBER_INFO)?.execute(client, { group_id: 9, user_id: 2 }),
    ).resolves.toEqual({ user_id: 2, nickname: "成员" });
    await expect(
      getActionCatalogEntry(Actions.GET_STRANGER_INFO)?.execute(client, { user_id: 8 }),
    ).resolves.toEqual({ user_id: 8, nickname: "路人" });
  });

  it("executes legacy profile and social mutation actions through the canonical catalog", async () => {
    const setNickname = vi.fn(async (value: string) => ({ nickname: value }));
    const setGender = vi.fn(async (value: 0 | 1 | 2) => ({ gender: value }));
    const setBirthday = vi.fn(async (value: string) => ({ birthday: value }));
    const setSignature = vi.fn(async (value: string) => ({ signature: value }));
    const setDescription = vi.fn(async (value: string) => ({ description: value }));
    const setOnlineStatus = vi.fn(async (value: number) => ({ status: value }));
    const sendLike = vi.fn(async (userId: number, times: number) => ({ userId, times }));
    const sendGroupSign = vi.fn(async (groupId: number) => ({ groupId }));
    const client = {
      setNickname,
      setGender,
      setBirthday,
      setSignature,
      setDescription,
      setOnlineStatus,
      sendLike,
      sendGroupSign,
    } as unknown as import("@icqqjs/icqq").Client;

    await expect(
      getActionCatalogEntry(Actions.SET_NICKNAME)?.execute(client, { nickname: "bot" }),
    ).resolves.toEqual({ nickname: "bot" });
    await expect(
      getActionCatalogEntry(Actions.SET_GENDER)?.execute(client, { gender: 1 }),
    ).resolves.toEqual({ gender: 1 });
    await expect(
      getActionCatalogEntry(Actions.SET_BIRTHDAY)?.execute(client, { birthday: "2026-05-30" }),
    ).resolves.toEqual({ birthday: "2026-05-30" });
    await expect(
      getActionCatalogEntry(Actions.SET_SIGNATURE)?.execute(client, { signature: "hi" }),
    ).resolves.toEqual({ signature: "hi" });
    await expect(
      getActionCatalogEntry(Actions.SET_DESCRIPTION)?.execute(client, { description: "desc" }),
    ).resolves.toEqual({ description: "desc" });
    await expect(
      getActionCatalogEntry(Actions.SET_ONLINE_STATUS)?.execute(client, { status: 11 }),
    ).resolves.toEqual({ status: 11 });
    await expect(
      getActionCatalogEntry(Actions.FRIEND_LIKE)?.execute(client, { user_id: 7, times: 3 }),
    ).resolves.toEqual({ userId: 7, times: 3 });
    await expect(
      getActionCatalogEntry(Actions.GROUP_SIGN)?.execute(client, { group_id: 9 }),
    ).resolves.toEqual({ groupId: 9 });
  });

  it("keeps deprecated subscribe actions available through the canonical catalog", async () => {
    await expect(
      getActionCatalogEntry(Actions.SUBSCRIBE)?.execute({} as never, {}),
    ).resolves.toEqual({
      deprecated: true,
      note: "认证连接后自动推送事件，无需 subscribe",
    });
    await expect(
      getActionCatalogEntry(Actions.UNSUBSCRIBE)?.execute({} as never, {}),
    ).resolves.toEqual({
      deprecated: true,
      note: "认证连接后自动推送事件，无需 subscribe",
    });
  });
});