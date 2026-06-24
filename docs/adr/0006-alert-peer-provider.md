# ADR-0006: Alert Peer Provider（双机互备）

## Status

Accepted

## Context

多机部署 icqq 时，需在实例 A 掉线或需人机登录时通知管理员。原「OneBot/Satori/Milky adapter」方案过重；真实需求是借助**另一台在线守护进程 B** 发 QQ 私聊或群消息。

## Decision

- 新增第 9 路告警 provider：**`peer`**
- A 的 `AlertDispatcher` 通过 **RPC（HMAC）** 连接 B 的守护进程，调用已有 `send_private_msg` / `send_group_msg`
- 配置：`alerts.providers.peer.{host,port,token,userId?,groupId?,enabled?}`；`userId` 与 `groupId` 至少其一
- 可选环境变量：`ICQQ_ALERT_PEER_*`
- **不**新增 B 侧 HTTP 接收端；**不**实现 OneBot/Satori/Milky adapter（该方向已废弃）

## Consequences

- 依赖 B 的 RPC 已启用且 QQ 在线；A 进程崩溃时无效（需另做探活）
- peer 与 bark/generic 等可并行；EventBus 级语义仍为 dispatcher 内 `Promise.allSettled`
- 文档补充「双机互备」示例
