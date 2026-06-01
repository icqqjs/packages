import { beforeAll, describe, expect, it, vi } from "vitest";

/** 测试用：与 icqq message.mjs 相同算法，仅 mock 层使用 */
function mockGenGroupMessageId(
  gid: number,
  uin: number,
  seq: number,
  rand: number,
  time: number,
  pktnum = 1,
): string {
  const buf = Buffer.allocUnsafe(21);
  buf.writeUInt32BE(gid);
  buf.writeUInt32BE(uin, 4);
  buf.writeInt32BE(seq & 0xffffffff, 8);
  buf.writeInt32BE(rand & 0xffffffff, 12);
  buf.writeUInt32BE(time, 16);
  buf.writeUInt8(pktnum > 1 ? pktnum : 1, 20);
  return buf.toString("base64");
}

function mockGenDmMessageId(
  uin: number,
  seq: number,
  rand: number,
  time: number,
  flag = 0,
): string {
  const buf = Buffer.allocUnsafe(17);
  buf.writeUInt32BE(uin);
  buf.writeInt32BE(seq & 0xffffffff, 4);
  buf.writeInt32BE(rand & 0xffffffff, 8);
  buf.writeUInt32BE(time, 12);
  buf.writeUInt8(flag, 16);
  return buf.toString("base64");
}

vi.mock("../src/lib/icqq-resolve.js", () => ({
  resolveIcqq: vi.fn(async () => ({
    genGroupMessageId: mockGenGroupMessageId,
    genDmMessageId: mockGenDmMessageId,
  })),
}));

import {
  applyCanonicalMessageIds,
  buildMessageId,
  initIcqqMessageIdBuilders,
  isCanonicalMessageId,
} from "../src/lib/icqq-message-id.js";
import { serializeIcqqEvent } from "../src/lib/serialize-icqq-event.js";

beforeAll(async () => {
  await initIcqqMessageIdBuilders();
});

describe("buildMessageId", () => {
  it("builds group message_id from seq/rand/time via icqq", () => {
    const id = buildMessageId(
      {
        user_id: 456,
        seq: 100,
        rand: 2_000,
        time: 1_700_000_000,
      },
      { message_type: "group", group_id: 123 },
    );
    expect(id).toBe(mockGenGroupMessageId(123, 456, 100, 2_000, 1_700_000_000));
    expect(isCanonicalMessageId(id!)).toBe(true);
  });

  it("builds private message_id from seq/rand/time via icqq", () => {
    const id = buildMessageId(
      { user_id: 789, seq: 1, rand: 2, time: 1_700_000_001 },
      { message_type: "private" },
    );
    expect(id).toBe(mockGenDmMessageId(789, 1, 2, 1_700_000_001));
    expect(isCanonicalMessageId(id!)).toBe(true);
  });
});

describe("applyCanonicalMessageIds", () => {
  it("adds message_id to source with only seq/rand/time", () => {
    const plain = {
      message_type: "group",
      group_id: 123,
      user_id: 999,
      seq: 50,
      rand: 3,
      time: 1_700_000_002,
      raw_message: "回复",
      source: {
        user_id: 456,
        seq: 10,
        rand: 20,
        time: 1_700_000_000,
        message: "被引用原文",
      },
    };

    applyCanonicalMessageIds(plain);

    expect((plain.source as Record<string, unknown>).message_id).toBe(
      mockGenGroupMessageId(123, 456, 10, 20, 1_700_000_000),
    );
  });
});

describe("serializeIcqqEvent + message_id", () => {
  it("enriches source on serialized group quote event", () => {
    const event = {
      message_type: "group",
      group_id: 10001,
      user_id: 20002,
      seq: 88,
      rand: 77,
      time: 1_800_000_000,
      raw_message: "ok",
      source: {
        user_id: 30003,
        seq: 5,
        rand: 6,
        time: 1_799_999_999,
        message: "quoted",
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
    const source = data.source as Record<string, unknown>;
    expect(source.message_id).toBe(
      mockGenGroupMessageId(10001, 30003, 5, 6, 1_799_999_999),
    );
  });
});
