import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  collectGlobalNodeModulesRoots,
  resolveIcqqEntryPath,
  resolveIcqqPackageRoot,
} from "../src/lib/icqq-resolve.js";

describe("icqq-resolve", () => {
  it("finds icqq in a fake global node_modules tree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "icqq-resolve-"));
    const pkgDir = path.join(tmp, "node_modules", "@icqqjs", "icqq");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name: "@icqqjs/icqq", main: "./index.js" }),
    );
    fs.writeFileSync(
      path.join(pkgDir, "index.js"),
      "export const createClient = () => ({});\n",
    );

    const entry = resolveIcqqEntryPath([path.join(tmp, "node_modules")]);
    expect(entry).toContain(path.join("@icqqjs", "icqq", "index.js"));
    expect(resolveIcqqPackageRoot([path.join(tmp, "node_modules")])).toBe(pkgDir);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("collectGlobalNodeModulesRoots includes pnpm global when present", () => {
    const roots = collectGlobalNodeModulesRoots();
    const pnpmGlobal = roots.find((r) =>
      r.includes(`${path.sep}global${path.sep}`) && r.endsWith("node_modules"),
    );
    if (process.env.PNPM_HOME || fs.existsSync(path.join(os.homedir(), "Library", "pnpm", "global"))) {
      expect(pnpmGlobal).toBeTruthy();
    }
  });
});
