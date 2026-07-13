import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  format: "esm",
  platform: "node",
  unbundle: true,
  fixedExtension: false,
  clean: true,
  dts: true,
  banner: (chunk) => {
    if (chunk.fileName === "cli.js") {
      return "#!/usr/bin/env node";
    }
  },
});
