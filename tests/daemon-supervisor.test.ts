import { describe, expect, it } from "vitest";
import {
  DaemonSupervisor,
  buildLaunchdPlist,
  getLaunchdLabel,
  spawnDaemon,
} from "../src/daemon/supervisor.js";

describe("DaemonSupervisor namespace", () => {
  it("exposes lifecycle and service helpers on one object", () => {
    expect(DaemonSupervisor.spawn).toBe(spawnDaemon);
    expect(DaemonSupervisor.janitor).toBeTypeOf("function");
    expect(DaemonSupervisor.installService).toBeTypeOf("function");
    expect(DaemonSupervisor.queryService).toBeTypeOf("function");
  });

  it("buildLaunchdPlist still resolves daemon entry beside supervisor", () => {
    const xml = buildLaunchdPlist(10001);
    expect(getLaunchdLabel(10001)).toBe("com.icqq.daemon.10001");
    expect(xml).toContain("entry.js");
    expect(xml).toContain("<string>10001</string>");
  });
});
