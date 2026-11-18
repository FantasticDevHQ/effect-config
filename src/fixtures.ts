import { Schema } from "effect"
import { defineKeys } from "./keys.ts"

/** A three-key list shared by the tests. Not exported from the package. */
export const keys = defineKeys([
  { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["api"] },
  { name: "API_KEY", schema: Schema.String, required: true, secret: true, consumers: ["api", "worker"] },
  {
    name: "LOG_LEVEL",
    schema: Schema.Literals(["debug", "info", "warn"]),
    required: false,
    secret: false,
    consumers: ["api"],
    description: "Minimum log level"
  }
])
