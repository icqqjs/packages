import { describe, expect, it } from "vitest";
import {
  appendAndSplitLines,
  formatJsonLine,
  parseJsonLine,
} from "../src/lib/json-line-framing.js";

describe("json-line-framing", () => {
  it("splits partial frames across chunks", () => {
    let buffer = "";
    const first = appendAndSplitLines(buffer, '{"a":1}\n{"b":');
    expect(first.lines).toEqual(['{"a":1}']);
    expect(first.remainder).toBe('{"b":');

    const second = appendAndSplitLines(first.remainder, '2}\n');
    expect(second.lines).toEqual(['{"b":2}']);
    expect(second.remainder).toBe("");
  });

  it("formats and parses json lines", () => {
    const line = formatJsonLine({ ok: true, n: 1 });
    expect(line.endsWith("\n")).toBe(true);
    expect(parseJsonLine(line.trim())).toEqual({ ok: true, n: 1 });
  });
});
