import type { IpcEvent } from "@/daemon/protocol.js";

/** 判断 IPC 推送是否为指定私聊/群聊会话的消息 */
export function isChatMessageEvent(
  event: IpcEvent,
  type: "private" | "group",
  id: number,
): boolean {
  if (!event.event.startsWith("message")) return false;
  const data = event.data as Record<string, unknown> | null;
  if (!data || data.message_type !== type) return false;

  if (type === "group") {
    return Number(data.group_id) === id;
  }

  const fromId = Number(data.from_id ?? data.user_id);
  return fromId === id;
}

/** 判断 IPC 推送是否为指定频道子频道消息 */
export function isGuildChannelMessageEvent(
  event: IpcEvent,
  channelId: string,
): boolean {
  if (!event.event.startsWith("message.guild")) return false;
  const data = event.data as Record<string, unknown> | null;
  return data != null && String(data.channel_id) === channelId;
}

/** 从 icqq 消息事件 data 提取聊天 UI 展示字段 */
export function chatMessageFromEventData(data: Record<string, unknown>): {
  nickname: string;
  content: string;
  time: number;
} {
  const sender = data.sender as Record<string, unknown> | undefined;
  return {
    nickname: String(
      sender?.card ?? sender?.nickname ?? data.user_id ?? data.from_id ?? "?",
    ),
    content: String(data.raw_message ?? ""),
    time: Number(data.time ?? Math.floor(Date.now() / 1000)),
  };
}

export function guildMessageFromEventData(data: Record<string, unknown>): {
  nickname: string;
  content: string;
  time: number;
} {
  const sender = data.sender as Record<string, unknown> | undefined;
  return {
    nickname: String(sender?.nickname ?? sender?.tiny_id ?? "?"),
    content: String(data.raw_message ?? ""),
    time: Number(data.time ?? Math.floor(Date.now() / 1000)),
  };
}

/**
 * 旧 subscribe(type, id) 的客户端过滤包装。
 * 服务端每条连接只推送一次，多个 subscribe 回调需各自过滤，避免重复处理。
 */
export function wrapSubscribeEventHandler(
  params: Record<string, unknown>,
  onEvent: (event: IpcEvent) => void,
): (event: IpcEvent) => void {
  const type = params.type;
  const idParam = params.id;

  if (type === "private" || type === "group") {
    const sessionId = Number(idParam);
    if (Number.isFinite(sessionId) && sessionId > 0) {
      return (event) => {
        if (isChatMessageEvent(event, type, sessionId)) onEvent(event);
      };
    }
  }

  if (type === "guild" && idParam != null && idParam !== "") {
    const channelId = String(idParam);
    return (event) => {
      if (isGuildChannelMessageEvent(event, channelId)) onEvent(event);
    };
  }

  return onEvent;
}
