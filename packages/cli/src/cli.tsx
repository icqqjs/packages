import { installPnpmReactResolveHook } from "./lib/pnpm-react-resolve.js";
import { isVersionArgv, printCliVersion } from "./lib/cli-version.js";

installPnpmReactResolveHook();

if (isVersionArgv(process.argv)) {
  printCliVersion(import.meta.url);
  process.exit(0);
}

// Extract global -u / --uin flag before Pastel processes args
const uIdx = process.argv.findIndex((a) => a === "-u" || a === "--uin");
if (uIdx !== -1 && process.argv[uIdx + 1]) {
  process.env.ICQQ_CURRENT_UIN = process.argv[uIdx + 1];
  process.argv.splice(uIdx, 2);
}

// Extract global --json flag
const jsonIdx = process.argv.indexOf("--json");
if (jsonIdx !== -1) {
  process.env.ICQQ_JSON_OUTPUT = "1";
  process.argv.splice(jsonIdx, 1);
}

const { default: Pastel } = await import("pastel");

const app = new Pastel({
  importMeta: import.meta,
  name: "icqq",
  description: "基于 icqq 的命令行 QQ 客户端",
});

await app.run();
