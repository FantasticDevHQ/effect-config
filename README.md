<p align="center">
  <a href="https://fantastic.dev"><img src="assets/fantastic-dev-logo.svg" width="80" height="80" alt="Fantastic.Dev" /></a>
</p>

<h1 align="center">Effect Config</h1>

<p align="center"><strong>Declare each configuration key once. Read it as typed Effect <code>Config</code>.</strong></p>

<p align="center">A <a href="https://fantastic.dev">Fantastic.Dev</a> Project</p>

<p align="center">
  <a href="https://fantastic.dev"><img src="https://img.shields.io/badge/Fantastic.dev-94C173?style=for-the-badge&amp;logoColor=0c0e13" alt="Visit Fantastic.Dev" /></a>
  <a href="https://github.com/FantasticDevHQ"><img src="https://img.shields.io/badge/GitHub-0c0e13?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="Fantastic.Dev on GitHub" /></a>
  <a href="https://www.youtube.com/@FantasticDevHQ"><img src="https://img.shields.io/badge/YouTube-FF0033?style=for-the-badge&amp;logo=youtube&amp;logoColor=white" alt="Fantastic.Dev on YouTube" /></a>
  <a href="https://twitter.com/FantasticDevHQ"><img src="https://img.shields.io/badge/Twitter_%2F_X-0c0e13?style=for-the-badge&amp;logo=x&amp;logoColor=white" alt="Fantastic.Dev on Twitter / X" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@fantastic.dev/effect-config"><img src="https://img.shields.io/npm/v/@fantastic.dev/effect-config?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/FantasticDevHQ/effect-config/actions/workflows/check.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/FantasticDevHQ/effect-config/check.yml?branch=main&amp;style=flat-square" alt="CI status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/FantasticDevHQ/effect-config?style=flat-square" alt="License: MIT" /></a>
</p>

<p align="center"><a href="#quick-start">Quick start</a> · <a href="#have-my-agent-set-this-up">Agent setup</a> · <a href="#documentation">Documentation</a></p>

---

Effect Config is a small library for [Effect](https://effect.website) 4 apps. You declare every configuration key once, with its schema, whether it is required, whether it is secret, and which parts of your system use it. That one list then gives you a typed Effect `Config` (secrets come back as `Redacted`), a CLI check that fails CI when `.env.example` drifts, and an optional Doppler `ConfigProvider` that reads only the declared keys.

Use it in an Effect 4 TypeScript app that reads environment variables and wants one source of truth for them.

## Quick start

### Have my agent set this up

Copy this into your coding agent while it is working in your Effect app's repository:

```text
Set up Effect Config (@fantastic.dev/effect-config) in this Effect 4 app using
its public documentation:
https://github.com/FantasticDevHQ/effect-config#readme
https://www.npmjs.com/package/@fantastic.dev/effect-config

Read applicable AGENTS.md and AGENT.md files. Inspect Git status, the package
manager and committed lockfile, the installed effect version (it must satisfy
^4.1.4), the Node.js version (22.18 or later), how the app reads environment
variables today, and any existing .env.example. Preserve user changes and the
existing architecture and production settings.

1. Install @fantastic.dev/effect-config with this repository's package manager
   (effect is a peer dependency; do not upgrade it unless it is below 4.1.4).
2. Create one key list module (for example src/config/keys.ts) that exports
   defineKeys([...]) with every environment variable the app reads: name,
   Effect Schema, required, secret and consumers. Mark credentials secret.
3. Read the values with makeConfig(keys) where the app reads config today, so
   secret keys arrive as Redacted. Do not log secret values.
4. Make .env.example list exactly the declared keys, with placeholder values
   only, never real secrets.
5. Add `effect-config check --keys <key list module> --env-example .env.example`
   as a script and to CI if the repository has CI.
6. Only if the app already uses Doppler: wire layerDoppler from
   @fantastic.dev/effect-config/doppler as described in the README. Do not
   create Doppler projects or tokens, and do not read live secrets.

Verify with `npx effect-config check --keys <key list module>`. It should
print `ok: <N> keys match .env.example` and exit 0. Also run the app's own
typecheck and tests. Report changed files, commands run, checks passed and
anything that still needs the user, such as Doppler credentials.
```

### Manual setup

Requires Node.js 22.18 or later, an app that uses `effect` `^4.1.4`, and npm, pnpm or another package manager.

Run from your app's root:

```sh
npm install @fantastic.dev/effect-config effect
```

Create `src/config/keys.ts`:

```ts
import { Schema } from "effect"
import { defineKeys } from "@fantastic.dev/effect-config"

export const keys = defineKeys([
  { name: "PORT", schema: Schema.Int, required: true, secret: false, consumers: ["api"] },
  { name: "API_KEY", schema: Schema.String, required: true, secret: true, consumers: ["api"] }
])
```

Create `.env.example` with placeholder values:

```sh
PORT=3000
API_KEY=
```

Check that the two agree:

```sh
npx effect-config check --keys src/config/keys.ts
```

Expected result: `ok: 2 keys match .env.example` and exit code 0. Remove `API_KEY` from `.env.example` and the same command prints `missing: API_KEY` and exits 1.

Then read the values in your app with `makeConfig(keys)`, as shown in [Key list](#key-list).

## Key list

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

## Check: drift between the key list and `.env.example`

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

## Documentation

- [Key list](#key-list): `defineKeys`, `makeConfig` and `keyConfig`
- [Drift check](#check-drift-between-the-key-list-and-envexample): the `effect-config check` command and its exit codes
- [Doppler](#doppler): the optional `@fantastic.dev/effect-config/doppler` provider
- [Changelog](CHANGELOG.md)
- [npm package](https://www.npmjs.com/package/@fantastic.dev/effect-config)

## Contributing

Contributions are welcome. Read the
[contributing guide](https://github.com/FantasticDevHQ/.github/blob/main/CONTRIBUTING.md)
and [Code of Conduct](https://github.com/FantasticDevHQ/.github/blob/main/CODE_OF_CONDUCT.md),
and report vulnerabilities privately as described in the
[security policy](https://github.com/FantasticDevHQ/.github/blob/main/SECURITY.md).

Source development needs Node.js 22.18 or later and pnpm 10 (`packageManager`
pins pnpm 10.12.3).

```sh
pnpm install --frozen-lockfile
pnpm check   # typecheck, build, tests, type tests, PR-standard, repository and release tests
```

Pull requests follow the [PR standard](docs/pull-request-standard.md). Releases
follow [docs/releasing.md](docs/releasing.md).

## License

[MIT](LICENSE)
