# icqq CLI — Domain Glossary

## AccountBootstrap

Module at `src/lib/account-bootstrap.ts` that owns QQ account login lifecycle and post-login orchestration. Callers use either **reject** policy (daemon, reconnect) or **interactive** policy (Ink `LoginFlow`).

## LoginInteractivePolicy

- `reject` — interactive login events become errors (`awaitLoginOutcome`, `waitForLoginOutcome`)
- `interactive` — events forwarded to UI via `bindInteractiveLoginHandlers`

## ActionRegistry

Unified IPC/MCP action catalog in `src/daemon/action-catalog.ts` and `src/daemon/executors/`. Each action exposes `execute(client, params, ctx)`.

## DaemonSupervisor

Module at `src/daemon/supervisor.ts` describing the per-account daemon process contract: `spawn`/`stop`/`janitor`, readiness (pid + Unix socket), and OS service install (launchd/systemd). Namespace export: `DaemonSupervisor`.

## JsonLineTransport

Shared newline-delimited JSON framing in `src/lib/json-line-framing.ts`, used by IPC server (`DaemonServer`) and `ipc-client` adapters.

## DaemonEventDispatcher

Module at `src/daemon/event-dispatcher.ts` that registers icqq client events (messages + `request.*` social events) and fans out to `EventPipeline` (webhook → notify → IPC).

## McpPolicy / McpServer

MCP layer entry at `src/mcp/server.ts` with blocked-action policy in `src/mcp/policy.ts`. HTTP host is `McpHost`; invocation goes through `invokeMcpAction(client, action, params, ctx)`.

## AlertDispatcher

Module at `src/daemon/alert/` broadcasting lifecycle alerts (`daemon_ready`, `login_waiting`, `offline_*`, `online`) to configured providers when `alerts.enabled`. Cooldown is per-kind in-process. **`peer`** provider relays alerts via another daemon’s RPC (`send_private_msg` / `send_group_msg`).

## LoginSession / LoginWaitingRuntime

`LoginSession` (`src/daemon/login-session.ts`) holds interactive login state during `login_waiting`. `LoginWaitingRuntime` orchestrates restricted `LoginIpcServer`, `LoginWebHost`, and alerts until `system.online`, then hands off to full `DaemonServer`.

## LoginIpcGate

`request-router.ts` routes `login_*` actions only when `LoginSession.isActive()`; other IPC requests during waiting return `daemon_login_required`.
