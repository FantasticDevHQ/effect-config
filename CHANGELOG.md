# Changelog

## 0.1.0

First release.

- `defineKeys`: declare each configuration key once with its name, schema, required flag, secret flag and consumers.
- `makeConfig` and `keyConfig`: read the key list as one typed Effect `Config`. Secret keys load as `Redacted`, optional keys as `Option`, and a missing required key fails with a `ConfigError` that names it. An undeclared key is a TypeScript error.
- `effect-config check`: a CLI command that compares a key list module with `.env.example`, prints each `missing:` and `extra:` key, and exits 1 on drift.
- `@fantastic.dev/effect-config/doppler`: an optional Doppler `ConfigProvider` that reads only declared keys, plus `stageToConfig`. Apps that do not import this subpath do not bundle the Doppler client.
