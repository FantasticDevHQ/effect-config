import { describe, expect, it } from "@effect/vitest"
import * as Doppler from "@distilled.cloud/doppler"
import { Effect, Layer, Option, Redacted, Schema } from "effect"
import { inspect } from "node:util"
import { makeConfig } from "../config.ts"
import { defineKeys } from "../keys.ts"
import { DopplerSecrets, layerDoppler, layerDopplerSecrets, makeDopplerConfigProvider } from "./provider.ts"
import { secretBody, stubDoppler } from "./testing.ts"

const token = Redacted.make("dp.st.dev.super-secret-token-value")
const selection = { project: "example-project", config: "dev" }

const keys = defineKeys([
  { name: "DATABASE_URL", schema: Schema.String, required: true, secret: true, consumers: ["api"] },
  { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["api"] }
])

const values: Record<string, string> = { DATABASE_URL: "postgres://db.example/app", PORT: "8080" }

describe("Doppler ConfigProvider", () => {
  it.effect("reads keys", () => {
    const doppler = stubDoppler((name) => ({ status: 200, body: secretBody(name, values[name] ?? "") }))
    return Effect.gen(function*() {
      const config = yield* makeConfig(keys)
      expect(Redacted.value(config.DATABASE_URL)).toBe("postgres://db.example/app")
      expect(config.PORT).toBe(8080)
      expect(doppler.requests.map((request) => new URL(request.url).searchParams.get("name")).sort())
        .toEqual(["DATABASE_URL", "PORT"])
      for (const request of doppler.requests) {
        const url = new URL(request.url)
        expect(url.searchParams.get("project")).toBe("example-project")
        expect(url.searchParams.get("config")).toBe("dev")
        expect(request.authorization).toBe("Bearer dp.st.dev.super-secret-token-value")
      }
    }).pipe(Effect.provide(layerDoppler(keys, selection, { token }).pipe(Layer.provide(doppler.layer))))
  })

  it.effect("allowlist", () => {
    const doppler = stubDoppler((name) => ({ status: 200, body: secretBody(name, values[name] ?? "") }))
    return Effect.gen(function*() {
      // The service refuses an undeclared key without calling Doppler.
      const secrets = yield* DopplerSecrets
      const before = doppler.requests.length
      const refused = yield* Effect.flip(secrets.read("UNDECLARED"))
      expect(refused._tag).toBe("DopplerConfigError")
      expect(refused.reason).toBe("not-allowlisted")
      expect(doppler.requests.length).toBe(before)

      // The ConfigProvider refuses it too.
      const provider = yield* makeDopplerConfigProvider(keys, selection)
      const error = yield* Effect.flip(provider.load(["UNDECLARED"]))
      expect(error._tag).toBe("SourceError")
      expect(error.cause).toMatchObject({ _tag: "DopplerConfigError", reason: "not-allowlisted" })
      expect(error.message).toContain("not-allowlisted")
    }).pipe(
      Effect.provide(
        layerDopplerSecrets(keys, selection).pipe(
          Layer.provide(Layer.mergeAll(doppler.layer, Doppler.fromApiKey({ apiKey: token })))
        )
      )
    )
  })

  it.effect("auth", () =>
    Effect.gen(function*() {
      for (const status of [401, 403]) {
        const doppler = stubDoppler(() => ({ status, body: { success: false, messages: ["Invalid Auth token"] } }))
        const error = yield* Effect.flip(
          Layer.build(layerDoppler(keys, selection, { token }).pipe(Layer.provide(doppler.layer))).pipe(Effect.scoped)
        )
        expect(error._tag).toBe("DopplerConfigError")
        expect(error.reason).toBe("authentication")
        expect(error.message).toMatch(/^Doppler configuration authentication\. config dev key (DATABASE_URL|PORT)$/)
        for (const text of [error.message, inspect(error, { depth: 20 }), JSON.stringify(error)]) {
          expect(text).not.toContain("super-secret-token-value")
          expect(text).not.toContain("example-project")
        }
      }
    }))

  it.effect("treats a key Doppler does not have as absent", () => {
    const optional = defineKeys([
      { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: [] },
      { name: "FEATURE_FLAG", schema: Schema.String, required: false, secret: false, consumers: [] }
    ])
    const doppler = stubDoppler((name) =>
      name === "PORT"
        ? { status: 200, body: secretBody(name, "1") }
        : { status: 404, body: { success: false, messages: ["Could not find requested secret"] } }
    )
    return Effect.gen(function*() {
      const config = yield* makeConfig(optional)
      expect(config.PORT).toBe(1)
      expect(Option.isNone(config.FEATURE_FLAG)).toBe(true)
    }).pipe(Effect.provide(layerDoppler(optional, selection, { token }).pipe(Layer.provide(doppler.layer))))
  })

  it.effect("reports an unreachable Doppler as unavailable", () => {
    const doppler = stubDoppler(() => ({ status: 500, body: { success: false, messages: ["boom"] } }))
    return Effect.gen(function*() {
      const error = yield* Effect.flip(
        Layer.build(layerDoppler(keys, selection, { token }).pipe(Layer.provide(doppler.layer))).pipe(Effect.scoped)
      )
      expect(error.reason).toBe("unavailable")
    })
  })

  it.effect("reports a missing token as authentication", () => {
    const doppler = stubDoppler((name) => ({ status: 200, body: secretBody(name, "x") }))
    const saved = { token: process.env["DOPPLER_TOKEN"], apiKey: process.env["DOPPLER_API_KEY"] }
    return Effect.gen(function*() {
      delete process.env["DOPPLER_TOKEN"]
      delete process.env["DOPPLER_API_KEY"]
      const error = yield* Effect.flip(
        Layer.build(layerDoppler(keys, selection).pipe(Layer.provide(doppler.layer))).pipe(Effect.scoped)
      )
      expect(error.reason).toBe("authentication")
      expect(doppler.requests).toEqual([])
    }).pipe(Effect.ensuring(Effect.sync(() => {
      if (saved.token !== undefined) process.env["DOPPLER_TOKEN"] = saved.token
      if (saved.apiKey !== undefined) process.env["DOPPLER_API_KEY"] = saved.apiKey
    })))
  })
})
