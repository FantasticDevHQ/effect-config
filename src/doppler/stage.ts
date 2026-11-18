import { Effect } from "effect"
import { dual } from "effect/Function"
import { DopplerConfigError } from "./error.ts"

/**
 * The Doppler environment configs a stage can map to.
 *
 * @since 0.1.0
 * @category models
 */
export type DopplerEnvironment = "dev" | "stg" | "prd"

/**
 * A caller-supplied table from stage names to Doppler environment configs,
 * for example `{ local: "dev", preview: "stg", prod: "prd" }`.
 *
 * @since 0.1.0
 * @category models
 */
export type StageTable = Readonly<Record<string, DopplerEnvironment>>

const environments: ReadonlySet<string> = new Set(["dev", "stg", "prd"])

/**
 * Maps a stage name to its Doppler environment config using `table`. Fails
 * with reason `invalid-stage` when the stage is not in the table.
 *
 * @example
 * ```ts
 * const toConfig = stageToConfig({ prod: "prd", preview: "stg" })
 * toConfig("prod") // Effect succeeding with "prd"
 * stageToConfig("prod", { prod: "prd" }) // same, data-first
 * ```
 *
 * @since 0.1.0
 * @category stages
 */
export const stageToConfig: {
  (table: StageTable): (stage: string) => Effect.Effect<DopplerEnvironment, DopplerConfigError>
  (stage: string, table: StageTable): Effect.Effect<DopplerEnvironment, DopplerConfigError>
} = dual(2, (stage: string, table: StageTable): Effect.Effect<DopplerEnvironment, DopplerConfigError> => {
  const environment = Object.hasOwn(table, stage) ? table[stage] : undefined
  return environment !== undefined && environments.has(environment)
    ? Effect.succeed(environment)
    : Effect.fail(new DopplerConfigError({ reason: "invalid-stage" }))
})
