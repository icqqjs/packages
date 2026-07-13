import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts", "src/daemon/**/*.ts"],
      exclude: ["src/**/*.tsx"],
      thresholds: {
        statements: 82,
        branches: 72,
        functions: 85,
        lines: 84,
      },
    },
  },
});
