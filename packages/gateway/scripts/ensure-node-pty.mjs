import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(fileURLToPath(import.meta.url));

try {
  const ptyRoot = path.dirname(require.resolve("node-pty/package.json"));
  const prebuilds = path.join(ptyRoot, "prebuilds");
  if (fs.existsSync(prebuilds)) {
    for (const platform of fs.readdirSync(prebuilds)) {
      const helper = path.join(prebuilds, platform, "spawn-helper");
      if (!fs.existsSync(helper)) continue;
      const mode = fs.statSync(helper).mode;
      if ((mode & 0o111) === 0) {
        fs.chmodSync(helper, mode | 0o755);
        console.log(`[gateway] 已修复 node-pty spawn-helper 权限: ${helper}`);
      }
    }
  }
} catch (err) {
  console.warn(
    "[gateway] node-pty spawn-helper 权限检查跳过:",
    err instanceof Error ? err.message : err,
  );
}
