import { describe, expectTypeOf, it } from "vitest"
import { type Config, type Option, type Redacted, Schema } from "effect"
import { keyConfig, makeConfig } from "./config.ts"
import { keys } from "./fixtures.ts"
import { defineKeys } from "./keys.ts"

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

  it("widened flags give a union that covers both runtime shapes", () => {
    const required: boolean = Math.random() > 0.5
    const secret: boolean = Math.random() > 0.5
    const widened = defineKeys([{ name: "W", schema: Schema.String, required, secret, consumers: [] }])
    expectTypeOf(keyConfig(widened, "W")).toEqualTypeOf<
      Config.Config<
        | string
        | Redacted.Redacted<string>
        | Option.Option<string | Redacted.Redacted<string>>
      >
    >()
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
