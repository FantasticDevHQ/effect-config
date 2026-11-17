import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { packageName } from "./index.ts"

describe("package entry", () => {
  it.effect("runs under @effect/vitest", () =>
    Effect.gen(function*() {
      const name = yield* Effect.succeed(packageName)
      expect(name).toBe("@fantastic.dev/effect-config")
    }))
})
