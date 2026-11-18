// Installs a packed tarball into a fresh directory and uses it the way an app
// would: the root entry, the /doppler subpath and the effect-config bin.
// Usage: node scripts/release/consumer.mjs <tarball>
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const tarball = resolve(process.argv[2])
const dir = mkdtempSync(join(tmpdir(), "effect-config-consumer-"))
const run = (command, args) => execFileSync(command, args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })

writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }))
run("npm", ["install", "--no-audit", "--no-fund", tarball, "effect@4.1.4", "@distilled.cloud/doppler@1.0.0-rc.20"])

writeFileSync(join(dir, "keys.mjs"), `
import { Schema } from "effect"
import { defineKeys } from "@fantastic.dev/effect-config"
export const keys = defineKeys([
  { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["app"] },
  { name: "API_KEY", schema: Schema.String, required: true, secret: true, consumers: ["app"] }
])
`)
writeFileSync(join(dir, "app.mjs"), `
import { ConfigProvider, Effect, Redacted } from "effect"
import * as Root from "@fantastic.dev/effect-config"
import * as Doppler from "@fantastic.dev/effect-config/doppler"
import { keys } from "./keys.mjs"
const config = await Effect.runPromise(Root.makeConfig(keys).parse(ConfigProvider.fromEnv({ env: { PORT: "8080", API_KEY: "k" } })))
if (config.PORT !== 8080 || Redacted.value(config.API_KEY) !== "k" || String(config.API_KEY) !== "<redacted>") throw new Error("root entry")
if (Object.keys(Root).some((name) => /doppler/i.test(name))) throw new Error("root exports Doppler")
if (typeof Doppler.layerDoppler !== "function" || typeof Doppler.stageToConfig !== "function") throw new Error("doppler subpath")
console.log("imports ok: root and /doppler")
`)
console.log(run("node", ["app.mjs"]).trim())
writeFileSync(join(dir, ".env.example"), "PORT=3000\nAPI_KEY=\n")
console.log(run("npx", ["--no-install", "effect-config", "check", "--keys", "keys.mjs"]).trim())
console.log(`consumer ok in ${dir}`)
