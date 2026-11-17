import { describe, expectTypeOf, it } from "vitest"
import type { Config, Option, Redacted } from "effect"
import { keyConfig, makeConfig } from "./config.ts"
import { keys } from "./fixtures.ts"

describe("makeConfig types", () => {
  it("types each declared key", () => {
    expectTypeOf(makeConfig(keys)).toEqualTypeOf<
      Config.Config<{
        readonly PORT: number
        readonly API_KEY: Redacted.Redacted<string>
        readonly LOG_LEVEL: Option.Option<"debug" | "info" | "warn">
      }>
    >()
    expectTypeOf(keyConfig(keys, "API_KEY")).toEqualTypeOf<Config.Config<Redacted.Redacted<string>>>()
  })

  it("unknown key", () => {
    // @ts-expect-error UNDECLARED_KEY is not in the key list
    const undeclared = keyConfig(keys, "UNDECLARED_KEY")

    type Values = Config.Success<ReturnType<typeof makeConfig<typeof keys.keys>>>
    const read = (values: Values) => {
      // @ts-expect-error UNDECLARED_KEY is not in the key list
      return values.UNDECLARED_KEY
    }
    expectTypeOf(read).toBeFunction()
    expectTypeOf(undeclared).not.toBeNever()
  })
})
