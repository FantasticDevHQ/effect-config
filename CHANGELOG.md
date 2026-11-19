# Changelog

## [0.1.1](https://github.com/FantasticDevHQ/effect-config/compare/v0.1.0...v0.1.1) (2026-11-19)


### Documentation

* **readme:** FORG-156 adopt the OSS README header and quick start ([#7](https://github.com/FantasticDevHQ/effect-config/issues/7)) ([0297ac5](https://github.com/FantasticDevHQ/effect-config/commit/0297ac57b879ac96a3d808a663e1b1dd4b77e0f4))


### Continuous Integration

* **release:** FORG-157 build on the provenance runner and add a recovery path ([#8](https://github.com/FantasticDevHQ/effect-config/issues/8)) ([603b867](https://github.com/FantasticDevHQ/effect-config/commit/603b867a5a34296ef0b64b55e999fedf6479c9e1))
* **release:** FORG-162 automate release PRs and publishing ([#9](https://github.com/FantasticDevHQ/effect-config/issues/9)) ([84f90cd](https://github.com/FantasticDevHQ/effect-config/commit/84f90cdc9284bd918868a97888f8b7c861c566be))

## 0.1.0

First release.

- `defineKeys`: declare each configuration key once with its name, schema, required flag, secret flag and consumers.
- `makeConfig` and `keyConfig`: read the key list as one typed Effect `Config`. Secret keys load as `Redacted`, optional keys as `Option`, and a missing required key fails with a `ConfigError` that names it. An undeclared key is a TypeScript error.
- `effect-config check`: a CLI command that compares a key list module with `.env.example`, prints each `missing:` and `extra:` key, and exits 1 on drift.
- `@fantastic.dev/effect-config/doppler`: an optional Doppler `ConfigProvider` that reads only declared keys, plus `stageToConfig`. Apps that do not import this subpath do not bundle the Doppler client.
