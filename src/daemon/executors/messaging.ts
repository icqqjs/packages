import type { Client, MessageElem } from "@icqqjs/icqq";
import type { ActionCatalogEntry } from "../action-types.js";
import { Actions } from "../protocol.js";
import { resolveSendable, stringifyMessage } from "@/lib/parse-message.js";
import { gid, uid, msgid } from "./params.js";

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

export const MESSAGE_ACTION_ENTRIES: readonly ActionCatalogEntry[] = [
  {
    action: Actions.SEND_PRIVATE_MSG,
    description: "发送私聊消息",
    paramsHint: "user_id, message（string | MessageElem[]）",
    execute: async (client, params, _ctx) => {
      const message = resolveSendable(params, "message");
      return await client.pickFriend(uid(params)).sendMsg(message);
    },
  },
  {
    action: Actions.SEND_GROUP_MSG,
    description: "发送群消息",
    paramsHint: "group_id, message（string | MessageElem[]）, anonymous?",
    execute: async (client, params, _ctx) => {
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
    execute: async (client, params, _ctx) => {
      const message = resolveSendable(params, "message");
      return await client.sendTempMsg(gid(params), uid(params), message);
    },
  },
  {
    action: Actions.RECALL_MSG,
    description: "撤回消息",
    paramsHint: "message_id",
    execute: async (client, params, _ctx) =>
      await client.deleteMsg(msgid(params)),
  },
  {
    action: Actions.GET_MSG,
    description: "获取单条消息",
    paramsHint: "message_id",
    execute: async (client, params, _ctx) =>
      await client.getMsg(msgid(params)),
  },
  {
    action: Actions.HISTORY_PRIVATE,
    description: "获取私聊历史",
    paramsHint: "user_id, count?, time?",
    execute: async (client, params, _ctx) => {
      const count = params.count ? Number(params.count) : 20;
      const time = params.time ? Number(params.time) : undefined;
      const messages = (await client
        .pickUser(uid(params))
        .getChatHistory(time, count)) as PrivateHistoryMessage[];
      return messages.map((message) => mapPrivateHistoryMessage(message));
    },
  },
  {
    action: Actions.HISTORY_GROUP,
    description: "获取群聊历史",
    paramsHint: "group_id, count?, seq?",
    execute: async (client, params, _ctx) => {
      const count = params.count ? Number(params.count) : 20;
      const seq = params.seq ? Number(params.seq) : undefined;
      const messages = (await client
        .pickGroup(gid(params))
        .getChatHistory(seq, count)) as GroupHistoryMessage[];
      return messages.map((message) => mapGroupHistoryMessage(message));
    },
  },
  {
    action: Actions.HISTORY_BY_MSG_ID,
    description: "以 message_id 为锚点拉历史",
    paramsHint: "message_id, count?",
    execute: async (client, params, _ctx) => {
      const count = params.count ? Number(params.count) : 20;
      const messages = (await client.getChatHistory(
        msgid(params),
        count,
      )) as (PrivateHistoryMessage | GroupHistoryMessage)[];
      return messages.map((message) => mapHistoryByMsgId(message));
    },
  },
  {
    action: Actions.SEND_LONG_MSG,
    description: "发送长消息（long_msg）",
    paramsHint: "user_id 或 group_id, message（string | MessageElem[]）",
    execute: async (client, params, _ctx) => {
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
    execute: async (client, params, _ctx) => {
      await client.reportReaded(msgid(params));
      return { ok: true };
    },
  },
  {
    action: Actions.DELETE_MSG,
    description: "删除消息",
    paramsHint: "message_id",
    execute: async (client, params, _ctx) =>
      await client.deleteMsg(msgid(params)),
  },
] as const;
