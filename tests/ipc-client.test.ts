import { describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "../src/daemon/protocol.js";
import { IpcClient } from "../src/lib/ipc-client.js";

function createClientHarness() {
  let registeredHandler: ((event: IpcEvent) => void) | undefined;
  const off = vi.fn();
  const client = Object.create(IpcClient.prototype) as IpcClient & {
    onEvent: (handler: (event: IpcEvent) => void) => () => void;
  };
  client.onEvent = vi.fn((handler: (event: IpcEvent) => void) => {
    registeredHandler = handler;
    return off;
  });

  return {
    client,
    off,
    emit(event: IpcEvent) {
      registeredHandler?.(event);
    },
  };
}

describe("IpcClient canonical subscriptions", () => {
  it("filters private and group chat sessions through subscribeChatSession", () => {
    const harness = createClientHarness();
    const privateHit = vi.fn();
    const groupHit = vi.fn();

    const privateOff = harness.client.subscribeChatSession("private", 100, privateHit);
    harness.emit({
      id: "*",
      event: "message.private.friend",
      data: { message_type: "private", from_id: 100 },
    } as IpcEvent);
    harness.emit({
      id: "*",
      event: "message.private.friend",
      data: { message_type: "private", from_id: 200 },
    } as IpcEvent);
    expect(privateHit).toHaveBeenCalledTimes(1);
    expect(privateOff).toBe(harness.off);

    const groupHarness = createClientHarness();
    const groupOff = groupHarness.client.subscribeChatSession("group", 123, groupHit);
    groupHarness.emit({
      id: "*",
      event: "message.group.normal",
      data: { message_type: "group", group_id: 123 },
    } as IpcEvent);
    groupHarness.emit({
      id: "*",
      event: "message.group.normal",
      data: { message_type: "group", group_id: 456 },
    } as IpcEvent);
    expect(groupHit).toHaveBeenCalledTimes(1);
    expect(groupOff).toBe(groupHarness.off);
  });

  it("filters guild channel subscriptions through subscribeGuildChannel", () => {
    const harness = createClientHarness();
    const guildHit = vi.fn();

    const off = harness.client.subscribeGuildChannel("ch-1", guildHit);
    harness.emit({
      id: "*",
      event: "message.guild.normal",
      data: { channel_id: "ch-1" },
    } as IpcEvent);
    harness.emit({
      id: "*",
      event: "message.guild.normal",
      data: { channel_id: "ch-2" },
    } as IpcEvent);

    expect(guildHit).toHaveBeenCalledTimes(1);
    expect(off).toBe(harness.off);
  });

  it("keeps deprecated subscribe as a compatibility wrapper", async () => {
    const harness = createClientHarness();
    const hit = vi.fn();

    const sub = harness.client.subscribe("subscribe", { type: "private", id: 77 }, hit);
    harness.emit({
      id: "*",
      event: "message.private.friend",
      data: { message_type: "private", from_id: 77 },
    } as IpcEvent);
    harness.emit({
      id: "*",
      event: "message.private.friend",
      data: { message_type: "private", from_id: 88 },
    } as IpcEvent);

    expect(hit).toHaveBeenCalledTimes(1);
    await sub.unsubscribe();
    expect(harness.off).toHaveBeenCalledTimes(1);
  });
});