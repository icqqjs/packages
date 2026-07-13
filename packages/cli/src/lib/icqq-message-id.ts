/**
 * IPC 事件序列化时，用 @icqqjs/icqq 的 genGroupMessageId / genDmMessageId
 * 将 source 等仅有 seq/rand/time 的字段编码为下游可用的 message_id。
 */
import { resolveIcqq } from "@/lib/icqq-resolve.js";

export type MessageIdContext = {
  message_type?: string;
  group_id?: number;
  user_id?: number;
  from_id?: number;
  to_id?: number;
  pktnum?: number;
};

type GenGroupMessageId = (
  gid: number,
  uin: number,
  seq: number,
  rand: number,
  time: number,
  pktnum?: number,
) => string;

type GenDmMessageId = (
  uin: number,
  seq: number,
  rand: number,
  time: number,
  flag?: number,
) => string;

let genGroupMessageId: GenGroupMessageId | null = null;
let genDmMessageId: GenDmMessageId | null = null;

/** 守护进程登录后调用，绑定 icqq 包内实现 */
export async function initIcqqMessageIdBuilders(): Promise<void> {
  const icqq = await resolveIcqq();
  if (typeof icqq.genGroupMessageId !== "function") {
    throw new Error("@icqqjs/icqq 未导出 genGroupMessageId");
  }
  if (typeof icqq.genDmMessageId !== "function") {
    throw new Error("@icqqjs/icqq 未导出 genDmMessageId");
  }
  genGroupMessageId = icqq.genGroupMessageId as GenGroupMessageId;
  genDmMessageId = icqq.genDmMessageId as GenDmMessageId;
}

function requireBuilders(): {
  genGroupMessageId: GenGroupMessageId;
  genDmMessageId: GenDmMessageId;
} {
  if (!genGroupMessageId || !genDmMessageId) {
    throw new Error(
      "message_id 编码未初始化，请确保守护进程已调用 initIcqqMessageIdBuilders",
    );
  }
  return { genGroupMessageId, genDmMessageId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

/** 已是 gen* 生成的 base64 message_id（17 私聊 / 21 群聊字节） */
export function isCanonicalMessageId(id: string): boolean {
  try {
    const buf = Buffer.from(id, "base64");
    return buf.length === 17 || buf.length === 21;
  } catch {
    return false;
  }
}

function extractParts(
  record: Record<string, unknown>,
  ctx: MessageIdContext,
): {
  user_id: number;
  seq: number;
  rand: number;
  time: number;
  group_id?: number;
  pktnum?: number;
  flag?: number;
} | null {
  const seq = num(record.seq);
  const rand = num(record.rand);
  const time = num(record.time);
  if (seq === undefined || rand === undefined || time === undefined) {
    return null;
  }

  const user_id =
    num(record.user_id) ??
    num(record.from_id) ??
    num(ctx.user_id) ??
    num(ctx.from_id);
  if (user_id === undefined) return null;

  return {
    user_id,
    seq,
    rand,
    time,
    group_id: num(record.group_id) ?? num(ctx.group_id),
    pktnum: num(record.pktnum) ?? num(ctx.pktnum),
    flag: num(record.flag),
  };
}

function isGroupContext(
  ctx: MessageIdContext,
  parts: { group_id?: number },
): boolean {
  if (ctx.message_type === "group") return true;
  if (parts.group_id !== undefined && parts.group_id > 0) return true;
  return num(ctx.group_id) !== undefined && num(ctx.group_id)! > 0;
}

/** 根据消息元数据生成 CQHTTP 风格 message_id（委托 icqq gen*） */
export function buildMessageId(
  record: Record<string, unknown>,
  ctx: MessageIdContext = {},
): string | undefined {
  const parts = extractParts(record, ctx);
  if (!parts) return undefined;

  const { genGroupMessageId: genGroup, genDmMessageId: genDm } =
    requireBuilders();

  if (isGroupContext(ctx, parts)) {
    const gid = parts.group_id ?? num(ctx.group_id);
    if (gid === undefined || gid <= 0) return undefined;
    return genGroup(
      gid,
      parts.user_id,
      parts.seq,
      parts.rand,
      parts.time,
      parts.pktnum ?? 1,
    );
  }

  return genDm(
    parts.user_id,
    parts.seq,
    parts.rand,
    parts.time,
    parts.flag ?? 0,
  );
}

function ensureIdOnRecord(
  record: Record<string, unknown>,
  ctx: MessageIdContext,
): void {
  const existing = record.message_id;
  if (typeof existing === "string" && isCanonicalMessageId(existing)) {
    return;
  }

  const built = buildMessageId(record, ctx);
  if (built) {
    record.message_id = built;
  }
}

function normalizeReplyElems(
  message: unknown,
  ctx: MessageIdContext,
): void {
  if (!Array.isArray(message)) return;

  for (const item of message) {
    if (!isRecord(item) || item.type !== "reply") continue;
    const id = item.id;
    if (typeof id !== "string" || !id) continue;
    if (isCanonicalMessageId(id)) continue;

    const fromReply = buildMessageId(
      {
        user_id: item.qq ?? item.user_id,
        seq: item.seq,
        rand: item.rand,
        time: item.time,
        group_id: item.group_id,
      },
      ctx,
    );
    if (fromReply) {
      item.id = fromReply;
    }
  }
}

/** 为 IPC 下发的 plain 事件补全 message_id（含 source、reply 段） */
export function applyCanonicalMessageIds(
  plain: Record<string, unknown>,
  raw?: Record<string, unknown>,
): void {
  const ctx: MessageIdContext = {
    message_type:
      typeof plain.message_type === "string" ? plain.message_type : undefined,
    group_id: num(plain.group_id),
    user_id: num(plain.user_id) ?? num(plain.from_id),
    from_id: num(plain.from_id),
    to_id: num(plain.to_id),
    pktnum: num(plain.pktnum),
  };

  ensureIdOnRecord(plain, ctx);

  if (isRecord(plain.source)) {
    const sourceCtx: MessageIdContext = {
      ...ctx,
      user_id: num(plain.source.user_id) ?? ctx.user_id,
      group_id: num(plain.source.group_id) ?? ctx.group_id,
    };
    ensureIdOnRecord(plain.source, sourceCtx);
  }

  normalizeReplyElems(plain.message, ctx);

  if (raw && isRecord(raw.source) && isRecord(plain.source)) {
    const sourceCtx: MessageIdContext = {
      ...ctx,
      user_id: num(raw.source.user_id) ?? num(plain.source.user_id),
    };
    ensureIdOnRecord(plain.source, sourceCtx);
  }
}
