import type { Client, MessageElem } from "@icqqjs/icqq";
import { Actions } from "./protocol.js";
import { ACTION_HINTS } from "./action-hints.js";
import { LEGACY_ACTION_HANDLERS } from "./handlers.js";
import { resolveSendable, stringifyMessage } from "@/lib/parse-message.js";

export type ActionCatalogEntry = {
  action: string;
  description: string;
  paramsHint?: string;
  execute: (client: Client, params: Record<string, unknown>) => Promise<unknown>;
};

type HistorySender = {
  nickname?: string;
  card?: string;
};

type PrivateHistoryMessage = {
  message_id: string;
  user_id: number;
  from_id: number;
  to_id: number;
  sender?: HistorySender;
  message: MessageElem[];
  time: number;
};

type GroupHistoryMessage = {
  message_id: string;
  user_id: number;
  group_id: number;
  sender?: HistorySender;
  message: MessageElem[];
  time: number;
};

function gid(params: Record<string, unknown>): number {
  const value = Number(params.group_id ?? params.gid);
  if (!Number.isFinite(value) || value <= 0) throw new Error("无效的 group_id");
  return value;
}

function uid(params: Record<string, unknown>): number {
  const value = Number(params.user_id ?? params.uid);
  if (!Number.isFinite(value) || value <= 0) throw new Error("无效的 user_id");
  return value;
}

function msgid(params: Record<string, unknown>): string {
  const value = params.message_id ?? params.msgid;
  if (typeof value !== "string" || !value) throw new Error("无效的 message_id");
  return value;
}

function mapPrivateHistoryMessage(message: PrivateHistoryMessage) {
  return {
    message_id: message.message_id,
    message_type: "private" as const,
    user_id: message.user_id,
    from_id: message.from_id,
    to_id: message.to_id,
    nickname: message.sender?.nickname ?? String(message.user_id),
    raw_message: stringifyMessage(message.message),
    time: message.time,
  };
}

function mapGroupHistoryMessage(message: GroupHistoryMessage) {
  return {
    message_id: message.message_id,
    message_type: "group" as const,
    user_id: message.user_id,
    group_id: message.group_id,
    nickname: message.sender?.nickname ?? String(message.user_id),
    card: message.sender?.card ?? "",
    raw_message: stringifyMessage(message.message),
    time: message.time,
  };
}

function mapHistoryByMsgId(
  message: PrivateHistoryMessage | GroupHistoryMessage,
) {
  if ("group_id" in message && message.group_id !== undefined) {
    return mapGroupHistoryMessage(message as GroupHistoryMessage);
  }
  return mapPrivateHistoryMessage(message as PrivateHistoryMessage);
}

function pickMessageContact(client: Client, params: Record<string, unknown>) {
  const groupId = params.group_id ?? params.gid;
  if (groupId !== undefined && groupId !== null && groupId !== "") {
    return client.pickGroup(gid(params));
  }
  return client.pickFriend(uid(params));
}

export const PILOT_ACTION_CATALOG: readonly ActionCatalogEntry[] = [
  {
    action: Actions.PING,
    description: "心跳检测",
    paramsHint: "无",
    execute: async () => ({ pong: true, time: Date.now() }),
  },
  {
    action: Actions.GET_STATUS,
    description: "获取当前在线状态",
    paramsHint: "无",
    execute: async (client) => ({
      uin: client.uin,
      nickname: client.nickname,
      online: client.isOnline(),
      sex: client.sex,
      age: client.age,
      friendCount: client.fl.size,
      groupCount: client.gl.size,
    }),
  },
  {
    action: Actions.GET_SELF_PROFILE,
    description: "获取自身详细资料",
    paramsHint: "无",
    execute: async (client) => ({
      uin: client.uin,
      nickname: client.nickname,
      sex: client.sex,
      age: client.age,
      friendCount: client.fl.size,
      groupCount: client.gl.size,
      blacklistCount: client.blacklist.size,
    }),
  },
  {
    action: Actions.LIST_FRIENDS,
    description: "获取好友列表",
    paramsHint: "无",
    execute: async (client) =>
      [...client.fl.values()].map((f) => ({
        user_id: f.user_id,
        nickname: f.nickname,
        remark: f.remark,
        sex: f.sex,
        class_id: f.class_id,
      })),
  },
] as const;

export const MESSAGE_ACTION_CATALOG: readonly ActionCatalogEntry[] = [
  {
    action: Actions.SEND_PRIVATE_MSG,
    description: "发送私聊消息",
    paramsHint: "user_id, message（string | MessageElem[]）",
    execute: async (client, params) => {
      const message = resolveSendable(params, "message");
      return await client.pickFriend(uid(params)).sendMsg(message);
    },
  },
  {
    action: Actions.SEND_GROUP_MSG,
    description: "发送群消息",
    paramsHint: "group_id, message（string | MessageElem[]）, anonymous?",
    execute: async (client, params) => {
      const message = resolveSendable(params, "message");
      const group = client.pickGroup(gid(params));
      if (params.anonymous === true) {
        return await group.sendMsg(message, undefined, true);
      }
      return await group.sendMsg(message);
    },
  },
  {
    action: Actions.SEND_TEMP_MSG,
    description: "发送群临时会话消息",
    paramsHint: "group_id, user_id, message（string | MessageElem[]）",
    execute: async (client, params) => {
      const message = resolveSendable(params, "message");
      return await client.sendTempMsg(gid(params), uid(params), message);
    },
  },
  {
    action: Actions.RECALL_MSG,
    description: "撤回消息",
    paramsHint: "message_id",
    execute: async (client, params) => await client.deleteMsg(msgid(params)),
  },
  {
    action: Actions.GET_MSG,
    description: "获取单条消息",
    paramsHint: "message_id",
    execute: async (client, params) => await client.getMsg(msgid(params)),
  },
  {
    action: Actions.HISTORY_PRIVATE,
    description: "获取私聊历史",
    paramsHint: "user_id, count?, time?",
    execute: async (client, params) => {
      const count = params.count ? Number(params.count) : 20;
      const time = params.time ? Number(params.time) : undefined;
      const messages = await client.pickUser(uid(params)).getChatHistory(
        time,
        count,
      ) as PrivateHistoryMessage[];
      return messages.map((message) => mapPrivateHistoryMessage(message));
    },
  },
  {
    action: Actions.HISTORY_GROUP,
    description: "获取群聊历史",
    paramsHint: "group_id, count?, seq?",
    execute: async (client, params) => {
      const count = params.count ? Number(params.count) : 20;
      const seq = params.seq ? Number(params.seq) : undefined;
      const messages = await client.pickGroup(gid(params)).getChatHistory(
        seq,
        count,
      ) as GroupHistoryMessage[];
      return messages.map((message) => mapGroupHistoryMessage(message));
    },
  },
  {
    action: Actions.HISTORY_BY_MSG_ID,
    description: "以 message_id 为锚点拉历史",
    paramsHint: "message_id, count?",
    execute: async (client, params) => {
      const count = params.count ? Number(params.count) : 20;
      const messages = await client.getChatHistory(msgid(params), count) as (
        | PrivateHistoryMessage
        | GroupHistoryMessage
      )[];
      return messages.map((message) => mapHistoryByMsgId(message));
    },
  },
  {
    action: Actions.SEND_LONG_MSG,
    description: "发送长消息（long_msg）",
    paramsHint: "user_id 或 group_id, message（string | MessageElem[]）",
    execute: async (client, params) => {
      const message = resolveSendable(params, "message");
      const contact = pickMessageContact(client, params);
      const longElem = await contact.uploadLongMsg(message);
      return await contact.sendMsg(longElem);
    },
  },
  {
    action: Actions.MARK_READ,
    description: "标记消息已读",
    paramsHint: "message_id",
    execute: async (client, params) => {
      await client.reportReaded(msgid(params));
      return { ok: true };
    },
  },
  {
    action: Actions.DELETE_MSG,
    description: "删除消息",
    paramsHint: "message_id",
    execute: async (client, params) => await client.deleteMsg(msgid(params)),
  },
] as const;

export const DEPRECATED_ACTION_CATALOG: readonly ActionCatalogEntry[] = [
  {
    action: Actions.SUBSCRIBE,
    description: "（已废弃）连接后自动推送事件",
    paramsHint: "无",
    execute: async () => ({
      deprecated: true,
      note: "认证连接后自动推送事件，无需 subscribe",
    }),
  },
  {
    action: Actions.UNSUBSCRIBE,
    description: "（已废弃）断开连接自动停止",
    paramsHint: "无",
    execute: async () => ({
      deprecated: true,
      note: "认证连接后自动推送事件，无需 subscribe",
    }),
  },
] as const;

export const ACTION_CATALOG: readonly ActionCatalogEntry[] = [
  ...PILOT_ACTION_CATALOG,
  ...MESSAGE_ACTION_CATALOG,
  ...DEPRECATED_ACTION_CATALOG,
  ...Object.entries(LEGACY_ACTION_HANDLERS)
    .filter(([action]) => ![
      ...PILOT_ACTION_CATALOG,
      ...MESSAGE_ACTION_CATALOG,
      ...DEPRECATED_ACTION_CATALOG,
    ].some((entry) => entry.action === action))
    .map(([action, execute]) => ({
      action,
      description: ACTION_HINTS[action]?.description ?? action,
      paramsHint: ACTION_HINTS[action]?.paramsHint ?? "见 protocol Actions",
      execute,
    })),
] as const;

const ACTION_CATALOG_MAP = new Map(
  ACTION_CATALOG.map((entry) => [entry.action, entry]),
);

const PILOT_ACTION_MAP = new Map(
  PILOT_ACTION_CATALOG.map((entry) => [entry.action, entry]),
);

export function getActionCatalogEntry(
  action: string,
): ActionCatalogEntry | null {
  return ACTION_CATALOG_MAP.get(action) ?? null;
}

export function getPilotActionCatalogEntry(
  action: string,
): ActionCatalogEntry | null {
  return PILOT_ACTION_MAP.get(action) ?? null;
}