import { describe, it, expect } from "vitest";
import { Actions } from "../src/daemon/protocol.ts";

describe("Actions", () => {
  it("has no duplicate values", () => {
    const values = Object.values(Actions);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("all values are non-empty strings", () => {
    for (const [key, value] of Object.entries(Actions)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("all values use snake_case", () => {
    for (const value of Object.values(Actions)) {
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("all keys use UPPER_SNAKE_CASE", () => {
    for (const key of Object.keys(Actions)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it("contains essential actions", () => {
    expect(Actions.PING).toBe("ping");
    expect(Actions.SEND_PRIVATE_MSG).toBe("send_private_msg");
    expect(Actions.SEND_GROUP_MSG).toBe("send_group_msg");
    expect(Actions.LIST_FRIENDS).toBe("list_friends");
    expect(Actions.LIST_GROUPS).toBe("list_groups");
    expect(Actions.SUBSCRIBE).toBe("subscribe");
    expect(Actions.SET_WEBHOOK).toBe("set_webhook");
  });
});
