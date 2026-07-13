import { describe, expect, it } from "vitest";
import {
  formatCliError,
  formatDaemonNotRunning,
  formatServiceError,
} from "../src/lib/cli-errors.js";

describe("cli-errors", () => {
  it("formats daemon not running with and without uin", () => {
    expect(formatDaemonNotRunning()).toContain("icqq login");
    expect(formatDaemonNotRunning()).not.toContain("login -q");
    expect(formatDaemonNotRunning(12345)).toContain("icqq login -q 12345");
  });

  it("formats cli and service errors", () => {
    expect(formatCliError("boom")).toBe("✖ boom");
    expect(formatServiceError("boom")).toBe("错误: boom");
  });
});
