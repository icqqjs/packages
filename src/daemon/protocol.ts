/**
 * IPC 协议类型定义与 Action 常量。
 *
 * CLI 与守护进程之间通过 Unix Domain Socket 通信，
 * 使用 JSON + 换行符（`\n`）分隔的文本协议。
 *
 * 通信流程：
 *   1. CLI 连接 Socket → 发送 auth 请求（携带 token）
 *   2. 认证通过后发送 IpcRequest → 等待 IpcResponse
 *   3. 认证通过后自动接收 icqq 事件推送（IpcEvent），断开连接自动停止
 *
 * @module protocol
 */

/** CLI → Daemon 请求 */
export type IpcRequest = {
  /** 请求唯一标识（UUID），用于匹配响应 */
  id: string;
  /** 操作名称，见 {@link Actions} */
  action: string;
  /** 操作参数 */
  params: Record<string, unknown>;
};

/** Daemon → CLI 响应 */
export type IpcResponse = {
  /** 对应请求的 id */
  id: string;
  /** 是否成功 */
  ok: boolean;
  /** 成功时的返回数据 */
  data?: unknown;
  /** 失败时的错误信息 */
  error?: string;
};

/** Daemon → CLI 事件推送（icqq client.em 分发的全部事件） */
export type IpcEvent = {
  /** 固定为 `"*"`，客户端应忽略，由本地 handler 自行过滤 */
  id: string;
  /** icqq 事件名，如 message.group.normal、notice.friend.recall */
  event: string;
  /** icqq 事件 toJSON 后的完整 plain object（不含 function / Client 等类实例） */
  data: unknown;
};

export type IpcMessage = IpcResponse | IpcEvent;

/**
 * 所有 IPC 操作常量。
 *
 * 命名规范：
 *   - Key: UPPER_SNAKE_CASE
 *   - Value: lower_snake_case（全局唯一）
 *
 * 参数约定：
 *   - user_id / uid: QQ 号
 *   - group_id / gid: 群号
 *   - message_id / msgid: 消息 ID
 *   - message: CQ 码字符串，或 MessageElem[]（JSON 数组）
 */
export const Actions = {
  /** 心跳检测，返回 { pong: true, time } */
  PING: "ping",
  /**
   * 登出并停止守护进程。
   * 参数: keep_token?(boolean，默认 false)
   *   false → 向 QQ 服务器发送下线包，终端会话作废，token 失效（完整登出）
   *   true  → 仅本地断开，不通知服务器，token 保留（可用 icqq login -r 重连）
   */
  LOGOUT: "logout",

  // ── 列表查询 ──
  /** 获取好友列表 → FriendInfo[] */
  LIST_FRIENDS: "list_friends",
  /** 获取群列表 → GroupInfo[] */
  LIST_GROUPS: "list_groups",
  /** 获取群成员列表。参数: group_id → MemberInfo[] */
  LIST_GROUP_MEMBERS: "list_group_members",
  /** 获取黑名单列表 → { user_id }[] */
  LIST_BLACKLIST: "list_blacklist",
  /** 获取好友分组列表 → { id, name }[] */
  LIST_FRIEND_CLASSES: "list_friend_classes",

  // ── 信息查询 ──
  /** 查看好友资料。参数: user_id */
  GET_FRIEND_INFO: "get_friend_info",
  /** 查看群信息。参数: group_id */
  GET_GROUP_INFO: "get_group_info",
  /** 查看群成员资料。参数: group_id, user_id */
  GET_GROUP_MEMBER_INFO: "get_group_member_info",
  /** 查看陌生人资料。参数: user_id */
  GET_STRANGER_INFO: "get_stranger_info",
  /** 获取当前在线状态（uin、nickname、online） */
  GET_STATUS: "get_status",
  /** 获取自身详细资料 */
  GET_SELF_PROFILE: "get_self_profile",

  // ── 消息发送 ──
  /** 发送私聊消息。参数: user_id, message（string 或 MessageElem[]） */
  SEND_PRIVATE_MSG: "send_private_msg",
  /** 发送群消息。参数: group_id, message（string 或 MessageElem[]） */
  SEND_GROUP_MSG: "send_group_msg",

  // ── 消息操作 ──
  /** 撤回消息。参数: message_id */
  RECALL_MSG: "recall_msg",
  /** 获取单条消息。参数: message_id */
  GET_MSG: "get_msg",
  /** 获取私聊历史。参数: user_id, count?, time? */
  HISTORY_PRIVATE: "history_private",
  /** 获取群聊历史。参数: group_id, count?, seq? */
  HISTORY_GROUP: "history_group",
  /** 标记消息已读。参数: message_id */
  MARK_READ: "mark_read",
  /** 删除消息。参数: message_id */
  DELETE_MSG: "delete_msg",

  // ── 个人设置 ──
  /** 修改昵称。参数: nickname */
  SET_NICKNAME: "set_nickname",
  /** 修改性别。参数: gender (0=未知/1=男/2=女) */
  SET_GENDER: "set_gender",
  /** 修改生日。参数: birthday (YYYY-MM-DD 或 YYYY/MM/DD) */
  SET_BIRTHDAY: "set_birthday",
  /** 修改签名。参数: signature */
  SET_SIGNATURE: "set_signature",
  /** 修改个人说明。参数: description */
  SET_DESCRIPTION: "set_description",
  /** 修改头像。参数: file (本地文件路径) */
  SET_AVATAR: "set_avatar",
  /** 修改在线状态。参数: status (11=在线/31=离开/41=隐身/50=忙碌/60=Q我吧/70=勿扰) */
  SET_ONLINE_STATUS: "set_online_status",

  // ── 群设置 ──
  /** 修改群名。参数: group_id, name */
  SET_GROUP_NAME: "set_group_name",
  /** 修改群头像。参数: group_id, file */
  SET_GROUP_AVATAR: "set_group_avatar",
  /** 修改群名片。参数: group_id, user_id, card */
  SET_GROUP_CARD: "set_group_card",
  /** 设置群头衔。参数: group_id, user_id, title, duration? */
  SET_GROUP_TITLE: "set_group_title",
  /** 设置/取消管理员。参数: group_id, user_id, enable? */
  SET_GROUP_ADMIN: "set_group_admin",
  /** 修改群备注。参数: group_id, remark */
  SET_GROUP_REMARK: "set_group_remark",

  // ── 群管理 ──
  /** 禁言成员。参数: group_id, user_id, duration?(秒，默认600) */
  GROUP_MUTE: "group_mute",
  /** 全体禁言。参数: group_id, enable?(默认true) */
  GROUP_MUTE_ALL: "group_mute_all",
  /** 踢出成员。参数: group_id, user_id, block?, message? */
  GROUP_KICK: "group_kick",
  /** 退出群聊。参数: group_id */
  GROUP_QUIT: "group_quit",
  /** 邀请好友入群。参数: group_id, user_id */
  GROUP_INVITE: "group_invite",
  /** 戳一戳群成员。参数: group_id, user_id */
  GROUP_POKE: "group_poke",
  /** 发送群公告。参数: group_id, content */
  GROUP_ANNOUNCE: "group_announce",
  /** 群签到。参数: group_id */
  GROUP_SIGN: "group_sign",
  /** 添加精华消息。参数: message_id */
  GROUP_ESSENCE_ADD: "group_essence_add",
  /** 移除精华消息。参数: message_id */
  GROUP_ESSENCE_REMOVE: "group_essence_remove",
  /** 开关匿名聊天。参数: group_id, enable? */
  GROUP_ALLOW_ANONY: "group_allow_anony",
  /** 获取被禁言成员列表。参数: group_id */
  GROUP_MUTED_LIST: "group_muted_list",
  /** 查询 @全体成员 剩余次数。参数: group_id */
  GROUP_AT_ALL_REMAIN: "group_at_all_remain",

  // ── 好友操作 ──
  /** 戳一戳好友。参数: user_id */
  FRIEND_POKE: "friend_poke",
  /** 给好友点赞。参数: user_id, times?(默认1) */
  FRIEND_LIKE: "friend_like",
  /** 删除好友。参数: user_id, block? */
  FRIEND_DELETE: "friend_delete",
  /** 设置好友备注。参数: user_id, remark */
  FRIEND_REMARK: "friend_remark",
  /** 移动好友到分组。参数: user_id, class_id */
  FRIEND_CLASS: "friend_class",

  // ── 系统消息/请求 ──
  /** 获取待处理的好友/群请求列表 */
  GET_SYSTEM_MSG: "get_system_msg",
  /** 处理好友请求。参数: flag, approve?, remark?, block? */
  HANDLE_FRIEND_REQUEST: "handle_friend_request",
  /** 处理群请求。参数: flag, approve?, reason?, block? */
  HANDLE_GROUP_REQUEST: "handle_group_request",

  // ── 好友分组 ──
  /** 新建好友分组。参数: name */
  ADD_FRIEND_CLASS: "add_friend_class",
  /** 删除好友分组。参数: id */
  DELETE_FRIEND_CLASS: "delete_friend_class",
  /** 重命名好友分组。参数: id, name */
  RENAME_FRIEND_CLASS: "rename_friend_class",

  // ── 群文件系统 ──
  /** 列出群文件。参数: group_id, pid?(目录ID，默认 "/") */
  GFS_LIST: "gfs_list",
  /** 查看群文件系统信息（磁盘空间等）。参数: group_id */
  GFS_INFO: "gfs_info",
  /** 创建文件夹。参数: group_id, name */
  GFS_MKDIR: "gfs_mkdir",
  /** 删除文件/文件夹。参数: group_id, fid */
  GFS_DELETE: "gfs_delete",
  /** 重命名文件。参数: group_id, fid, name */
  GFS_RENAME: "gfs_rename",
  /** 查看文件详情。参数: group_id, fid */
  GFS_STAT: "gfs_stat",
  /** 移动文件到目录。参数: group_id, fid, pid */
  GFS_MOVE: "gfs_move",
  /** 获取群文件下载链接。参数: group_id, fid */
  GFS_DOWNLOAD: "gfs_download",

  // ── 其他功能 ──
  /** 图片 OCR 识别。参数: file (本地文件路径) */
  IMAGE_OCR: "image_ocr",
  /** 重载好友列表 */
  RELOAD_FRIEND_LIST: "reload_friend_list",
  /** 重载群列表 */
  RELOAD_GROUP_LIST: "reload_group_list",
  /** 清理缓存 */
  CLEAN_CACHE: "clean_cache",
  /** 获取群分享 JSON。参数: group_id */
  GET_GROUP_SHARE: "get_group_share",

  // ── 群管理扩展 ──
  /** 设置入群验证方式。参数: group_id, type, question?, answer? */
  GROUP_SET_JOIN_TYPE: "group_set_join_type",
  /** 设置群发消息频率限制。参数: group_id, times */
  GROUP_SET_RATE_LIMIT: "group_set_rate_limit",
  /** 禁言匿名成员。参数: group_id, flag, duration? */
  GROUP_MUTE_ANONY: "group_mute_anony",
  /** 获取匿名信息。参数: group_id */
  GROUP_ANON_INFO: "group_anon_info",

  // ── 好友操作扩展 ──
  /** 申请添加好友。参数: group_id, user_id, comment? */
  ADD_FRIEND: "add_friend",
  /** 发送临时消息。参数: group_id, user_id, message */
  SEND_TEMP_MSG: "send_temp_msg",

  // ── 漫游表情 ──
  /** 获取漫游表情列表 */
  GET_ROAMING_STAMP: "get_roaming_stamp",
  /** 删除漫游表情。参数: id (string | string[]) */
  DELETE_STAMP: "delete_stamp",

  // ── 好友文件操作 ──
  /** 撤回好友文件。参数: user_id, fid */
  FRIEND_RECALL_FILE: "friend_recall_file",

  // ── 群文件上传 ──
  /** 上传群文件。参数: group_id, file, pid?, name? */
  GFS_UPLOAD: "gfs_upload",

  // ── 群消息表态 ──
  /** 给群消息添加表态。参数: group_id, seq, id */
  GROUP_SET_REACTION: "group_set_reaction",
  /** 取消群消息表态。参数: group_id, seq, id */
  GROUP_DEL_REACTION: "group_del_reaction",

  // ── 转发消息 ──
  /** 获取合并转发内容。参数: resid */
  GET_FORWARD_MSG: "get_forward_msg",
  /** 构造合并转发消息。参数: messages, dm? */
  MAKE_FORWARD_MSG: "make_forward_msg",

  // ── 频道系统 ──
  /** 获取频道列表 */
  GUILD_LIST: "guild_list",
  /** 获取频道信息。参数: guild_id */
  GUILD_INFO: "guild_info",
  /** 获取频道子频道列表。参数: guild_id */
  GUILD_CHANNELS: "guild_channels",
  /** 获取频道成员列表。参数: guild_id */
  GUILD_MEMBERS: "guild_members",
  /** 发送频道消息。参数: guild_id, channel_id, message */
  GUILD_SEND_MSG: "guild_send_msg",
  /** 撤回频道消息。参数: guild_id, channel_id, seq */
  GUILD_RECALL_MSG: "guild_recall_msg",

  // ── 用户文件操作 ──
  /** 获取文件信息。参数: user_id, fid */
  GET_FILE_INFO: "get_file_info",
  /** 获取文件下载链接。参数: user_id, fid */
  GET_FILE_URL: "get_file_url",
  /** 获取用户头像 URL。参数: user_id, size?(0|40|100|140) */
  GET_AVATAR_URL: "get_avatar_url",
  /** 获取群头像 URL。参数: group_id, size?, history? */
  GET_GROUP_AVATAR_URL: "get_group_avatar_url",

  // ── 屏蔽群成员消息 ──
  /** 屏蔽/取消屏蔽成员消息。参数: group_id, user_id, is_screen? */
  SET_SCREEN_MEMBER_MSG: "set_screen_member_msg",

  // ── 群文件转发 ──
  /** 转发群文件到另一个群。参数: group_id, target_group_id, fid, pid?, name? */
  GFS_FORWARD: "gfs_forward",
  /** 转发群文件到离线文件。参数: group_id, fid, name? */
  GFS_FORWARD_OFFLINE: "gfs_forward_offline",

  // ── 重载列表 ──
  /** 重载黑名单 */
  RELOAD_BLACKLIST: "reload_blacklist",
  /** 重载陌生人列表 */
  RELOAD_STRANGER_LIST: "reload_stranger_list",

  // ── 在线状态查询 ──
  /** 查询在线状态。参数: uin? */
  GET_STATUS_INFO: "get_status_info",

  // ── 密钥/工具 ──
  /** 获取客户端密钥 */
  GET_CLIENT_KEY: "get_client_key",
  /** 获取 PSKey。参数: domain (string | string[]) */
  GET_PSKEY: "get_pskey",
  /** UID 转 UIN。参数: uid, group_id? */
  UID2UIN: "uid2uin",
  /** UIN 转 UID。参数: uin, group_id? */
  UIN2UID: "uin2uid",

  // ── 视频/加好友设置 ──
  /** 获取视频下载链接。参数: fid, md5 */
  GET_VIDEO_URL: "get_video_url",
  /** 获取好友添加设置。参数: user_id */
  GET_ADD_FRIEND_SETTING: "get_add_friend_setting",

  // ── 频道扩展 ──
  /** 重载频道列表 */
  RELOAD_GUILDS: "reload_guilds",
  /** 获取帖子 URL。参数: guild_id, channel_id, forum_id */
  GET_FORUM_URL: "get_forum_url",
  /** 发送频道分享链接。参数: guild_id, channel_id, url, title, summary?, content?, image? */
  GUILD_CHANNEL_SHARE: "guild_channel_share",

  // ── 获取图片/语音 URL ──
  /** 获取图片 URL。参数: elem, group_id? 或 user_id? */
  GET_PIC_URL: "get_pic_url",
  /** 获取语音 URL。参数: elem, group_id? 或 user_id? */
  GET_PTT_URL: "get_ptt_url",

  // ── 消息订阅（已废弃：认证连接后自动推送） ──
  /** @deprecated 连接认证后自动推送，无需调用 */
  SUBSCRIBE: "subscribe",
  /** @deprecated 断开连接自动停止，无需调用 */
  UNSUBSCRIBE: "unsubscribe",

  // ── 文件传输 ──
  /** 发送私聊文件。参数: user_id, file */
  SEND_PRIVATE_FILE: "send_private_file",
  /** 发送群文件。参数: group_id, file, pid?, name? */
  SEND_GROUP_FILE: "send_group_file",

  // ── Webhook ──
  /** 设置 Webhook 推送地址。参数: url (http/https) */
  SET_WEBHOOK: "set_webhook",
  /** 查询当前 Webhook 配置 */
  GET_WEBHOOK: "get_webhook",

  // ── 系统通知 ──
  /** 开启/关闭系统通知。参数: enabled? */
  SET_NOTIFY: "set_notify",
  /** 查询系统通知状态 */
  GET_NOTIFY: "get_notify",
} as const;
