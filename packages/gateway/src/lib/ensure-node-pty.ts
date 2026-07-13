import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let ensured = false;

/** pnpm 可能跳过 node-pty 安装脚本，导致 prebuild 的 spawn-helper 无执行位 */
export function ensureNodePtySpawnHelper(): void {
  if (ensured) return;
  ensured = true;

  try {
    const require = createRequire(fileURLToPath(import.meta.url));
    const ptyRoot = path.dirname(require.resolve("node-pty/package.json"));
    const prebuilds = path.join(ptyRoot, "prebuilds");
    if (!fs.existsSync(prebuilds)) return;

    for (const platform of fs.readdirSync(prebuilds)) {
      const helper = path.join(prebuilds, platform, "spawn-helper");
      if (!fs.existsSync(helper)) continue;
      const mode = fs.statSync(helper).mode;
      if ((mode & 0o111) === 0) {
        fs.chmodSync(helper, mode | 0o755);
      }
    }
  } catch {
    /* 非致命：spawn 失败时上层会返回明确错误 */
  }
}
