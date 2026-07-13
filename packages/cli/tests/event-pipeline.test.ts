import { describe, expect, it, vi } from "vitest";
import { EventPipeline } from "../src/daemon/event-pipeline.js";

describe("EventPipeline", () => {
  it("runs webhook, notify, and fan-out in order", () => {
    const order: string[] = [];
    const ctx = {
      pushWebhook: vi.fn(async () => {
        order.push("webhook");
      }),
      notifications: {
        notifyMessage: vi.fn(() => {
          order.push("notify");
        }),
      },
      client: {},
    };
    const fanOut = vi.fn(() => {
      order.push("fanout");
    });

    const pipeline = new EventPipeline(ctx as never, fanOut);
    pipeline.handle({ event: "message.private", data: { x: 1 } });

    expect(order).toEqual(["webhook", "notify", "fanout"]);
    expect(fanOut).toHaveBeenCalledWith("message.private", { x: 1 });
  });
});
