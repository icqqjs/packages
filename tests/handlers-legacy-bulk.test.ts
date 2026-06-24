import { beforeEach, describe, expect, it, vi } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import { getActionCatalogEntry } from "../src/daemon/action-catalog.js";
import { handleRequest } from "../src/daemon/handlers.js";
import { tryGetDaemonContext, initDaemonContext } from "../src/daemon/daemon-context.js";

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

function createGroupClient() {
  const muteMember = vi.fn(async () => ({ ok: true }));
  const muteAll = vi.fn(async () => ({ ok: true }));
  const kickMember = vi.fn(async () => ({ ok: true }));
  const quit = vi.fn(async () => ({ ok: true }));
  const inviteMember = vi.fn(async () => ({ ok: true }));
  const pokeMember = vi.fn(async () => ({ ok: true }));
  const announce = vi.fn(async () => ({ ok: true }));
  const setCard = vi.fn(async () => ({ ok: true }));
  const setAdmin = vi.fn(async () => ({ ok: true }));
  const pickGroup = vi.fn(() => ({
    muteMember,
    muteAll,
    kickMember,
    quit,
    invite: inviteMember,
    pokeMember,
    announce,
    setCard,
    setAdmin,
    setName: vi.fn(async () => ({ ok: true })),
    setAvatar: vi.fn(async () => ({ ok: true })),
    allowAnonymous: vi.fn(async () => ({ ok: true })),
    getMuteList: vi.fn(async () => []),
    getAtAllRemain: vi.fn(async () => 1),
    fs: {
      ls: vi.fn(async () => []),
      mkdir: vi.fn(async () => ({ fid: "d1" })),
      rm: vi.fn(async () => ({ ok: true })),
      rename: vi.fn(async () => ({ ok: true })),
      stat: vi.fn(async () => ({ size: 1 })),
      move: vi.fn(async () => ({ ok: true })),
      download: vi.fn(async () => "https://example.com/f"),
      upload: vi.fn(async () => ({ fid: "f1" })),
    },
    setReaction: vi.fn(async () => ({ ok: true })),
    delReaction: vi.fn(async () => ({ ok: true })),
  }));

  return {
    client: {
      setGroupBan: vi.fn(async () => ({ ok: true })),
      setGroupWholeBan: vi.fn(async () => ({ ok: true })),
      setGroupKick: vi.fn(async () => ({ ok: true })),
      inviteFriend: vi.fn(async () => ({ ok: true })),
      sendGroupPoke: vi.fn(async () => ({ ok: true })),
      acquireGfs: vi.fn(() => ({
        dir: vi.fn(async () => []),
        df: vi.fn(async () => ({})),
        mkdir: vi.fn(async () => ({ fid: "d1" })),
        rm: vi.fn(async () => undefined),
        rename: vi.fn(async () => undefined),
        stat: vi.fn(async () => ({ size: 1 })),
        mv: vi.fn(async () => undefined),
        download: vi.fn(async () => "https://example.com/f"),
        upload: vi.fn(async () => ({ fid: "f1" })),
      })),
      pickGroup,
      pickFriend: vi.fn(() => ({
        deleteFriend: vi.fn(async () => ({ ok: true })),
        setRemark: vi.fn(async () => ({ ok: true })),
        poke: vi.fn(async () => ({ ok: true })),
        sendFile: vi.fn(async () => ({ fid: "f" })),
        recallFile: vi.fn(async () => ({ ok: true })),
      })),
      reloadFriendList: vi.fn(async () => undefined),
      reloadGroupList: vi.fn(async () => undefined),
      reloadBlackList: vi.fn(async () => undefined),
      reloadStrangerList: vi.fn(async () => undefined),
      reloadGuildList: vi.fn(async () => undefined),
      cleanCache: vi.fn(async () => ({ ok: true })),
      getSystemMsg: vi.fn(async () => ({ unreadCount: 0, msgs: [] })),
      setEssenceMessage: vi.fn(async () => ({ ok: true })),
      removeEssenceMessage: vi.fn(async () => ({ ok: true })),
      getForwardMsg: vi.fn(async () => ({ messages: [] })),
      makeForwardMsg: vi.fn(async () => ({ message_id: "fwd" })),
      imageOcr: vi.fn(async () => ({ text: "ocr" })),
      getVideoUrl: vi.fn(async () => "https://video"),
      getClientKey: vi.fn(async () => "key"),
      getCookies: vi.fn(async () => "cookie"),
      getCsrfToken: vi.fn(async () => "csrf"),
      getPskey: vi.fn(async () => "pskey"),
      getUid: vi.fn(async () => "uid"),
      getUin: vi.fn(async () => 123),
      pickGuild: vi.fn(() => ({
        channels: new Map([
          [
            "ch1",
            {
              sendMsg: vi.fn(async () => ({ seq: 1 })),
              recallMsg: vi.fn(async () => ({ ok: true })),
              share: vi.fn(async () => ({ ok: true })),
              getForumUrl: vi.fn(async () => "https://forum"),
            },
          ],
        ]),
      })),
      gl: new Map([[9, { group_id: 9 }]]),
      fl: new Map(),
      guilds: new Map([[1, { guild_id: "1", guild_name: "g" }]]),
    } as unknown as import("@icqqjs/icqq").Client,
    pickGroup,
    muteMember,
  };
}

describe("legacy handlers bulk matrix", () => {
  beforeEach(() => {
    initDaemonContext(null);
  });

  it("executes group moderation and filesystem actions", async () => {
    const { client } = createGroupClient();

    await expect(
      getActionCatalogEntry(Actions.GROUP_MUTE)?.execute(client, {
        group_id: 9,
        user_id: 2,
        duration: 60,
      }),
    ).resolves.toEqual({ ok: true });
    expect(client.setGroupBan).toHaveBeenCalled();

    await expect(
      getActionCatalogEntry(Actions.GROUP_MUTE_ALL)?.execute(client, { group_id: 9 }),
    ).resolves.toEqual({ ok: true });
    await expect(
      getActionCatalogEntry(Actions.GROUP_KICK)?.execute(client, {
        group_id: 9,
        user_id: 2,
        block: false,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      getActionCatalogEntry(Actions.GROUP_INVITE)?.execute(client, { group_id: 9, user_id: 2 }),
    ).resolves.toEqual({ ok: true });
    await expect(
      getActionCatalogEntry(Actions.GFS_LIST)?.execute(client, { group_id: 9 }),
    ).resolves.toEqual([]);
    await expect(
      getActionCatalogEntry(Actions.GFS_UPLOAD)?.execute(client, {
        group_id: 9,
        file: "report.pdf",
      }),
    ).resolves.toEqual({ fid: "f1" });
    await expect(
      getActionCatalogEntry(Actions.RELOAD_FRIEND_LIST)?.execute(client, {}),
    ).resolves.toEqual({ ok: true, friendCount: 0 });
    await expect(
      getActionCatalogEntry(Actions.CLEAN_CACHE)?.execute(client, {}),
    ).resolves.toEqual({ ok: true });
  });

  it("routes handleRequest through catalog and formats errors", async () => {
    const client = createGroupClient().client;
    const ok = await handleRequest(client, {
      id: "1",
      action: Actions.PING,
      params: {},
    });
    expect(ok).toEqual({ id: "1", ok: true, data: expect.objectContaining({ pong: true }) });

    const bad = await handleRequest(client, {
      id: "2",
      action: Actions.GROUP_MUTE,
      params: { group_id: 0, user_id: 2 },
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("group_id");

    const unknown = await handleRequest(client, {
      id: "3",
      action: "not_real",
      params: {},
    });
    expect(unknown).toEqual({ id: "3", ok: false, error: "未知操作: not_real" });
  });

  it("executes webhook actions when daemon context is initialized", async () => {
    const setWebhook = vi.fn(async () => null);
    const ctx = {
      setWebhookUrl: setWebhook,
      getWebhookUrl: () => "https://example.com/hook",
      setNotifyEnabled: vi.fn(async () => {}),
      notifications: { isEnabled: () => true },
    };
    initDaemonContext(ctx as never);

    const client = {} as import("@icqqjs/icqq").Client;
    await expect(
      getActionCatalogEntry(Actions.SET_WEBHOOK)?.execute(client, {
        url: "https://example.com/hook",
      }),
    ).resolves.toEqual({ webhookUrl: "https://example.com/hook" });
    await expect(getActionCatalogEntry(Actions.GET_WEBHOOK)?.execute(client, {})).resolves.toEqual({
      webhookUrl: "https://example.com/hook",
    });
    await expect(
      getActionCatalogEntry(Actions.SET_NOTIFY)?.execute(client, { enabled: true }),
    ).resolves.toEqual({ notifyEnabled: true });
    expect(tryGetDaemonContext()).toBe(ctx);
  });
});
