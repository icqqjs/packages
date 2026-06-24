import { describe, it, expect, vi } from "vitest";
import {
  normalizeSystemMessage,
  normalizeGfsDirEntry,
  resolveGroupReactionTarget,
} from "../src/daemon/executors/helpers.js";

vi.mock("@/lib/icqq-resolve.js", () => ({
  resolveIcqq: vi.fn(async () => ({
    parseGroupMessageId: (id: string) => {
      if (id === "bad-group") return { group_id: 0, seq: 10 };
      if (id === "bad-seq") return { group_id: 100, seq: 0 };
      return { group_id: 200, seq: 42 };
    },
  })),
}));

describe("executor helpers", () => {
  it("normalizes system messages", () => {
    expect(normalizeSystemMessage(null)).toEqual({ type: "unknown" });
    expect(
      normalizeSystemMessage({
        request_type: "friend",
        user_id: 1,
        nickname: "n",
        comment: "hi",
      }),
    ).toEqual({
      type: "friend",
      user_id: 1,
      nickname: "n",
      group_id: undefined,
      group_name: undefined,
      comment: "hi",
      flag: undefined,
      seq: undefined,
      time: undefined,
    });
    expect(normalizeSystemMessage({ sub_type: "poke" })).toEqual({ type: "poke" });
  });

  it("normalizes gfs directory entries", () => {
    expect(
      normalizeGfsDirEntry({
        fid: "f1",
        name: "dir",
        pid: "p0",
        is_dir: true,
        file_count: 3,
        modify_time: 1,
        user_id: 9,
      } as never),
    ).toMatchObject({ fid: "f1", is_dir: true, file_count: 3, uploader: 9 });

    expect(
      normalizeGfsDirEntry({
        fid: "f2",
        name: "file.bin",
        pid: "p0",
        md5: "abc",
        size: 100,
        upload_time: 2,
        modify_time: 3,
        user_id: 8,
      } as never),
    ).toMatchObject({
      fid: "f2",
      is_dir: false,
      size: 100,
      upload_time: 2,
      modify_time: 3,
    });
  });

  it("resolves group reaction targets from message ids", async () => {
    await expect(
      resolveGroupReactionTarget({ message_id: "bad-group" }),
    ).rejects.toThrow("不是有效的群消息");
    await expect(
      resolveGroupReactionTarget({ message_id: "bad-seq" }),
    ).rejects.toThrow("未包含有效的群消息序列号");
    await expect(
      resolveGroupReactionTarget({ message_id: "ok" }),
    ).resolves.toEqual({ groupId: 200, seq: 42 });
  });
});
