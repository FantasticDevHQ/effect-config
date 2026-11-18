<p align="center">
  <a href="https://fantastic.dev"><img src="assets/fantastic-dev-logo.svg" width="80" height="80" alt="Fantastic.Dev" /></a>
</p>

[A Fantastic.Dev Project](https://fantastic.dev)

<h1 align="center">effect-config</h1>

<p align="center"><strong>Declare each configuration key once. Read it as typed Effect <code>Config</code>.</strong></p>

> **Status:** pre-release. The API below is being built in the open; the first
> published version will be `0.1.0`.

## What it is

`@fantastic.dev/effect-config` is a small library for [Effect](https://effect.website) 4 apps:

- **One key list.** Declare every configuration key with its schema, whether it
  is required, whether it is secret, and which parts of your system use it.
- **Effect `Config`.** Turn that list into one typed `Config` value. Secrets come
  back as `Redacted`.
- **Drift check.** A CLI command fails CI when `.env.example` and the key list
  disagree.
- **Optional Doppler provider.** A `ConfigProvider` that reads only declared keys
  from Doppler, published on its own subpath so apps that do not use Doppler
  never bundle it.

## Usage

Declare each key once:

```ts
import { Schema } from "effect"
import { defineKeys } from "@fantastic.dev/effect-config"

export const keys = defineKeys([
  { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["api"] },
  { name: "API_KEY", schema: Schema.String, required: true, secret: true, consumers: ["api", "worker"] },
  { name: "LOG_LEVEL", schema: Schema.Literals(["debug", "info"]), required: false, secret: false, consumers: ["api"] }
])
```

Read it as one typed Effect `Config`:

```ts
import { Effect } from "effect"
import { makeConfig } from "@fantastic.dev/effect-config"
import { keys } from "./keys.ts"

const program = Effect.gen(function*() {
  const config = yield* makeConfig(keys)
  config.PORT      // number
  config.API_KEY   // Redacted<string>, prints as <redacted>
  config.LOG_LEVEL // Option<"debug" | "info">
})
```

- A missing required key fails with a `ConfigError` that names the key.
- `keyConfig(keys, "API_KEY")` reads a single key. A name the list does not
  declare is a TypeScript error, and so is `config.UNDECLARED`.
- The values come from the active `ConfigProvider` (environment variables by
  default), so tests can swap in `ConfigProvider.fromUnknown(...)`.

## Drift check

Fail CI when `.env.example` and the key list disagree:

```sh
effect-config check --keys ./src/config/keys.ts --env-example .env.example
```

```text
missing: API_KEY      # declared, but not in .env.example
extra: OLD_SETTING    # in .env.example, but not declared
```

The command imports the key list module (the default export, the only
`defineKeys` export, or the one named by `--export`). It reads only the key
names from the example file, never the values. Exit codes: `0` when the keys
match, `1` on drift, `2` when the inputs cannot be read. A `.ts` key list
module needs Node.js 22.18 or later.

## Doppler

Read the declared keys from [Doppler](https://www.doppler.com) without
changing app code. The provider lives on its own subpath, and the client is
an optional peer dependency:

```sh
pnpm add @distilled.cloud/doppler
```

```ts
import { Effect, Layer } from "effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import { makeConfig } from "@fantastic.dev/effect-config"
import { layerDoppler, stageToConfig } from "@fantastic.dev/effect-config/doppler"
import { keys } from "./keys.ts"

const ConfigLive = Layer.unwrap(
  Effect.map(
    stageToConfig(process.env.STAGE ?? "local", { local: "dev", preview: "stg", prod: "prd" }),
    (config) => layerDoppler(keys, { project: "my-app", config })
  )
).pipe(Layer.provide(FetchHttpClient.layer))

const program = makeConfig(keys).pipe(Effect.provide(ConfigLive))
```

- Only keys in the list are read. Asking for any other key fails with a
  `DopplerConfigError` whose reason is `not-allowlisted`.
- A 401 or 403 from Doppler fails with reason `authentication`. Error
  messages contain only the reason, the config name and the key name, never
  the token or a value.
- The token comes from `DOPPLER_TOKEN` (or `DOPPLER_API_KEY`), or from the
  `token` option as a `Redacted` value.
- An app that imports only `@fantastic.dev/effect-config` never bundles the
  Doppler client.

## Requirements

- Node.js 22.18 or later
- `effect` `^4.1.4` as a peer dependency

## Development

```sh
pnpm install
pnpm check   # typecheck, tests, build, PR-standard and repository tests
```

Pull requests follow the [PR standard](docs/pull-request-standard.md).

## License

[MIT](LICENSE)
