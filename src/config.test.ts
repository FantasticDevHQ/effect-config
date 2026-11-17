import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Logger, Option, Redacted, Schema } from "effect"
import { inspect } from "node:util"
import { keyConfig, makeConfig } from "./config.ts"
import { keys } from "./fixtures.ts"
import { defineKeys } from "./keys.ts"

const provider = (env: Record<string, string>) => ConfigProvider.fromEnv({ env })

describe("makeConfig", () => {
  it.effect("loads values", () =>
    Effect.gen(function*() {
      const config = yield* makeConfig(keys).parse(
        provider({ PORT: "8080", API_KEY: "sk_live_123", LOG_LEVEL: "debug" })
      )
      expect(config.PORT).toBe(8080)
      expect(Redacted.value(config.API_KEY)).toBe("sk_live_123")
      expect(config.LOG_LEVEL).toEqual(Option.some("debug"))
    }))

  it.effect("loads an absent optional key as None", () =>
    Effect.gen(function*() {
      const config = yield* makeConfig(keys).parse(provider({ PORT: "1", API_KEY: "x" }))
      expect(Option.isNone(config.LOG_LEVEL)).toBe(true)
    }))

  it.effect("reads from the ambient ConfigProvider when yielded", () =>
    Effect.gen(function*() {
      const config = yield* makeConfig(keys)
      expect(config.PORT).toBe(3000)
    }).pipe(Effect.provide(ConfigProvider.layer(provider({ PORT: "3000", API_KEY: "x" })))))

  it.effect("redacts", () => {
    const lines: Array<string> = []
    const capture = Logger.make((options) => {
      lines.push(Logger.formatSimple.log(options), Logger.formatLogFmt.log(options), Logger.formatJson.log(options))
    })
    return Effect.gen(function*() {
      const config = yield* makeConfig(keys).parse(provider({ PORT: "1", API_KEY: "sk_live_123" }))
      expect(Redacted.isRedacted(config.API_KEY)).toBe(true)
      yield* Effect.logInfo("loaded api key", config.API_KEY)
      yield* Effect.logInfo("loaded config", config)
      expect(lines.length).toBe(6)
      for (const line of [...lines, String(config.API_KEY), inspect(config), JSON.stringify(config)]) {
        expect(line).toContain("<redacted>")
        expect(line).not.toContain("sk_live_123")
      }
    }).pipe(Effect.provide(Logger.layer([capture])))
  })

  it.effect("missing key", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(makeConfig(keys).parse(provider({ PORT: "1" })))
      expect(error._tag).toBe("ConfigError")
      expect(error.message).toContain("API_KEY")
    }))

  it.effect("does not echo a rejected secret value, even from a custom schema message", () =>
    Effect.gen(function*() {
      const leaky = defineKeys([{
        name: "TOKEN",
        schema: Schema.String.check(
          Schema.makeFilter((value) => value.startsWith("tok_") || `bad token ${value}`)
        ),
        required: true,
        secret: true,
        consumers: []
      }])
      const error = yield* Effect.flip(makeConfig(leaky).parse(provider({ TOKEN: "sk_live_123" })))
      expect(error.message).toContain("TOKEN")
      expect(error.message).not.toContain("sk_live_123")
      expect(inspect(error, { depth: 30 })).not.toContain("sk_live_123")
      expect(JSON.stringify(error)).not.toContain("sk_live_123")
      // A missing secret still reports the key as missing.
      const missing = yield* Effect.flip(makeConfig(leaky).parse(provider({})))
      expect(missing.message).toContain("TOKEN")
    }))

  it.effect("does not echo an invalid secret value in the error", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        makeConfig(keys).parse(provider({ PORT: "not-a-number", API_KEY: "sk_live_123", LOG_LEVEL: "nope" }))
      )
      expect(error.message).toContain("PORT")
      expect(inspect(error, { depth: 20 })).not.toContain("sk_live_123")
    }))
})

describe("keyConfig", () => {
  it.effect("loads one declared key", () =>
    Effect.gen(function*() {
      const apiKey = yield* keyConfig(keys, "API_KEY").parse(provider({ API_KEY: "secret" }))
      expect(Redacted.value(apiKey)).toBe("secret")
    }))
})
