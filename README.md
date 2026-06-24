# @icqqjs/cli

基于 [icqq](https://github.com/icqqjs/icqq) 的命令行 QQ 客户端，使用 React Ink 构建交互式终端 UI。

## 安装

```bash
npm install -g @icqqjs/cli
```

### 安装 icqq 核心依赖

CLI 的核心协议库 `@icqqjs/icqq` 可能托管在 GitHub Packages（与发布在 npmjs 的 `@icqqjs/cli` 不同源）。**请勿**把 `@icqqjs:registry` 写入 `~/.npmrc`，否则两个包会冲突。

```bash
icqq setup                        # 交互引导（检测 → 输入 Token → 安装）
icqq setup --token <PAT>          # 或预先提供 PAT
export GITHUB_TOKEN=<PAT> && icqq setup
```

交互输入的 GitHub Token 会保存到 `~/.icqq/github.token`（权限 600），供后续 `icqq update` 使用。

```bash
icqq update                       # 升级 @icqqjs/icqq（自动读取已保存 Token）
icqq cli-update                   # 升级 @icqqjs/cli（npmjs 公网源，无需 Token）
```

<details>
<summary>手动安装（不修改 ~/.npmrc）</summary>

公网 npm：

```bash
pnpm add -g @icqqjs/icqq
# 或 npm install -g @icqqjs/icqq
```

GitHub Packages（将 `<PAT>` 换为 [Personal Access Token](https://github.com/settings/tokens/new)）：

```bash
export GITHUB_TOKEN=<PAT>
pnpm add -g @icqqjs/icqq --config.@icqqjs:registry=https://npm.pkg.github.com
# npm: npm install -g @icqqjs/icqq --@icqqjs:registry=https://npm.pkg.github.com
```

</details>

## 快速开始

```bash
# 交互式登录
icqq login

# 快速重连（使用已保存的 token）
icqq login -r

# 指定账号快速重连
icqq login -q 12345 -r
```

设备锁验证时，终端会引导你选择 **手机短信验证**（有密保手机时）或 **浏览器打开链接验证**。

## 多实例支持

通过 `-u` 全局参数或 `ICQQ_CURRENT_UIN` 环境变量指定操作的账号，默认使用 `currentUin`。

```bash
icqq -u 12345 profile
ICQQ_CURRENT_UIN=12345 icqq friend list
```

### 脚本化输出（`--json`）

多数 IPC 命令支持全局 `--json`，输出结构化 JSON 并设置 `exitCode`：

```bash
icqq --json -u 12345 friend list
icqq --json profile
```

失败时 stderr 输出 `{"ok":false,"error":"..."}`，进程退出码为 `1`。

### Shell 补全

```bash
# zsh
eval "$(icqq completion zsh)"

# bash
eval "$(icqq completion bash)"

# fish
icqq completion fish | source
```

### 频道子命令别名

`icqq channel <子命令>` 与 `icqq guild channel <子命令>` 等价，推荐使用后者的完整路径。

### 登录与网络（补充）

- 首次 `icqq login` 会引导配置全局 MCP/RPC 开关；端口写入当前账号
- 二次登录可为单账号覆盖 MCP/RPC 端口（`icqq config set` 支持账号级 `-u`）
- 237 身份验证需按终端提示在浏览器控制台注入设备信息
- 端口冲突时登录向导会报错；也可执行 `icqq service status` 查看 MCP 端口

### 故障排查

| 现象 | 处理 |
|------|------|
| 守护进程已在运行 | `icqq service stop` 或 `icqq logout -k` 后重试 |
| 守护进程未运行 | `icqq login -r` 或 `icqq service start` |
| MCP 端口冲突 | `icqq config set mcp.http.port 0` 后 `icqq service restart` |
| macOS 服务 logout 后仍重启 | 正常退出会写入 `daemon.stopped`；需再次 `service start` 清除标记 |
| 服务器收不到告警 | `icqq config get alerts` 确认 `enabled` 与 `providers`；密钥勿提交 git；改配置后 `service restart` |
| 告警无登录链接 | 配置 `login.http.publicUrl` 为反代 HTTPS 根 URL |

## 命令一览

### 账号

| 命令 | 说明 |
|------|------|
| `icqq login` | 登录 QQ 账号并启动守护进程 |
| `icqq login -r` | 使用已保存 token 快速重连 |
| `icqq logout` | 退出登录并停止守护进程（token 作废） |
| `icqq logout -k` | 仅断开连接，保留 token（可 `login -r` 重连） |
| `icqq logout <uin>` | 退出指定账号 |
| `icqq switch [uin]` | 切换当前操作的账号 |
| `icqq profile` | 查看个人资料 |
| `icqq requests` | 查看待处理的好友/群请求 |

### 系统服务（每账号一个 plist/unit）

每个 QQ 号对应独立的 launchd plist 或 systemd unit（`com.icqq.daemon.<uin>` / `icqq-<uin>.service`）。**不指定 QQ 号时，默认对 `config.accounts` 中全部已配置账号执行**；也可传入 QQ 号只操作单个账号。

| 命令 | 说明 |
|------|------|
| `icqq service install [uin]` | 安装并启动系统服务（默认全部账号） |
| `icqq service uninstall [uin]` | 卸载系统服务 |
| `icqq service start [uin]` | 启动已安装的服务 |
| `icqq service stop [uin]` | 停止服务（保留 plist/unit） |
| `icqq service restart [uin]` | 重启服务（改 MCP 等配置后执行） |
| `icqq service status [uin]` | 查看服务、守护进程、MCP 状态（默认全部账号） |

注意：`icqq logout` 不会阻止服务自动重启；永久停止请先 `icqq service uninstall`。

### MCP Server（守护进程内嵌）

MCP 与 IPC **同进程**运行，由配置开关；`icqq login` 或 `icqq service start` 拉起守护进程时按需启用。

PR #40 后，MCP action discovery 与实际调用统一来自同一条 canonical contract：先用 `icqq_list_actions` 查看可调用 action 与参数提示，再用 `icqq_invoke` 调用；返回结果与错误也会按同一 contract 规范化，避免 discovery 与 invoke 漂移。

```bash
icqq config set mcp.enabled true
icqq config set mcp.http.port 3920          # 可选，0 为自动分配
icqq config set mcp.http.token "your-secret"
icqq service restart                      # 或重新 login
```

端点写入 `~/.icqq/<uin>/daemon.mcp`，`icqq service status` 会显示 URL。

| MCP 工具 | 说明 |
|----------|------|
| `icqq_invoke` | 调用任意可发现的 IPC action（如 `send_private_msg`） |
| `icqq_list_actions` | 列出当前可发现 action 及参数说明，是 MCP 调用的权威来源 |

**Cursor 配置示例**（Streamable HTTP）：

```json
{
  "mcpServers": {
    "icqq": {
      "url": "http://127.0.0.1:3920/mcp",
      "headers": {
        "Authorization": "Bearer your-secret"
      }
    }
  }
}
```

端口以 `daemon.mcp` 或 `service status` 输出为准。可通过 `config.mcp.plugins` 加载第三方 MCP 插件包。

### 配置

| 命令 | 说明 |
|------|------|
| `icqq config get` | 查看所有配置 |
| `icqq config get <key>` | 查看指定配置项 |
| `icqq config set <key> <value>` | 设置配置项 |

常用配置键：`currentUin`、`webhookUrl`、`notifyEnabled`、`mcp.enabled`、`alerts.enabled`、`alerts.providers.bark.deviceKey`、`login.http.publicUrl` 等。告警详情见下节。

### 无人值守告警（`alerts`）

适用于 **headless Linux**、无桌面通知的服务器部署。守护进程在 token 失效、掉线、需滑块/扫码时向配置的渠道**广播**推送；进程进入 `login_waiting` 而非退出，可通过内嵌 Web UI 或门控 IPC 续传登录。

#### 与桌面通知的区别

| 配置 | 作用 |
|------|------|
| `notifyEnabled` | 本机**桌面通知**（macOS/Windows 弹窗），适合有图形界面的机器 |
| `alerts.enabled` + `alerts.providers.<type>.*` | **远程推送**（Bark、企微、钉钉等），适合服务器无人值守 |

两者可同时开启：消息类仍走桌面 notify；生命周期类（掉线、需登录、上线）在 `alerts.enabled` 时走推送渠道。

#### 快速启用

```bash
# 1. 启用并配置渠道（每项一条 config set）
icqq config set alerts.enabled true
icqq config set alerts.providers.bark.deviceKey YOUR_DEVICE_KEY
icqq config set alerts.providers.bark.server https://bark.l2cl.link

# 2. （推荐）配置外网可点的 Login Web 根 URL，告警里才会有可点击链接
icqq config set login.http.publicUrl https://qq.example.com

# 3. 查看当前告警配置（含各渠道字段）
icqq config get alerts

# 4. 重启守护进程使配置生效
icqq service restart
```

渠道按 **type 分组**，CLI 键名为 `alerts.providers.<type>.<field>`。可配置多个 type，每次告警会对所有已启用且字段齐全的渠道各发一遍（广播）。临时禁用某渠道：`icqq config set alerts.providers.bark.enabled false`。

#### 告警事件

| 事件 | 触发时机 | 默认冷却 |
|------|----------|----------|
| `daemon_ready` | IPC socket 可连 / 守护进程上线 | 15 分钟（per-kind） |
| `login_waiting` | 需扫码、滑块等人机验证 | 15 分钟 |
| `offline_network` | 网络掉线 | 15 分钟 |
| `offline_kickoff` | 被踢下线 | 15 分钟 |
| `online` | 每次上线（含日常重连） | 15 分钟 |

冷却时间可通过 `icqq config set alerts.cooldownMs 900000` 调整（毫秒，默认 `900000` = 15 分钟）。同一账号、同一事件类型在冷却窗口内不重复推送。

告警正文**不含** `daemon.token`；`login_waiting` 会附带 `login.http.publicUrl/login`（未配置 `publicUrl` 时仅提示 CLI 命令）。

#### 通知渠道配置示例

键名格式：`alerts.providers.<type>.<field>`。`config.json` 中对应为对象 `alerts.providers.{type}.{field}`。

| type | CLI 键示例 |
|------|------------|
| `bark` | `alerts.providers.bark.deviceKey`、`alerts.providers.bark.server` |
| `wecom` | `alerts.providers.wecom.webhookKey` |
| `dingtalk` | `alerts.providers.dingtalk.webhook`、`alerts.providers.dingtalk.secret` |
| `feishu` | `alerts.providers.feishu.webhook`、`alerts.providers.feishu.secret` |
| `telegram` | `alerts.providers.telegram.botToken`、`alerts.providers.telegram.chatId` |
| `pushdeer` | `alerts.providers.pushdeer.pushkey`、`alerts.providers.pushdeer.server` |
| `serverchan` | `alerts.providers.serverchan.sendkey` |
| `generic` | `alerts.providers.generic.url` |

各 type 均支持 `alerts.providers.<type>.enabled`（`true`/`false`）。

**Bark（iOS）** — 默认服务器 `https://api.day.app`；自建/第三方需设 `server`：

```bash
icqq config set alerts.providers.bark.deviceKey YOUR_DEVICE_KEY
icqq config set alerts.providers.bark.server https://bark.l2cl.link
```

**企业微信机器人** — webhook URL 中 `key=` 后的值：

```bash
icqq config set alerts.providers.wecom.webhookKey YOUR_WEBHOOK_KEY
```

**钉钉机器人**

```bash
icqq config set alerts.providers.dingtalk.webhook 'https://oapi.dingtalk.com/robot/send?access_token=TOKEN'
icqq config set alerts.providers.dingtalk.secret SECxxx   # 加签时可选
```

**飞书机器人**

```bash
icqq config set alerts.providers.feishu.webhook 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
icqq config set alerts.providers.feishu.secret xxx       # 签名时可选
```

**Telegram Bot**

```bash
icqq config set alerts.providers.telegram.botToken '123456:ABC'
icqq config set alerts.providers.telegram.chatId '-1001234567890'
```

**PushDeer**

```bash
icqq config set alerts.providers.pushdeer.pushkey PUSHKEY
icqq config set alerts.providers.pushdeer.server https://api2.pushdeer.com   # 可选
```

**Server酱 Turbo**

```bash
icqq config set alerts.providers.serverchan.sendkey SCTxxxxxx
```

**自建 Webhook（generic）** — POST JSON，含 `type`、`uin`、`ts`、`reason`、`loginUrl` 等：

```bash
icqq config set alerts.providers.generic.url https://hooks.example.com/icqq
```

**多渠道同时推送** — 分别 set 各 type 即可：

```bash
icqq config set alerts.providers.bark.deviceKey KEY
icqq config set alerts.providers.bark.server https://bark.l2cl.link
icqq config set alerts.providers.wecom.webhookKey WECOM_KEY
```

#### 环境变量（headless / systemd 友好）

写入 service 环境或 `~/.icqq` 启动脚本后，守护进程启动时会自动合并进 `alerts.providers.<type>`（与 config.json 同 type 时 env 覆盖对应字段）：

| 环境变量 | 说明 |
|----------|------|
| `ICQQ_ALERTS_ENABLED` | `true` 或 `1` 启用告警 |
| `ICQQ_ALERT_BARK_KEY` | Bark `deviceKey` |
| `ICQQ_ALERT_BARK_SERVER` | Bark 服务器根 URL（如 `https://bark.l2cl.link`） |
| `ICQQ_ALERT_WECOM_WEBHOOK_KEY` | 企业微信机器人 key |
| `ICQQ_ALERT_DINGTALK_WEBHOOK` | 钉钉 webhook 完整 URL |
| `ICQQ_ALERT_DINGTALK_SECRET` | 钉钉加签 secret（可选） |
| `ICQQ_ALERT_FEISHU_WEBHOOK` | 飞书 webhook URL |
| `ICQQ_ALERT_FEISHU_SECRET` | 飞书签名 secret（可选） |
| `ICQQ_ALERT_TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `ICQQ_ALERT_TELEGRAM_CHAT_ID` | Telegram Chat ID |
| `ICQQ_ALERT_PUSHDEER_KEY` | PushDeer pushkey |
| `ICQQ_ALERT_PUSHDEER_SERVER` | PushDeer server（可选） |
| `ICQQ_ALERT_SERVERCHAN_KEY` | Server酱 sendkey |
| `ICQQ_ALERT_WEBHOOK_URL` | generic webhook URL |

示例（systemd `Environment=` 或 shell）：

```bash
export ICQQ_ALERTS_ENABLED=true
export ICQQ_ALERT_BARK_KEY=YOUR_DEVICE_KEY
export ICQQ_ALERT_BARK_SERVER=https://bark.l2cl.link
```

#### 远程登录续传（`login_waiting`）

需人机验证时守护进程**不退出**，并启动本地 Login Web（默认 `127.0.0.1` 随机端口）：

| 配置键 | 说明 | 默认 |
|--------|------|------|
| `login.http.host` | Login Web 监听地址 | `127.0.0.1` |
| `login.http.port` | 监听端口 | `0`（自动分配） |
| `login.http.publicUrl` | 反代/公网 HTTPS 根 URL，告警中可点击 | 未设置 |
| `login.waitingTimeoutMs` | waiting 超时后 exit | `86400000`（24h） |

外网访问：配置 Nginx/Caddy 反代到本机 Login Web，或使用 SSH 隧道：

```bash
ssh -L 8787:127.0.0.1:<login-port> user@server
# 浏览器打开 http://127.0.0.1:8787/login/auth ，粘贴 ~/.icqq/<uin>/daemon.token
```

门控 IPC（仅 `login_waiting` 态，需 socket 认证）：`login_get_state`、`login_submit`、`login_send_sms`。MCP **不**暴露这些 action。

设计说明见 [docs/adr/0005-headless-alerts-login-waiting.md](docs/adr/0005-headless-alerts-login-waiting.md)。

### 消息

| 命令 | 说明 |
|------|------|
| `icqq friend send <qq> <message>` | 发送私聊消息 |
| `icqq group send <gid> <message>` | 发送群消息（`-a` 匿名） |
| `icqq group send-temp <gid> <uid> <message>` | 发送群临时会话消息 |
| `icqq msg history-by-id <msgid>` | 以 message_id 拉历史 |
| `icqq friend profile <qq>` | 详细资料卡 |
| `icqq stranger list` | 陌生人列表 |
| `icqq friend chat <qq>` | 进入好友交互聊天 |
| `icqq group chat <gid>` | 进入群交互聊天 |
| `icqq friend chat history <qq>` | 查看好友聊天记录 |
| `icqq group chat history <gid>` | 查看群聊天记录 |
| `icqq recall <msgid>` | 撤回消息 |
| `icqq msg get <msgid>` | 查看消息详情 |
| `icqq msg mark-read <msgid>` | 标记消息已读 |
| `icqq forward get <msgid>` | 查看合并转发消息 |

消息支持 CQ 码语法：

```
[face:id]    表情
[image:path] 图片
[at:uid]     @某人
[at:all]     @全体成员
[dice]       骰子
[rps]        猜拳
```

### 好友

| 命令 | 说明 |
|------|------|
| `icqq friend list` | 好友列表 |
| `icqq friend view <qq>` | 查看好友资料 |
| `icqq friend add <qq>` | 添加好友（可通过群） |
| `icqq friend delete <qq>` | 删除好友 |
| `icqq friend like <qq>` | 点赞 |
| `icqq friend poke <qq>` | 戳一戳 |
| `icqq friend remark <qq> <name>` | 设置好友备注 |
| `icqq friend avatar-url <qq>` | 获取好友头像 URL |
| `icqq friend send-file <qq> <file>` | 发送文件给好友 |
| `icqq friend file-info <qq> <fid>` | 获取私聊文件信息 |
| `icqq friend file-url <qq> <fid>` | 获取私聊文件下载链接 |
| `icqq friend recall-file <qq> <fid>` | 撤回发送给好友的文件 |

### 好友分组

| 命令 | 说明 |
|------|------|
| `icqq friend class list` | 查看好友分组 |
| `icqq friend class add <name>` | 创建好友分组 |
| `icqq friend class delete <id>` | 删除好友分组 |
| `icqq friend class rename <id> <name>` | 重命名好友分组 |
| `icqq friend class set <qq> <id>` | 移动好友到分组 |

### 群

| 命令 | 说明 |
|------|------|
| `icqq group list` | 群列表 |
| `icqq group view <gid>` | 查看群信息 |
| `icqq group member list <gid>` | 群成员列表 |
| `icqq group member view <gid> <qq>` | 查看群成员资料 |
| `icqq group invite <gid> <qq>` | 邀请入群 |
| `icqq group kick <gid> <qq>` | 踢出群成员 |
| `icqq group mute <gid> <qq> [duration]` | 禁言 |
| `icqq group mute-all <gid>` | 全体禁言 |
| `icqq group mute-anon <gid> <flag>` | 禁言匿名成员 |
| `icqq group muted-list <gid>` | 查看禁言列表 |
| `icqq group poke <gid> <qq>` | 戳一戳 |
| `icqq group quit <gid>` | 退群 |
| `icqq group sign <gid>` | 群签到 |
| `icqq group announce <gid> <content>` | 发群公告 |
| `icqq group avatar-url <gid>` | 获取群头像 URL |
| `icqq group anon-info <gid>` | 查看群匿名信息 |
| `icqq group at-all-remain <gid>` | 查看 @全体 剩余次数 |
| `icqq group share <gid>` | 获取群分享链接 |
| `icqq group screen-member <gid> <qq>` | 屏蔽/取消屏蔽群成员消息 |
| `icqq group reaction add <msgid> <emoji>` | 消息表态 |
| `icqq group reaction remove <msgid> <emoji>` | 取消表态 |

### 群设置

| 命令 | 说明 |
|------|------|
| `icqq group set name <gid> <name>` | 修改群名 |
| `icqq group set avatar <gid> <file>` | 修改群头像 |
| `icqq group set card <gid> <qq> <card>` | 修改群名片 |
| `icqq group set title <gid> <qq> <title>` | 设置群头衔 |
| `icqq group set admin <gid> <qq>` | 设置/取消管理员 |
| `icqq group set remark <gid> <name>` | 修改群备注 |
| `icqq group set anonymous <gid>` | 开关匿名 |
| `icqq group set join-type <gid> <type>` | 设置加群方式 |
| `icqq group set rate-limit <gid> <limit>` | 设置发言频率限制 |

### 群精华 / 群文件

| 命令 | 说明 |
|------|------|
| `icqq group essence add <msgid>` | 添加精华消息 |
| `icqq group essence remove <msgid>` | 移除精华消息 |
| `icqq group fs list <gid>` | 群文件列表 |
| `icqq group fs info <gid>` | 查看群文件系统信息 |
| `icqq group fs stat <gid> <fid>` | 查看文件/目录详情 |
| `icqq group fs mkdir <gid> <name>` | 创建文件夹 |
| `icqq group fs delete <gid> <fid>` | 删除文件 |
| `icqq group fs rename <gid> <fid> <name>` | 重命名文件 |
| `icqq group fs upload <gid> <file>` | 上传文件 |
| `icqq group fs download <gid> <fid>` | 获取下载链接 |
| `icqq group fs move <gid> <fid> <pid>` | 移动文件 |
| `icqq group fs forward <gid> <fid> <target_gid>` | 转发到其他群 |
| `icqq group fs forward-offline <gid> <fid>` | 转为离线文件 |

### 个人设置

| 命令 | 说明 |
|------|------|
| `icqq set nickname <name>` | 修改昵称 |
| `icqq set avatar <file>` | 修改头像 |
| `icqq set signature <text>` | 修改签名 |
| `icqq set gender <gender>` | 修改性别 |
| `icqq set birthday <date>` | 修改生日 |
| `icqq set description <text>` | 修改简介 |
| `icqq set online-status <status>` | 修改在线状态 |

### 其他

| 命令 | 说明 |
|------|------|
| `icqq blacklist` | 黑名单列表 |
| `icqq ocr <file>` | 图片文字识别 |
| `icqq request accept <flag>` | 接受请求 |
| `icqq request reject <flag>` | 拒绝请求 |
| `icqq webhook` | 查看 Webhook 配置 |
| `icqq webhook set <url>` | 设置 Webhook 推送地址 |
| `icqq webhook off` | 关闭 Webhook 推送 |
| `icqq notify` | 查看通知状态 |
| `icqq notify on` | 开启系统通知 |
| `icqq notify off` | 关闭系统通知 |
| `icqq config set rpc.enabled true` | 启用 RPC TCP 远程连接 |
| `icqq config set rpc.host 0.0.0.0` | 设置 RPC 监听地址 |
| `icqq config set rpc.port 9100` | 设置 RPC 监听端口 |
| `icqq convert uid <qq>` | QQ 号转 UID |
| `icqq convert uin <uid>` | UID 转 QQ 号 |
| `icqq get client-key` | 获取 ClientKey |
| `icqq get pskey` | 获取 PSKey |
| `icqq get video-url <vid>` | 获取短视频下载链接 |
| `icqq stranger view <qq>` | 查看陌生人资料 |
| `icqq stranger status <qq>` | 查看陌生人在线状态 |
| `icqq stranger add-setting <qq>` | 查看加好友设置 |
| `icqq stamp list` | 查看漫游表情列表 |
| `icqq stamp delete` | 删除漫游表情 |
| `icqq cache clean` | 清理缓存 |
| `icqq reload friends` | 重载好友列表 |
| `icqq reload groups` | 重载群列表 |
| `icqq reload blacklist` | 重载黑名单 |
| `icqq reload guilds` | 重载频道列表 |
| `icqq reload strangers` | 重载陌生人列表 |
| `icqq completion [shell]` | 生成 Shell 自动补全脚本 |

### 频道（Guild）

| 命令 | 说明 |
|------|------|
| `icqq guild list` | 频道列表 |
| `icqq guild info <guild_id>` | 查看频道信息 |
| `icqq guild members <guild_id>` | 频道成员列表 |
| `icqq guild channel list <guild_id>` | 子频道列表 |
| `icqq guild channel send <guild_id> <channel_id> <message>` | 发送子频道消息 |
| `icqq guild channel chat <guild_id> <channel_id>` | 进入子频道聊天模式 |
| `icqq guild channel recall <guild_id> <channel_id> <seq>` | 撤回子频道消息 |
| `icqq guild channel share <guild_id> <channel_id> <url> <title>` | 发送互联分享 |
| `icqq guild channel forum-url <guild_id> <channel_id> <forum_id>` | 获取帖子 URL |

## 架构

```
┌──────────────────────────────────────────────────────┐
│                     icqq CLI                         │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Pastel     │  │  React Ink │  │  IPC Client   │  │
│  │  文件路由   │─▸│  终端 UI   │  │  (ipc-client) │  │
│  └────────────┘  └────────────┘  └───────┬───────┘  │
└──────────────────────────────────────────┬───────────┘
                                  IPC │         │ RPC
                           Unix Socket │         │ TCP
                           Token 直传  │         │ HMAC 挑战-响应
┌──────────────────────────────────────┴─────────┴─────┐
│                   守护进程 (Daemon)                    │
│  ┌────────────┐  ┌─────────┐ ┌──────┐ ┌──────────┐  │
│  │  icqq      │  │  IPC    │ │ RPC  │ │ Webhook  │  │
│  │  Client    │◂─│  Server │ │Server│ │  推送     │  │
│  │  (QQ协议)  │  │  (sock) │ │(TCP) │ │(HTTP POST)│  │
│  └─────┬──────┘  └─────────┘ └──────┘ └──────────┘  │
└────────┼─────────────────────────────────────────────┘
         │
         ▼
   腾讯 QQ 服务器
```

- **CLI 层**：基于 [Pastel](https://github.com/nickstefan/pastel) 文件系统路由，`src/commands/` 目录结构即命令结构；React Ink 渲染终端 UI
- **IPC 通信**：CLI 与守护进程通过 `~/.icqq/<uin>/daemon.sock` Unix Socket 通信，首次连接需 Token 认证
- **RPC 通信**：可选的 TCP 远程连接，使用 HMAC-SHA256 挑战-响应认证（token 不经过网络传输），支持 IP 限速防暴力破解
- **守护进程**：登录后在后台运行，管理 icqq 客户端实例，自动断线重连（指数退避，最多 5 次）
- **Webhook**：可选配置，守护进程将消息事件 POST 到指定 URL
- **日志轮转**：守护进程日志 > 5MB 自动轮转

### RPC 远程连接

守护进程支持通过 TCP 远程访问，适用于跨机器控制 QQ 账号的场景。

**启用 RPC：**

在 `~/.icqq/config.json` 中配置：

```json
{
  "rpc": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 0
  }
}
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 RPC TCP 监听 | `false` |
| `host` | 监听地址，`"0.0.0.0"` = 对外开放 | `"127.0.0.1"` |
| `port` | 监听端口，`0` = 系统自动分配 | `0` |

**安全机制：**

1. **HMAC-SHA256 挑战-响应认证** — 连接后服务端发送随机 challenge，客户端用 `HMAC(token, challenge)` 回复，token 永不经过网络传输
2. **IP 限速** — 同一 IP 在 5 分钟内认证失败 5 次后自动封锁
3. **默认仅本机** — 必须显式配置 `host: "0.0.0.0"` 才对外暴露
4. **未认证缓冲区限制** — 4KB 防止未认证连接的内存耗尽攻击

**编程接入：**

```typescript
import { IpcClient } from "@icqqjs/cli/lib/ipc-client";

// 方式一：指定地址和 token
const client = await IpcClient.connectRpc({
  host: "192.168.1.100",
  port: 9100,
  token: "your-token-here",
});

// 方式二：自动从 daemon.rpc 文件读取（本机）
const client = await IpcClient.connectRpcByUin(12345);

const resp = await client.request("list_friends");
client.close();
```

## 开发

```bash
pnpm install
pnpm build
npm link         # 本地全局注册 icqq 命令
```

### 发版流程

使用 [Changesets](https://github.com/changesets/changesets) 管理版本：

```bash
pnpm changeset        # 添加变更描述
git add . && git commit
git push              # 推送后 GitHub Actions 自动创建 Version PR
                      # 合并 Version PR 后自动发布到 GitHub Packages
```

## License

ISC
