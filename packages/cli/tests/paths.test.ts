import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn(() => "/mock-home"),
  },
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
  },
}));

import fs from "node:fs/promises";
import {
  getIcqqHome,
  getAccountDir,
  getTmpDir,
  getSocketPath,
  getPidPath,
  getLogPath,
  getTokenPath,
  getRpcPortPath,
  getMcpEndpointPath,
  getConfigPath,
  readMcpEndpoint,
  formatMcpUrl,
} from "../src/lib/paths.ts";

describe("paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds icqq home and config paths", () => {
    expect(getIcqqHome()).toBe("/mock-home/.icqq");
    expect(getTmpDir()).toBe("/mock-home/.icqq/.tmp");
    expect(getConfigPath()).toBe("/mock-home/.icqq/config.json");
  });

  it("builds account scoped daemon paths", () => {
    expect(getAccountDir(12345)).toBe("/mock-home/.icqq/12345");
    expect(getSocketPath(12345)).toBe("/mock-home/.icqq/12345/daemon.sock");
    expect(getPidPath(12345)).toBe("/mock-home/.icqq/12345/daemon.pid");
    expect(getLogPath(12345)).toBe("/mock-home/.icqq/12345/daemon.log");
    expect(getTokenPath(12345)).toBe("/mock-home/.icqq/12345/daemon.token");
    expect(getRpcPortPath(12345)).toBe("/mock-home/.icqq/12345/daemon.rpc");
    expect(getMcpEndpointPath(12345)).toBe("/mock-home/.icqq/12345/daemon.mcp");
  });

  it("reads MCP endpoint file", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: "127.0.0.1",
      port: 3920,
      basePath: "/mcp",
    }));

    await expect(readMcpEndpoint(12345)).resolves.toEqual({
      host: "127.0.0.1",
      port: 3920,
      basePath: "/mcp",
    });
  });

  it("returns null when MCP endpoint file is missing or invalid", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    await expect(readMcpEndpoint(12345)).resolves.toBeNull();
  });

  it("formats MCP url", () => {
    expect(formatMcpUrl({ host: "127.0.0.1", port: 3920, basePath: "/mcp" })).toBe(
      "http://127.0.0.1:3920/mcp",
    );
  });
});