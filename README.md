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
