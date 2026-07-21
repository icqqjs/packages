import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { requestOrigin, sanitizeReportedBaseUrl } from "../src/http/origin.js";

function fakeReq(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe("requestOrigin", () => {
  it("prefers X-Forwarded-Proto/Host behind a reverse proxy", () => {
    const req = fakeReq({
      host: "127.0.0.1:8787",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "gw.example.com",
    });
    expect(requestOrigin(req, "http://127.0.0.1:8787")).toBe(
      "https://gw.example.com",
    );
  });

  it("takes the first value of comma-separated forwarded headers", () => {
    const req = fakeReq({
      "x-forwarded-proto": "https, http",
      "x-forwarded-host": "gw.example.com, proxy.internal",
    });
    expect(requestOrigin(req, "http://127.0.0.1:8787")).toBe(
      "https://gw.example.com",
    );
  });

  it("falls back to Host header for direct access", () => {
    const req = fakeReq({ host: "192.168.1.10:8787" });
    expect(requestOrigin(req, "http://127.0.0.1:8787")).toBe(
      "http://192.168.1.10:8787",
    );
  });

  it("uses fallback when no host information is present", () => {
    const req = fakeReq({});
    expect(requestOrigin(req, "http://127.0.0.1:8787")).toBe(
      "http://127.0.0.1:8787",
    );
  });
});

describe("sanitizeReportedBaseUrl", () => {
  it("replaces loopback host with the peer address", () => {
    expect(
      sanitizeReportedBaseUrl("http://127.0.0.1:8787", "10.0.0.2"),
    ).toBe("http://10.0.0.2:8787");
  });

  it("replaces wildcard listen host with the peer address", () => {
    expect(sanitizeReportedBaseUrl("http://0.0.0.0:8787", "10.0.0.2")).toBe(
      "http://10.0.0.2:8787",
    );
  });

  it("unwraps IPv4-mapped IPv6 peer addresses", () => {
    expect(
      sanitizeReportedBaseUrl("http://127.0.0.1:8787", "::ffff:10.0.0.2"),
    ).toBe("http://10.0.0.2:8787");
  });

  it("keeps reachable addresses such as reverse-proxy domains untouched", () => {
    expect(
      sanitizeReportedBaseUrl("https://gw-remote.example.com", "10.0.0.2"),
    ).toBe("https://gw-remote.example.com");
    expect(sanitizeReportedBaseUrl("http://10.0.0.2:8787", "1.2.3.4")).toBe(
      "http://10.0.0.2:8787",
    );
  });

  it("returns the input unchanged without a peer address or on invalid URL", () => {
    expect(sanitizeReportedBaseUrl("http://127.0.0.1:8787", undefined)).toBe(
      "http://127.0.0.1:8787",
    );
    expect(sanitizeReportedBaseUrl("not-a-url", "10.0.0.2")).toBe("not-a-url");
  });
});
