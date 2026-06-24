import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import {
  awaitLoginOutcome,
  bindInteractiveLoginHandlers,
  LOGIN_INTERACTIVE_ERRORS,
  waitForLoginOutcome,
} from "../src/lib/account-bootstrap.js";

function createLoginClient() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    login: vi.fn(async () => undefined),
    once: emitter.once.bind(emitter),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
  });
}

describe("account-bootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reject policy resolves on system.online", async () => {
    const client = createLoginClient();
    const promise = awaitLoginOutcome(client, "reject", () => client.login(123), {
      errorVariant: "daemon",
    });
    client.emit("system.online");
    await expect(promise).resolves.toBeUndefined();
  });

  it("reject policy rejects all five interactive events for daemon", async () => {
    const client = createLoginClient();
    const events = [
      ["system.login.qrcode", LOGIN_INTERACTIVE_ERRORS.daemon.qrcode],
      ["system.login.slider", LOGIN_INTERACTIVE_ERRORS.daemon.slider],
      ["system.login.device", LOGIN_INTERACTIVE_ERRORS.daemon.device],
      ["system.login.auth", LOGIN_INTERACTIVE_ERRORS.daemon.auth],
    ] as const;

    for (const [event, message] of events) {
      const c = createLoginClient();
      const promise = awaitLoginOutcome(c, "reject", () => c.login(1), {
        errorVariant: "daemon",
      });
      c.emit(event);
      await expect(promise).rejects.toThrow(message);
    }
  });

  it("waitForLoginOutcome times out for reconnect", async () => {
    const client = createLoginClient();
    const promise = waitForLoginOutcome(client, {
      errorVariant: "reconnect",
      timeoutMs: 1000,
    });
    vi.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow(LOGIN_INTERACTIVE_ERRORS.reconnect.timeout);
  });

  it("bindInteractiveLoginHandlers forwards events to callbacks", () => {
    const client = createLoginClient();
    const onQrcode = vi.fn();
    const dispose = bindInteractiveLoginHandlers(client, {
      onOnline: vi.fn(),
      onLoginError: vi.fn(),
      onQrcode,
      onSlider: vi.fn(),
      onDevice: vi.fn(),
      onAuth: vi.fn(),
    });

    client.emit("system.login.qrcode", { image: Buffer.from("x") });
    expect(onQrcode).toHaveBeenCalled();
    dispose();
    client.emit("system.login.qrcode", { image: Buffer.from("y") });
    expect(onQrcode).toHaveBeenCalledTimes(1);
  });
});
