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

  it("handles sms submit, send_sms, continue and validation errors", async () => {
    const client = createMockClient();
    const session = new LoginSession(client, 123, 60_000, 10);
    session.start();

    const sms = await executeLoginAction(
      client,
      { id: "5", action: LoginActions.LOGIN_SUBMIT, params: { kind: "sms", value: "123456" } },
      session,
    );
    expect(sms.ok).toBe(true);

    const sendSms = await executeLoginAction(
      client,
      { id: "6", action: LoginActions.LOGIN_SEND_SMS, params: {} },
      session,
    );
    expect(sendSms.ok).toBe(true);

    const cont = await executeLoginAction(
      client,
      { id: "7", action: LoginActions.LOGIN_SUBMIT, params: { kind: "auth" } },
      session,
    );
    expect(cont.ok).toBe(true);

    const missingTicket = await executeLoginAction(
      client,
      { id: "8", action: LoginActions.LOGIN_SUBMIT, params: { kind: "slider", value: " " } },
      session,
    );
    expect(missingTicket.ok).toBe(false);

    const unknownKind = await executeLoginAction(
      client,
      { id: "9", action: LoginActions.LOGIN_SUBMIT, params: { kind: "nope" } },
      session,
    );
    expect(unknownKind.error).toMatch(/未知 kind/);

    const unknownAction = await executeLoginAction(
      client,
      { id: "10", action: "login_other", params: {} },
      session,
    );
    expect(unknownAction.error).toMatch(/未知 login action/);

    session.stop();
  });

  it("surfaces client errors from send_sms", async () => {
    const client = createMockClient();
    (client as { sendSmsCode: ReturnType<typeof vi.fn> }).sendSmsCode.mockRejectedValue(
      new Error("sms failed"),
    );
    const session = new LoginSession(client, 123, 60_000, 10);
    session.start();
    const res = await executeLoginAction(
      client,
      { id: "11", action: LoginActions.LOGIN_SEND_SMS, params: {} },
      session,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("sms failed");
    session.stop();
  });
});
