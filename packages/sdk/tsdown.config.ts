import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: "esm",
  platform: "node",
  unbundle: true,
  clean: true,
  dts: true,
  external: ["@icqqjs/cli", /^@icqqjs\/cli\//],
});
