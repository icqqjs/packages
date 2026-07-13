import { describe, expect, it } from "vitest";
import {
  buildDeviceVerifyOptions,
  shouldShowDeviceVerifyChooser,
} from "../src/lib/login-device-verify.js";

describe("login-device-verify", () => {
  it("offers sms and url when phone is present", () => {
    const options = buildDeviceVerifyOptions("138****1234");
    expect(options.map((o) => o.id)).toEqual(["sms", "url"]);
    expect(options[0]!.label).toContain("138****1234");
  });

  it("offers only url when phone is absent", () => {
    expect(buildDeviceVerifyOptions("").map((o) => o.id)).toEqual(["url"]);
    expect(buildDeviceVerifyOptions("   ").map((o) => o.id)).toEqual(["url"]);
    expect(shouldShowDeviceVerifyChooser("")).toBe(false);
    expect(shouldShowDeviceVerifyChooser("13800000000")).toBe(true);
  });
});
