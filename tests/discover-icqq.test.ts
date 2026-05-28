import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  isIcqqAvailable: vi.fn<() => Promise<boolean>>(),
  getIcqqPath: vi.fn<() => Promise<string | null>>(),
  collectGlobalNodeModulesRoots: vi.fn<() => string[]>(),
  resolveIcqqPackageRoot: vi.fn<(roots: string[]) => string | null>(),
  resolveIcqqEntryPath: vi.fn<(roots: string[]) => string | null>(),
  execSync: vi.fn(),
}));

vi.mock("../src/lib/icqq-resolve.js", () => ({
  isIcqqAvailable: mocks.isIcqqAvailable,
  getIcqqPath: mocks.getIcqqPath,
  collectGlobalNodeModulesRoots: mocks.collectGlobalNodeModulesRoots,
  resolveIcqqPackageRoot: mocks.resolveIcqqPackageRoot,
  resolveIcqqEntryPath: mocks.resolveIcqqEntryPath,
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: mocks.execSync,
  };
});

import { discoverIcqq } from "../src/lib/icqq-install.js";

describe("discoverIcqq", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isIcqqAvailable.mockResolvedValue(false);
    mocks.getIcqqPath.mockResolvedValue(null);
    mocks.collectGlobalNodeModulesRoots.mockReturnValue([]);
    mocks.resolveIcqqPackageRoot.mockReturnValue(null);
    mocks.resolveIcqqEntryPath.mockReturnValue(null);
    mocks.execSync.mockImplementation(() => {
      throw new Error("not installed");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns found when runtime can load", async () => {
    mocks.isIcqqAvailable.mockResolvedValue(true);
    mocks.getIcqqPath.mockResolvedValue("/opt/icqq");

    const result = await discoverIcqq();
    expect(result).toEqual({ found: true, path: "/opt/icqq" });
  });

  it("returns not found when only listed in pnpm global (ghost install)", async () => {
    mocks.execSync.mockImplementation((cmd: string) => {
      if (typeof cmd === "string" && cmd.includes("pnpm list -g")) {
        return "";
      }
      throw new Error("not installed");
    });

    const logs: string[] = [];
    const result = await discoverIcqq((m) => logs.push(m));

    expect(result.found).toBe(false);
    expect(logs.some((l) => l.includes("pnpm 列表中有"))).toBe(true);
    expect(logs.some((l) => l.includes("重新安装"))).toBe(true);
  });
});
