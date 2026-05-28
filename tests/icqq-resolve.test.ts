import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  collectGlobalNodeModulesRoots,
  resolveIcqqEntryPath,
  resolveIcqqPackageRoot,
} from "../src/lib/icqq-resolve.js";

describe("icqq-resolve", () => {
  const envRestore: { key: string; value: string | undefined }[] = [];

  afterEach(() => {
    for (const { key, value } of envRestore.splice(0)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function setEnv(key: string, value: string) {
    envRestore.push({ key, value: process.env[key] });
    process.env[key] = value;
  }

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

    const root = path.join(tmp, "node_modules");
    const entry = resolveIcqqEntryPath([root]);
    expect(entry).toContain(path.join("@icqqjs", "icqq", "index.js"));
    expect(resolveIcqqPackageRoot([root])).toBe(pkgDir);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("collectGlobalNodeModulesRoots includes pnpm global/5/node_modules under PNPM_HOME", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "icqq-resolve-pnpm-"));
    const globalNm = path.join(tmp, "global", "5", "node_modules");
    fs.mkdirSync(globalNm, { recursive: true });
    setEnv("PNPM_HOME", tmp);

    const roots = collectGlobalNodeModulesRoots();
    expect(roots).toContain(globalNm);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
