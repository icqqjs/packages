import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ensureNodePtySpawnHelper } from "../src/lib/ensure-node-pty.js";

describe("ensureNodePtySpawnHelper", () => {
  it("grants execute permission to spawn-helper prebuilds", () => {
    const require = createRequire(import.meta.url);
    const ptyRoot = path.dirname(require.resolve("node-pty/package.json"));
    const helper = path.join(ptyRoot, "prebuilds", "darwin-arm64", "spawn-helper");

    if (!fs.existsSync(helper)) {
      // CI / non-macOS: skip
      return;
    }

    try {
      fs.chmodSync(helper, fs.statSync(helper).mode & ~0o111);
    } catch {
      return;
    }

    ensureNodePtySpawnHelper();
    const mode = fs.statSync(helper).mode;
    expect(mode & 0o111).not.toBe(0);
  });
});
