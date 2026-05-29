import { describe, expect, it, vi } from "vitest";
import { EventBridge } from "../src/daemon/event-bridge.js";

describe("EventBridge", () => {
  it("hooks em and notifies subscribers once per event", () => {
    const bridge = new EventBridge();
    const inner = vi.fn();
    const client = { em: inner };
    bridge.attach(client as never);

    const hits: string[] = [];
    bridge.subscribe(({ event }) => {
      hits.push(event);
    });

    client.em("message.private.friend", {
      raw_message: "hi",
      toJSON() {
        return { raw_message: "hi" };
      },
    });

    expect(inner).toHaveBeenCalledOnce();
    expect(hits).toEqual(["message.private.friend"]);
  });

  it("does not dispatch when event name is empty", () => {
    const bridge = new EventBridge();
    const client = { em: vi.fn() };
    bridge.attach(client as never);

    const hits: string[] = [];
    bridge.subscribe(({ event }) => hits.push(event));

    client.em("");
    expect(hits).toEqual([]);
  });

  it("attach is idempotent", () => {
    const bridge = new EventBridge();
    const inner = vi.fn();
    const client = { em: inner };
    bridge.attach(client as never);
    bridge.attach(client as never);

    const hits: string[] = [];
    bridge.subscribe(({ event }) => hits.push(event));
    client.em("system.online", { toJSON: () => ({}) });

    expect(hits).toEqual(["system.online"]);
  });
});
