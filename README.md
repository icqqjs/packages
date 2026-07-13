# icqqjs/packages

icqq 对外包的 monorepo，基于 pnpm workspace 统一管理以下包：

| 包 | 目录 | 说明 |
|----|------|------|
| [`@icqqjs/cli`](packages/cli) | `packages/cli` | 基于 icqq 的命令行 QQ 客户端（含 daemon、MCP、skills） |
| [`@icqqjs/sdk`](packages/sdk) | `packages/sdk` | 面向独立业务线的稳定公开 SDK（gateway/daemon/protocol/bot 子路径） |
| [`@icqqjs/gateway`](packages/gateway) | `packages/gateway` | 多用户多 bot 网关（主机隔离、集中 MCP/RPC、Web 控制面） |

## 快速上手

要求 Node.js >= 22，包管理器为 pnpm。

```bash
pnpm install          # 安装全部 workspace 依赖
pnpm build            # 构建所有包（pnpm -r build）
pnpm typecheck        # 类型检查所有包
pnpm test             # 运行所有包测试
```

各包的详细文档见对应目录下的 `README.md`。`skills` 作为 git submodule 位于 `packages/skills`，克隆时请使用 `git clone --recurse-submodules` 或执行 `git submodule update --init --recursive`。

## 目录约定

- 对外发布的 npm 包统一放在 `packages/*`，包名保持 `@icqqjs/*`。
- 仓库级配置（CI、hooks、agent 文档）位于根目录 `.github/`、`AGENTS.md`、`CONTEXT.md`。
