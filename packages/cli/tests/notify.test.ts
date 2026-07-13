import { describe, it, expect, vi, beforeEach } from "vitest";

const platformState = vi.hoisted(() => ({ value: "darwin" }));
const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:os", () => ({
  default: { platform: () => platformState.value },
}));

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

async function loadNotify() {
  vi.resetModules();
  return import("../src/lib/notify.js");
}

describe("sendNotification", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    execFileMock.mockImplementation((_cmd, _args, cb) => {
      if (typeof cb === "function") cb(null);
    });
  });

  it("uses osascript on macOS with subtitle and sound", async () => {
    platformState.value = "darwin";
    const { sendNotification } = await loadNotify();
    sendNotification({
      title: 'icqq "alert"',
      body: "line\nbreak",
      subtitle: "sub",
    });
    expect(execFileMock).toHaveBeenCalledWith(
      "osascript",
      expect.any(Array),
      expect.any(Function),
    );
    const script = String(execFileMock.mock.calls[0]![1]![1]);
    expect(script).toContain("subtitle");
    expect(script).toContain('sound name "default"');
  });

  it("skips sound on macOS when sound is false", async () => {
    platformState.value = "darwin";
    const { sendNotification } = await loadNotify();
    sendNotification({ title: "t", body: "b", sound: false });
    const script = String(execFileMock.mock.calls[0]![1]![1]);
    expect(script).not.toContain("sound name");
  });

  it("uses notify-send on linux", async () => {
    platformState.value = "linux";
    const { sendNotification } = await loadNotify();
    sendNotification({ title: "t", body: "b", subtitle: "s" });
    expect(execFileMock).toHaveBeenCalledWith(
      "notify-send",
      expect.arrayContaining(["t"]),
      expect.any(Function),
    );
  });

  it("uses powershell on windows", async () => {
    platformState.value = "win32";
    const { sendNotification } = await loadNotify();
    sendNotification({ title: "t", body: "b & <>", subtitle: "s" });
    expect(execFileMock).toHaveBeenCalledWith(
      "powershell",
      expect.any(Array),
      expect.any(Function),
    );
    const ps = String(execFileMock.mock.calls[0]![1]![3]);
    expect(ps).toContain("&amp;");
  });

  it("skips on unsupported platforms", async () => {
    platformState.value = "freebsd";
    const { sendNotification } = await loadNotify();
    sendNotification({ title: "t", body: "b" });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("logs exec failures without throwing", async () => {
    platformState.value = "darwin";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    execFileMock.mockImplementation((_cmd, _args, cb) => {
      if (typeof cb === "function") cb(new Error("osascript missing"));
    });
    const { sendNotification } = await loadNotify();
    sendNotification({ title: "t", body: "b" });
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("[notify]"));
    errSpy.mockRestore();
  });
});
