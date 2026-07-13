import { describe, expect, it } from "vitest";
import { extractBearer, parseCookies, SESSION_COOKIE } from "../src/http/auth.js";

describe("http auth helpers", () => {
  it("parses cookie headers", () => {
    const cookies = parseCookies(`${SESSION_COOKIE}=abc123; other=x%20y`);
    expect(cookies[SESSION_COOKIE]).toBe("abc123");
    expect(cookies.other).toBe("x y");
  });

  it("returns empty object for missing cookie header", () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it("extracts bearer tokens", () => {
    expect(extractBearer("Bearer tok-123")).toBe("tok-123");
    expect(extractBearer("Basic abc")).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
  });
});
