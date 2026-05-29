import { describe, it, expect } from "vitest";
import { parseMessage, stringifyMessage, resolveSendable } from "../src/lib/parse-message.ts";

describe("parseMessage", () => {
  it("returns plain text for simple strings", () => {
    expect(parseMessage("hello")).toBe("hello");
  });

  it("parses face tags", () => {
    const result = parseMessage("hi [face:76] there");
    expect(result).toEqual(["hi ", { type: "face", id: 76 }, " there"]);
  });

  it("parses at tags", () => {
    const result = parseMessage("[at:12345] hello");
    expect(result).toEqual([{ type: "at", qq: 12345 }, " hello"]);
  });

  it("parses at:all", () => {
    const result = parseMessage("[at:all]");
    expect(result).toEqual([{ type: "at", qq: "all" }]);
  });

  it("parses reply tag", () => {
    const result = parseMessage("[reply:abc123] 收到");
    expect(result).toEqual([
      { type: "reply", id: "abc123" },
      " 收到",
    ]);
  });

  it("parses dice and rps", () => {
    const result = parseMessage("[dice][rps]");
    expect(result).toEqual([{ type: "dice" }, { type: "rps" }]);
  });

  it("parses image with URL", () => {
    const result = parseMessage("[image:https://example.com/img.png]");
    expect(result).toEqual([{ type: "image", file: "https://example.com/img.png" }]);
  });

  it("parses mixed content", () => {
    const result = parseMessage("hi [face:13] [at:999] bye");
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(5);
  });

  it("returns empty string for empty input", () => {
    expect(parseMessage("")).toBe("");
  });

  it("handles multiple faces in a row", () => {
    const result = parseMessage("[face:1][face:2]");
    expect(result).toEqual([{ type: "face", id: 1 }, { type: "face", id: 2 }]);
  });
});

describe("resolveSendable", () => {
  it("accepts CQ string like parseMessage", () => {
    expect(resolveSendable({ message: "hello" })).toBe("hello");
  });

  it("accepts MessageElem array for reply", () => {
    expect(
      resolveSendable({
        message: [
          { type: "reply", id: "msg-1" },
          { type: "text", text: "收到" },
        ],
      }),
    ).toEqual([{ type: "reply", id: "msg-1" }, "收到"]);
  });

  it("accepts mixed string and elem in array", () => {
    expect(
      resolveSendable({
        message: [{ type: "at", qq: 123 }, " hi"],
      }),
    ).toEqual([{ type: "at", qq: 123 }, " hi"]);
  });

  it("rejects missing message", () => {
    expect(() => resolveSendable({})).toThrow("缺少参数");
  });
});

describe("stringifyMessage", () => {
  it("converts text elements", () => {
    expect(stringifyMessage([{ type: "text", text: "hello" } as any])).toBe("hello");
  });

  it("converts face elements", () => {
    expect(stringifyMessage([{ type: "face", id: 76 } as any])).toBe("[face:76]");
  });

  it("converts at elements", () => {
    expect(stringifyMessage([{ type: "at", qq: 12345 } as any])).toBe("[at:12345]");
    expect(stringifyMessage([{ type: "at", qq: "all" } as any])).toBe("[at:all]");
  });

  it("converts image elements", () => {
    expect(stringifyMessage([{ type: "image", url: "https://x.com/a.png" } as any])).toBe("[image:https://x.com/a.png]");
  });

  it("converts reply elements", () => {
    expect(stringifyMessage([{ type: "reply", id: "msg-1" } as any])).toBe(
      "[reply:msg-1]",
    );
  });

  it("converts dice and rps", () => {
    expect(stringifyMessage([{ type: "dice" } as any, { type: "rps" } as any])).toBe("[dice][rps]");
  });

  it("handles mixed elements", () => {
    const elems = [
      { type: "text", text: "hi " },
      { type: "face", id: 13 },
      { type: "text", text: " " },
      { type: "at", qq: 999 },
    ] as any[];
    expect(stringifyMessage(elems)).toBe("hi [face:13] [at:999]");
  });
});
