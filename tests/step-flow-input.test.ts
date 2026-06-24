import { describe, expect, it } from "vitest";
import {
  applyTextInputKey,
  moveSelectIndex,
  toggleBinaryIndex,
} from "../src/lib/step-flow-input.js";

describe("applyTextInputKey", () => {
  it("appends printable input", () => {
    expect(applyTextInputKey("ab", "c", {})).toEqual({
      type: "append",
      value: "abc",
    });
  });

  it("ignores ctrl/meta modified input", () => {
    expect(applyTextInputKey("ab", "c", { ctrl: true })).toEqual({ type: "noop" });
  });

  it("handles backspace and delete", () => {
    expect(applyTextInputKey("abc", "", { backspace: true })).toEqual({
      type: "backspace",
      value: "ab",
    });
    expect(applyTextInputKey("abc", "", { delete: true })).toEqual({
      type: "backspace",
      value: "ab",
    });
  });

  it("submits on return", () => {
    expect(applyTextInputKey("hello", "", { return: true })).toEqual({
      type: "submit",
      value: "hello",
    });
  });
});

describe("toggleBinaryIndex", () => {
  it("toggles between 0 and 1", () => {
    expect(toggleBinaryIndex(0)).toBe(1);
    expect(toggleBinaryIndex(1)).toBe(0);
  });
});

describe("moveSelectIndex", () => {
  it("clamps at bounds", () => {
    expect(moveSelectIndex(0, "up", 3)).toBe(0);
    expect(moveSelectIndex(3, "down", 3)).toBe(3);
    expect(moveSelectIndex(1, "up", 3)).toBe(0);
    expect(moveSelectIndex(1, "down", 3)).toBe(2);
  });
});
