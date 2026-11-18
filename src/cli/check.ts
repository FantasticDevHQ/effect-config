/**
 * Drift detection between a key list and an env example file.
 *
 * @since 0.1.0
 */
import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { pathToFileURL } from "node:url"
import type { KeyList } from "../keys.ts"

/**
 * Failure to read the inputs of the check command.
 *
 * @since 0.1.0
 * @category errors
 */
export class CheckInputError extends Schema.TaggedError<CheckInputError, { readonly brand: unique symbol }>()("CheckInputError", {
  reason: Schema.Literals(["env-example-unreadable", "key-list-unloadable", "key-list-not-found"]),
  path: Schema.String,
  detail: Schema.optional(Schema.String)
}) {
  override get message(): string {
    const what = this.reason === "env-example-unreadable"
      ? "Could not read the env example file"
      : this.reason === "key-list-unloadable"
      ? "Could not import the key list module"
      : "No key list export found in the module"
    return `${what}: ${this.path}${this.detail === undefined ? "" : ` (${this.detail})`}`
  }
}

/**
 * The difference between the declared keys and the env example.
 *
 * - `missing`: declared in the key list but absent from the example file.
 * - `extra`: present in the example file but not declared.
 *
 * @since 0.1.0
 * @category models
 */
export interface Drift {
  readonly missing: ReadonlyArray<string>
  readonly extra: ReadonlyArray<string>
}

const assignment = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/

/**
 * Returns the key names assigned in a dotenv-style file, in order, without
 * duplicates. Blank lines and `#` comments are ignored, and an `export `
 * prefix is accepted. Values are never parsed or returned.
 *
 * @since 0.1.0
 * @category parsing
 */
export const parseEnvExample = (text: string): ReadonlyArray<string> => {
  const names = new Set<string>()
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (/^\s*(#|$)/.test(line)) continue
    const match = assignment.exec(line)
    if (match?.[1] !== undefined) names.add(match[1])
  }
  return [...names]
}

/**
 * Compares declared key names with the names in an env example.
 *
 * @since 0.1.0
 * @category comparison
 */
export const diffKeys = (declared: ReadonlyArray<string>, example: ReadonlyArray<string>): Drift => {
  const inExample = new Set(example)
  const isDeclared = new Set(declared)
  return {
    missing: declared.filter((name) => !inExample.has(name)),
    extra: example.filter((name) => !isDeclared.has(name))
  }
}

/**
 * Whether a drift result has no differences.
 *
 * @since 0.1.0
 * @category comparison
 */
export const isClean = (drift: Drift): boolean => drift.missing.length === 0 && drift.extra.length === 0

/**
 * The report lines for a drift result: `missing: NAME` then `extra: NAME`.
 *
 * @since 0.1.0
 * @category formatting
 */
export const formatDrift = (drift: Drift): ReadonlyArray<string> => [
  ...drift.missing.map((name) => `missing: ${name}`),
  ...drift.extra.map((name) => `extra: ${name}`)
]

const isKeyList = (value: unknown): value is KeyList =>
  typeof value === "object" && value !== null &&
  Array.isArray(Reflect.get(value, "keys")) && Array.isArray(Reflect.get(value, "names"))

/**
 * Imports a key list module and returns its key list: the named export when
 * `exportName` is given, otherwise the default export, otherwise the only
 * export that is a key list.
 *
 * @since 0.1.0
 * @category loading
 */
export const loadKeyList = Effect.fn("effect-config/loadKeyList")(function*(modulePath: string, exportName?: string) {
  const path = yield* Path.Path
  const absolute = path.resolve(modulePath)
  const module: Record<string, unknown> = yield* Effect.tryPromise({
    try: () => import(pathToFileURL(absolute).href),
    catch: (cause) =>
      new CheckInputError({
        reason: "key-list-unloadable",
        path: modulePath,
        detail: cause instanceof Error ? cause.message : String(cause)
      })
  })
  if (exportName !== undefined) {
    const named = module[exportName]
    if (isKeyList(named)) return named
    return yield* new CheckInputError({ reason: "key-list-not-found", path: modulePath, detail: `export ${exportName}` })
  }
  if (isKeyList(module["default"])) return module["default"]
  const lists = Object.values(module).filter(isKeyList)
  const [only] = lists
  if (lists.length === 1 && only !== undefined) return only
  return yield* new CheckInputError({
    reason: "key-list-not-found",
    path: modulePath,
    detail: lists.length > 1 ? "several key lists; pass --export NAME" : "no defineKeys export"
  })
})

/**
 * Options for {@link check}.
 *
 * @since 0.1.0
 * @category models
 */
export interface CheckOptions {
  readonly keys: string
  readonly envExample: string
  readonly exportName?: string | undefined
}

/**
 * Reads the key list module and the env example, prints one line per
 * missing or extra key, and returns the drift.
 *
 * @since 0.1.0
 * @category commands
 */
export const check = Effect.fn("effect-config/check")(function*(options: CheckOptions) {
  const fs = yield* FileSystem.FileSystem
  const list = yield* loadKeyList(options.keys, options.exportName)
  const text = yield* fs.readFileString(options.envExample).pipe(
    Effect.mapError((cause) =>
      new CheckInputError({ reason: "env-example-unreadable", path: options.envExample, detail: cause.message })
    )
  )
  const drift = diffKeys(list.names, parseEnvExample(text))
  for (const line of formatDrift(drift)) yield* Console.log(line)
  if (isClean(drift)) {
    yield* Console.log(`ok: ${list.names.length} keys match ${options.envExample}`)
  }
  return drift
})
