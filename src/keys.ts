/**
 * The configuration key list: one declaration per key, read by both app code
 * (through {@link makeConfig}) and tooling (drift checks, secret providers).
 *
 * @since 0.1.0
 */
import type { Schema } from "effect"

/**
 * A schema that can decode a configuration value. Any Effect `Schema` codec
 * that `Config.schema` accepts works, for example `Schema.String`,
 * `Schema.Int`, `Schema.URL` or `Schema.Literals(["dev", "prod"])`.
 *
 * @since 0.1.0
 * @category models
 */
export type KeySchema = Schema.ConstraintCodec<unknown, unknown>

/**
 * The declaration of one configuration key.
 *
 * - `name` is the key as it appears in the environment, e.g. `DATABASE_URL`.
 * - `schema` decodes the raw value.
 * - `required` keys fail loading when absent; optional keys load as `Option`.
 * - `secret` keys load as `Redacted` so they never print in logs.
 * - `consumers` lists the parts of the system that read the key (apps,
 *   services, jobs). Tooling uses it; the runtime ignores it.
 *
 * @since 0.1.0
 * @category models
 */
export interface KeyDefinition<
  Name extends string = string,
  S extends KeySchema = KeySchema,
  Required extends boolean = boolean,
  Secret extends boolean = boolean
> {
  readonly name: Name
  readonly schema: S
  readonly required: Required
  readonly secret: Secret
  readonly consumers: ReadonlyArray<string>
  readonly description?: string | undefined
}

/**
 * A validated, ordered list of key definitions.
 *
 * @since 0.1.0
 * @category models
 */
export interface KeyList<Keys extends ReadonlyArray<KeyDefinition> = ReadonlyArray<KeyDefinition>> {
  readonly keys: Keys
  readonly names: ReadonlyArray<KeyName<Keys>>
}

/**
 * The union of declared key names.
 *
 * @since 0.1.0
 * @category models
 */
export type KeyName<Keys extends ReadonlyArray<KeyDefinition>> = Keys[number]["name"]

/**
 * Looks up the definition of one declared key by name.
 *
 * @since 0.1.0
 * @category models
 */
export type KeyByName<Keys extends ReadonlyArray<KeyDefinition>, Name extends KeyName<Keys>> = Extract<
  Keys[number],
  { readonly name: Name }
>

const keyNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/

// Names that would hit Object.prototype accessors instead of becoming plain
// properties of the loaded config object.
const reservedNames: ReadonlySet<string> = new Set(["__proto__"])

/**
 * Declares the configuration key list.
 *
 * Throws at definition time if a name is not a valid environment variable
 * name (or is the reserved `__proto__`), is declared twice, or has a
 * non-string consumer. These are programmer
 * errors in a static declaration, so they fail fast at module load.
 *
 * @example
 * ```ts
 * import { Schema } from "effect"
 * import { defineKeys } from "@fantastic.dev/effect-config"
 *
 * export const keys = defineKeys([
 *   { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["api"] },
 *   { name: "API_KEY", schema: Schema.String, required: true, secret: true, consumers: ["api", "worker"] },
 *   { name: "LOG_LEVEL", schema: Schema.Literals(["debug", "info"]), required: false, secret: false, consumers: ["api"] }
 * ])
 * ```
 *
 * @since 0.1.0
 * @category constructors
 */
export const defineKeys = <const Keys extends ReadonlyArray<KeyDefinition>>(keys: Keys): KeyList<Keys> => {
  const seen = new Set<string>()
  for (const key of keys) {
    if (!keyNamePattern.test(key.name) || reservedNames.has(key.name)) {
      throw new TypeError(`effect-config: invalid key name ${JSON.stringify(key.name)}`)
    }
    if (seen.has(key.name)) {
      throw new TypeError(`effect-config: key ${key.name} is declared more than once`)
    }
    seen.add(key.name)
    if (!Array.isArray(key.consumers) || key.consumers.some((consumer) => typeof consumer !== "string")) {
      throw new TypeError(`effect-config: key ${key.name} must list its consumers as strings`)
    }
  }
  return { keys, names: keys.map((key) => key.name) }
}
