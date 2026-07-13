import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let testDir = "";
let pidPath = "";
let socketPath = "";
let tokenPath = "";
let rpcPortPath = "";
let mcpPath = "";

vi.mock("@/lib/paths.js", () => ({
  getPidPath: () => pidPath,
  getSocketPath: () => socketPath,
  getTokenPath: () => tokenPath,
  getRpcPortPath: () => rpcPortPath,
  getMcpEndpointPath: () => mcpPath,
}));

import { cleanupDaemonStartupArtifacts } from "../src/daemon/entry-cleanup.js";

describe("cleanupDaemonStartupArtifacts", () => {
  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), "icqq-entry-cleanup-"));
    pidPath = join(testDir, "daemon.pid");
    socketPath = join(testDir, "daemon.sock");
    tokenPath = join(testDir, "daemon.token");
    rpcPortPath = join(testDir, "daemon.rpc");
    mcpPath = join(testDir, "daemon.mcp");
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("removes startup artifact files", async () => {
    for (const p of [pidPath, socketPath, tokenPath, rpcPortPath, mcpPath]) {
      await fs.writeFile(p, "x");
    }

    await cleanupDaemonStartupArtifacts(12345);

    for (const p of [pidPath, socketPath, tokenPath, rpcPortPath, mcpPath]) {
      await expect(fs.stat(p)).rejects.toThrow();
    }
  });

  it("ignores missing files", async () => {
    await expect(cleanupDaemonStartupArtifacts(12345)).resolves.toBeUndefined();
  });
});
