import { beforeEach, describe, expect, it, vi } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import { getActionCatalogEntry } from "../src/daemon/action-catalog.js";
import type { DaemonContext } from "../src/daemon/daemon-context.js";
import { createStubDaemonContext } from "./helpers/daemon-test-context.js";

vi.mock("../src/lib/icqq-resolve.js", () => ({
  resolveIcqq: async () => ({
    parseGroupMessageId: () => ({
      group_id: 9,
      user_id: 2,
      seq: 1,
      rand: 1,
      time: 1,
      pktnum: 1,
    }),
  }),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(async () => Buffer.from("x")),
  },
}));

function fn<T>(value: T) {
  return vi.fn(async () => value);
}

function createRichClient() {
  const channel = {
    sendMsg: fn({ seq: 1 }),
    recallMsg: fn({ ok: true }),
    share: fn({ ok: true }),
    getForumUrl: fn("https://forum"),
  };
  const group = {
    group_id: 9,
    group_name: "群",
    member_count: 2,
    max_member_count: 200,
    owner_id: 1,
    sendMsg: fn({ message_id: "g1" }),
    getChatHistory: fn([]),
    uploadLongMsg: fn({ type: "long" }),
    quit: fn({ ok: true }),
    setRemark: fn(undefined),
    setGroupJoinType: fn({ ok: true }),
    setMessageRateLimit: fn({ ok: true }),
    muteAnony: fn(undefined),
    getAnonyInfo: fn({ ok: true }),
    getMuteMemberList: fn([]),
    getAtAllRemainder: fn(1),
    getMemberMap: fn(new Map([[2, { user_id: 2, nickname: "成员" }]])),
    sendFile: fn({ fid: "f1" }),
    getAvatarUrl: fn("https://gavatar"),
    getPicUrl: fn("https://pic"),
    getPttUrl: fn("https://ptt"),
    share: fn({ ok: true }),
    setReaction: fn({ ok: true }),
    delReaction: fn({ ok: true }),
    fs: {
      ls: fn([]),
      mkdir: fn({ fid: "d1" }),
      rm: fn({ ok: true }),
      rename: fn({ ok: true }),
      stat: fn({ size: 1 }),
      move: fn({ ok: true }),
      download: fn("https://example.com/f"),
      upload: fn({ fid: "f1" }),
    },
  };
  const friend = {
    user_id: 2,
    nickname: "好友",
    remark: "备注",
    sex: "male",
    age: 18,
    sendMsg: fn({ message_id: "p1" }),
    getChatHistory: fn([]),
    uploadLongMsg: fn({ type: "long" }),
    setRemark: fn({ ok: true }),
    setClass: fn({ ok: true }),
    poke: fn({ ok: true }),
    sendFile: fn({ fid: "f1" }),
    recallFile: fn({ ok: true }),
    forwardFile: fn("f2"),
    searchSameGroup: fn([]),
    getPicUrl: fn("https://pic"),
    getPttUrl: fn("https://ptt"),
    share: fn({ ok: true }),
  };
  const user = {
    user_id: 2,
    getFileInfo: fn({ fid: "f1" }),
    getFileUrl: fn("https://file"),
    getAvatarUrl: fn("https://avatar"),
    getAddFriendSetting: fn(0),
    getChatHistory: fn([]),
    uploadLongMsg: fn({ type: "long" }),
    sendMsg: fn({ message_id: "p1" }),
  };
  const gfsBase = {
    dir: fn([]),
    df: fn({ total: 1 }),
    mkdir: fn({ fid: "d1" }),
    rm: fn(undefined),
    rename: fn(undefined),
    stat: fn({ fid: "f1", size: 1 }),
    mv: fn(undefined),
    download: fn("https://example.com/f"),
    upload: fn({ fid: "f1" }),
    forward: fn({ fid: "f2" }),
    forwardOfflineFile: fn({ fid: "f2" }),
  };

  return {
    uin: 123,
    nickname: "bot",
    sex: "male",
    age: 18,
    isOnline: () => true,
    fl: new Map([[2, friend]]),
    gl: new Map([[9, group]]),
    sl: new Map([[8, { user_id: 8, nickname: "路人", sex: "male", age: 20 }]]),
    blacklist: new Set([66]),
    classes: new Map([[1, "默认"]]),
    guilds: new Map([[1, { guild_id: "1", guild_name: "guild", channels: new Map([["ch1", channel]]) }]]),
    pickFriend: vi.fn(() => friend),
    pickGroup: vi.fn(() => group),
    pickUser: vi.fn(() => user),
    pickGuild: vi.fn(() => ({ channels: new Map([["ch1", channel]]) })),
    sendTempMsg: fn({ message_id: "t1" }),
    deleteMsg: fn({ ok: true }),
    getMsg: fn({ message_id: "m1" }),
    reportReaded: fn(undefined),
    getChatHistory: fn([]),
    setNickname: fn({ ok: true }),
    setGender: fn({ ok: true }),
    setBirthday: fn({ ok: true }),
    setSignature: fn({ ok: true }),
    setDescription: fn({ ok: true }),
    setAvatar: fn({ ok: true }),
    setOnlineStatus: fn({ ok: true }),
    setGroupName: fn({ ok: true }),
    setGroupPortrait: fn({ ok: true }),
    setGroupCard: fn({ ok: true }),
    setGroupSpecialTitle: fn({ ok: true }),
    setGroupAdmin: fn({ ok: true }),
    setGroupBan: fn({ ok: true }),
    setGroupWholeBan: fn({ ok: true }),
    setGroupKick: fn({ ok: true }),
    setGroupAnonymous: fn({ ok: true }),
    sendGroupNotice: fn({ ok: true }),
    inviteFriend: fn({ ok: true }),
    sendGroupPoke: fn({ ok: true }),
    sendGroupSign: fn({ ok: true }),
    setEssenceMessage: fn({ ok: true }),
    removeEssenceMessage: fn({ ok: true }),
    setFriendAddRequest: fn({ ok: true }),
    setGroupAddRequest: fn({ ok: true }),
    sendLike: fn({ ok: true }),
    deleteFriend: fn({ ok: true }),
    sendGuildMsg: fn({ seq: 1 }),
    setGroupMemberScreenMsg: fn({ ok: true }),
    getGroupInfo: fn(group),
    getGroupMemberInfo: fn({ user_id: 2, nickname: "成员" }),
    getStrangerInfo: fn({ user_id: 8, nickname: "路人" }),
    getSystemMsg: fn({ unreadCount: 0, msgs: [] }),
    getOnlineStatus: fn(11),
    reloadFriendList: fn(undefined),
    reloadGroupList: fn(undefined),
    reloadBlackList: fn(undefined),
    reloadStrangerList: fn(undefined),
    reloadGuilds: fn(undefined),
    cleanCache: vi.fn(),
    acquireGfs: vi.fn(() => gfsBase),
    imageOcr: fn({ text: "ocr" }),
    getForwardMsg: fn({ messages: [] }),
    makeForwardMsg: fn({ message_id: "fwd" }),
    getGroupShareJson: fn({ url: "u" }),
    getVideoUrl: fn("https://video"),
    getClientKey: fn("key"),
    getCookies: fn("cookie"),
    getCsrfToken: fn("csrf"),
    getPSkey: fn("pskey"),
    uid2uin: fn(123),
    uin2uid: fn("uid"),
    uid2uins: fn([123]),
    uin2uids: fn(["uid"]),
    getForumUrl: fn("https://forum"),
    getGuildList: fn([]),
    getGuildInfo: fn({ guild_id: "1" }),
    getChannelList: fn([]),
    getGuildMemberList: fn([]),
    getChannelInfo: fn({ channel_id: "ch1" }),
    addFriend: fn({ ok: true }),
    getRoamingStamp: fn([]),
    deleteStamp: fn({ ok: true }),
    sendDiscussMsg: fn({ message_id: "d1" }),
    getProfile: fn({ user_id: 2 }),
    getStatusInfo: fn({ status: 11 }),
    refreshNTPicRkey: fn({ ok: true }),
    addClass: fn({ id: 1 }),
    deleteClass: fn({ ok: true }),
    renameClass: fn({ ok: true }),
    setFriendClass: fn({ ok: true }),
    logout: fn({ ok: true }),
  } as unknown as import("@icqqjs/icqq").Client;
}

const PARAMS: Partial<Record<string, Record<string, unknown>>> = {
  [Actions.SEND_PRIVATE_MSG]: { user_id: 2, message: "hi" },
  [Actions.SEND_GROUP_MSG]: { group_id: 9, message: "hi" },
  [Actions.SEND_TEMP_MSG]: { group_id: 9, user_id: 2, message: "hi" },
  [Actions.RECALL_MSG]: { message_id: "abc" },
  [Actions.GET_MSG]: { message_id: "abc" },
  [Actions.HISTORY_PRIVATE]: { user_id: 2, count: 1 },
  [Actions.HISTORY_GROUP]: { group_id: 9, count: 1 },
  [Actions.HISTORY_BY_MSG_ID]: { message_id: "abc", count: 1 },
  [Actions.SEND_LONG_MSG]: { group_id: 9, message: "long" },
  [Actions.MARK_READ]: { message_id: "abc" },
  [Actions.DELETE_MSG]: { message_id: "abc" },
  [Actions.SET_NICKNAME]: { nickname: "n" },
  [Actions.SET_GENDER]: { gender: 1 },
  [Actions.SET_BIRTHDAY]: { birthday: "20260101" },
  [Actions.SET_SIGNATURE]: { signature: "s" },
  [Actions.SET_DESCRIPTION]: { description: "d" },
  [Actions.SET_AVATAR]: { file: "avatar.jpg" },
  [Actions.SET_ONLINE_STATUS]: { status: 11 },
  [Actions.SET_GROUP_NAME]: { group_id: 9, name: "新群名" },
  [Actions.SET_GROUP_AVATAR]: { group_id: 9, file: "g.jpg" },
  [Actions.SET_GROUP_CARD]: { group_id: 9, user_id: 2, card: "名片" },
  [Actions.SET_GROUP_TITLE]: { group_id: 9, user_id: 2, title: "头衔" },
  [Actions.SET_GROUP_ADMIN]: { group_id: 9, user_id: 2, enable: true },
  [Actions.SET_GROUP_REMARK]: { group_id: 9, remark: "备注" },
  [Actions.GROUP_MUTE]: { group_id: 9, user_id: 2, duration: 60 },
  [Actions.GROUP_MUTE_ALL]: { group_id: 9 },
  [Actions.GROUP_KICK]: { group_id: 9, user_id: 2 },
  [Actions.GROUP_QUIT]: { group_id: 9 },
  [Actions.GROUP_INVITE]: { group_id: 9, user_id: 2 },
  [Actions.GROUP_POKE]: { group_id: 9, user_id: 2 },
  [Actions.GROUP_ANNOUNCE]: { group_id: 9, content: "公告" },
  [Actions.GROUP_SIGN]: { group_id: 9 },
  [Actions.GROUP_ESSENCE_ADD]: { message_id: "abc" },
  [Actions.GROUP_ESSENCE_REMOVE]: { message_id: "abc" },
  [Actions.GROUP_ALLOW_ANONY]: { group_id: 9, enable: true },
  [Actions.GROUP_MUTED_LIST]: { group_id: 9 },
  [Actions.GROUP_AT_ALL_REMAIN]: { group_id: 9 },
  [Actions.FRIEND_POKE]: { user_id: 2 },
  [Actions.FRIEND_LIKE]: { user_id: 2, times: 1 },
  [Actions.FRIEND_DELETE]: { user_id: 2 },
  [Actions.FRIEND_REMARK]: { user_id: 2, remark: "备注" },
  [Actions.FRIEND_CLASS]: { user_id: 2, class_id: 1 },
  [Actions.HANDLE_FRIEND_REQUEST]: { flag: "f1", approve: true },
  [Actions.HANDLE_GROUP_REQUEST]: { flag: "g1", approve: true },
  [Actions.ADD_FRIEND_CLASS]: { name: "新分组" },
  [Actions.DELETE_FRIEND_CLASS]: { class_id: 1 },
  [Actions.RENAME_FRIEND_CLASS]: { class_id: 1, name: "改名" },
  [Actions.GFS_LIST]: { group_id: 9 },
  [Actions.GFS_INFO]: { group_id: 9 },
  [Actions.GFS_MKDIR]: { group_id: 9, name: "dir" },
  [Actions.GFS_DELETE]: { group_id: 9, fid: "f1" },
  [Actions.GFS_RENAME]: { group_id: 9, fid: "f1", name: "new" },
  [Actions.GFS_STAT]: { group_id: 9, fid: "f1" },
  [Actions.GFS_MOVE]: { group_id: 9, fid: "f1", pid: "/" },
  [Actions.GFS_DOWNLOAD]: { group_id: 9, fid: "f1" },
  [Actions.GFS_UPLOAD]: { group_id: 9, file: "a.txt" },
  [Actions.IMAGE_OCR]: { file: "a.jpg" },
  [Actions.GET_GROUP_SHARE]: { group_id: 9 },
  [Actions.GROUP_SET_JOIN_TYPE]: { group_id: 9, type: 1 },
  [Actions.GROUP_SET_RATE_LIMIT]: { group_id: 9, times: 10 },
  [Actions.GROUP_MUTE_ANONY]: { group_id: 9, flag: "anon1", duration: 60 },
  [Actions.GROUP_ANON_INFO]: { group_id: 9 },
  [Actions.ADD_FRIEND]: { group_id: 9, user_id: 8 },
  [Actions.SEND_PRIVATE_FILE]: { user_id: 2, file: "a.txt" },
  [Actions.SEND_GROUP_FILE]: { group_id: 9, file: "a.txt" },
  [Actions.FRIEND_RECALL_FILE]: { user_id: 2, fid: "f1" },
  [Actions.GROUP_SET_REACTION]: { message_id: "abc", id: "128077" },
  [Actions.GROUP_DEL_REACTION]: { message_id: "abc", id: "128077" },
  [Actions.GET_FORWARD_MSG]: { resid: "r1" },
  [Actions.MAKE_FORWARD_MSG]: { message_id: "abc" },
  [Actions.GUILD_SEND_MSG]: { guild_id: "1", channel_id: "ch1", message: "hi" },
  [Actions.GUILD_RECALL_MSG]: { guild_id: "1", channel_id: "ch1", seq: 1 },
  [Actions.GET_FILE_INFO]: { user_id: 2, fid: "f1" },
  [Actions.GET_FILE_URL]: { user_id: 2, fid: "f1" },
  [Actions.GET_AVATAR_URL]: { user_id: 2 },
  [Actions.GET_GROUP_AVATAR_URL]: { group_id: 9 },
  [Actions.SET_SCREEN_MEMBER_MSG]: { group_id: 9, user_id: 2, enable: true },
  [Actions.GFS_FORWARD]: { group_id: 9, fid: "f1", target_group_id: 10 },
  [Actions.GFS_FORWARD_OFFLINE]: { group_id: 9, fid: "f1", name: "a.txt" },
  [Actions.GET_STATUS_INFO]: { user_id: 2 },
  [Actions.GET_PSKEY]: { domain: "qq.com" },
  [Actions.UID2UIN]: { uid: "uid" },
  [Actions.UIN2UID]: { uin: 123 },
  [Actions.GET_PIC_URL]: { user_id: 2, elem: { type: "image" } },
  [Actions.GET_PTT_URL]: { user_id: 2, elem: { type: "ptt" } },
  [Actions.GET_VIDEO_URL]: { fid: "v1", md5: "md5" },
  [Actions.GET_ADD_FRIEND_SETTING]: { user_id: 2 },
  [Actions.GET_FORUM_URL]: { guild_id: "1", channel_id: "ch1", forum_id: "f1" },
  [Actions.GUILD_CHANNEL_SHARE]: {
    guild_id: "1",
    channel_id: "ch1",
    url: "https://example.com",
    title: "t",
  },
  [Actions.GET_FRIEND_INFO]: { user_id: 2 },
  [Actions.GET_GROUP_INFO]: { group_id: 9 },
  [Actions.GET_GROUP_MEMBER_INFO]: { group_id: 9, user_id: 2 },
  [Actions.GET_STRANGER_INFO]: { user_id: 8 },
  [Actions.GET_PROFILE]: { user_id: 2 },
  [Actions.LIST_GROUP_MEMBERS]: { group_id: 9 },
  [Actions.FRIEND_FORWARD_FILE]: { user_id: 2, fid: "f1" },
  [Actions.SEARCH_SAME_GROUP]: { user_id: 2 },
  [Actions.SEND_CONTACT_SHARE]: { user_id: 2, url: "https://example.com", title: "t" },
  [Actions.GET_COOKIES]: { domain: "qq.com" },
  [Actions.SEND_DISCUSS_MSG]: { discuss_id: 1, message: "hi" },
  [Actions.UID2UINS]: { uids: ["uid1"] },
  [Actions.UIN2UIDS]: { uins: [123] },
  [Actions.GET_CHANNEL_INFO]: { guild_id: "1", channel_id: "ch1" },
  [Actions.SET_WEBHOOK]: { url: "https://example.com/hook" },
  [Actions.SET_NOTIFY]: { enabled: true },
};

function createWebhookTestContext(): DaemonContext {
  return {
    setWebhookUrl: vi.fn(async () => null),
    getWebhookUrl: () => "https://example.com/hook",
    setNotifyEnabled: vi.fn(async () => {}),
    notifications: { isEnabled: () => true },
  } as unknown as DaemonContext;
}

const DAEMON_CONFIG_ACTIONS = new Set([
  Actions.SET_WEBHOOK,
  Actions.GET_WEBHOOK,
  Actions.SET_NOTIFY,
  Actions.GET_NOTIFY,
]);

describe("action catalog full matrix", () => {
  for (const action of Object.keys(PARAMS)) {
    it(`executes ${action}`, async () => {
      const entry = getActionCatalogEntry(action);
      expect(entry).toBeTruthy();
      const client = createRichClient();
      const ctx = DAEMON_CONFIG_ACTIONS.has(action)
        ? createWebhookTestContext()
        : createStubDaemonContext(client);
      await expect(entry!.execute(client, PARAMS[action]!, ctx)).resolves.toBeDefined();
    });
  }

  it("executes zero-param catalog actions", async () => {
    const client = createRichClient();
    const zeroParamActions = [
      Actions.PING,
      Actions.GET_STATUS,
      Actions.GET_SELF_PROFILE,
      Actions.LIST_FRIENDS,
      Actions.LIST_GROUPS,
      Actions.LIST_BLACKLIST,
      Actions.LIST_FRIEND_CLASSES,
      Actions.LIST_STRANGERS,
      Actions.GET_ONLINE_STATUS,
      Actions.GET_SYSTEM_MSG,
      Actions.RELOAD_FRIEND_LIST,
      Actions.RELOAD_GROUP_LIST,
      Actions.RELOAD_BLACKLIST,
      Actions.RELOAD_STRANGER_LIST,
      Actions.RELOAD_GUILDS,
      Actions.CLEAN_CACHE,
      Actions.GUILD_LIST,
      Actions.GUILD_INFO,
      Actions.GUILD_CHANNELS,
      Actions.GUILD_MEMBERS,
      Actions.GET_CLIENT_KEY,
      Actions.GET_CSRF_TOKEN,
      Actions.GET_NOTIFY,
      Actions.GET_WEBHOOK,
      Actions.GET_ROAMING_STAMP,
      Actions.SUBSCRIBE,
      Actions.UNSUBSCRIBE,
    ];

    for (const action of zeroParamActions) {
      const entry = getActionCatalogEntry(action);
      if (!entry) continue;
      const params =
        action === Actions.GUILD_INFO ||
        action === Actions.GUILD_CHANNELS ||
        action === Actions.GUILD_MEMBERS
          ? { guild_id: "1" }
          : {};
      await expect(entry.execute(client, params, createStubDaemonContext(client))).resolves.toBeDefined();
    }
  });
});
