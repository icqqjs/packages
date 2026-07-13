import { describe, it, expect, vi } from "vitest";
import { LoginActions } from "../src/daemon/login-actions.js";
import { handleRequest } from "../src/daemon/request-router.js";
import { LoginSession } from "../src/daemon/login-session.js";
import { Actions } from "../src/daemon/protocol.js";
import { createStubDaemonContext } from "./helpers/daemon-test-context.js";
import type { Client } from "@icqqjs/icqq";

const mockClient = {
  on: vi.fn(),
  off: vi.fn(),
} as unknown as Client;

describe("login IPC gate", () => {
  it("rejects login actions when session inactive", async () => {
    const session = new LoginSession(mockClient, 1, 60_000, 10);
    const res = await handleRequest(
      mockClient,
      { id: "1", action: LoginActions.LOGIN_GET_STATE, params: {} },
      null,
      session,
    );
    expect(res).toEqual({ id: "1", ok: false, error: "daemon_login_required" });
  });

  it("allows login_get_state when session active", async () => {
    const session = new LoginSession(mockClient, 1, 60_000, 10);
    session.start();
    const res = await handleRequest(
      mockClient,
      { id: "2", action: LoginActions.LOGIN_GET_STATE, params: {} },
      null,
      session,
    );
    expect(res.ok).toBe(true);
    session.stop();
  });

  it("rejects catalog actions without daemon context during waiting", async () => {
    const session = new LoginSession(mockClient, 1, 60_000, 10);
    session.start();
    const res = await handleRequest(
      mockClient,
      { id: "3", action: Actions.SEND_PRIVATE_MSG, params: {} },
      null,
      session,
    );
    expect(res).toEqual({ id: "3", ok: false, error: "daemon_login_required" });
    session.stop();
  });

  it("allows catalog actions with full context", async () => {
    const ctx = createStubDaemonContext(mockClient);
    const res = await handleRequest(
      mockClient,
      { id: "4", action: Actions.PING, params: {} },
      ctx,
      null,
    );
    expect(res.ok).toBe(true);
  });
});
