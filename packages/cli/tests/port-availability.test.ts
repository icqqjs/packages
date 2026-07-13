import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawnSync: vi.fn(actual.spawnSync),
  };
});

const spawnSyncMock = vi.mocked(spawnSync);

async function loadPortAvailability() {
  vi.resetModules();
  return import("../src/lib/port-availability.js");
}

describe("port-availability", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for port 0", async () => {
    const { isPortInUse } = await loadPortAvailability();
    expect(isPortInUse(0)).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it("uses lsof on unix when port is listening", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    spawnSyncMock.mockReturnValueOnce({
      status: 0,
      stdout: "node 12345 user TCP *:61500 (LISTEN)\n",
      stderr: "",
      pid: 1,
      output: [null, "node\n", ""],
      signal: null,
      error: undefined,
    });

    const { isPortInUse } = await loadPortAvailability();
    expect(isPortInUse(61500)).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "lsof",
      ["-nP", "-iTCP:61500", "-sTCP:LISTEN"],
      expect.objectContaining({ encoding: "utf-8" }),
    );

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("uses lsof on unix when port is free", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    spawnSyncMock.mockReturnValueOnce({
      status: 1,
      stdout: "",
      stderr: "",
      pid: 1,
      output: [null, "", ""],
      signal: null,
      error: undefined,
    });

    const { isPortInUse } = await loadPortAvailability();
    expect(isPortInUse(61500)).toBe(false);

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("falls back to bind probe when lsof is missing", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    spawnSyncMock
      .mockReturnValueOnce({
        status: null,
        stdout: "",
        stderr: "",
        pid: 0,
        output: [null, "", ""],
        signal: null,
        error: Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      })
      .mockImplementationOnce((cmd, args) => {
        if (cmd === process.execPath && Array.isArray(args) && args[0] === "-e") {
          return {
            status: 0,
            stdout: "",
            stderr: "",
            pid: 2,
            output: [null, "", ""],
            signal: null,
            error: undefined,
          };
        }
        return spawnSync(cmd as string, args as string[], {});
      });

    const { isPortInUse } = await loadPortAvailability();
    expect(isPortInUse(61500)).toBe(false);
    expect(spawnSyncMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});
