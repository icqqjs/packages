import { describe, expect, it } from "vitest";
import {
  chatMessageFromEventData,
  guildMessageFromEventData,
  isChatMessageEvent,
  isGuildChannelMessageEvent,
  wrapSubscribeEventHandler,
} from "../src/lib/ipc-event-filter.js";

describe("isChatMessageEvent", () => {
  const groupMsg = {
    id: "sub-1",
    event: "message.group.normal",
    data: {
      message_type: "group",
      group_id: 123,
      raw_message: "hi",
      sender: { nickname: "A" },
      time: 100,
    },
  };

  it("matches group by group_id", () => {
    expect(isChatMessageEvent(groupMsg, "group", 123)).toBe(true);
    expect(isChatMessageEvent(groupMsg, "group", 456)).toBe(false);
  });

  it("matches private by from_id", () => {
    const evt = {
      id: "sub-1",
      event: "message.private.friend",
      data: {
        message_type: "private",
        from_id: 456,
        raw_message: "hi",
        time: 100,
      },
    };
    expect(isChatMessageEvent(evt, "private", 456)).toBe(true);
    expect(isChatMessageEvent(evt, "private", 123)).toBe(false);
  });

  it("ignores non-message events", () => {
    expect(
      isChatMessageEvent(
        { id: "1", event: "notice.friend.recall", data: {} },
        "group",
        123,
      ),
    ).toBe(false);
  });
});

describe("isGuildChannelMessageEvent", () => {
  it("matches guild channel id", () => {
    const evt = {
      id: "sub-1",
      event: "message.guild.forum",
      data: { channel_id: "ch-1", raw_message: "x" },
    };
    expect(isGuildChannelMessageEvent(evt, "ch-1")).toBe(true);
    expect(isGuildChannelMessageEvent(evt, "ch-2")).toBe(false);
  });

  it("ignores non guild events and null payloads", () => {
    expect(
      isGuildChannelMessageEvent(
        { id: "1", event: "message.group.normal", data: { channel_id: "ch-1" } },
        "ch-1",
      ),
    ).toBe(false);
    expect(
      isGuildChannelMessageEvent(
        { id: "1", event: "message.guild.normal", data: null },
        "ch-1",
      ),
    ).toBe(false);
  });
});

describe("chatMessageFromEventData", () => {
  it("prefers sender card over nickname", () => {
    const msg = chatMessageFromEventData({
      sender: { card: "名片", nickname: "昵称" },
      raw_message: "hello",
      time: 42,
    });
    expect(msg.nickname).toBe("名片");
    expect(msg.content).toBe("hello");
    expect(msg.time).toBe(42);
  });

  it("falls back to ids and current time", () => {
    const now = Date.now;
    Date.now = () => 99_000;

    const msg = chatMessageFromEventData({ from_id: 12 });
    expect(msg.nickname).toBe("12");
    expect(msg.content).toBe("");
    expect(msg.time).toBe(99);

    Date.now = now;
  });
});

describe("guildMessageFromEventData", () => {
  it("prefers guild nickname and falls back to tiny_id", () => {
    expect(
      guildMessageFromEventData({
        sender: { nickname: "频道昵称", tiny_id: "tiny-1" },
        raw_message: "hi",
        time: 8,
      }),
    ).toEqual({ nickname: "频道昵称", content: "hi", time: 8 });

    expect(
      guildMessageFromEventData({
        sender: { tiny_id: "tiny-2" },
      }),
    ).toMatchObject({ nickname: "tiny-2", content: "" });
  });
});

describe("wrapSubscribeEventHandler", () => {
  const privateMsg = {
    id: "*",
    event: "message.private.friend",
    data: {
      message_type: "private",
      from_id: 100,
      raw_message: "te",
      time: 1,
    },
  };

  it("only invokes matching session handler among multiple subscriptions", () => {
    const hits: number[] = [];
    const h100 = wrapSubscribeEventHandler(
      { type: "private", id: 100 },
      () => hits.push(100),
    );
    const h200 = wrapSubscribeEventHandler(
      { type: "private", id: 200 },
      () => hits.push(200),
    );

    h100(privateMsg);
    h200(privateMsg);

    expect(hits).toEqual([100]);
  });

  it("filters guild subscriptions and leaves invalid params untouched", () => {
    const hits: string[] = [];
    const guildHandler = wrapSubscribeEventHandler(
      { type: "guild", id: "ch-1" },
      () => hits.push("guild"),
    );
    const passthrough = wrapSubscribeEventHandler(
      { type: "private", id: "not-a-number" },
      () => hits.push("raw"),
    );

    guildHandler({
      id: "1",
      event: "message.guild.normal",
      data: { channel_id: "ch-1" },
    });
    guildHandler({
      id: "2",
      event: "message.guild.normal",
      data: { channel_id: "ch-2" },
    });
    passthrough({ id: "3", event: "notice.any", data: {} as any });

    expect(hits).toEqual(["guild", "raw"]);
  });
});
