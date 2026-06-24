# ADR-0001: Unified Action Registry

## Status

Accepted (2025-06-24)

## Context

IPC and MCP both invoked QQ operations through parallel registries: `MESSAGE_ACTION_CATALOG`, `LEGACY_ACTION_HANDLERS`, `ACTION_HINTS`, and `action-meta` mirrors. Daemon-config actions (`SET_WEBHOOK`, `GET_WEBHOOK`, `SET_NOTIFY`, `GET_NOTIFY`) reached `DaemonContext` via `tryGetDaemonContext()`, a process-global singleton.

## Decision

- One **ActionRegistry** seam: `ACTION_CATALOG` built from `src/daemon/executors/` (basic, messaging, legacy).
- Every action `execute(client, params, ctx)` receives **explicit** `DaemonContext`; no global lookup in executors.
- `handleRequest(client, req, ctx)` lives in `request-router.ts`.
- `action-hints.ts` and `handlers.ts` are removed; metadata is co-located with each catalog entry.

## Consequences

- IPC (`DaemonServer`) and tests pass `ctx` at the call site.
- MCP (`invokeMcpAction`) still uses `tryGetDaemonContext()` until ADR follow-up removes the global (Commit 4).
- Adding an action means one entry in the appropriate `executors/*.ts` file.
