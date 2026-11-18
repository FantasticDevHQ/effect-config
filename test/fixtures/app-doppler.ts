// A consumer that imports the Doppler subpath (positive control).
import { Schema } from "effect"
import { layerDoppler } from "../../src/doppler/index.ts"
import { defineKeys } from "../../src/index.ts"

const keys = defineKeys([{ name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["app"] }])
export const layer = layerDoppler(keys, { project: "p", config: "dev" })
