import type { Client } from "@icqqjs/icqq";
import type { DaemonContext } from "../daemon-context.js";
import type { ActionCatalogEntry } from "../action-types.js";
import { Actions } from "../protocol.js";
import { resolveSendable } from "@/lib/parse-message.js";
import fs from "node:fs/promises";
import {
  gid,
  uid,
  msgid,
  requireString,
  safeFilePath,
  optionalString,
} from "./params.js";
import {
  normalizeSystemMessage,
  normalizeGfsDirEntry,
  resolveGroupReactionTarget,
} from "./helpers.js";

type GfsInstance = ReturnType<Client["acquireGfs"]>;
type GfsForwardPayload = Parameters<GfsInstance["forward"]>[0];
type ForwardMessagesInput = Parameters<Client["makeForwardMsg"]>[0];
type FriendImageElement = Parameters<ReturnType<Client["pickFriend"]>["getPicUrl"]>[0];
type FriendPttElement = Parameters<ReturnType<Client["pickFriend"]>["getPttUrl"]>[0];

type ActionHandler = (
  client: Client,
  params: Record<string, unknown>,
  ctx: DaemonContext,
) => Promise<unknown>;


const ACTION_HINTS: Record<string, { description: string; paramsHint?: string }> = {
  "ping": {
    "description": "心跳检测",
    "paramsHint": "无"
  },
  "logout": {
    "description": "登出并停止守护进程",
    "paramsHint": "keep_token?: boolean"
  },
  "list_friends": {
    "description": "获取好友列表",
    "paramsHint": "无"
  },
  "list_groups": {
    "description": "获取群列表",
    "paramsHint": "无"
  },
  "list_group_members": {
    "description": "获取群成员列表",
    "paramsHint": "group_id"
  },
  "list_blacklist": {
    "description": "获取黑名单列表",
    "paramsHint": "无"
  },
  "list_friend_classes": {
    "description": "获取好友分组列表",
    "paramsHint": "无"
  },
  "get_friend_info": {
    "description": "查看好友资料",
    "paramsHint": "user_id"
  },
  "get_group_info": {
    "description": "查看群信息",
    "paramsHint": "group_id"
  },
  "get_group_member_info": {
    "description": "查看群成员资料",
    "paramsHint": "group_id, user_id"
  },
  "get_stranger_info": {
    "description": "查看陌生人资料",
    "paramsHint": "user_id"
  },
  "list_strangers": {
    "description": "获取陌生人列表",
    "paramsHint": "无"
  },
  "get_profile": {
    "description": "获取详细资料卡",
    "paramsHint": "user_id 或 uid（string）"
  },
  "get_status": {
    "description": "获取当前在线状态",
    "paramsHint": "无"
  },
  "get_online_status": {
    "description": "向服务器查询在线状态",
    "paramsHint": "无"
  },
  "get_self_profile": {
    "description": "获取自身详细资料",
    "paramsHint": "无"
  },
  "send_private_msg": {
    "description": "发送私聊消息",
    "paramsHint": "user_id, message（string | MessageElem[]）"
  },
  "send_group_msg": {
    "description": "发送群消息",
    "paramsHint": "group_id, message（string | MessageElem[]）, anonymous?"
  },
  "send_temp_msg": {
    "description": "发送群临时会话消息",
    "paramsHint": "group_id, user_id, message（string | MessageElem[]）"
  },
  "recall_msg": {
    "description": "撤回消息",
    "paramsHint": "message_id"
  },
  "get_msg": {
    "description": "获取单条消息",
    "paramsHint": "message_id"
  },
  "history_private": {
    "description": "获取私聊历史",
    "paramsHint": "user_id, count?, time?"
  },
  "history_group": {
    "description": "获取群聊历史",
    "paramsHint": "group_id, count?, seq?"
  },
  "history_by_msg_id": {
    "description": "以 message_id 为锚点拉历史",
    "paramsHint": "message_id, count?"
  },
  "send_long_msg": {
    "description": "发送长消息（long_msg）",
    "paramsHint": "user_id 或 group_id, message（string | MessageElem[]）"
  },
  "mark_read": {
    "description": "标记消息已读",
    "paramsHint": "message_id"
  },
  "delete_msg": {
    "description": "删除消息",
    "paramsHint": "message_id"
  },
  "set_nickname": {
    "description": "修改昵称",
    "paramsHint": "nickname"
  },
  "set_gender": {
    "description": "修改性别",
    "paramsHint": "gender (0/1/2)"
  },
  "set_birthday": {
    "description": "修改生日",
    "paramsHint": "birthday"
  },
  "set_signature": {
    "description": "修改签名",
    "paramsHint": "signature"
  },
  "set_description": {
    "description": "修改个人说明",
    "paramsHint": "description"
  },
  "set_avatar": {
    "description": "修改头像",
    "paramsHint": "file"
  },
  "set_online_status": {
    "description": "修改在线状态",
    "paramsHint": "status"
  },
  "set_group_name": {
    "description": "修改群名",
    "paramsHint": "group_id, name"
  },
  "set_group_avatar": {
    "description": "修改群头像",
    "paramsHint": "group_id, file"
  },
  "set_group_card": {
    "description": "修改群名片",
    "paramsHint": "group_id, user_id, card"
  },
  "set_group_title": {
    "description": "设置群头衔",
    "paramsHint": "group_id, user_id, title, duration?"
  },
  "set_group_admin": {
    "description": "设置/取消管理员",
    "paramsHint": "group_id, user_id, enable?"
  },
  "set_group_remark": {
    "description": "修改群备注",
    "paramsHint": "group_id, remark"
  },
  "group_mute": {
    "description": "禁言成员",
    "paramsHint": "group_id, user_id, duration?"
  },
  "group_mute_all": {
    "description": "全体禁言",
    "paramsHint": "group_id, enable?"
  },
  "group_kick": {
    "description": "踢出成员",
    "paramsHint": "group_id, user_id, block?, message?"
  },
  "group_quit": {
    "description": "退出群聊",
    "paramsHint": "group_id"
  },
  "group_invite": {
    "description": "邀请好友入群",
    "paramsHint": "group_id, user_id"
  },
  "group_poke": {
    "description": "戳一戳群成员",
    "paramsHint": "group_id, user_id"
  },
  "group_announce": {
    "description": "发送群公告",
    "paramsHint": "group_id, content"
  },
  "group_sign": {
    "description": "群签到",
    "paramsHint": "group_id"
  },
  "group_essence_add": {
    "description": "添加精华消息",
    "paramsHint": "message_id"
  },
  "group_essence_remove": {
    "description": "移除精华消息",
    "paramsHint": "message_id"
  },
  "group_allow_anony": {
    "description": "开关匿名聊天",
    "paramsHint": "group_id, enable?"
  },
  "group_muted_list": {
    "description": "获取被禁言成员列表",
    "paramsHint": "group_id"
  },
  "group_at_all_remain": {
    "description": "查询 @全体 剩余次数",
    "paramsHint": "group_id"
  },
  "friend_poke": {
    "description": "戳一戳好友",
    "paramsHint": "user_id"
  },
  "friend_like": {
    "description": "给好友点赞",
    "paramsHint": "user_id, times?"
  },
  "friend_delete": {
    "description": "删除好友",
    "paramsHint": "user_id, block?"
  },
  "friend_remark": {
    "description": "设置好友备注",
    "paramsHint": "user_id, remark"
  },
  "friend_class": {
    "description": "移动好友到分组",
    "paramsHint": "user_id, class_id"
  },
  "get_system_msg": {
    "description": "获取待处理的好友/群请求",
    "paramsHint": "无"
  },
  "handle_friend_request": {
    "description": "处理好友请求",
    "paramsHint": "flag, approve?, remark?, block?"
  },
  "handle_group_request": {
    "description": "处理群请求",
    "paramsHint": "flag, approve?, reason?, block?"
  },
  "add_friend_class": {
    "description": "新建好友分组",
    "paramsHint": "name"
  },
  "delete_friend_class": {
    "description": "删除好友分组",
    "paramsHint": "id"
  },
  "rename_friend_class": {
    "description": "重命名好友分组",
    "paramsHint": "id, name"
  },
  "gfs_list": {
    "description": "列出群文件",
    "paramsHint": "group_id, pid?"
  },
  "gfs_info": {
    "description": "群文件系统信息",
    "paramsHint": "group_id"
  },
  "gfs_mkdir": {
    "description": "创建群文件夹",
    "paramsHint": "group_id, name"
  },
  "gfs_delete": {
    "description": "删除群文件/文件夹",
    "paramsHint": "group_id, fid"
  },
  "gfs_rename": {
    "description": "重命名群文件",
    "paramsHint": "group_id, fid, name"
  },
  "gfs_stat": {
    "description": "查看群文件详情",
    "paramsHint": "group_id, fid"
  },
  "gfs_move": {
    "description": "移动群文件",
    "paramsHint": "group_id, fid, pid"
  },
  "gfs_download": {
    "description": "获取群文件下载链接",
    "paramsHint": "group_id, fid"
  },
  "gfs_upload": {
    "description": "上传群文件",
    "paramsHint": "group_id, file, pid?, name?"
  },
  "image_ocr": {
    "description": "图片 OCR",
    "paramsHint": "file"
  },
  "reload_friend_list": {
    "description": "重载好友列表",
    "paramsHint": "无"
  },
  "reload_group_list": {
    "description": "重载群列表",
    "paramsHint": "无"
  },
  "clean_cache": {
    "description": "清理缓存",
    "paramsHint": "无"
  },
  "get_group_share": {
    "description": "获取群分享 JSON",
    "paramsHint": "group_id"
  },
  "group_set_join_type": {
    "description": "设置入群验证方式",
    "paramsHint": "group_id, type, question?, answer?"
  },
  "group_set_rate_limit": {
    "description": "设置群发消息频率限制",
    "paramsHint": "group_id, times"
  },
  "group_mute_anony": {
    "description": "禁言匿名成员",
    "paramsHint": "group_id, flag, duration?"
  },
  "group_anon_info": {
    "description": "获取匿名信息",
    "paramsHint": "group_id"
  },
  "add_friend": {
    "description": "申请添加好友",
    "paramsHint": "group_id, user_id, comment?"
  },
  "get_roaming_stamp": {
    "description": "获取漫游表情列表",
    "paramsHint": "无"
  },
  "delete_stamp": {
    "description": "删除漫游表情",
    "paramsHint": "id"
  },
  "friend_recall_file": {
    "description": "撤回好友文件",
    "paramsHint": "user_id, fid"
  },
  "friend_forward_file": {
    "description": "转发私聊文件到群/临时",
    "paramsHint": "user_id, fid, group_id?"
  },
  "search_same_group": {
    "description": "查找与用户的共群",
    "paramsHint": "user_id"
  },
  "send_contact_share": {
    "description": "发送链接分享卡片",
    "paramsHint": "user_id 或 group_id, url, title, image?, content?, audio?"
  },
  "group_set_reaction": {
    "description": "给群消息添加表态",
    "paramsHint": "message_id, id"
  },
  "group_del_reaction": {
    "description": "取消群消息表态",
    "paramsHint": "message_id, id"
  },
  "get_forward_msg": {
    "description": "获取合并转发内容",
    "paramsHint": "resid"
  },
  "make_forward_msg": {
    "description": "构造合并转发消息",
    "paramsHint": "messages, dm?"
  },
  "guild_list": {
    "description": "获取频道列表",
    "paramsHint": "无"
  },
  "guild_info": {
    "description": "获取频道信息",
    "paramsHint": "guild_id"
  },
  "guild_channels": {
    "description": "获取频道子频道列表",
    "paramsHint": "guild_id"
  },
  "get_channel_info": {
    "description": "获取子频道详情",
    "paramsHint": "guild_id, channel_id"
  },
  "guild_members": {
    "description": "获取频道成员列表",
    "paramsHint": "guild_id"
  },
  "guild_send_msg": {
    "description": "发送频道消息",
    "paramsHint": "guild_id, channel_id, message"
  },
  "guild_recall_msg": {
    "description": "撤回频道消息",
    "paramsHint": "guild_id, channel_id, seq"
  },
  "get_file_info": {
    "description": "获取文件信息",
    "paramsHint": "user_id, fid"
  },
  "get_file_url": {
    "description": "获取文件下载链接",
    "paramsHint": "user_id, fid"
  },
  "get_avatar_url": {
    "description": "获取用户头像 URL",
    "paramsHint": "user_id, size?"
  },
  "get_group_avatar_url": {
    "description": "获取群头像 URL",
    "paramsHint": "group_id, size?, history?"
  },
  "set_screen_member_msg": {
    "description": "屏蔽/取消屏蔽成员消息",
    "paramsHint": "group_id, user_id, is_screen?"
  },
  "gfs_forward": {
    "description": "转发群文件到另一群",
    "paramsHint": "group_id, target_group_id, fid, pid?, name?"
  },
  "gfs_forward_offline": {
    "description": "转发群文件到离线文件",
    "paramsHint": "group_id, fid, name?"
  },
  "reload_blacklist": {
    "description": "重载黑名单",
    "paramsHint": "无"
  },
  "reload_stranger_list": {
    "description": "重载陌生人列表",
    "paramsHint": "无"
  },
  "get_status_info": {
    "description": "查询在线状态",
    "paramsHint": "uin?"
  },
  "get_client_key": {
    "description": "获取客户端密钥",
    "paramsHint": "无"
  },
  "get_pskey": {
    "description": "获取 PSKey",
    "paramsHint": "domain"
  },
  "uid2uin": {
    "description": "UID 转 UIN",
    "paramsHint": "uid, group_id?"
  },
  "uid2uins": {
    "description": "批量 UID 转 UIN",
    "paramsHint": "uids (string[]), group_id?"
  },
  "uin2uid": {
    "description": "UIN 转 UID",
    "paramsHint": "uin, group_id?"
  },
  "uin2uids": {
    "description": "批量 UIN 转 UID",
    "paramsHint": "uins (number[]), group_id?"
  },
  "get_cookies": {
    "description": "获取 Cookies",
    "paramsHint": "domain?"
  },
  "get_csrf_token": {
    "description": "获取 CSRF Token (bkn)",
    "paramsHint": "无"
  },
  "refresh_nt_pic_rkey": {
    "description": "刷新 QQNT 图片 rkey",
    "paramsHint": "force?"
  },
  "send_discuss_msg": {
    "description": "发送讨论组消息",
    "paramsHint": "discuss_id, message"
  },
  "get_video_url": {
    "description": "获取视频下载链接",
    "paramsHint": "fid, md5"
  },
  "get_add_friend_setting": {
    "description": "获取好友添加设置",
    "paramsHint": "user_id"
  },
  "reload_guilds": {
    "description": "重载频道列表",
    "paramsHint": "无"
  },
  "get_forum_url": {
    "description": "获取帖子 URL",
    "paramsHint": "guild_id, channel_id, forum_id"
  },
  "guild_channel_share": {
    "description": "发送频道分享链接",
    "paramsHint": "guild_id, channel_id, url, title, ..."
  },
  "get_pic_url": {
    "description": "获取图片 URL",
    "paramsHint": "elem, group_id? | user_id?"
  },
  "get_ptt_url": {
    "description": "获取语音 URL",
    "paramsHint": "elem, group_id? | user_id?"
  },
  "subscribe": {
    "description": "（已废弃）连接后自动推送事件",
    "paramsHint": "无"
  },
  "unsubscribe": {
    "description": "（已废弃）断开连接自动停止",
    "paramsHint": "无"
  },
  "send_private_file": {
    "description": "发送私聊文件",
    "paramsHint": "user_id, file"
  },
  "send_group_file": {
    "description": "发送群文件",
    "paramsHint": "group_id, file, pid?, name?"
  },
  "set_webhook": {
    "description": "设置 Webhook 地址",
    "paramsHint": "url"
  },
  "get_webhook": {
    "description": "查询 Webhook 配置",
    "paramsHint": "无"
  },
  "set_notify": {
    "description": "开启/关闭系统通知",
    "paramsHint": "enabled?"
  },
  "get_notify": {
    "description": "查询系统通知状态",
    "paramsHint": "无"
  }
};

const HANDLERS: Record<string, ActionHandler> = {
  // ── 基础 ──
  [Actions.PING]: async (_client, _params, _ctx) => ({ pong: true, time: Date.now() }),

  [Actions.LOGOUT]: async (client, params, _ctx) => {
    const keepToken = params.keep_token === true;
    // keepAlive=true → 仅本地断开，不向服务器发下线包，token 保留
    // keepAlive=false → 完整登出，token 作废
    await client.logout(keepToken);
    // 标记已完成 logout，避免 SIGTERM handler 重复调用
    (process as NodeJS.Process & { _icqqLogoutDone?: boolean })._icqqLogoutDone = true;
    // 触发 entry.ts 的 shutdown 流程（跳过 logout 步骤）
    setImmediate(() => process.kill(process.pid, "SIGTERM"));
    return { ok: true };
  },

  [Actions.GET_STATUS]: async (client, _params, _ctx) => ({
    uin: client.uin,
    nickname: client.nickname,
    online: client.isOnline(),
    sex: client.sex,
    age: client.age,
    friendCount: client.fl.size,
    groupCount: client.gl.size,
  }),

  [Actions.GET_SELF_PROFILE]: async (client, _params, _ctx) => ({
    uin: client.uin,
    nickname: client.nickname,
    sex: client.sex,
    age: client.age,
    friendCount: client.fl.size,
    groupCount: client.gl.size,
    blacklistCount: client.blacklist.size,
  }),

  // ── 守护进程配置（需 DaemonContext） ──
  [Actions.SET_WEBHOOK]: async (_client, params, ctx) => {
    const url = (params.url as string) ?? "";
    const err = await ctx.setWebhookUrl(url);
    if (err) throw new Error(err);
    return { webhookUrl: url || null };
  },

  [Actions.GET_WEBHOOK]: async (_client, _params, ctx) => {
    const url = ctx.getWebhookUrl();
    return { webhookUrl: url || null };
  },

  [Actions.SET_NOTIFY]: async (_client, params, ctx) => {
    const enabled = params.enabled !== false;
    await ctx.setNotifyEnabled(enabled);
    return { notifyEnabled: enabled };
  },

  [Actions.GET_NOTIFY]: async (_client, _params, ctx) => {
    return { notifyEnabled: ctx.notifications.isEnabled() };
  },

  // ── 列表 ──
  [Actions.LIST_FRIENDS]: async (client, _params, _ctx) =>
    [...client.fl.values()].map((f) => ({
      user_id: f.user_id,
      nickname: f.nickname,
      remark: f.remark,
      sex: f.sex,
      class_id: f.class_id,
    })),

  [Actions.LIST_GROUPS]: async (client, _params, _ctx) =>
    [...client.gl.values()].map((g) => ({
      group_id: g.group_id,
      group_name: g.group_name,
      member_count: g.member_count,
      max_member_count: g.max_member_count,
      owner_id: g.owner_id,
    })),

  [Actions.LIST_GROUP_MEMBERS]: async (client, params, _ctx) => {
    const g = gid(params);
    const members = await client.pickGroup(g).getMemberMap();
    return [...members.values()].map((m) => ({
      user_id: m.user_id,
      nickname: m.nickname,
      card: m.card,
      role: m.role,
      title: m.title,
      join_time: m.join_time,
      last_sent_time: m.last_sent_time,
      level: m.level,
      shutup_time: m.shutup_time,
    }));
  },

  [Actions.LIST_BLACKLIST]: async (client, _params, _ctx) =>
    [...client.blacklist].map((uin) => ({ user_id: uin })),

  [Actions.LIST_FRIEND_CLASSES]: async (client, _params, _ctx) =>
    [...client.classes.entries()].map(([id, name]) => ({ id, name })),

  // ── 查看信息 ──
  [Actions.GET_FRIEND_INFO]: async (client, params, _ctx) => {
    const u = uid(params);
    const info = client.fl.get(u);
    if (info) return info;
    return await client.pickUser(u).getSimpleInfo();
  },

  [Actions.GET_GROUP_INFO]: async (client, params, _ctx) => {
    return await client.getGroupInfo(gid(params), true);
  },

  [Actions.GET_GROUP_MEMBER_INFO]: async (client, params, _ctx) => {
    return await client.getGroupMemberInfo(gid(params), uid(params), true);
  },

  [Actions.GET_STRANGER_INFO]: async (client, params, _ctx) => {
    return await client.getStrangerInfo(uid(params));
  },

  [Actions.LIST_STRANGERS]: async (client, _params, _ctx) => {
    return [...client.sl.values()].map((s) => ({
      user_id: s.user_id,
      nickname: s.nickname,
      sex: s.sex,
      age: s.age,
    }));
  },

  [Actions.GET_PROFILE]: async (client, params, _ctx) => {
    const target = params.user_id ?? params.uid;
    if (target === undefined || target === null || target === "") {
      throw new Error("缺少 user_id 或 uid");
    }
    if (typeof target === "number" || (typeof target === "string" && /^\d+$/.test(target))) {
      return await client.getProfile(Number(target));
    }
    if (typeof target === "string") {
      return await client.getProfile(target);
    }
    throw new Error("无效的 user_id / uid");
  },

  [Actions.GET_ONLINE_STATUS]: async (client, _params, _ctx) => {
    return { status: await client.getOnlineStatus() };
  },

  [Actions.GET_CHANNEL_INFO]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const info = client.getChannelInfo(guildId, channelId);
    if (!info) throw new Error(`子频道 ${channelId} 不存在`);
    return info;
  },

  [Actions.FRIEND_FORWARD_FILE]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const groupId = params.group_id ? gid(params) : 0;
    const result = await client.pickFriend(uid(params)).forwardFile(fid, groupId);
    return { fid: result };
  },

  [Actions.SEARCH_SAME_GROUP]: async (client, params, _ctx) => {
    return await client.pickFriend(uid(params)).searchSameGroup();
  },

  [Actions.SEND_CONTACT_SHARE]: async (client, params, _ctx) => {
    const url = requireString(params, "url");
    const title = requireString(params, "title");
    const content = {
      url,
      title,
      image: optionalString(params, "image"),
      content: optionalString(params, "content"),
      audio: optionalString(params, "audio"),
    };
    const contact = params.group_id ?? params.gid
      ? client.pickGroup(gid(params))
      : client.pickFriend(uid(params));
    await contact.share(content);
    return { ok: true };
  },

  [Actions.GET_COOKIES]: async (client, params, _ctx) => {
    const domain = optionalString(params, "domain");
    return { cookies: client.getCookies(domain as never) };
  },

  [Actions.GET_CSRF_TOKEN]: async (client, _params, _ctx) => {
    return { token: client.getCsrfToken() };
  },

  [Actions.REFRESH_NT_PIC_RKEY]: async (client, params, _ctx) => {
    const force = params.force === true;
    return await client.refreshNTPicRkey(force);
  },

  [Actions.SEND_DISCUSS_MSG]: async (client, params, _ctx) => {
    const discussId = Number(params.discuss_id);
    if (!Number.isFinite(discussId) || discussId <= 0) {
      throw new Error("无效的 discuss_id");
    }
    const message = resolveSendable(params, "message");
    return await client.sendDiscussMsg(discussId, message);
  },

  [Actions.UID2UINS]: async (client, params, _ctx) => {
    const uids = params.uids;
    if (!Array.isArray(uids) || uids.length === 0) {
      throw new Error("缺少参数 uids（string[]）");
    }
    const groupId = params.group_id ? Number(params.group_id) : undefined;
    const uins = await client.uid2uins(uids as string[], groupId);
    return { uins };
  },

  [Actions.UIN2UIDS]: async (client, params, _ctx) => {
    const uins = params.uins;
    if (!Array.isArray(uins) || uins.length === 0) {
      throw new Error("缺少参数 uins（number[]）");
    }
    const groupId = params.group_id ? Number(params.group_id) : undefined;
    const uids = await client.uin2uids(uins as number[], groupId);
    return { uids };
  },

  // ── 消息发送 ──
  // ── 消息操作 ──
  // ── 个人设置 ──
  [Actions.SET_NICKNAME]: async (client, params, _ctx) => {
    return await client.setNickname(requireString(params, "nickname"));
  },

  [Actions.SET_GENDER]: async (client, params, _ctx) => {
    const g = Number(params.gender);
    if (![0, 1, 2].includes(g)) throw new Error("gender 须为 0|1|2");
    return await client.setGender(g as 0 | 1 | 2);
  },

  [Actions.SET_BIRTHDAY]: async (client, params, _ctx) => {
    return await client.setBirthday(requireString(params, "birthday"));
  },

  [Actions.SET_SIGNATURE]: async (client, params, _ctx) => {
    return await client.setSignature(requireString(params, "signature"));
  },

  [Actions.SET_DESCRIPTION]: async (client, params, _ctx) => {
    return await client.setDescription(requireString(params, "description"));
  },

  [Actions.SET_AVATAR]: async (client, params, _ctx) => {
    const filePath = safeFilePath(params);
    const buf = await fs.readFile(filePath);
    await client.setAvatar(buf);
    return { ok: true };
  },

  [Actions.SET_ONLINE_STATUS]: async (client, params, _ctx) => {
    return await client.setOnlineStatus(Number(params.status));
  },

  // ── 群设置 ──
  [Actions.SET_GROUP_NAME]: async (client, params, _ctx) => {
    return await client.setGroupName(gid(params), requireString(params, "name"));
  },

  [Actions.SET_GROUP_AVATAR]: async (client, params, _ctx) => {
    const filePath = safeFilePath(params);
    const buf = await fs.readFile(filePath);
    await client.setGroupPortrait(gid(params), buf);
    return { ok: true };
  },

  [Actions.SET_GROUP_CARD]: async (client, params, _ctx) => {
    return await client.setGroupCard(gid(params), uid(params), requireString(params, "card"));
  },

  [Actions.SET_GROUP_TITLE]: async (client, params, _ctx) => {
    const duration = params.duration ? Number(params.duration) : undefined;
    return await client.setGroupSpecialTitle(
      gid(params),
      uid(params),
      requireString(params, "title"),
      duration,
    );
  },

  [Actions.SET_GROUP_ADMIN]: async (client, params, _ctx) => {
    const enable = params.enable !== false;
    return await client.setGroupAdmin(gid(params), uid(params), enable);
  },

  [Actions.SET_GROUP_REMARK]: async (client, params, _ctx) => {
    await client.pickGroup(gid(params)).setRemark(requireString(params, "remark"));
    return { ok: true };
  },

  // ── 群管理 ──
  [Actions.GROUP_MUTE]: async (client, params, _ctx) => {
    const duration = params.duration !== undefined ? Number(params.duration) : 600;
    return await client.setGroupBan(gid(params), uid(params), duration);
  },

  [Actions.GROUP_MUTE_ALL]: async (client, params, _ctx) => {
    const enable = params.enable !== false;
    return await client.setGroupWholeBan(gid(params), enable);
  },

  [Actions.GROUP_KICK]: async (client, params, _ctx) => {
    const block = params.block === true;
    const msg = optionalString(params, "message") ?? "";
    return await client.setGroupKick(gid(params), uid(params), block, msg);
  },

  [Actions.GROUP_QUIT]: async (client, params, _ctx) => {
    return await client.pickGroup(gid(params)).quit();
  },

  [Actions.GROUP_INVITE]: async (client, params, _ctx) => {
    return await client.inviteFriend(gid(params), uid(params));
  },

  [Actions.GROUP_POKE]: async (client, params, _ctx) => {
    return await client.sendGroupPoke(gid(params), uid(params));
  },

  [Actions.GROUP_ANNOUNCE]: async (client, params, _ctx) => {
    return await client.sendGroupNotice(gid(params), requireString(params, "content"));
  },

  [Actions.GROUP_SIGN]: async (client, params, _ctx) => {
    return await client.sendGroupSign(gid(params));
  },

  [Actions.GROUP_ESSENCE_ADD]: async (client, params, _ctx) => {
    return await client.setEssenceMessage(msgid(params));
  },

  [Actions.GROUP_ESSENCE_REMOVE]: async (client, params, _ctx) => {
    return await client.removeEssenceMessage(msgid(params));
  },

  [Actions.GROUP_ALLOW_ANONY]: async (client, params, _ctx) => {
    const enable = params.enable !== false;
    return await client.setGroupAnonymous(gid(params), enable);
  },

  [Actions.GROUP_MUTED_LIST]: async (client, params, _ctx) => {
    return await client.pickGroup(gid(params)).getMuteMemberList();
  },

  [Actions.GROUP_AT_ALL_REMAIN]: async (client, params, _ctx) => {
    return await client.pickGroup(gid(params)).getAtAllRemainder();
  },

  // ── 好友操作 ──
  [Actions.FRIEND_POKE]: async (client, params, _ctx) => {
    return await client.pickFriend(uid(params)).poke();
  },

  [Actions.FRIEND_LIKE]: async (client, params, _ctx) => {
    const times = params.times ? Number(params.times) : 1;
    return await client.sendLike(uid(params), times);
  },

  [Actions.FRIEND_DELETE]: async (client, params, _ctx) => {
    const block = params.block === true;
    return await client.deleteFriend(uid(params), block);
  },

  [Actions.FRIEND_REMARK]: async (client, params, _ctx) => {
    await client.pickFriend(uid(params)).setRemark(requireString(params, "remark"));
    return { ok: true };
  },

  [Actions.FRIEND_CLASS]: async (client, params, _ctx) => {
    const classId = Number(params.class_id);
    await client.pickFriend(uid(params)).setClass(classId);
    return { ok: true };
  },

  // ── 系统消息/请求 ──
  [Actions.GET_SYSTEM_MSG]: async (client, _params, _ctx) => {
    const msgs = await client.getSystemMsg();
    // getSystemMsg() may return an array or { friend: [], group: [] }
    let raw: unknown[];
    if (Array.isArray(msgs)) {
      raw = msgs;
    } else if (msgs && typeof msgs === "object") {
      const obj = msgs as Record<string, unknown>;
      const friend = Array.isArray(obj.friend) ? obj.friend : [];
      const group = Array.isArray(obj.group) ? obj.group : [];
      raw = [...friend, ...group];
    } else {
      raw = [];
    }
    const all = raw.map(normalizeSystemMessage);
    return {
      friendRequests: all.filter((m) => m.type === "friend" || (!m.group_id && m.user_id)),
      groupRequests: all.filter((m) => m.type === "group" || m.group_id),
    };
  },

  [Actions.HANDLE_FRIEND_REQUEST]: async (client, params, _ctx) => {
    const flag = requireString(params, "flag");
    const approve = params.approve !== false;
    const remark = optionalString(params, "remark") ?? "";
    const block = params.block === true;
    return await client.setFriendAddRequest(flag, approve, remark, block);
  },

  [Actions.HANDLE_GROUP_REQUEST]: async (client, params, _ctx) => {
    const flag = requireString(params, "flag");
    const approve = params.approve !== false;
    const reason = optionalString(params, "reason") ?? "";
    const block = params.block === true;
    return await client.setGroupAddRequest(flag, approve, reason, block);
  },

  // ── 好友分组 ──
  [Actions.ADD_FRIEND_CLASS]: async (client, params, _ctx) => {
    await client.addClass(requireString(params, "name"));
    return { ok: true };
  },

  [Actions.DELETE_FRIEND_CLASS]: async (client, params, _ctx) => {
    await client.deleteClass(Number(params.id));
    return { ok: true };
  },

  [Actions.RENAME_FRIEND_CLASS]: async (client, params, _ctx) => {
    await client.renameClass(Number(params.id), requireString(params, "name"));
    return { ok: true };
  },

  // ── 群文件系统 ──
  [Actions.GFS_LIST]: async (client, params, _ctx) => {
    const g = gid(params);
    const pid = optionalString(params, "pid") ?? "/";
    const gfs = client.acquireGfs(g);
    const files = await gfs.dir(pid);
    return files.map(normalizeGfsDirEntry);
  },

  [Actions.GFS_INFO]: async (client, params, _ctx) => {
    const gfs = client.acquireGfs(gid(params));
    return await gfs.df();
  },

  [Actions.GFS_MKDIR]: async (client, params, _ctx) => {
    const gfs = client.acquireGfs(gid(params));
    return await gfs.mkdir(requireString(params, "name"));
  },

  [Actions.GFS_DELETE]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const gfs = client.acquireGfs(gid(params));
    await gfs.rm(fid);
    return { ok: true };
  },

  [Actions.GFS_RENAME]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const name = requireString(params, "name");
    const gfs = client.acquireGfs(gid(params));
    await gfs.rename(fid, name);
    return { ok: true };
  },

  [Actions.GFS_STAT]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const gfs = client.acquireGfs(gid(params));
    return await gfs.stat(fid);
  },

  [Actions.GFS_MOVE]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const pid = requireString(params, "pid");
    const gfs = client.acquireGfs(gid(params));
    await gfs.mv(fid, pid);
    return { ok: true };
  },

  [Actions.GFS_DOWNLOAD]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const gfs = client.acquireGfs(gid(params));
    return await gfs.download(fid);
  },

  // ── 其他 ──
  [Actions.IMAGE_OCR]: async (client, params, _ctx) => {
    const filePath = safeFilePath(params);
    const buf = await fs.readFile(filePath);
    return await client.imageOcr(buf);
  },

  [Actions.RELOAD_FRIEND_LIST]: async (client, _params, _ctx) => {
    await client.reloadFriendList();
    return { ok: true, friendCount: client.fl.size };
  },

  [Actions.RELOAD_GROUP_LIST]: async (client, _params, _ctx) => {
    await client.reloadGroupList();
    return { ok: true, groupCount: client.gl.size };
  },

  [Actions.CLEAN_CACHE]: async (client, _params, _ctx) => {
    client.cleanCache();
    return { ok: true };
  },

  [Actions.GET_GROUP_SHARE]: async (client, params, _ctx) => {
    return await client.getGroupShareJson(gid(params));
  },

  [Actions.GROUP_SET_JOIN_TYPE]: async (client, params, _ctx) => {
    const type = String(params.type);
    const question = optionalString(params, "question");
    const answer = optionalString(params, "answer");
    return await client.pickGroup(gid(params)).setGroupJoinType(type, question, answer);
  },

  [Actions.GROUP_SET_RATE_LIMIT]: async (client, params, _ctx) => {
    const times = Number(params.times);
    return await client.pickGroup(gid(params)).setMessageRateLimit(times);
  },

  [Actions.GROUP_MUTE_ANONY]: async (client, params, _ctx) => {
    const flag = requireString(params, "flag");
    const duration = params.duration !== undefined ? Number(params.duration) : undefined;
    await client.pickGroup(gid(params)).muteAnony(flag, duration);
    return { ok: true };
  },

  [Actions.GROUP_ANON_INFO]: async (client, params, _ctx) => {
    return await client.pickGroup(gid(params)).getAnonyInfo();
  },

  [Actions.ADD_FRIEND]: async (client, params, _ctx) => {
    const g = gid(params);
    const u = uid(params);
    const comment = optionalString(params, "comment") ?? "";
    return await client.addFriend(g, u, comment);
  },

  [Actions.GET_ROAMING_STAMP]: async (client, _params, _ctx) => {
    return await client.getRoamingStamp();
  },

  [Actions.DELETE_STAMP]: async (client, params, _ctx) => {
    const id = Array.isArray(params.id) ? params.id as string[] : requireString(params, "id");
    await client.deleteStamp(id);
    return { ok: true };
  },

  // ── 文件传输 ──
  [Actions.SEND_PRIVATE_FILE]: async (client, params, _ctx) => {
    const filePath = safeFilePath(params);
    const u = uid(params);
    return await client.pickFriend(u).sendFile(filePath);
  },

  [Actions.SEND_GROUP_FILE]: async (client, params, _ctx) => {
    const filePath = safeFilePath(params);
    const g = gid(params);
    const pid = optionalString(params, "pid") ?? "/";
    const name = optionalString(params, "name");
    return await client.pickGroup(g).sendFile(filePath, pid, name);
  },

  [Actions.FRIEND_RECALL_FILE]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    return await client.pickFriend(uid(params)).recallFile(fid);
  },

  [Actions.GFS_UPLOAD]: async (client, params, _ctx) => {
    const filePath = safeFilePath(params);
    const g = gid(params);
    const pid = optionalString(params, "pid") ?? "/";
    const name = optionalString(params, "name");
    const gfs = client.acquireGfs(g);
    return await gfs.upload(filePath, pid, name);
  },

  [Actions.GROUP_SET_REACTION]: async (client, params, _ctx) => {
    const { groupId, seq } = await resolveGroupReactionTarget(params);
    const id = requireString(params, "id");
    return await client.pickGroup(groupId).setReaction(seq, id);
  },

  [Actions.GROUP_DEL_REACTION]: async (client, params, _ctx) => {
    const { groupId, seq } = await resolveGroupReactionTarget(params);
    const id = requireString(params, "id");
    return await client.pickGroup(groupId).delReaction(seq, id);
  },

  [Actions.GET_FORWARD_MSG]: async (client, params, _ctx) => {
    const resid = requireString(params, "resid");
    return await client.getForwardMsg(resid);
  },

  [Actions.MAKE_FORWARD_MSG]: async (client, params, _ctx) => {
    const msgs = params.messages as ForwardMessagesInput;
    const dm = params.dm === true;
    return await client.makeForwardMsg(msgs, dm);
  },

  // ── 频道 ──
  [Actions.GUILD_LIST]: async (client, _params, _ctx) => {
    return client.getGuildList();
  },

  [Actions.GUILD_INFO]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    return client.getGuildInfo(guildId);
  },

  [Actions.GUILD_CHANNELS]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    return client.getChannelList(guildId);
  },

  [Actions.GUILD_MEMBERS]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    return await client.getGuildMemberList(guildId);
  },

  [Actions.GUILD_SEND_MSG]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const message = resolveSendable(params, "message");
    return await client.sendGuildMsg(guildId, channelId, message);
  },

  [Actions.GUILD_RECALL_MSG]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const seq = Number(params.seq);
    const channel = client.pickGuild(guildId).channels.get(channelId);
    if (!channel) throw new Error(`频道 ${channelId} 不存在`);
    return await channel.recallMsg(seq);
  },

  // ── 用户文件操作 ──
  [Actions.GET_FILE_INFO]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    return await client.pickUser(uid(params)).getFileInfo(fid);
  },

  [Actions.GET_FILE_URL]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    return await client.pickUser(uid(params)).getFileUrl(fid);
  },

  [Actions.GET_AVATAR_URL]: async (client, params, _ctx) => {
    const size = (params.size as 0 | 40 | 100 | 140) ?? 0;
    return { url: client.pickUser(uid(params)).getAvatarUrl(size) };
  },

  [Actions.GET_GROUP_AVATAR_URL]: async (client, params, _ctx) => {
    const size = (params.size as 0 | 40 | 100 | 140) ?? 0;
    const history = params.history ? Number(params.history) : undefined;
    return { url: client.pickGroup(gid(params)).getAvatarUrl(size, history) };
  },

  // ── 屏蔽群成员消息 ──
  [Actions.SET_SCREEN_MEMBER_MSG]: async (client, params, _ctx) => {
    const isScreen = params.is_screen !== false;
    return await client.setGroupMemberScreenMsg(gid(params), uid(params), isScreen);
  },

  // ── 群文件转发 ──
  [Actions.GFS_FORWARD]: async (client, params, _ctx) => {
    const sourceGid = gid(params);
    const targetGid = Number(params.target_group_id);
    if (!Number.isFinite(targetGid) || targetGid <= 0) throw new Error("无效的 target_group_id");
    const fid = requireString(params, "fid");
    const pid = optionalString(params, "pid") ?? "/";
    const name = optionalString(params, "name");
    const sourceGfs = client.acquireGfs(sourceGid);
    const stat = await sourceGfs.stat(fid) as GfsForwardPayload;
    const targetGfs = client.acquireGfs(targetGid);
    return await targetGfs.forward(stat, pid, name);
  },

  [Actions.GFS_FORWARD_OFFLINE]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const name = optionalString(params, "name");
    const gfs = client.acquireGfs(gid(params));
    return await gfs.forwardOfflineFile(fid, name);
  },

  // ── 重载列表扩展 ──
  [Actions.RELOAD_BLACKLIST]: async (client, _params, _ctx) => {
    await client.reloadBlackList();
    return { ok: true, blacklistCount: client.blacklist.size };
  },

  [Actions.RELOAD_STRANGER_LIST]: async (client, _params, _ctx) => {
    await client.reloadStrangerList();
    return { ok: true };
  },

  [Actions.RELOAD_GUILDS]: async (client, _params, _ctx) => {
    await client.reloadGuilds();
    return { ok: true };
  },

  // ── 在线状态查询 ──
  [Actions.GET_STATUS_INFO]: async (client, params, _ctx) => {
    const uin = params.uin ? Number(params.uin) : undefined;
    return await client.getStatusInfo(uin);
  },

  // ── 密钥/工具 ──
  [Actions.GET_CLIENT_KEY]: async (client, _params, _ctx) => {
    return await client.getClientKey();
  },

  [Actions.GET_PSKEY]: async (client, params, _ctx) => {
    const domains = params.domain as string | string[];
    return await client.getPSkey(domains);
  },

  [Actions.UID2UIN]: async (client, params, _ctx) => {
    const uid = params.uid as string;
    const groupId = params.group_id ? Number(params.group_id) : undefined;
    return { uin: await client.uid2uin(uid, groupId) };
  },

  [Actions.UIN2UID]: async (client, params, _ctx) => {
    const uin = Number(params.uin);
    const groupId = params.group_id ? Number(params.group_id) : undefined;
    return { uid: await client.uin2uid(uin, groupId) };
  },

  // ── 获取图片/语音 URL ──
  [Actions.GET_PIC_URL]: async (client, params, _ctx) => {
    const elem = params.elem as FriendImageElement;
    const contact = params.group_id
      ? client.pickGroup(gid(params))
      : client.pickFriend(uid(params));
    return { url: await contact.getPicUrl(elem) };
  },

  [Actions.GET_PTT_URL]: async (client, params, _ctx) => {
    const elem = params.elem as FriendPttElement;
    const contact = params.group_id
      ? client.pickGroup(gid(params))
      : client.pickFriend(uid(params));
    return { url: await contact.getPttUrl(elem) };
  },

  // ── 视频/加好友设置 ──
  [Actions.GET_VIDEO_URL]: async (client, params, _ctx) => {
    const fid = requireString(params, "fid");
    const md5 = requireString(params, "md5");
    return { url: await client.getVideoUrl(fid, md5) };
  },

  [Actions.GET_ADD_FRIEND_SETTING]: async (client, params, _ctx) => {
    return { setting: await client.pickUser(uid(params)).getAddFriendSetting() };
  },

  // ── 频道扩展 ──
  [Actions.GET_FORUM_URL]: async (client, params, _ctx) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const forumId = requireString(params, "forum_id");
    return { url: await client.getForumUrl(guildId, channelId, forumId) };
  },

  [Actions.GUILD_CHANNEL_SHARE]: async (client, params, _ctx) => {
    const guildId = params.guild_id as string;
    const channelId = params.channel_id as string;
    const content = {
      url: params.url as string,
      title: params.title as string,
      summary: (params.summary as string) ?? undefined,
      content: (params.content as string) ?? undefined,
      image: (params.image as string) ?? undefined,
    };
    const channel = client.pickGuild(guildId).channels.get(channelId);
    if (!channel) throw new Error(`频道 ${channelId} 不存在`);
    await channel.share(content);
    return { ok: true };
  },
};

const EXCLUDED_FROM_LEGACY = new Set<string>([
  "ping",
  "get_status",
  "get_self_profile",
  "list_friends",
  "send_private_msg",
  "send_group_msg",
  "send_temp_msg",
  "recall_msg",
  "get_msg",
  "history_private",
  "history_group",
  "history_by_msg_id",
  "send_long_msg",
  "mark_read",
  "delete_msg",
  "subscribe",
  "unsubscribe"
]);

export const LEGACY_ACTION_ENTRIES: ActionCatalogEntry[] = Object.entries(HANDLERS)
  .filter(([action]) => !EXCLUDED_FROM_LEGACY.has(action))
  .map(([action, execute]) => {
    const hint = ACTION_HINTS[action];
    return {
      action,
      description: hint?.description ?? action,
      paramsHint: hint?.paramsHint ?? "见 protocol Actions",
      execute,
    };
  });
