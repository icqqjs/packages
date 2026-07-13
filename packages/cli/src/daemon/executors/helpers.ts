import type { Client } from "@icqqjs/icqq";
import { resolveIcqq } from "@/lib/icqq-resolve.js";
import { msgid } from "./params.js";

type GroupReactionTarget = {
  groupId: number;
  seq: number;
};

type SystemMessageRecord = {
  request_type?: string;
  sub_type?: string;
  user_id?: number;
  nickname?: string;
  group_id?: number;
  group_name?: string;
  comment?: string;
  flag?: string;
  seq?: number;
  time?: number;
};

export type NormalizedSystemMessage = {
  type: string;
  user_id?: number;
  nickname?: string;
  group_id?: number;
  group_name?: string;
  comment?: string;
  flag?: string;
  seq?: number;
  time?: number;
};

type GfsInstance = ReturnType<Client["acquireGfs"]>;
type GfsDirEntry = Awaited<ReturnType<GfsInstance["dir"]>>[number];

export function normalizeSystemMessage(item: unknown): NormalizedSystemMessage {
  if (!item || typeof item !== "object") {
    return { type: "unknown" };
  }

  const message = item as SystemMessageRecord;
  return {
    type: message.request_type ?? message.sub_type ?? "unknown",
    user_id: message.user_id,
    nickname: message.nickname,
    group_id: message.group_id,
    group_name: message.group_name,
    comment: message.comment,
    flag: message.flag,
    seq: message.seq,
    time: message.time,
  };
}

export function normalizeGfsDirEntry(entry: GfsDirEntry) {
  return {
    fid: entry.fid,
    name: entry.name,
    pid: entry.pid,
    is_dir: entry.is_dir ?? !("md5" in entry),
    size: "size" in entry ? entry.size : undefined,
    upload_time: "upload_time" in entry ? entry.upload_time : entry.create_time,
    modify_time: entry.modify_time,
    uploader: entry.user_id,
    file_count: "file_count" in entry ? entry.file_count : undefined,
  };
}

export async function resolveGroupReactionTarget(
  params: Record<string, unknown>,
): Promise<GroupReactionTarget> {
  const { parseGroupMessageId } = await resolveIcqq();
  const parsed = parseGroupMessageId(msgid(params));
  const groupId = Number(parsed.group_id);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("message_id 不是有效的群消息");
  }

  const seq = Number(parsed.seq);
  if (!Number.isFinite(seq) || seq <= 0) {
    throw new Error("message_id 未包含有效的群消息序列号");
  }

  return { groupId, seq };
}
