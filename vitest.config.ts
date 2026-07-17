import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "test/smoke/**"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // Transport glue is covered by smoke tests and the Desktop checklist
      // instead of the unit gate (test-architecture spec §1).
      exclude: ["src/entry/**", "src/**/*.test.ts", "src/metrolinx/types.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
