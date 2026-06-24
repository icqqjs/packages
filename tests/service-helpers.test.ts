import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

import fs from "node:fs/promises";
import {
  buildLaunchdPlist,
  buildSystemdUnit,
  getAllUins,
  getLaunchdLabel,
  getLaunchdPlistPath,
  getSystemdServiceName,
  getSystemdServicePath,
  resolveServiceUins,
} from "../src/commands/service/_helpers.js";

describe("service _helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds launchd label and plist path", () => {
    expect(getLaunchdLabel(12345)).toBe("com.icqq.daemon.12345");
    expect(getLaunchdPlistPath(12345)).toContain("com.icqq.daemon.12345.plist");
  });

  it("builds systemd service name and path", () => {
    expect(getSystemdServiceName(99)).toBe("icqq-99.service");
    expect(getSystemdServicePath(99)).toContain("icqq-99.service");
  });

  it("buildLaunchdPlist includes uin and entry", () => {
    const xml = buildLaunchdPlist(24680);
    expect(xml).toContain("com.icqq.daemon.24680");
    expect(xml).toContain("<string>24680</string>");
    expect(xml).toContain("entry.js");
    expect(xml).toContain("PathState");
    expect(xml).toContain("daemon.stopped");
    expect(xml).not.toContain("SuccessfulExit");
  });

  it("buildSystemdUnit includes uin and restart policy", () => {
    const unit = buildSystemdUnit(24680);
    expect(unit).toContain("icqq QQ daemon for account 24680");
    expect(unit).toContain("Restart=on-failure");
    expect(unit).toContain("entry.js 24680");
  });

  it("getAllUins returns sorted account keys", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        accounts: { "300": { platform: 1, signApiUrl: "" }, "100": { platform: 1, signApiUrl: "" } },
      }),
    );
    await expect(getAllUins()).resolves.toEqual([100, 300]);
  });

  it("resolveServiceUins returns single uin when specified", async () => {
    await expect(resolveServiceUins(42)).resolves.toEqual([42]);
  });
});
