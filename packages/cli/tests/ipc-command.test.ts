import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const exit = vi.fn();
const request = vi.fn();
const close = vi.fn();
const ipc = { request, close };
const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("ink", () => ({
  Text: ({ children }: { children: React.ReactNode }) => React.createElement("span", null, children),
  useApp: () => ({ exit }),
}));

vi.mock("../src/components/Spinner.js", () => ({
  Spinner: ({ label }: { label: string }) => React.createElement("span", null, label),
}));

let jsonMode = false;

vi.mock("../src/lib/json-mode.js", () => ({
  isJsonMode: () => jsonMode,
}));

vi.mock("../src/lib/use-ipc-connection.js", () => ({
  useIpcConnection: () => ({
    ipc,
    error: "",
    uin: 123,
  }),
}));

import { IpcCommand } from "../src/components/IpcCommand.js";

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("IpcCommand", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    exit.mockReset();
    request.mockReset();
    close.mockReset();
    log.mockClear();
    error.mockClear();
    jsonMode = false;
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders success data and exits after the success delay", async () => {
    request.mockResolvedValue({ ok: true, data: ["ok"] });

    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        React.createElement(IpcCommand, {
          action: "ping",
          render: (data: unknown) => React.createElement("span", null, JSON.stringify(data)),
        }),
      );
    });
    await flushPromises();

    expect(close).toHaveBeenCalledTimes(1);
    expect(renderer!.toJSON()).toEqual({ type: "span", props: {}, children: ['["ok"]'] });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("prints JSON success output and exits immediately in JSON mode", async () => {
    jsonMode = true;
    request.mockResolvedValue({ ok: true, data: { ok: true } });

    await act(async () => {
      create(
        React.createElement(IpcCommand, {
          action: "ping",
          render: () => React.createElement("span", null, "ignored"),
        }),
      );
    });
    await flushPromises();
    await act(async () => {
      vi.runAllTimers();
    });

    expect(log).toHaveBeenCalledWith(JSON.stringify({ ok: true }, null, 2));
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("prints JSON errors and sets exitCode on failure", async () => {
    jsonMode = true;
    request.mockResolvedValue({ ok: false, error: "失败" });

    await act(async () => {
      create(
        React.createElement(IpcCommand, {
          action: "ping",
          render: () => React.createElement("span", null, "ignored"),
        }),
      );
    });
    await flushPromises();
    await act(async () => {
      vi.runAllTimers();
    });

    expect(error).toHaveBeenCalledWith(JSON.stringify({ ok: false, error: "失败" }));
    expect(process.exitCode).toBe(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});