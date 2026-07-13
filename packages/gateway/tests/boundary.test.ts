import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "node:fs/promises";

describe("gateway dependency boundary", () => {
  it("does not import @icqqjs/cli internal subpaths", async () => {
    const root = path.resolve(import.meta.dirname, "../src");
    const files: string[] = [];
    for await (const entry of glob("**/*.{ts,tsx}", { cwd: root })) {
      files.push(path.join(root, entry));
    }

    const offenders: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(file, "utf-8");
      if (/@icqqjs\/cli(\/|")/.test(content)) {
        offenders.push(path.relative(root, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
