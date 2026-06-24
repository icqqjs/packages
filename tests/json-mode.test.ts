import { afterEach, describe, expect, it } from "vitest";
import { isJsonMode } from "../src/lib/json-mode.js";

describe("isJsonMode", () => {
  afterEach(() => {
    delete process.env.ICQQ_JSON_OUTPUT;
  });

  it("returns true when ICQQ_JSON_OUTPUT is 1", () => {
    process.env.ICQQ_JSON_OUTPUT = "1";
    expect(isJsonMode()).toBe(true);
  });

  it("returns false when unset or other values", () => {
    expect(isJsonMode()).toBe(false);
    process.env.ICQQ_JSON_OUTPUT = "0";
    expect(isJsonMode()).toBe(false);
  });
});
