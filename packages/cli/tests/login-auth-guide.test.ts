import { describe, expect, it } from "vitest";
import {
  AUTH_DEVICE_INJECT_SCRIPT,
  AUTH_DEVICE_STEPS,
  formatAuthDeviceJson,
  formatAuthDeviceOneLine,
} from "../src/lib/login-auth-guide.js";

describe("login-auth-guide", () => {
  const sample = { guid: "abc-123", version: "14.0.0" };

  it("formats device json for display and prompt", () => {
    expect(formatAuthDeviceJson(sample)).toContain('"guid": "abc-123"');
    expect(formatAuthDeviceOneLine(sample)).toBe(
      '{"guid":"abc-123","version":"14.0.0"}',
    );
  });

  it("includes inject script and four steps", () => {
    expect(AUTH_DEVICE_INJECT_SCRIPT).toContain("window.__INITIAL_STATE__.deviceInfo");
    expect(AUTH_DEVICE_INJECT_SCRIPT).toContain('prompt("输入设备信息")');
    expect(AUTH_DEVICE_STEPS).toHaveLength(4);
    expect(AUTH_DEVICE_STEPS[2]).toContain("弹窗");
  });
});
