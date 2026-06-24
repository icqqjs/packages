# ADR-0005: Headless 告警与门控 Login IPC / Web UI

## Status

Accepted

## Context

在 headless Linux 部署下，守护进程 token 失效或网络重连需人机验证时，原先 `entry.ts` 在 `DaemonContext` 创建前 `exit(1)`，无告警、无续传路径。桌面 `NotificationService` 对无人值守无效；重连耗尽亦仅桌面通知。

## Decision

### 告警（AlertDispatcher）

- **5 类事件**：`daemon_ready`、`login_waiting`、`offline_network`、`offline_kickoff`、`online`（每次 `system.online`，接受噪音，靠 per-kind cooldown 默认 15min）
- **8 路内置 provider**：bark、wecom、dingtalk、feishu、telegram、pushdeer、serverchan、generic；**邮件首版不做**
- **peer provider**（ADR-0006）：经对端守护进程 RPC 发 QQ 私聊/群聊，用于双机互备
- **配置**：`alerts.providers.<type>.<field>` 对象 + 可选 `ICQQ_ALERT_*` 环境变量；广播投递；正文按 channel 富文本
- **安全**：告警正文使用 `login.http.publicUrl/login`，**不含** IPC token

### 门控 Login IPC + Web UI

- **共享 executor**：`executors/login.ts` 供 IPC 与 HTTP 共用
- **LoginSession**：waiting 期间单例，包装 interactive handlers
- **门控 actions**（不进主 `ACTION_CATALOG`）：`login_get_state`、`login_submit`、`login_send_sms`
- **LoginWaitingRuntime**：冷启动/重连交互失败时进入 `login_waiting`，不 exit；同一 `daemon.sock` 上 `LoginIpcServer` 仅服务 login actions；`LoginWebHost` 提供 `/login/auth` 表单鉴权 + SSE 状态
- **MCP 隔离**：全部 `login_*` 列入 `MCP_BLOCKED_ACTIONS`

### 威胁模型（可接受前提）

| 风险 | 缓解 |
|------|------|
| token 泄漏 | Web 默认 `127.0.0.1`；告警不带 token；文档强调 SSH 隧道/反代 |
| 非 waiting 态滥用 login IPC | `LoginSessionGate` 返回 `daemon_login_required` |
| MCP/Agent 攻击面扩大 | login actions 永不注册 MCP |
| 暴力试码 | `login_submit` per-session 速率限制 |

## Consequences

- `entry.ts` / `managed-runtime.ts` 交互式登录失败进入 `runLoginWaitingRuntime` 而非 exit
- lifecycle 类通知在 `alerts.enabled` 时经 `AlertDispatcher`（可与桌面 notify 并存）
- 需配置 `login.http.publicUrl` 才能在手机端点击告警外链；SSH 隧道由用户自行配置
- 后续可增 `email` provider、`icqq login attach` CLI
