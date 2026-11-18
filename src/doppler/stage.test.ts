import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { stageToConfig } from "./stage.ts"

describe("stageToConfig", () => {
  it.effect("maps", () =>
    Effect.gen(function*() {
      expect(yield* stageToConfig({ prod: "prd" })("prod")).toBe("prd")
      expect(yield* stageToConfig("prod", { prod: "prd" })).toBe("prd")
      const table = { local: "dev", preview: "stg", prod: "prd" } as const
      expect(yield* stageToConfig("local", table)).toBe("dev")
      expect(yield* stageToConfig("preview", table)).toBe("stg")
    }))

  it.effect("fails with invalid-stage for an unknown or inherited stage name", () =>
    Effect.gen(function*() {
      for (const stage of ["staging", "toString", "__proto__"]) {
        const error = yield* Effect.flip(stageToConfig(stage, { prod: "prd" }))
        expect(error.reason).toBe("invalid-stage")
      }
    }))
})
