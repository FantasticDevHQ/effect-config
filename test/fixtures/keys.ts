import { Schema } from "effect"
import { defineKeys } from "../../src/index.ts"

export const keys = defineKeys([
  { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["api"] },
  { name: "API_KEY", schema: Schema.String, required: true, secret: true, consumers: ["api"] },
  { name: "LOG_LEVEL", schema: Schema.Literals(["debug", "info"]), required: false, secret: false, consumers: ["api"] }
])
