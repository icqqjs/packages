import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from "node:fs";
import { isVersionArgv, printCliVersion } from "../src/lib/cli-version.js";

describe("isVersionArgv", () => {
  it("matches -v, -V, --version", () => {
    expect(isVersionArgv(["node", "icqq", "-v"])).toBe(true);
    expect(isVersionArgv(["node", "icqq", "-V"])).toBe(true);
    expect(isVersionArgv(["node", "icqq", "--version"])).toBe(true);
  });

  it("ignores other flags", () => {
    expect(isVersionArgv(["node", "icqq", "help"])).toBe(false);
    expect(isVersionArgv(["node", "icqq", "--verbose"])).toBe(false);
  });
});

describe("printCliVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads package version and prints it", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ version: "1.2.3" }) as any);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    printCliVersion(new URL("file:///tmp/project/dist/cli.js").href);

    expect(readFileSync).toHaveBeenCalledWith("/tmp/project/package.json", "utf8");
    expect(log).toHaveBeenCalledWith("1.2.3");

    log.mockRestore();
  });
});
