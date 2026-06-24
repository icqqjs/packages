import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  fork: vi.fn(),
}));

vi.mock("node:fs", () => ({
  openSync: vi.fn(() => 3),
  closeSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("node:net", () => ({
  default: {
    connect: vi.fn(),
  },
}));

import { fork } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import {
  getDaemonPid,
  isDaemonRunning,
  janitorStaleDaemonArtifacts,
  spawnDaemon,
  stopDaemon,
} from "../src/daemon/lifecycle.js";

const killSpy = vi.spyOn(process, "kill");

function mockSocketConnect(ok: boolean) {
  vi.mocked(net.connect).mockImplementation(() => {
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
    const sock = {
      on(event: string, fn: (...args: unknown[]) => void) {
        handlers[event] ??= [];
        handlers[event].push(fn);
        if (event === "connect" && ok) {
          queueMicrotask(() => fn());
        }
        if (event === "error" && !ok) {
          queueMicrotask(() => fn(new Error("ECONNREFUSED")));
        }
        return sock;
      },
      destroy: vi.fn(),
    };
    return sock as unknown as ReturnType<typeof net.connect>;
  });
}

describe("lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketConnect(true);
    killSpy.mockImplementation((pid, signal) => {
      if (signal === 0 && pid === 99999) {
        throw new Error("ESRCH");
      }
      return true;
    });
  });

  afterEach(() => {
    killSpy.mockReset();
  });

  it("janitor removes stale artifacts when pid is dead", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("99999");
    mockSocketConnect(false);

    await janitorStaleDaemonArtifacts(12345);

    expect(fs.unlink).toHaveBeenCalled();
  });

  it("isDaemonRunning returns false after janitor on dead pid", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    await expect(isDaemonRunning(12345)).resolves.toBe(false);
  });

  it("getDaemonPid returns null for dead process", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("99999");

    await expect(getDaemonPid(12345)).resolves.toBeNull();
  });

  it("stopDaemon sends SIGKILL when SIGTERM does not exit in time", async () => {
    vi.useFakeTimers();
    let alive = true;
    vi.mocked(fs.readFile).mockResolvedValue("1234");
    killSpy.mockImplementation((_pid, signal) => {
      if (signal === "SIGKILL") {
        alive = false;
        return true;
      }
      if (signal === 0) {
        if (!alive) throw new Error("ESRCH");
        return true;
      }
      return true;
    });

    const pending = stopDaemon(12345);
    await vi.advanceTimersByTimeAsync(6000);
    await pending;
    vi.useRealTimers();

    expect(killSpy).toHaveBeenCalledWith(1234, "SIGTERM");
    expect(killSpy).toHaveBeenCalledWith(1234, "SIGKILL");
    expect(fs.unlink).toHaveBeenCalled();
  });

  it("spawnDaemon rejects when already running", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("1234");
    killSpy.mockImplementation(() => true);

    await expect(spawnDaemon(12345)).rejects.toThrow("已在运行");
    expect(fork).not.toHaveBeenCalled();
  });

  it("isDaemonRunning returns true when pid and socket are healthy", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("1234");
    killSpy.mockImplementation(() => true);
    mockSocketConnect(true);

    await expect(isDaemonRunning(12345)).resolves.toBe(true);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it("stopDaemon returns false when no pid file", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    await expect(stopDaemon(12345)).resolves.toBe(false);
  });

  it("spawnDaemon resolves when child sends ready", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
    mockSocketConnect(false);

    const child = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "message") {
          queueMicrotask(() => handler("ready"));
        }
      }),
      removeAllListeners: vi.fn(),
      unref: vi.fn(),
    };
    vi.mocked(fork).mockReturnValue(child as never);

    await expect(spawnDaemon(12345)).resolves.toBeUndefined();
    expect(child.unref).toHaveBeenCalled();
  });

  it("spawnDaemon rejects on child exit with non-zero code", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
    mockSocketConnect(false);

    const child = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === "exit") {
          queueMicrotask(() => handler(1));
        }
      }),
      removeAllListeners: vi.fn(),
      unref: vi.fn(),
    };
    vi.mocked(fork).mockReturnValue(child as never);

    await expect(spawnDaemon(12345)).rejects.toThrow("守护进程退出");
  });
});
