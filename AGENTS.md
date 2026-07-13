# AGENTS

本文件给 AI 编码代理提供最小可执行上下文，帮助其在本仓库快速、安全地完成任务。

## 快速上手

- 运行环境：Node.js >= 22，包管理器为 pnpm（锁文件为 `pnpm-lock.yaml`）。
- 本仓库为 pnpm monorepo，对外包位于 `packages/*`：`@icqqjs/cli`（`packages/cli`）、`@icqqjs/sdk`（`packages/sdk`）、`@icqqjs/gateway`（`packages/gateway`）。
- 安装依赖：`pnpm install`（根目录）
- 类型检查：`pnpm typecheck`（= `pnpm -r typecheck`）
- 测试：`pnpm test`（= `pnpm -r test`）
- 构建：`pnpm build`（= `pnpm -r build`）
- 单包操作：`pnpm --filter @icqqjs/cli <script>`。

默认在提交前至少执行：`pnpm typecheck && pnpm test`。

## 代码结构（高价值路径）

CLI 包（`packages/cli/`）：

- `packages/cli/src/commands/`: CLI 命令入口（目录结构即命令结构，基于 Pastel 文件路由）。
- `packages/cli/src/components/`: Ink/Pastel 交互组件（选择器、会话 UI 等）。
- `packages/cli/src/daemon/`: 守护进程（登录态、IPC/RPC 服务、事件桥接、生命周期）。
- `packages/cli/src/mcp/`: MCP server 与 action 调用适配层。
- `packages/cli/src/lib/`: 通用基础库（配置、路径、IPC 客户端、消息解析等）。
- `packages/cli/tests/`: Vitest 测试，命名为 `*.test.ts`。

其它包：`packages/sdk/`（稳定公开 SDK 子路径边界）、`packages/gateway/`（多 bot 网关）。

## 修改约定

- 新增 CLI 能力时，优先在 `packages/cli/src/commands/` 增加/修改命令文件，并复用 `packages/cli/src/lib/` 的通用逻辑。
- 涉及守护进程行为（登录、重连、IPC/RPC/MCP）时，优先在 `packages/cli/src/daemon/` 和 `packages/cli/src/mcp/` 做最小闭环修改，不要在命令层复制协议逻辑。
- 独立业务线（gateway 等）只能依赖 `@icqqjs/sdk/*` 公开子路径，不得 import `@icqqjs/cli` 内部实现。
- 测试与实现保持同层语义：为新增行为补充对应包 `tests/` 下的主题测试。
- 保持 ESM + TypeScript 风格，与现有 strict 类型约束一致（见各包 `tsconfig.json`）。

## 常见坑点

- `data/` 目录被 `.gitignore` 忽略，含本地运行态与账号数据；不要依赖其内容编写可提交代码。
- 路径约定集中在 `packages/cli/src/lib/paths.ts`，所有 `~/.icqq` 相关文件路径应复用该模块，不要散落硬编码。
- CLI 全局参数 `-u/--uin` 和 `--json` 在 `packages/cli/src/cli.tsx` 被预处理；新增全局参数时要避免与 Pastel 参数解析冲突。
- `skills` 是 git submodule，位于 `packages/skills`；克隆需 `--recurse-submodules`。

## 参考文档（链接，不重复）

- monorepo 总览：根 `README.md`
- CLI 主文档与命令手册：`packages/cli/README.md`
- Skill 总览：`packages/skills/README.md`
- icqq skill 入口：`packages/skills/icqq/SKILL.md`

如果任务涉及完整命令参数、账号服务/MCP 配置细节或用户侧操作流程，优先阅读 `README.md` 对应章节后再改代码。

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for this repository; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is configured as a single-context repo: use root `CONTEXT.md` and `docs/adr/` when they exist. See `docs/agents/domain.md`.