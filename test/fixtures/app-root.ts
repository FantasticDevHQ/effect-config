// A consumer that imports only the root entry.
import { Effect, Schema } from "effect"
import { defineKeys, makeConfig } from "../../src/index.ts"

const keys = defineKeys([{ name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["app"] }])
export const program = Effect.map(makeConfig(keys), (config) => config.PORT)
