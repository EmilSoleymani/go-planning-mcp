import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts on purpose: that config's `exclude` list
// deliberately keeps test/smoke/** out of the default `test` script (PR
// CI must never touch the live API), but the same exclude list applies
// regardless of a CLI path filter — `vitest run test/smoke` under the
// default config still finds zero files. This config is the smoke
// suite's own entry point, with no coverage gate (that's the unit/
// integration suite's job per test-architecture spec §1).
export default defineConfig({
  test: {
    include: ["test/smoke/**/*.test.ts"],
  },
});
