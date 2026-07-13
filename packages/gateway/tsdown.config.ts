import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: "esm",
  platform: "node",
  unbundle: true,
  fixedExtension: false,
  clean: true,
  dts: false,
  external: [
    "next",
    "react",
    "react-dom",
    "better-sqlite3",
    "@icqqjs/sdk",
    /^@icqqjs\/sdk\//,
  ],
  banner: (chunk) => {
    if (chunk.fileName === "cli.js" || chunk.fileName === "entry.js") {
      return "#!/usr/bin/env node";
    }
  },
});
