import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create } from "react-test-renderer";

const { connect, close, resolveUin, isDaemonRunning } = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
  resolveUin: vi.fn(),
  isDaemonRunning: vi.fn(),
}));

vi.mock("../src/lib/ipc-client.js", () => ({
  IpcClient: {
    connect,
  },
}));

vi.mock("../src/lib/config.js", () => ({
  resolveUin,
}));

vi.mock("../src/daemon/supervisor.js", () => ({
  isDaemonRunning,
}));

import { useIpcConnection } from "../src/lib/use-ipc-connection.js";

function Probe() {
  const state = useIpcConnection();
  return React.createElement(
    "span",
    null,
    JSON.stringify({
      hasIpc: state.ipc !== null,
      error: state.error,
      uin: state.uin,
    }),
  );
}

describe("useIpcConnection", () => {
  beforeEach(() => {
    connect.mockReset();
    close.mockReset();
    resolveUin.mockReset();
    isDaemonRunning.mockReset();
    connect.mockResolvedValue({ close });
    resolveUin.mockResolvedValue(12345);
    isDaemonRunning.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("connects when daemon is running", async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(Probe));
      await Promise.resolve();
    });

    const text = JSON.parse(renderer!.root.findByType("span").children[0] as string);
    expect(text.hasIpc).toBe(true);
    expect(text.uin).toBe(12345);
    expect(text.error).toBe("");
    expect(connect).toHaveBeenCalledWith(12345);

    await act(async () => {
      renderer!.unmount();
    });
    expect(close).toHaveBeenCalled();
  });

  it("sets error when daemon is not running", async () => {
    isDaemonRunning.mockResolvedValue(false);

    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(React.createElement(Probe));
      await Promise.resolve();
    });

    const text = JSON.parse(renderer!.root.findByType("span").children[0] as string);
    expect(text.hasIpc).toBe(false);
    expect(text.error).toContain("守护进程未运行");
    expect(connect).not.toHaveBeenCalled();
  });
});
