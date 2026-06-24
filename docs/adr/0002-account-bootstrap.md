# ADR-0002: Account Bootstrap Module

## Status

Accepted (2025-06-24)

## Context

Login semantics were duplicated across `login.tsx`, `LoginFlow.tsx`, `daemon/entry.ts`, and `managed-runtime.ts`. Interactive event wiring and error messages diverged (e.g. `entry.ts` omitted `system.login.auth`). Post-login orchestration (tmp migration, network ports, spawn) lived only in `login.tsx`.

## Decision

Introduce **`AccountBootstrap`** at `src/lib/account-bootstrap.ts`:

- `awaitLoginOutcome` / `waitForLoginOutcome` — reject policy for daemon cold start and reconnect
- `bindInteractiveLoginHandlers` — interactive policy for Ink UI (`LoginFlow`)
- `LOGIN_INTERACTIVE_ERRORS` — unified copy for `daemon` vs `reconnect` variants
- `runPostLoginSetup` — post-login migration, config, network, spawn

`LoginFlow` remains a UI adapter; it calls `bindInteractiveLoginHandlers` instead of binding `client.on` directly.

## Consequences

- Adding a new interactive login event requires updating `account-bootstrap.ts` once.
- `createInteractiveLoginAwaitOutcome` in `managed-runtime.ts` is a thin re-export from bootstrap.
