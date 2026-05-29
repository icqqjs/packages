import type { Client } from "@icqqjs/icqq";
import { Actions, type IpcRequest, type IpcResponse } from "./protocol.js";
import { tryGetDaemonContext } from "./daemon-context.js";
import { parseMessage, stringifyMessage } from "@/lib/parse-message.js";
import fs from "node:fs/promises";
import path from "node:path";

type Handler = (
  client: Client,
  params: Record<string, unknown>,
) => Promise<unknown>;

/** Extract group_id from params (accepts both group_id and gid) */
function gid(p: Record<string, unknown>): number {
  const v = Number(p.group_id ?? p.gid);
  if (!Number.isFinite(v) || v <= 0) throw new Error("无效的 group_id");
  return v;
}
/** Extract user_id from params (accepts both user_id and uid) */
function uid(p: Record<string, unknown>): number {
  const v = Number(p.user_id ?? p.uid);
  if (!Number.isFinite(v) || v <= 0) throw new Error("无效的 user_id");
  return v;
}
/** Extract message_id from params */
function msgid(p: Record<string, unknown>): string {
  const v = p.message_id ?? p.msgid;
  if (typeof v !== "string" || !v) throw new Error("无效的 message_id");
  return v;
}
/** Validate that a string param is present */
function requireString(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (typeof v !== "string" || !v) throw new Error(`缺少参数: ${key}`);
  return v;
}
/** Validate file path: must be a non-empty string, no null bytes, path traversal, or absolute paths */
function safeFilePath(p: Record<string, unknown>, key = "file"): string {
  const v = requireString(p, key);
  if (v.includes("\0") || v.includes("..")) throw new Error("无效的文件路径");
  if (path.isAbsolute(v)) throw new Error("不允许使用绝对路径");
  return v;
}
/** Extract an optional string param (returns undefined if missing, throws if wrong type) */
function optionalString(p: Record<string, unknown>, key: string): string | undefined {
  const v = p[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`参数 ${key} 类型错误，应为字符串`);
  return v;
}

const handlers: Record<string, Handler> = {
  // ── 基础 ──
  [Actions.PING]: async () => ({ pong: true, time: Date.now() }),

  [Actions.LOGOUT]: async (client, params) => {
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

  [Actions.GET_STATUS]: async (client) => ({
    uin: client.uin,
    nickname: client.nickname,
    online: client.isOnline(),
    sex: client.sex,
    age: client.age,
    friendCount: client.fl.size,
    groupCount: client.gl.size,
  }),

  [Actions.GET_SELF_PROFILE]: async (client) => ({
    uin: client.uin,
    nickname: client.nickname,
    sex: client.sex,
    age: client.age,
    friendCount: client.fl.size,
    groupCount: client.gl.size,
    blacklistCount: client.blacklist.size,
  }),

  // ── 守护进程配置（需 DaemonContext） ──
  [Actions.SET_WEBHOOK]: async (_client, params) => {
    const ctx = tryGetDaemonContext();
    if (!ctx) throw new Error("守护进程未就绪");
    const url = (params.url as string) ?? "";
    const err = await ctx.setWebhookUrl(url);
    if (err) throw new Error(err);
    return { webhookUrl: url || null };
  },

  [Actions.GET_WEBHOOK]: async () => {
    const ctx = tryGetDaemonContext();
    if (!ctx) throw new Error("守护进程未就绪");
    const url = ctx.getWebhookUrl();
    return { webhookUrl: url || null };
  },

  [Actions.SET_NOTIFY]: async (_client, params) => {
    const ctx = tryGetDaemonContext();
    if (!ctx) throw new Error("守护进程未就绪");
    const enabled = params.enabled !== false;
    await ctx.setNotifyEnabled(enabled);
    return { notifyEnabled: enabled };
  },

  [Actions.GET_NOTIFY]: async () => {
    const ctx = tryGetDaemonContext();
    if (!ctx) throw new Error("守护进程未就绪");
    return { notifyEnabled: ctx.notifications.isEnabled() };
  },

  // ── 列表 ──
  [Actions.LIST_FRIENDS]: async (client) =>
    [...client.fl.values()].map((f) => ({
      user_id: f.user_id,
      nickname: f.nickname,
      remark: f.remark,
      sex: f.sex,
      class_id: f.class_id,
    })),

  [Actions.LIST_GROUPS]: async (client) =>
    [...client.gl.values()].map((g) => ({
      group_id: g.group_id,
      group_name: g.group_name,
      member_count: g.member_count,
      max_member_count: g.max_member_count,
      owner_id: g.owner_id,
    })),

  [Actions.LIST_GROUP_MEMBERS]: async (client, params) => {
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

  [Actions.LIST_BLACKLIST]: async (client) =>
    [...client.blacklist].map((uin) => ({ user_id: uin })),

  [Actions.LIST_FRIEND_CLASSES]: async (client) =>
    [...client.classes.entries()].map(([id, name]) => ({ id, name })),

  // ── 查看信息 ──
  [Actions.GET_FRIEND_INFO]: async (client, params) => {
    const u = uid(params);
    const info = client.fl.get(u);
    if (info) return info;
    return await client.pickUser(u).getSimpleInfo();
  },

  [Actions.GET_GROUP_INFO]: async (client, params) => {
    return await client.getGroupInfo(gid(params), true);
  },

  [Actions.GET_GROUP_MEMBER_INFO]: async (client, params) => {
    return await client.getGroupMemberInfo(gid(params), uid(params), true);
  },

  [Actions.GET_STRANGER_INFO]: async (client, params) => {
    return await client.getStrangerInfo(uid(params));
  },

  // ── 消息发送 ──
  [Actions.SEND_PRIVATE_MSG]: async (client, params) => {
    const message = parseMessage(requireString(params, "message"));
    return await client.pickFriend(uid(params)).sendMsg(message);
  },

  [Actions.SEND_GROUP_MSG]: async (client, params) => {
    const message = parseMessage(requireString(params, "message"));
    return await client.pickGroup(gid(params)).sendMsg(message);
  },

  // ── 消息操作 ──
  [Actions.RECALL_MSG]: async (client, params) => {
    return await client.deleteMsg(msgid(params));
  },

  [Actions.GET_MSG]: async (client, params) => {
    return await client.getMsg(msgid(params));
  },

  [Actions.HISTORY_PRIVATE]: async (client, params) => {
    const count = params.count ? Number(params.count) : 20;
    const time = params.time ? Number(params.time) : undefined;
    const msgs = await client.pickUser(uid(params)).getChatHistory(time, count);
    return msgs.map((m: any) => ({
      message_id: m.message_id,
      user_id: m.user_id,
      from_id: m.from_id,
      to_id: m.to_id,
      nickname: m.sender?.nickname ?? String(m.user_id),
      raw_message: stringifyMessage(m.message),
      time: m.time,
    }));
  },

  [Actions.HISTORY_GROUP]: async (client, params) => {
    const count = params.count ? Number(params.count) : 20;
    const seq = params.seq ? Number(params.seq) : undefined;
    const msgs = await client.pickGroup(gid(params)).getChatHistory(seq, count);
    return msgs.map((m: any) => ({
      message_id: m.message_id,
      user_id: m.user_id,
      group_id: m.group_id,
      nickname: m.sender?.nickname ?? String(m.user_id),
      card: (m.sender as any)?.card ?? "",
      raw_message: stringifyMessage(m.message),
      time: m.time,
    }));
  },

  [Actions.MARK_READ]: async (client, params) => {
    await client.reportReaded(msgid(params));
    return { ok: true };
  },

  [Actions.DELETE_MSG]: async (client, params) => {
    return await client.deleteMsg(msgid(params));
  },

  // ── 个人设置 ──
  [Actions.SET_NICKNAME]: async (client, params) => {
    return await client.setNickname(requireString(params, "nickname"));
  },

  [Actions.SET_GENDER]: async (client, params) => {
    const g = Number(params.gender);
    if (![0, 1, 2].includes(g)) throw new Error("gender 须为 0|1|2");
    return await client.setGender(g as 0 | 1 | 2);
  },

  [Actions.SET_BIRTHDAY]: async (client, params) => {
    return await client.setBirthday(requireString(params, "birthday"));
  },

  [Actions.SET_SIGNATURE]: async (client, params) => {
    return await client.setSignature(requireString(params, "signature"));
  },

  [Actions.SET_DESCRIPTION]: async (client, params) => {
    return await client.setDescription(requireString(params, "description"));
  },

  [Actions.SET_AVATAR]: async (client, params) => {
    const filePath = safeFilePath(params);
    const buf = await fs.readFile(filePath);
    await client.setAvatar(buf);
    return { ok: true };
  },

  [Actions.SET_ONLINE_STATUS]: async (client, params) => {
    return await client.setOnlineStatus(Number(params.status));
  },

  // ── 群设置 ──
  [Actions.SET_GROUP_NAME]: async (client, params) => {
    return await client.setGroupName(gid(params), requireString(params, "name"));
  },

  [Actions.SET_GROUP_AVATAR]: async (client, params) => {
    const filePath = safeFilePath(params);
    const buf = await fs.readFile(filePath);
    await client.setGroupPortrait(gid(params), buf);
    return { ok: true };
  },

  [Actions.SET_GROUP_CARD]: async (client, params) => {
    return await client.setGroupCard(gid(params), uid(params), requireString(params, "card"));
  },

  [Actions.SET_GROUP_TITLE]: async (client, params) => {
    const duration = params.duration ? Number(params.duration) : undefined;
    return await client.setGroupSpecialTitle(
      gid(params),
      uid(params),
      requireString(params, "title"),
      duration,
    );
  },

  [Actions.SET_GROUP_ADMIN]: async (client, params) => {
    const enable = params.enable !== false;
    return await client.setGroupAdmin(gid(params), uid(params), enable);
  },

  [Actions.SET_GROUP_REMARK]: async (client, params) => {
    await client.pickGroup(gid(params)).setRemark(requireString(params, "remark"));
    return { ok: true };
  },

  // ── 群管理 ──
  [Actions.GROUP_MUTE]: async (client, params) => {
    const duration = params.duration !== undefined ? Number(params.duration) : 600;
    return await client.setGroupBan(gid(params), uid(params), duration);
  },

  [Actions.GROUP_MUTE_ALL]: async (client, params) => {
    const enable = params.enable !== false;
    return await client.setGroupWholeBan(gid(params), enable);
  },

  [Actions.GROUP_KICK]: async (client, params) => {
    const block = params.block === true;
    const msg = optionalString(params, "message") ?? "";
    return await client.setGroupKick(gid(params), uid(params), block, msg);
  },

  [Actions.GROUP_QUIT]: async (client, params) => {
    return await client.pickGroup(gid(params)).quit();
  },

  [Actions.GROUP_INVITE]: async (client, params) => {
    return await client.inviteFriend(gid(params), uid(params));
  },

  [Actions.GROUP_POKE]: async (client, params) => {
    return await client.sendGroupPoke(gid(params), uid(params));
  },

  [Actions.GROUP_ANNOUNCE]: async (client, params) => {
    return await client.sendGroupNotice(gid(params), requireString(params, "content"));
  },

  [Actions.GROUP_SIGN]: async (client, params) => {
    return await client.sendGroupSign(gid(params));
  },

  [Actions.GROUP_ESSENCE_ADD]: async (client, params) => {
    return await client.setEssenceMessage(msgid(params));
  },

  [Actions.GROUP_ESSENCE_REMOVE]: async (client, params) => {
    return await client.removeEssenceMessage(msgid(params));
  },

  [Actions.GROUP_ALLOW_ANONY]: async (client, params) => {
    const enable = params.enable !== false;
    return await client.setGroupAnonymous(gid(params), enable);
  },

  [Actions.GROUP_MUTED_LIST]: async (client, params) => {
    return await client.pickGroup(gid(params)).getMuteMemberList();
  },

  [Actions.GROUP_AT_ALL_REMAIN]: async (client, params) => {
    return await client.pickGroup(gid(params)).getAtAllRemainder();
  },

  // ── 好友操作 ──
  [Actions.FRIEND_POKE]: async (client, params) => {
    return await client.pickFriend(uid(params)).poke();
  },

  [Actions.FRIEND_LIKE]: async (client, params) => {
    const times = params.times ? Number(params.times) : 1;
    return await client.sendLike(uid(params), times);
  },

  [Actions.FRIEND_DELETE]: async (client, params) => {
    const block = params.block === true;
    return await client.deleteFriend(uid(params), block);
  },

  [Actions.FRIEND_REMARK]: async (client, params) => {
    await client.pickFriend(uid(params)).setRemark(requireString(params, "remark"));
    return { ok: true };
  },

  [Actions.FRIEND_CLASS]: async (client, params) => {
    const classId = Number(params.class_id);
    await client.pickFriend(uid(params)).setClass(classId);
    return { ok: true };
  },

  // ── 系统消息/请求 ──
  [Actions.GET_SYSTEM_MSG]: async (client) => {
    const msgs = await client.getSystemMsg();
    // getSystemMsg() may return an array or { friend: [], group: [] }
    let raw: any[];
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
    const all = raw.map((m: any) => ({
      type: m.request_type ?? m.sub_type ?? "unknown",
      user_id: m.user_id,
      nickname: m.nickname,
      group_id: m.group_id,
      group_name: m.group_name,
      comment: m.comment,
      flag: m.flag,
      seq: m.seq,
      time: m.time,
    }));
    return {
      friendRequests: all.filter((m) => m.type === "friend" || (!m.group_id && m.user_id)),
      groupRequests: all.filter((m) => m.type === "group" || m.group_id),
    };
  },

  [Actions.HANDLE_FRIEND_REQUEST]: async (client, params) => {
    const flag = requireString(params, "flag");
    const approve = params.approve !== false;
    const remark = optionalString(params, "remark") ?? "";
    const block = params.block === true;
    return await client.setFriendAddRequest(flag, approve, remark, block);
  },

  [Actions.HANDLE_GROUP_REQUEST]: async (client, params) => {
    const flag = requireString(params, "flag");
    const approve = params.approve !== false;
    const reason = optionalString(params, "reason") ?? "";
    const block = params.block === true;
    return await client.setGroupAddRequest(flag, approve, reason, block);
  },

  // ── 好友分组 ──
  [Actions.ADD_FRIEND_CLASS]: async (client, params) => {
    await client.addClass(requireString(params, "name"));
    return { ok: true };
  },

  [Actions.DELETE_FRIEND_CLASS]: async (client, params) => {
    await client.deleteClass(Number(params.id));
    return { ok: true };
  },

  [Actions.RENAME_FRIEND_CLASS]: async (client, params) => {
    await client.renameClass(Number(params.id), requireString(params, "name"));
    return { ok: true };
  },

  // ── 群文件系统 ──
  [Actions.GFS_LIST]: async (client, params) => {
    const g = gid(params);
    const pid = optionalString(params, "pid") ?? "/";
    const gfs = client.acquireGfs(g);
    const files = await gfs.dir(pid);
    return files.map((f: any) => ({
      fid: f.fid,
      name: f.name,
      pid: f.pid,
      is_dir: f.is_dir ?? !f.md5,
      size: f.size,
      upload_time: f.upload_time ?? f.create_time,
      modify_time: f.modify_time,
      uploader: f.user_id,
      file_count: f.file_count,
    }));
  },

  [Actions.GFS_INFO]: async (client, params) => {
    const gfs = client.acquireGfs(gid(params));
    return await gfs.df();
  },

  [Actions.GFS_MKDIR]: async (client, params) => {
    const gfs = client.acquireGfs(gid(params));
    return await gfs.mkdir(requireString(params, "name"));
  },

  [Actions.GFS_DELETE]: async (client, params) => {
    const fid = requireString(params, "fid");
    const gfs = client.acquireGfs(gid(params));
    await gfs.rm(fid);
    return { ok: true };
  },

  [Actions.GFS_RENAME]: async (client, params) => {
    const fid = requireString(params, "fid");
    const name = requireString(params, "name");
    const gfs = client.acquireGfs(gid(params));
    await gfs.rename(fid, name);
    return { ok: true };
  },

  [Actions.GFS_STAT]: async (client, params) => {
    const fid = requireString(params, "fid");
    const gfs = client.acquireGfs(gid(params));
    return await gfs.stat(fid);
  },

  [Actions.GFS_MOVE]: async (client, params) => {
    const fid = requireString(params, "fid");
    const pid = requireString(params, "pid");
    const gfs = client.acquireGfs(gid(params));
    await gfs.mv(fid, pid);
    return { ok: true };
  },

  [Actions.GFS_DOWNLOAD]: async (client, params) => {
    const fid = requireString(params, "fid");
    const gfs = client.acquireGfs(gid(params));
    return await gfs.download(fid);
  },

  // ── 其他 ──
  [Actions.IMAGE_OCR]: async (client, params) => {
    const filePath = safeFilePath(params);
    const buf = await fs.readFile(filePath);
    return await client.imageOcr(buf);
  },

  [Actions.RELOAD_FRIEND_LIST]: async (client) => {
    await client.reloadFriendList();
    return { ok: true, friendCount: client.fl.size };
  },

  [Actions.RELOAD_GROUP_LIST]: async (client) => {
    await client.reloadGroupList();
    return { ok: true, groupCount: client.gl.size };
  },

  [Actions.CLEAN_CACHE]: async (client) => {
    client.cleanCache();
    return { ok: true };
  },

  [Actions.GET_GROUP_SHARE]: async (client, params) => {
    return await client.getGroupShareJson(gid(params));
  },

  [Actions.GROUP_SET_JOIN_TYPE]: async (client, params) => {
    const type = String(params.type);
    const question = optionalString(params, "question");
    const answer = optionalString(params, "answer");
    return await client.pickGroup(gid(params)).setGroupJoinType(type, question, answer);
  },

  [Actions.GROUP_SET_RATE_LIMIT]: async (client, params) => {
    const times = Number(params.times);
    return await client.pickGroup(gid(params)).setMessageRateLimit(times);
  },

  [Actions.GROUP_MUTE_ANONY]: async (client, params) => {
    const flag = requireString(params, "flag");
    const duration = params.duration !== undefined ? Number(params.duration) : undefined;
    await client.pickGroup(gid(params)).muteAnony(flag, duration);
    return { ok: true };
  },

  [Actions.GROUP_ANON_INFO]: async (client, params) => {
    return await client.pickGroup(gid(params)).getAnonyInfo();
  },

  [Actions.ADD_FRIEND]: async (client, params) => {
    const g = gid(params);
    const u = uid(params);
    const comment = optionalString(params, "comment") ?? "";
    return await client.addFriend(g, u, comment);
  },

  [Actions.SEND_TEMP_MSG]: async (client, params) => {
    const g = gid(params);
    const message = parseMessage(requireString(params, "message"));
    return await client.sendTempMsg(g, uid(params), message);
  },

  [Actions.GET_ROAMING_STAMP]: async (client) => {
    return await client.getRoamingStamp();
  },

  [Actions.DELETE_STAMP]: async (client, params) => {
    const id = Array.isArray(params.id) ? params.id as string[] : requireString(params, "id");
    await client.deleteStamp(id);
    return { ok: true };
  },

  // ── 文件传输 ──
  [Actions.SEND_PRIVATE_FILE]: async (client, params) => {
    const filePath = safeFilePath(params);
    const u = uid(params);
    return await client.pickFriend(u).sendFile(filePath);
  },

  [Actions.SEND_GROUP_FILE]: async (client, params) => {
    const filePath = safeFilePath(params);
    const g = gid(params);
    const pid = optionalString(params, "pid") ?? "/";
    const name = optionalString(params, "name");
    return await client.pickGroup(g).sendFile(filePath, pid, name);
  },

  [Actions.FRIEND_RECALL_FILE]: async (client, params) => {
    const fid = requireString(params, "fid");
    return await client.pickFriend(uid(params)).recallFile(fid);
  },

  [Actions.GFS_UPLOAD]: async (client, params) => {
    const filePath = safeFilePath(params);
    const g = gid(params);
    const pid = optionalString(params, "pid") ?? "/";
    const name = optionalString(params, "name");
    const gfs = client.acquireGfs(g);
    return await gfs.upload(filePath, pid, name);
  },

  [Actions.GROUP_SET_REACTION]: async (client, params) => {
    const seq = Number(params.seq);
    const id = String(params.id);
    return await client.pickGroup(gid(params)).setReaction(seq, id);
  },

  [Actions.GROUP_DEL_REACTION]: async (client, params) => {
    const seq = Number(params.seq);
    const id = String(params.id);
    return await client.pickGroup(gid(params)).delReaction(seq, id);
  },

  [Actions.GET_FORWARD_MSG]: async (client, params) => {
    const resid = requireString(params, "resid");
    return await client.getForwardMsg(resid);
  },

  [Actions.MAKE_FORWARD_MSG]: async (client, params) => {
    const msgs = params.messages as any[];
    const dm = params.dm === true;
    return await client.makeForwardMsg(msgs, dm);
  },

  // ── 频道 ──
  [Actions.GUILD_LIST]: async (client) => {
    return client.getGuildList();
  },

  [Actions.GUILD_INFO]: async (client, params) => {
    const guildId = requireString(params, "guild_id");
    return client.getGuildInfo(guildId);
  },

  [Actions.GUILD_CHANNELS]: async (client, params) => {
    const guildId = requireString(params, "guild_id");
    return client.getChannelList(guildId);
  },

  [Actions.GUILD_MEMBERS]: async (client, params) => {
    const guildId = requireString(params, "guild_id");
    return await client.getGuildMemberList(guildId);
  },

  [Actions.GUILD_SEND_MSG]: async (client, params) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const message = parseMessage(requireString(params, "message"));
    return await client.sendGuildMsg(guildId, channelId, message);
  },

  [Actions.GUILD_RECALL_MSG]: async (client, params) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const seq = Number(params.seq);
    const channel = client.pickGuild(guildId).channels.get(channelId);
    if (!channel) throw new Error(`频道 ${channelId} 不存在`);
    return await channel.recallMsg(seq);
  },

  // ── 用户文件操作 ──
  [Actions.GET_FILE_INFO]: async (client, params) => {
    const fid = requireString(params, "fid");
    return await client.pickUser(uid(params)).getFileInfo(fid);
  },

  [Actions.GET_FILE_URL]: async (client, params) => {
    const fid = requireString(params, "fid");
    return await client.pickUser(uid(params)).getFileUrl(fid);
  },

  [Actions.GET_AVATAR_URL]: async (client, params) => {
    const size = (params.size as 0 | 40 | 100 | 140) ?? 0;
    return { url: client.pickUser(uid(params)).getAvatarUrl(size) };
  },

  [Actions.GET_GROUP_AVATAR_URL]: async (client, params) => {
    const size = (params.size as 0 | 40 | 100 | 140) ?? 0;
    const history = params.history ? Number(params.history) : undefined;
    return { url: client.pickGroup(gid(params)).getAvatarUrl(size, history) };
  },

  // ── 屏蔽群成员消息 ──
  [Actions.SET_SCREEN_MEMBER_MSG]: async (client, params) => {
    const isScreen = params.is_screen !== false;
    return await client.setGroupMemberScreenMsg(gid(params), uid(params), isScreen);
  },

  // ── 群文件转发 ──
  [Actions.GFS_FORWARD]: async (client, params) => {
    const sourceGid = gid(params);
    const targetGid = Number(params.target_group_id);
    if (!Number.isFinite(targetGid) || targetGid <= 0) throw new Error("无效的 target_group_id");
    const fid = requireString(params, "fid");
    const pid = optionalString(params, "pid") ?? "/";
    const name = optionalString(params, "name");
    const sourceGfs = client.acquireGfs(sourceGid);
    const stat = await sourceGfs.stat(fid) as any;
    const targetGfs = client.acquireGfs(targetGid);
    return await targetGfs.forward(stat, pid, name);
  },

  [Actions.GFS_FORWARD_OFFLINE]: async (client, params) => {
    const fid = requireString(params, "fid");
    const name = optionalString(params, "name");
    const gfs = client.acquireGfs(gid(params));
    return await gfs.forwardOfflineFile(fid, name);
  },

  // ── 重载列表扩展 ──
  [Actions.RELOAD_BLACKLIST]: async (client) => {
    await client.reloadBlackList();
    return { ok: true, blacklistCount: client.blacklist.size };
  },

  [Actions.RELOAD_STRANGER_LIST]: async (client) => {
    await client.reloadStrangerList();
    return { ok: true };
  },

  [Actions.RELOAD_GUILDS]: async (client) => {
    await client.reloadGuilds();
    return { ok: true };
  },

  // ── 在线状态查询 ──
  [Actions.GET_STATUS_INFO]: async (client, params) => {
    const uin = params.uin ? Number(params.uin) : undefined;
    return await client.getStatusInfo(uin);
  },

  // ── 密钥/工具 ──
  [Actions.GET_CLIENT_KEY]: async (client) => {
    return await client.getClientKey();
  },

  [Actions.GET_PSKEY]: async (client, params) => {
    const domains = params.domain as string | string[];
    return await client.getPSkey(domains);
  },

  [Actions.UID2UIN]: async (client, params) => {
    const uid = params.uid as string;
    const groupId = params.group_id ? Number(params.group_id) : undefined;
    return { uin: await client.uid2uin(uid, groupId) };
  },

  [Actions.UIN2UID]: async (client, params) => {
    const uin = Number(params.uin);
    const groupId = params.group_id ? Number(params.group_id) : undefined;
    return { uid: await client.uin2uid(uin, groupId) };
  },

  // ── 获取图片/语音 URL ──
  [Actions.GET_PIC_URL]: async (client, params) => {
    const elem = params.elem;
    const contact = params.group_id
      ? client.pickGroup(gid(params))
      : client.pickFriend(uid(params));
    return { url: await contact.getPicUrl(elem as any) };
  },

  [Actions.GET_PTT_URL]: async (client, params) => {
    const elem = params.elem;
    const contact = params.group_id
      ? client.pickGroup(gid(params))
      : client.pickFriend(uid(params));
    return { url: await contact.getPttUrl(elem as any) };
  },

  // ── 视频/加好友设置 ──
  [Actions.GET_VIDEO_URL]: async (client, params) => {
    const fid = requireString(params, "fid");
    const md5 = requireString(params, "md5");
    return { url: await client.getVideoUrl(fid, md5) };
  },

  [Actions.GET_ADD_FRIEND_SETTING]: async (client, params) => {
    return { setting: await client.pickUser(uid(params)).getAddFriendSetting() };
  },

  // ── 频道扩展 ──
  [Actions.GET_FORUM_URL]: async (client, params) => {
    const guildId = requireString(params, "guild_id");
    const channelId = requireString(params, "channel_id");
    const forumId = requireString(params, "forum_id");
    return { url: await client.getForumUrl(guildId, channelId, forumId) };
  },

  [Actions.GUILD_CHANNEL_SHARE]: async (client, params) => {
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

export async function handleRequest(
  client: Client,
  req: IpcRequest,
): Promise<IpcResponse> {
  const handler = handlers[req.action];
  if (!handler) {
    return { id: req.id, ok: false, error: `未知操作: ${req.action}` };
  }
  try {
    const data = await handler(client, req.params);
    return { id: req.id, ok: true, data };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err) ?? String(err);
    return {
      id: req.id,
      ok: false,
      error: message,
    };
  }
}
