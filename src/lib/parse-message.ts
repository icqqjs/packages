/**
 * CQ 码消息解析与编码。
 *
 * 支持的标记：
 *   [face:id]          QQ 表情
 *   [image:路径或URL]   图片
 *   [at:QQ号]          @某人
 *   [at:all]           @全体
 *   [dice]             骰子
 *   [rps]              猜拳
 *   [reply:message_id] 引用回复（须写在 message 字符串内，通常放在开头）
 *
 * parseMessage: 文本 → Sendable
 * resolveSendable: IPC params.message（string | MessageElem[]）→ Sendable
 * stringifyMessage: MessageElem[] → CQ 码文本
 */

import type { MessageElem } from "@icqqjs/icqq";
import fs from "node:fs";
import path from "node:path";
import { FACE_MAP } from "../components/chat/useEmojiMode.js";

const TAG_RE = /\[(face|image|at|dice|rps|reply)(?::([^\]]*))?\]/g;

// ── Face ID → Emoji lookup ──
const FACE_EMOJI_MAP = new Map<number, string>();
for (const [id, name] of FACE_MAP) {
  const emoji = name.split(" ")[0];
  FACE_EMOJI_MAP.set(id, emoji);
}

const DISPLAY_RE = /\[(face|image|flash|record|video|bface|share|poke|json|xml|file|dice|rps|reply|markdown)(?::([^\]]*))?\]/g;

/** 生成 OSC 8 终端超链接（支持 iTerm2/Kitty/WezTerm/Windows Terminal 等） */
export function termLink(label: string, url: string): string {
  return `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;
}

/** 若 value 是 HTTP(S) URL 则包裹为可点击超链接，否则返回纯文本 */
function linkIfUrl(label: string, value: string | undefined): string {
  if (value && /^https?:\/\//.test(value)) {
    return termLink(label, value);
  }
  return label;
}

/** 将 CQ 码文本转换为可读的显示文本（表情转 emoji，多媒体转可点击超链接等） */
export function renderDisplayMessage(raw: string): string {
  return raw.replace(DISPLAY_RE, (_match, tag: string, value: string) => {
    switch (tag) {
      case "face": {
        const id = Number(value);
        return FACE_EMOJI_MAP.get(id) ?? `[表情${id}]`;
      }
      case "image":
        return linkIfUrl("[图片]", value);
      case "flash":
        return linkIfUrl("[闪照]", value);
      case "record":
        return linkIfUrl("[语音]", value);
      case "video":
        return linkIfUrl("[视频]", value);
      case "dice":
        return "[骰子·不支持查看]";
      case "rps":
        return "[猜拳·不支持查看]";
      case "reply":
        return value ? `[引用:${value}]` : "[引用]";
      case "bface":
        return value ? `[${value}]` : "[表情]";
      case "share":
        return linkIfUrl("[分享]", value);
      case "poke":
        return "[戳一戳]";
      case "json":
        return "[卡片消息·不支持查看]";
      case "xml":
        return "[XML消息·不支持查看]";
      case "file":
        return `[文件:${value}]`;
      case "markdown":
        return "[Markdown·不支持查看]";
      default:
        return _match;
    }
  });
}

/** Check if a string is a local file path (not a URL or base64) */
function isLocalPath(str: string): boolean {
  if (!str) return false;
  if (str.startsWith("http://") || str.startsWith("https://")) return false;
  if (str.startsWith("base64://")) return false;
  return true;
}

/** Read a local file and return a base64:// data URI */
function fileToBase64(filePath: string): string {
  try {
    const resolved = path.resolve(filePath);
    const buf = fs.readFileSync(resolved);
    return "base64://" + buf.toString("base64");
  } catch {
    // 文件不存在或无法读取时返回原路径
    return filePath;
  }
}

export function parseMessage(raw: string): string | (string | MessageElem)[] {
  const parts: (string | MessageElem)[] = [];
  let last = 0;

  for (const m of raw.matchAll(TAG_RE)) {
    const before = raw.slice(last, m.index);
    if (before) parts.push(before);

    const [, tag, value] = m;

    switch (tag) {
      case "face":
        parts.push({ type: "face", id: Number(value) });
        break;
      case "image":
        parts.push({
          type: "image",
          file: value && isLocalPath(value) ? fileToBase64(value) : (value ?? ""),
        });
        break;
      case "at":
        parts.push({
          type: "at",
          qq: value === "all" ? "all" : Number(value),
        } as MessageElem);
        break;
      case "dice":
        parts.push({ type: "dice" } as MessageElem);
        break;
      case "rps":
        parts.push({ type: "rps" } as MessageElem);
        break;
      case "reply":
        parts.push({ type: "reply", id: value ?? "" } as MessageElem);
        break;
    }

    last = m.index! + m[0].length;
  }

  const tail = raw.slice(last);
  if (tail) parts.push(tail);

  // 纯文本不包装
  if (parts.length === 1 && typeof parts[0] === "string") {
    return parts[0];
  }
  return parts.length === 0 ? raw : parts;
}

export type Sendable = string | MessageElem | (string | MessageElem)[];

/**
 * 解析 IPC 发消息参数：支持 CQ 字符串或 MessageElem[]（JSON 数组）。
 * icqq sendMsg 原生接受 Sendable，此前仅因 handler 强制 string 而未暴露数组形态。
 */
export function resolveSendable(
  params: Record<string, unknown>,
  key = "message",
): Sendable {
  const raw = params[key];
  if (raw === undefined || raw === null) {
    throw new Error(`缺少参数: ${key}`);
  }
  if (typeof raw === "string") {
    return parseMessage(raw);
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error(`参数 ${key} 不能为空数组`);
    }
    return raw.map(normalizeMessagePart);
  }
  throw new Error(`参数 ${key} 须为 string 或 MessageElem[]`);
}

function normalizeMessagePart(item: unknown): string | MessageElem {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object" || !("type" in item)) {
    throw new Error("message 数组项须为 string 或含 type 的对象");
  }

  const elem = item as Record<string, unknown>;
  const type = elem.type;
  if (typeof type !== "string") {
    throw new Error("message 数组项缺少 type");
  }

  switch (type) {
    case "text":
      return String(elem.text ?? "");
    case "face":
      return { type: "face", id: Number(elem.id) };
    case "at":
      return {
        type: "at",
        qq: elem.qq === "all" ? "all" : Number(elem.qq),
      } as MessageElem;
    case "image": {
      const file = String(elem.file ?? elem.url ?? "");
      return {
        type: "image",
        file: file && isLocalPath(file) ? fileToBase64(file) : file,
      };
    }
    case "reply":
      return { type: "reply", id: String(elem.id ?? "") } as MessageElem;
    case "dice":
      return { type: "dice" } as MessageElem;
    case "rps":
      return { type: "rps" } as MessageElem;
    default:
      return elem as unknown as MessageElem;
  }
}

/** 将 icqq 的 MessageElem 数组编码为 CQ 码文本 */
export function stringifyMessage(elems: MessageElem[]): string {
  return elems
    .map((e) => {
      switch (e.type) {
        case "text":
          return e.text;
        case "face":
        case "sface":
          return `[face:${e.id}]`;
        case "at":
          return `[at:${e.qq}]`;
        case "image":
          return `[image:${e.url ?? e.file}]`;
        case "flash":
          return `[flash:${(e as any).url ?? (e as any).file}]`;
        case "record":
          return `[record:${(e as any).url ?? (e as any).file}]`;
        case "video":
          return `[video:${(e as any).url ?? (e as any).file}]`;
        case "rps":
          return `[rps]`;
        case "reply":
          return `[reply:${(e as { id?: string }).id ?? ""}]`;
        case "dice":
          return `[dice]`;
        case "bface":
          return `[bface:${e.text}]`;
        case "share":
          return `[share:${e.url}]`;
        case "location":
          return `[location:${e.lat},${e.lng},${e.address}]`;
        case "poke":
          return `[poke:${e.id}]`;
        case "json":
          return `[json]`;
        case "xml":
          return `[xml]`;
        case "file":
          return `[file:${e.name ?? e.fid}]`;
        case "markdown":
          return `[markdown]`;
        default:
          return `[${e.type}]`;
      }
    })
    .join("");
}
