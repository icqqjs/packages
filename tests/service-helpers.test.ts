import { describe, expect, it, vi, beforeEach } from "vitest";

const execSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  fork: vi.fn(),
  execSync: (...args: unknown[]) => execSyncMock(...args),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
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
  startService,
} from "../src/daemon/supervisor.js";

describe("service _helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execSyncMock.mockReset();
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
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

  it("startService kickstarts loaded but stopped launchd job on darwin", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    const getuid = process.getuid;
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.getuid = () => 501;

    execSyncMock.mockImplementation((cmd: string) => {
      if (cmd.includes("launchctl list")) {
        return '"PID" = 0;\n"LastExitStatus" = 0;\n';
      }
      if (cmd.includes("launchctl kickstart")) {
        return "";
      }
      throw new Error(`unexpected: ${cmd}`);
    });

    await startService(8596238, () => {});
    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining("launchctl kickstart"),
      expect.anything(),
    );
    expect(execSyncMock).not.toHaveBeenCalledWith(
      expect.stringContaining("launchctl load"),
      expect.anything(),
    );

    if (platform) Object.defineProperty(process, "platform", platform);
    process.getuid = getuid;
  });
});
