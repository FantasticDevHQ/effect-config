import { Schema } from "effect"

/**
 * Why a Doppler read failed.
 *
 * - `authentication`: Doppler rejected the token (401 or 403), or no token
 *   was configured.
 * - `not-allowlisted`: the key is not in the key list, so it is never read.
 * - `unavailable`: Doppler could not be reached or returned an unexpected
 *   response.
 * - `invalid-stage`: a stage name has no entry in the stage table.
 *
 * @since 0.1.0
 * @category models
 */
export const DopplerConfigErrorReason = Schema.Literals([
  "authentication",
  "not-allowlisted",
  "unavailable",
  "invalid-stage"
])

/**
 * @since 0.1.0
 * @category models
 */
export type DopplerConfigErrorReason = typeof DopplerConfigErrorReason.Type

/**
 * A Doppler configuration failure. Its message contains only the reason, the
 * Doppler config name and the key name: never a token, project or value.
 *
 * @since 0.1.0
 * @category errors
 */
export class DopplerConfigError extends Schema.TaggedError<DopplerConfigError, { readonly brand: unique symbol }>()(
  "DopplerConfigError",
  {
    reason: DopplerConfigErrorReason,
    config: Schema.optional(Schema.String),
    key: Schema.optional(Schema.String)
  }
) {
  override get message(): string {
    const config = this.config === undefined ? "" : ` config ${this.config}`
    const key = this.key === undefined ? "" : ` key ${this.key}`
    return `Doppler configuration ${this.reason}.${config}${key}`.trimEnd()
  }
}
