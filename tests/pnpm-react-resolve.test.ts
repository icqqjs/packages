import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { findPackageJsonPath } from "../src/lib/pnpm-react-resolve.js";

describe("findPackageJsonPath", () => {
  it("finds package.json from dist/lib layout", () => {
    const distLib = join(process.cwd(), "dist/lib/pnpm-react-resolve.js");
    expect(findPackageJsonPath(pathToFileURL(distLib))).toBe(
      join(process.cwd(), "package.json"),
    );
  });

  it("finds package.json from src/lib layout", () => {
    const srcLib = join(process.cwd(), "src/lib/pnpm-react-resolve.ts");
    expect(findPackageJsonPath(pathToFileURL(srcLib))).toBe(
      join(process.cwd(), "package.json"),
    );
  });

  it("resolves react from the discovered package root", () => {
    const distLib = join(process.cwd(), "dist/lib/pnpm-react-resolve.js");
    const pkgJson = findPackageJsonPath(pathToFileURL(distLib));
    expect(pkgJson).not.toBeNull();
    const reactPath = createRequire(pkgJson!).resolve("react");
    expect(existsSync(reactPath)).toBe(true);
  });
});
