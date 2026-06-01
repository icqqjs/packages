import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/icqq-resolve.js", () => ({
  resolveIcqq: vi.fn(async () => ({
    genGroupMessageId: (
      gid: number,
      uin: number,
      seq: number,
      rand: number,
      time: number,
      pktnum = 1,
    ) => {
      const buf = Buffer.allocUnsafe(21);
      buf.writeUInt32BE(gid);
      buf.writeUInt32BE(uin, 4);
      buf.writeInt32BE(seq & 0xffffffff, 8);
      buf.writeInt32BE(rand & 0xffffffff, 12);
      buf.writeUInt32BE(time, 16);
      buf.writeUInt8(pktnum > 1 ? pktnum : 1, 20);
      return buf.toString("base64");
    },
    genDmMessageId: (
      uin: number,
      seq: number,
      rand: number,
      time: number,
      flag = 0,
    ) => {
      const buf = Buffer.allocUnsafe(17);
      buf.writeUInt32BE(uin);
      buf.writeInt32BE(seq & 0xffffffff, 4);
      buf.writeInt32BE(rand & 0xffffffff, 8);
      buf.writeUInt32BE(time, 12);
      buf.writeUInt8(flag, 16);
      return buf.toString("base64");
    },
  })),
}));

import { initIcqqMessageIdBuilders } from "../src/lib/icqq-message-id.js";
import {
  ICQQ_EVENT_JSON_OMIT_KEYS,
  icqqEventJsonReplacer,
  serializeIcqqEvent,
} from "../src/lib/serialize-icqq-event.js";

beforeAll(async () => {
  await initIcqqMessageIdBuilders();
});

describe("serializeIcqqEvent", () => {
  it("uses icqq toJSON and omits internal keys", () => {
    const event = {
      post_type: "message",
      message_type: "group",
      group_id: 123,
      user_id: 456,
      raw_message: "hello",
      time: 1_700_000_000,
      msg_id: 999n,
      client: { uin: 10001 },
      proto: { encoded: true },
      friend: { pickMember: () => null },
      reply() {
        return Promise.resolve({});
      },
      toJSON(keys: string[]) {
        return Object.fromEntries(
          Object.entries(this).filter(
            ([key, value]) =>
              typeof value !== "function" && !keys.includes(key),
          ),
        );
      },
    };

    const data = serializeIcqqEvent(event) as Record<string, unknown>;
    expect(data.post_type).toBe("message");
    expect(data.message_type).toBe("group");
    expect(data.group_id).toBe(123);
    expect(data.raw_message).toBe("hello");
    expect(data.msg_id).toBe("999");
    expect(data.client).toBeUndefined();
    expect(data.proto).toBeUndefined();
    expect(data.friend).toBeUndefined();
    expect(data.reply).toBeUndefined();
  });

  it("walks plain objects when toJSON is absent", () => {
    const event = {
      post_type: "message",
      detail_type: "guild",
      guild_id: "g1",
      channel_id: "c1",
      sender: { nickname: "n", tiny_id: "t1" },
      raw_message: "hi",
      proto: { hidden: true },
      reply() {
        return Promise.resolve({});
      },
    };

    const data = serializeIcqqEvent(event) as Record<string, unknown>;
    expect(data.guild_id).toBe("g1");
    expect(data.sender).toEqual({ nickname: "n", tiny_id: "t1" });
    expect(data.raw_message).toBe("hi");
    expect((data as Record<string, unknown>).proto).toBeUndefined();
  });

  it("documents omit keys aligned with icqq Message internals", () => {
    expect(ICQQ_EVENT_JSON_OMIT_KEYS).toContain("client");
    expect(ICQQ_EVENT_JSON_OMIT_KEYS).toContain("proto");
    expect(ICQQ_EVENT_JSON_OMIT_KEYS).toContain("group");
  });

  it("serializes arrays, buffers, and circular references safely", () => {
    const circular: Record<string, unknown> = {
      list: [1n, Buffer.from("hi")],
    };
    circular.self = circular;

    expect(serializeIcqqEvent(circular)).toEqual({
      list: ["1", { type: "Buffer", data: Buffer.from("hi").toString("base64") }],
      self: undefined,
    });
  });

  it("merges source when toJSON omits quoted message", () => {
    const quoted = {
      message_id: "quoted-1",
      user_id: 111,
      raw_message: "原消息内容",
      time: 1_700_000_001,
      toJSON(keys: string[]) {
        return Object.fromEntries(
          Object.entries(this).filter(
            ([key, value]) =>
              typeof value !== "function" && !keys.includes(key),
          ),
        );
      },
    };

    const event = {
      post_type: "message",
      message_type: "group",
      group_id: 123,
      raw_message: "回复内容",
      source: quoted,
      toJSON() {
        return {
          post_type: "message",
          message_type: "group",
          group_id: 123,
          raw_message: "回复内容",
        };
      },
    };

    const data = serializeIcqqEvent(event) as Record<string, unknown>;
    expect(data.source).toEqual({
      message_id: "quoted-1",
      user_id: 111,
      raw_message: "原消息内容",
      time: 1_700_000_001,
    });
  });

  it("replaces shallow source stub with full quoted message", () => {
    const quoted = {
      message_id: "quoted-2",
      raw_message: "完整引用",
      user_id: 222,
    };

    const event = {
      raw_message: "回复",
      source: quoted,
      toJSON() {
        return { raw_message: "回复", source: { id: "quoted-2" } };
      },
    };

    const data = serializeIcqqEvent(event) as Record<string, unknown>;
    expect(data.source).toEqual({
      message_id: "quoted-2",
      raw_message: "完整引用",
      user_id: 222,
    });
  });

  it("keeps source already expanded by toJSON", () => {
    const event = {
      raw_message: "回复",
      source: { message_id: "q3", raw_message: "已有", user_id: 3 },
      toJSON() {
        return {
          raw_message: "回复",
          source: { message_id: "q3", raw_message: "已有", user_id: 3 },
        };
      },
    };

    const data = serializeIcqqEvent(event) as Record<string, unknown>;
    expect(data.source).toEqual({
      message_id: "q3",
      raw_message: "已有",
      user_id: 3,
    });
  });

  it("provides JSON replacer for bigint and buffer", () => {
    expect(icqqEventJsonReplacer("id", 123n)).toBe("123");
    expect(icqqEventJsonReplacer("buf", Buffer.from("ok"))).toEqual({
      type: "Buffer",
      data: Buffer.from("ok").toString("base64"),
    });
    expect(icqqEventJsonReplacer("plain", "text")).toBe("text");
  });
});
