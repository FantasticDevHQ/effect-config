/**
 * Turns a key list into Effect `Config` values.
 *
 * @since 0.1.0
 */
import { Config, ConfigProvider, Effect, Option, type Redacted, Schema, SchemaIssue } from "effect"
import type { KeyByName, KeyDefinition, KeyList, KeyName } from "./keys.ts"

/**
 * The loaded value of one key: `Redacted` for secrets, `Option` for keys that
 * are not required.
 *
 * @since 0.1.0
 * @category models
 */
export type KeyValue<K extends KeyDefinition> = boolean extends K["required"] ?
  // `required` is a widened `boolean`, so either shape can occur at runtime.
  SecretAware<K> | Option.Option<SecretAware<K>>
  : K["required"] extends true ? SecretAware<K>
  : Option.Option<SecretAware<K>>

type SecretAware<K extends KeyDefinition> = boolean extends K["secret"] ?
  K["schema"]["Type"] | Redacted.Redacted<K["schema"]["Type"]>
  : K["secret"] extends true ? Redacted.Redacted<K["schema"]["Type"]>
  : K["schema"]["Type"]

/**
 * The loaded values of a whole key list, keyed by name.
 *
 * @since 0.1.0
 * @category models
 */
export type ConfigValues<Keys extends ReadonlyArray<KeyDefinition>> = {
  readonly [K in Keys[number] as K["name"]]: KeyValue<K>
}

const invalidSecret = (name: string): Config.ConfigError =>
  new Config.ConfigError(
    new Schema.SchemaError(
      new SchemaIssue.Pointer([name], new SchemaIssue.InvalidValue({ message: `Invalid value for secret key ${name}` }))
    )
  )

const unreadableSecret = (name: string): Config.ConfigError =>
  new Config.ConfigError(new ConfigProvider.SourceError({ message: `Could not read secret key ${name}` }))

/**
 * Secret keys decode straight into `Redacted`. If decoding fails while a
 * value is present, the original issue is replaced by one that carries no
 * input, so neither a schema's own message nor the issue object can expose
 * the secret. A missing value keeps its original schema error, which has no
 * value. A provider (source) error is replaced too, because its message comes
 * from the provider and could contain anything.
 * If the presence check itself fails, the key is treated as present so no
 * provider error can surface in its place.
 */
const secretConfig = (key: KeyDefinition): Config.Config<unknown> =>
  Config.orElse(
    Config.schema(Schema.Redacted(key.schema), key.name),
    (error) =>
      Config.option(Config.schema(Schema.String, key.name)).pipe(
        Config.orElse(() => Config.succeed(Option.some(""))),
        Config.mapEffect((raw) =>
          Effect.fail(
            Option.isNone(raw)
              // Absent value: keep a schema error (it has no input to leak);
              // replace a provider error, whose text the provider controls.
              ? Schema.isSchemaError(error.cause) ? error : unreadableSecret(key.name)
              : invalidSecret(key.name)
          )
        )
      )
  )

const keyToConfig = (key: KeyDefinition): Config.Config<unknown> => {
  const base = key.secret ? secretConfig(key) : Config.schema(key.schema, key.name)
  return key.required ? base : Config.option(base)
}

/**
 * Builds one Effect `Config` that loads every declared key.
 *
 * - Secret keys load as `Redacted`.
 * - Optional keys load as `Option`.
 * - A missing required key fails with a `ConfigError` whose message names the
 *   key.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { makeConfig } from "@fantastic.dev/effect-config"
 * import { keys } from "./keys.ts"
 *
 * const program = Effect.gen(function*() {
 *   const config = yield* makeConfig(keys)
 *   config.PORT // number
 *   config.API_KEY // Redacted<string>
 *   config.LOG_LEVEL // Option<"debug" | "info">
 * })
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const makeConfig = <const Keys extends ReadonlyArray<KeyDefinition>>(
  list: KeyList<Keys>
): Config.Config<ConfigValues<Keys>> => {
  const configs: Record<string, Config.Config<unknown>> = {}
  for (const key of list.keys) configs[key.name] = keyToConfig(key)
  // `Config.all` loses the per-key types of a dynamically built record; the
  // mapped type above restores them from the same key list.
  return Config.all(configs) as Config.Config<ConfigValues<Keys>>
}

/**
 * Builds the `Config` for one declared key. Passing a name that the list does
 * not declare is a type error.
 *
 * @since 0.1.0
 * @category constructors
 */
export const keyConfig = <const Keys extends ReadonlyArray<KeyDefinition>, const Name extends KeyName<Keys>>(
  list: KeyList<Keys>,
  name: Name
): Config.Config<KeyValue<KeyByName<Keys, Name>>> => {
  const key = list.keys.find((candidate) => candidate.name === name)
  if (key === undefined) {
    // Unreachable from typed code; guards untyped callers.
    return Config.fail(
      new ConfigProvider.SourceError({ message: `effect-config: key ${String(name)} is not declared` })
    )
  }
  return keyToConfig(key) as Config.Config<KeyValue<KeyByName<Keys, Name>>>
}
