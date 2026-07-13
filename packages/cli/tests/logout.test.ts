import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create } from "react-test-renderer";

const {
  exit,
  resolveUin,
  isDaemonRunning,
  connect,
  request,
  close,
} = vi.hoisted(() => ({
  exit: vi.fn(),
  resolveUin: vi.fn(),
  isDaemonRunning: vi.fn(),
  connect: vi.fn(),
  request: vi.fn(),
  close: vi.fn(),
}));

const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

let jsonMode = false;

vi.mock("ink", () => ({
  Text: ({ children }: { children: React.ReactNode }) => React.createElement("span", null, children),
  useApp: () => ({ exit }),
}));

vi.mock("../src/components/Spinner.js", () => ({
  Spinner: ({ label }: { label: string }) => React.createElement("span", null, label),
}));

vi.mock("../src/lib/config.js", () => ({
  resolveUin,
}));

vi.mock("../src/daemon/supervisor.js", () => ({
  isDaemonRunning,
}));

vi.mock("../src/lib/ipc-client.js", () => ({
  IpcClient: {
    connect,
  },
}));

vi.mock("../src/lib/json-mode.js", () => ({
  isJsonMode: () => jsonMode,
}));

import Logout from "../src/commands/logout.js";

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Logout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    jsonMode = false;
    exit.mockReset();
    resolveUin.mockReset();
    isDaemonRunning.mockReset();
    connect.mockReset();
    request.mockReset();
    close.mockReset();
    log.mockClear();
    error.mockClear();
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prints canonical JSON success output for the migrated self-managed flow", async () => {
    jsonMode = true;
    isDaemonRunning.mockResolvedValue(true);
    connect.mockResolvedValue({ request, close });
    request.mockResolvedValue({ ok: true });

    await act(async () => {
      create(
        React.createElement(Logout, {
          args: [123],
          options: { k: false },
        }),
      );
    });
    await flushPromises();
    await act(async () => {
      vi.runAllTimers();
    });

    expect(request).toHaveBeenCalledWith("logout", { keep_token: false });
    expect(close).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({ ok: true, message: "账号 123 已退出登录（token 已作废）" }, null, 2),
    );
    expect(exit).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(0);
  });

  it("prints canonical JSON error output when logout fails", async () => {
    jsonMode = true;
    isDaemonRunning.mockResolvedValue(false);

    await act(async () => {
      create(
        React.createElement(Logout, {
          args: [456],
          options: { k: true },
        }),
      );
    });
    await flushPromises();
    await act(async () => {
      vi.runAllTimers();
    });

    expect(error).toHaveBeenCalledWith(
      JSON.stringify({ ok: false, error: "守护进程未运行 (账号 456)" }),
    );
    expect(exit).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(1);
  });
});