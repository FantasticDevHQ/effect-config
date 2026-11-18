import * as Doppler from "@distilled.cloud/doppler"
import * as Retry from "@distilled.cloud/doppler/Retry"
import { ConfigProvider, Context, Effect, Layer, Option, Redacted } from "effect"
import type * as HttpClient from "effect/http/HttpClient"
import type { KeyDefinition, KeyList } from "../keys.ts"
import { DopplerConfigError } from "./error.ts"

/**
 * Which Doppler project and config to read.
 *
 * @since 0.1.0
 * @category models
 */
export interface DopplerSelection {
  readonly project: string
  readonly config: string
}

/**
 * Reads single secrets from Doppler, restricted to a key list.
 *
 * `read` returns `None` when Doppler has no value for a declared key, and
 * fails with `not-allowlisted` (without calling Doppler) for any other key.
 *
 * @since 0.1.0
 * @category services
 */
export class DopplerSecrets extends Context.Service<DopplerSecrets, {
  readonly read: (name: string) => Effect.Effect<Option.Option<Redacted.Redacted<string>>, DopplerConfigError>
}>()("@fantastic.dev/effect-config/DopplerSecrets") {}

const requestTimeout = "10 seconds"

const toReason = (error: unknown): "authentication" | "missing" | "unavailable" => {
  const tag: unknown = typeof error === "object" && error !== null ? Reflect.get(error, "_tag") : undefined
  if (tag === "Unauthorized" || tag === "Forbidden" || tag === "ConfigError") return "authentication"
  if (tag === "NotFound") return "missing"
  return "unavailable"
}

/**
 * Builds the {@link DopplerSecrets} service for a key list and selection.
 * Requires Doppler credentials and an `HttpClient`.
 *
 * @since 0.1.0
 * @category layers
 */
export const layerDopplerSecrets = <const Keys extends ReadonlyArray<KeyDefinition>>(
  list: KeyList<Keys>,
  selection: DopplerSelection
): Layer.Layer<DopplerSecrets, never, Doppler.DopplerOpContext> =>
  Layer.effect(
    DopplerSecrets,
    Effect.gen(function*() {
      const context = yield* Effect.context<Doppler.DopplerOpContext>()
      const allowed: ReadonlySet<string> = new Set(list.names)
      const fail = (reason: DopplerConfigError["reason"], key: string) =>
        Effect.fail(new DopplerConfigError({ reason, config: selection.config, key }))
      return DopplerSecrets.of({
        read: Effect.fn("DopplerSecrets.read")(function*(name: string) {
          if (!allowed.has(name)) return yield* fail("not-allowlisted", name)
          const outcome = yield* Doppler.getSecret({ project: selection.project, config: selection.config, name }).pipe(
            // Fail fast at startup; the caller decides whether to retry the layer.
            Retry.none,
            Effect.timeout(requestTimeout),
            Effect.provideContext(context),
            Effect.map((response) => ({ ok: true as const, response })),
            // Map every failure to a reason; the original error (which can
            // hold request details) is dropped here.
            Effect.catchCause((cause) => {
              const failure = cause.reasons.find((reason) => reason._tag === "Fail")
              return Effect.succeed({ ok: false as const, reason: toReason(failure?._tag === "Fail" ? failure.error : undefined) })
            })
          )
          if (!outcome.ok) {
            return outcome.reason === "missing" ? Option.none() : yield* fail(outcome.reason, name)
          }
          const computed = outcome.response.value?.computed
          if (computed === undefined || computed === null) return Option.none()
          return Option.some(Redacted.isRedacted(computed) ? computed : Redacted.make(computed))
        })
      })
    })
  )

const notAllowlisted = (selection: DopplerSelection, key: string) => {
  const error = new DopplerConfigError({ reason: "not-allowlisted", config: selection.config, key })
  return new ConfigProvider.SourceError({ message: error.message, cause: error })
}

/**
 * Loads every key in the list from Doppler and returns a `ConfigProvider`
 * that serves only those keys.
 *
 * - Loading fails with a `DopplerConfigError` (for example `authentication`
 *   on a 401 or 403) before any config is read.
 * - A declared key with no Doppler value is absent, so optional keys load as
 *   `None` and required keys fail with a missing-key error.
 * - A request for any other key fails with a `SourceError` whose cause is a
 *   `DopplerConfigError` with reason `not-allowlisted`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeDopplerConfigProvider = Effect.fn("makeDopplerConfigProvider")(function*<
  const Keys extends ReadonlyArray<KeyDefinition>
>(list: KeyList<Keys>, selection: DopplerSelection) {
  const secrets = yield* DopplerSecrets
  const entries = yield* Effect.forEach(
    list.names,
    (name) => Effect.map(secrets.read(name), (value) => [name, value] as const),
    { concurrency: 4 }
  )
  const values = new Map<string, Redacted.Redacted<string>>()
  for (const [name, value] of entries) if (Option.isSome(value)) values.set(name, value.value)
  const allowed: ReadonlySet<string> = new Set(list.names)
  return ConfigProvider.make((path) => {
    const [name, ...rest] = path
    if (typeof name !== "string" || rest.length > 0 || !allowed.has(name)) {
      return Effect.fail(notAllowlisted(selection, path.map(String).join(".")))
    }
    const value = values.get(name)
    return Effect.succeed(value === undefined ? undefined : ConfigProvider.makeValue(Redacted.value(value)))
  })
})

/**
 * Options for {@link layerDoppler}.
 *
 * @since 0.1.0
 * @category models
 */
export interface LayerDopplerOptions {
  /**
   * The Doppler service token. When omitted, `DOPPLER_TOKEN` (or
   * `DOPPLER_API_KEY`) is read from the process environment.
   */
  readonly token?: Redacted.Redacted<string> | undefined
}

/**
 * Makes Doppler the active `ConfigProvider` for the declared keys, so
 * `makeConfig(list)` reads them from Doppler with no other code changes.
 * Requires an `HttpClient` (for example `FetchHttpClient.layer`).
 *
 * @example
 * ```ts
 * import { Effect, Layer } from "effect"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient"
 * import { makeConfig } from "@fantastic.dev/effect-config"
 * import { layerDoppler } from "@fantastic.dev/effect-config/doppler"
 * import { keys } from "./keys.ts"
 *
 * const ConfigLive = layerDoppler(keys, { project: "my-app", config: "prd" }).pipe(
 *   Layer.provide(FetchHttpClient.layer)
 * )
 * const program = Effect.gen(function*() {
 *   const config = yield* makeConfig(keys)
 * }).pipe(Effect.provide(ConfigLive))
 * ```
 *
 * @since 0.1.0
 * @category layers
 */
export const layerDoppler = <const Keys extends ReadonlyArray<KeyDefinition>>(
  list: KeyList<Keys>,
  selection: DopplerSelection,
  options: LayerDopplerOptions = {}
): Layer.Layer<never, DopplerConfigError, HttpClient.HttpClient> =>
  ConfigProvider.layer(makeDopplerConfigProvider(list, selection)).pipe(
    Layer.provide(layerDopplerSecrets(list, selection)),
    Layer.provide(
      options.token === undefined ? Doppler.CredentialsFromEnv : Doppler.fromApiKey({ apiKey: options.token })
    )
  )
