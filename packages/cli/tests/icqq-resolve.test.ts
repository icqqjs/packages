import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("icqq-resolve", () => {
  const envRestore: { key: string; value: string | undefined }[] = [];
  const argv1 = process.argv[1];
  const tmpDirs = new Set<string>();

  afterEach(() => {
    for (const { key, value } of envRestore.splice(0)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    process.argv[1] = argv1;
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.clear();
    vi.doUnmock("node:child_process");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function setEnv(key: string, value: string) {
    envRestore.push({ key, value: process.env[key] });
    process.env[key] = value;
  }

  function makeTmpDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.add(dir);
    return dir;
  }

  function createFakeIcqqPackage(root: string, marker = "fallback") {
    const pkgDir = path.join(root, "@icqqjs", "icqq");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@icqqjs/icqq",
        type: "module",
        main: "./index.js",
      }),
    );
    fs.writeFileSync(
      path.join(pkgDir, "index.js"),
      `export const __testMarker = ${JSON.stringify(marker)};\n`,
    );
    return pkgDir;
  }

  async function loadModule(execImpl?: (command: string) => string) {
    vi.resetModules();
    vi.doMock("node:child_process", () => ({
      execSync: vi.fn((command: string) => {
        if (!execImpl) throw new Error(`unexpected command: ${command}`);
        return execImpl(command);
      }),
    }));
    return import("../src/lib/icqq-resolve.js");
  }

  it("finds icqq in a fake global node_modules tree", async () => {
    const tmp = makeTmpDir("icqq-resolve-");
    const root = path.join(tmp, "node_modules");
    const pkgDir = createFakeIcqqPackage(root, "entry");
    const { resolveIcqqEntryPath, resolveIcqqPackageRoot } = await loadModule();

    const entry = resolveIcqqEntryPath([root]);
    expect(entry).toContain(path.join("@icqqjs", "icqq", "index.js"));
    expect(resolveIcqqPackageRoot([root])).toBe(pkgDir);
  });

  it("collects pnpm, argv, APPDATA, and package-manager roots", async () => {
    const tmp = makeTmpDir("icqq-resolve-pnpm-");
    const globalNm = path.join(tmp, "global", "5", "node_modules");
    fs.mkdirSync(globalNm, { recursive: true });
    const argvGlobal = path.join(tmp, "global", "7", "node_modules");
    fs.mkdirSync(argvGlobal, { recursive: true });
    setEnv("PNPM_HOME", tmp);
    const appData = makeTmpDir("icqq-resolve-appdata-");
    const appDataNm = path.join(appData, "pnpm", "global", "8", "node_modules");
    fs.mkdirSync(appDataNm, { recursive: true });
    setEnv("APPDATA", appData);
    process.argv[1] = path.join(tmp, "global", "7", "bin", "icqq.js");

    const cmdRoot = path.join(makeTmpDir("icqq-resolve-cmd-"), "node_modules");
    fs.mkdirSync(cmdRoot, { recursive: true });
    const { collectGlobalNodeModulesRoots } = await loadModule((command) => {
      if (command === "pnpm root -g") return cmdRoot;
      throw new Error(`unsupported: ${command}`);
    });

    const roots = collectGlobalNodeModulesRoots();
    expect(roots).toContain(globalNm);
    expect(roots).toContain(argvGlobal);
    expect(roots).toContain(appDataNm);
    expect(roots).toContain(cmdRoot);
  });

  it("falls back to global package roots for resolveIcqq and getIcqqPath", async () => {
    const tmp = makeTmpDir("icqq-resolve-fallback-");
    const globalNm = path.join(tmp, "global", "5", "node_modules");
    const pkgDir = createFakeIcqqPackage(globalNm, "global-fallback");
    setEnv("PNPM_HOME", tmp);
    setEnv("ICQQ_RESOLVE_SKIP_DIRECT_IMPORT", "1");

    const { getIcqqPath, isIcqqAvailable, resolveIcqq } = await loadModule();

    const mod = await resolveIcqq();
    expect((mod as { __testMarker?: string }).__testMarker).toBe("global-fallback");
    expect(await isIcqqAvailable()).toBe(true);
    expect(await getIcqqPath()).toBe(pkgDir);
  });

  it("returns null for missing roots", async () => {
    const tmp = makeTmpDir("icqq-resolve-empty-");
    setEnv("PNPM_HOME", tmp);
    const { resolveIcqqEntryPath, resolveIcqqPackageRoot } = await loadModule();

    expect(resolveIcqqEntryPath([path.join(tmp, "node_modules")])).toBeNull();
    expect(resolveIcqqPackageRoot([path.join(tmp, "node_modules")])).toBeNull();
  });
});
