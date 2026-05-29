import { describe, expect, it } from "vitest";
import { validateWebhookUrl } from "../src/daemon/webhook.js";

describe("validateWebhookUrl", () => {
  it("allows empty url", () => {
    expect(validateWebhookUrl("")).toBeNull();
  });

  it("allows public https url", () => {
    expect(validateWebhookUrl("https://example.com/hook")).toBeNull();
  });

  it("rejects localhost", () => {
    expect(validateWebhookUrl("http://127.0.0.1/hook")).toBeTruthy();
  });
});
