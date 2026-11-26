import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/server/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: { lines: 90, statements: 90, branches: 85, functions: 90 },
    },
  },
});
