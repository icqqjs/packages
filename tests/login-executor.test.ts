import { describe, it, expect, vi } from "vitest";
import { LoginActions } from "../src/daemon/login-actions.js";
import { executeLoginAction } from "../src/daemon/executors/login.js";
import { LoginSession } from "../src/daemon/login-session.js";
import type { Client } from "@icqqjs/icqq";

function createMockClient() {
  return {
    submitSlider: vi.fn(async () => {}),
    submitSmsCode: vi.fn(async () => {}),
    sendSmsCode: vi.fn(async () => {}),
    login: vi.fn(async () => {}),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as Client;
}

describe("executeLoginAction", () => {
  it("returns session state for login_get_state", async () => {
    const client = createMockClient();
    const session = new LoginSession(client, 123, 60_000, 10);
    session.start();

    const res = await executeLoginAction(
      client,
      { id: "1", action: LoginActions.LOGIN_GET_STATE, params: {} },
      session,
    );
    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ phase: "connecting" });
    session.stop();
  });

  it("submits slider ticket", async () => {
    const client = createMockClient();
    const session = new LoginSession(client, 123, 60_000, 10);
    session.start();

    const res = await executeLoginAction(
      client,
      {
        id: "2",
        action: LoginActions.LOGIN_SUBMIT,
        params: { kind: "slider", value: "ticket-abc" },
      },
      session,
    );
    expect(res.ok).toBe(true);
    expect((client as { submitSlider: ReturnType<typeof vi.fn> }).submitSlider).toHaveBeenCalledWith(
      "ticket-abc",
    );
    session.stop();
  });

  it("rate limits login_submit", async () => {
    const client = createMockClient();
    const session = new LoginSession(client, 123, 60_000, 1);
    session.start();

    await executeLoginAction(
      client,
      { id: "3", action: LoginActions.LOGIN_SUBMIT, params: { kind: "continue" } },
      session,
    );
    const blocked = await executeLoginAction(
      client,
      { id: "4", action: LoginActions.LOGIN_SUBMIT, params: { kind: "continue" } },
      session,
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/频繁/);
    session.stop();
  });
});
