import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    typecheck: {
      // `pnpm test:types` runs the *.test-d.ts type tests through tsc.
      include: ["src/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json"
    }
  }
})
