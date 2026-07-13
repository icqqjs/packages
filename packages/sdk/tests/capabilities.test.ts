import { describe, expect, it } from "vitest";
import { capabilities, SDK_VERSION, assertSdkCompatible } from "../src/capabilities.js";

describe("@icqqjs/sdk capabilities", () => {
  it("exports version and capabilities", () => {
    expect(SDK_VERSION).toBe("0.1.0");
    expect(capabilities()).toContain("daemon.lifecycle");
    expect(capabilities()).toContain("ipc.client");
  });

  it("assertSdkCompatible passes for known capabilities", () => {
    expect(() =>
      assertSdkCompatible({ capabilities: ["daemon.lifecycle"] }),
    ).not.toThrow();
  });

  it("assertSdkCompatible fails for unknown capability", () => {
    expect(() =>
      assertSdkCompatible({ capabilities: ["nonexistent.cap"] as never }),
    ).toThrow(/缺少能力/);
  });
});
