import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_FLAGS = new Set(["--version", "-V", "-v"]);

export function isVersionArgv(argv: string[]): boolean {
  return argv.some((arg) => VERSION_FLAGS.has(arg));
}

export function printCliVersion(importMetaUrl: string): void {
  const pkgRoot = join(dirname(fileURLToPath(importMetaUrl)), "..");
  const { version } = JSON.parse(
    readFileSync(join(pkgRoot, "package.json"), "utf8"),
  ) as { version: string };
  console.log(version);
}
