/**
 * 将 icqq 事件对象序列化为可 JSON 传输的 plain object。
 * 优先调用 icqq 自带的 toJSON(keys)，排除内部协议字段与 Client/Group 等类实例。
 * 若 toJSON 未带上引用消息，会从原始 event.source 补全序列化结果。
 * source / reply 等仅有 seq+rand+time 时，会生成 CQHTTP 风格 message_id 供下游使用。
 */
import { applyCanonicalMessageIds } from "@/lib/icqq-message-id.js";

/** icqq Message / 事件对象 toJSON 时需排除的键 */
export const ICQQ_EVENT_JSON_OMIT_KEYS = [
  "client",
  "proto",
  "parsed",
  "info",
  "head",
  "frag",
  "body",
  "friend",
  "group",
  "member",
  "discuss",
] as const;

type JsonOmitKey = (typeof ICQQ_EVENT_JSON_OMIT_KEYS)[number];

function hasIcqqToJSON(
  value: object,
): value is { toJSON: (keys: string[]) => Record<string, unknown> } {
  return typeof (value as { toJSON?: unknown }).toJSON === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** toJSON 未展开或只留了 reply id 时，视为需从原始 event.source 补全 */
function isShallowQuotedMessage(value: unknown): boolean {
  if (!isRecord(value)) return true;
  if (
    typeof value.raw_message === "string" ||
    Array.isArray(value.message) ||
    typeof value.message_id === "string" ||
    typeof value.user_id === "number"
  ) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length === 0 || (keys.length <= 2 && "id" in value);
}

function needsSourceFromRaw(
  plainSource: unknown,
  rawSource: unknown,
): boolean {
  if (plainSource === undefined) return true;
  if (isShallowQuotedMessage(plainSource) && !isShallowQuotedMessage(rawSource)) {
    return true;
  }
  if (isRecord(plainSource) && hasIcqqToJSON(plainSource)) {
    return true;
  }
  return false;
}

function toPlainEvent(event: unknown, seen = new WeakSet<object>()): unknown {
  if (event === null || event === undefined) return event;
  if (typeof event === "bigint") return event.toString();
  if (typeof event !== "object") return event;

  if (Buffer.isBuffer(event)) {
    return { type: "Buffer", data: event.toString("base64") };
  }

  if (Array.isArray(event)) {
    return event.map((item) => toPlainEvent(item, seen));
  }

  if (seen.has(event)) return undefined;
  seen.add(event);

  if (hasIcqqToJSON(event)) {
    return toPlainEvent(event.toJSON([...ICQQ_EVENT_JSON_OMIT_KEYS]), seen);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (typeof value === "function") continue;
    if (ICQQ_EVENT_JSON_OMIT_KEYS.includes(key as JsonOmitKey)) continue;
    out[key] = toPlainEvent(value, seen);
  }
  return out;
}

/** 序列化 icqq 事件，供 IPC / Webhook JSON 传输使用 */
export function serializeIcqqEvent(event: unknown): unknown {
  const plain = toPlainEvent(event);
  if (!isRecord(plain) || !isRecord(event)) {
    return plain;
  }

  const rawSource = event.source;
  if (rawSource !== null && rawSource !== undefined) {
    if (needsSourceFromRaw(plain.source, rawSource)) {
      plain.source = toPlainEvent(rawSource);
    }
  }

  applyCanonicalMessageIds(plain, event);

  return plain;
}

/** JSON.stringify replacer，配合 serializeIcqqEvent 兜底 BigInt / Buffer */
export function icqqEventJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) {
    return { type: "Buffer", data: value.toString("base64") };
  }
  return value;
}
