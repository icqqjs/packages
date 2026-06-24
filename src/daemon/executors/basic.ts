import type { ActionCatalogEntry } from "../action-types.js";
import { Actions } from "../protocol.js";

export const PILOT_ACTION_ENTRIES: readonly ActionCatalogEntry[] = [
  {
    action: Actions.PING,
    description: "心跳检测",
    paramsHint: "无",
    execute: async (_client, _params, _ctx) => ({
      pong: true,
      time: Date.now(),
    }),
  },
  {
    action: Actions.GET_STATUS,
    description: "获取当前在线状态",
    paramsHint: "无",
    execute: async (client, _params, _ctx) => ({
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
    execute: async (client, _params, _ctx) => ({
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
    execute: async (client, _params, _ctx) =>
      [...client.fl.values()].map((f) => ({
        user_id: f.user_id,
        nickname: f.nickname,
        remark: f.remark,
        sex: f.sex,
        class_id: f.class_id,
      })),
  },
] as const;

export const DEPRECATED_ACTION_ENTRIES: readonly ActionCatalogEntry[] = [
  {
    action: Actions.SUBSCRIBE,
    description: "（已废弃）连接后自动推送事件",
    paramsHint: "无",
    execute: async (_client, _params, _ctx) => ({
      deprecated: true,
      note: "认证连接后自动推送事件，无需 subscribe",
    }),
  },
  {
    action: Actions.UNSUBSCRIBE,
    description: "（已废弃）断开连接自动停止",
    paramsHint: "无",
    execute: async (_client, _params, _ctx) => ({
      deprecated: true,
      note: "认证连接后自动推送事件，无需 subscribe",
    }),
  },
] as const;
