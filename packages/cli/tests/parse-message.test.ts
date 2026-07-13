import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseMessage,
  stringifyMessage,
  resolveSendable,
  renderDisplayMessage,
  termLink,
} from "../src/lib/parse-message.ts";

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

  it("parses image with local file path as base64", () => {
    const filePath = path.join(os.tmpdir(), `icqq-parse-${Date.now()}.txt`);
    fs.writeFileSync(filePath, "hello");

    const result = parseMessage(`[image:${filePath}]`);
    expect(result).toEqual([{ type: "image", file: `base64://${Buffer.from("hello").toString("base64")}` }]);

    fs.rmSync(filePath, { force: true });
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

  it("rejects invalid message array shapes", () => {
    expect(() => resolveSendable({ message: [] })).toThrow("不能为空数组");
    expect(() => resolveSendable({ message: [123] as any })).toThrow("message 数组项须为 string 或含 type 的对象");
  });

  it("accepts image url and default custom elements in array", () => {
    expect(
      resolveSendable({
        message: [
          { type: "image", url: "https://example.com/a.png" },
          { type: "custom", foo: 1 },
        ],
      }),
    ).toEqual([
      { type: "image", file: "https://example.com/a.png" },
      { type: "custom", foo: 1 },
    ]);
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

  it("converts extended media and custom element types", () => {
    expect(
      stringifyMessage([
        { type: "flash", url: "https://x/flash.jpg" } as any,
        { type: "record", file: "/tmp/a.amr" } as any,
        { type: "video", url: "https://x/video.mp4" } as any,
        { type: "bface", text: "原创表情" } as any,
        { type: "share", url: "https://x/share" } as any,
        { type: "location", lat: 1, lng: 2, address: "A" } as any,
        { type: "poke", id: 66 } as any,
        { type: "json" } as any,
        { type: "xml" } as any,
        { type: "file", name: "a.txt" } as any,
        { type: "markdown" } as any,
        { type: "unknown" } as any,
      ]),
    ).toBe(
      "[flash:https://x/flash.jpg][record:/tmp/a.amr][video:https://x/video.mp4][bface:原创表情][share:https://x/share][location:1,2,A][poke:66][json][xml][file:a.txt][markdown][unknown]",
    );
  });
});

describe("renderDisplayMessage", () => {
  it("renders common CQ display markers", () => {
    const output = renderDisplayMessage(
      "[dice][rps][reply:abc][bface:原图][poke][json][xml][file:doc.txt][markdown]",
    );
    expect(output).toContain("[骰子·不支持查看]");
    expect(output).toContain("[猜拳·不支持查看]");
    expect(output).toContain("[引用:abc]");
    expect(output).toContain("[原图]");
    expect(output).toContain("[戳一戳]");
    expect(output).toContain("[卡片消息·不支持查看]");
    expect(output).toContain("[XML消息·不支持查看]");
    expect(output).toContain("[文件:doc.txt]");
    expect(output).toContain("[Markdown·不支持查看]");
  });

  it("wraps http resources as terminal links", () => {
    const output = renderDisplayMessage(
      "[image:https://example.com/a.png][flash:https://example.com/f.jpg][record:https://example.com/a.amr][video:https://example.com/v.mp4][share:https://example.com]",
    );
    expect(output).toContain(termLink("[图片]", "https://example.com/a.png"));
    expect(output).toContain(termLink("[闪照]", "https://example.com/f.jpg"));
    expect(output).toContain(termLink("[语音]", "https://example.com/a.amr"));
    expect(output).toContain(termLink("[视频]", "https://example.com/v.mp4"));
    expect(output).toContain(termLink("[分享]", "https://example.com"));
  });

  it("falls back for plain labels and unknown face ids", () => {
    const output = renderDisplayMessage("[face:999999][image:/tmp/a.png][reply]");
    expect(output).toContain("[表情999999]");
    expect(output).toContain("[图片]");
    expect(output).toContain("[引用]");
  });
});
