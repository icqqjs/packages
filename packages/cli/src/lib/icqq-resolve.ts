/**
 * Dynamic resolver for @icqqjs/icqq.
 * Allows the CLI to be installed without icqq and defers the error
 * to runtime with friendly setup instructions.
 *
 * pnpm 全局安装时 CLI 与 @icqqjs/icqq 相互隔离，裸 import 找不到包；
 * 需从 pnpm/npm 全局 node_modules 解析入口再加载。
 */
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import { ICQQ_SETUP_HINT } from "./icqq-setup-hint.js";

const PKG = "@icqqjs/icqq";
const PKG_JSON = "@icqqjs/icqq/package.json";

let _mod: typeof import("@icqqjs/icqq") | null = null;

function shouldSkipDirectImport(): boolean {
  return process.env.ICQQ_RESOLVE_SKIP_DIRECT_IMPORT === "1";
}

function getPnpmHomes(): string[] {
  const homes: string[] = [];
  if (process.env.PNPM_HOME) homes.push(process.env.PNPM_HOME);
  const home = os.homedir();
  homes.push(path.join(home, "Library", "pnpm"));
  homes.push(path.join(home, ".local", "share", "pnpm"));
  if (process.env.APPDATA) homes.push(path.join(process.env.APPDATA, "pnpm"));
  return [...new Set(homes)];
}

function addPnpmGlobalRoots(roots: Set<string>): void {
  for (const home of getPnpmHomes()) {
    const globalDir = path.join(home, "global");
    if (!fs.existsSync(globalDir)) continue;
    for (const entry of fs.readdirSync(globalDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const nm = path.join(globalDir, entry.name, "node_modules");
      if (fs.existsSync(nm)) roots.add(nm);
    }
  }
}

function addCliAncestorNodeModules(roots: Set<string>): void {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    roots.add(path.join(dir, "node_modules"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

function addArgvGlobalRoot(roots: Set<string>): void {
  const argv1 = process.argv[1];
  if (!argv1) return;
  const match = argv1.match(/^(.*\/global\/\d+)\//);
  if (match) roots.add(path.join(match[1], "node_modules"));
}

function queryPackageManagerGlobalRoot(command: string): string | null {
  try {
    const root = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
    return root && fs.existsSync(root) ? root : null;
  } catch {
    return null;
  }
}

/** 可能安装 @icqqjs/icqq 的全局 / 本地 node_modules 目录 */
export function collectGlobalNodeModulesRoots(): string[] {
  const roots = new Set<string>();

  addPnpmGlobalRoots(roots);
  addArgvGlobalRoot(roots);

  for (const cmd of ["pnpm root -g", "npm root -g"] as const) {
    const root = queryPackageManagerGlobalRoot(cmd);
    if (root) roots.add(root);
  }

  addCliAncestorNodeModules(roots);

  return [...roots];
}

/** 在若干 node_modules 根目录中解析 @icqqjs/icqq 入口文件 */
export function resolveIcqqEntryPath(roots: string[]): string | null {
  for (const root of roots) {
    const pkgJson = path.join(root, PKG_JSON);
    if (!fs.existsSync(pkgJson)) continue;
    try {
      const req = createRequire(pkgJson);
      return req.resolve(PKG);
    } catch {
      /* try next root */
    }
  }
  return null;
}

/** @icqqjs/icqq 包根目录 */
export function resolveIcqqPackageRoot(roots: string[]): string | null {
  for (const root of roots) {
    const pkgJson = path.join(root, PKG_JSON);
    if (fs.existsSync(pkgJson)) return path.dirname(pkgJson);
  }
  return null;
}

async function importEntry(entryPath: string): Promise<typeof import("@icqqjs/icqq")> {
  return import(pathToFileURL(entryPath).href);
}

export async function resolveIcqq(): Promise<typeof import("@icqqjs/icqq")> {
  if (_mod) return _mod;

  if (!shouldSkipDirectImport()) {
    try {
      _mod = await import(PKG);
      return _mod as typeof import("@icqqjs/icqq");
    } catch {
      /* pnpm 全局等场景下继续从全局 node_modules 解析 */
    }
  }

  const roots = collectGlobalNodeModulesRoots();
  const entry = resolveIcqqEntryPath(roots);
  if (entry) {
    try {
      _mod = await importEntry(entry);
      return _mod;
    } catch {
      /* fall through */
    }
  }

  throw new Error(ICQQ_SETUP_HINT);
}

export function isIcqqAvailable(): Promise<boolean> {
  return resolveIcqq().then(
    () => true,
    () => false,
  );
}

/** Return the directory where @icqqjs/icqq is installed, or null. */
export async function getIcqqPath(): Promise<string | null> {
  const roots = collectGlobalNodeModulesRoots();
  const fromGlobal = resolveIcqqPackageRoot(roots);
  if (fromGlobal) return fromGlobal;

  try {
    const req = createRequire(import.meta.url);
    return path.dirname(req.resolve(PKG_JSON));
  } catch {
    return null;
  }
}
