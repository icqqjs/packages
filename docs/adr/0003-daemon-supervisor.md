# ADR-0003: DaemonSupervisor

## Status

Accepted

## Context

守护进程生命周期（`lifecycle.ts`）与系统服务安装（`commands/service/_helpers.ts`）分散在两处，CLI 与登录后编排需要分别 import，难以描述「账号守护进程进程契约」这一统一概念。

## Decision

新建 `src/daemon/supervisor.ts`，合并：

- `spawnDaemon` / `stopDaemon` / `janitorStaleDaemonArtifacts` / 就绪探测（pid + socket）
- launchd / systemd plist/unit 生成与 install/start/stop/restart/query

导出命名空间 `DaemonSupervisor` 作为语义入口；`lifecycle.ts` 与 `service/_helpers.ts` 保留为薄 re-export，供渐进迁移。

## Consequences

- 登录、`account-bootstrap`、service 子命令统一从 `supervisor` 引用核心能力
- 单测集中在 `tests/lifecycle.test.ts` 与 `tests/service-helpers.test.ts`（import 路径改为 supervisor）
- 平台相关 launchd/systemd 逻辑未重构，仅搬家
