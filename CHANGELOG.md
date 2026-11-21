# Changelog

## [0.1.4](https://github.com/FantasticDevHQ/effect-config/compare/v0.1.3...v0.1.4) (2026-11-21)


### Continuous Integration

* **standards:** add the PR standard re-run workflow ([#16](https://github.com/FantasticDevHQ/effect-config/issues/16)) ([7899175](https://github.com/FantasticDevHQ/effect-config/commit/7899175ca1a4090cf19ca65324a1be7b1aa15f64))

## [0.1.3](https://github.com/FantasticDevHQ/effect-config/compare/v0.1.2...v0.1.3) (2026-11-21)


### Continuous Integration

* **standards:** add the issue standard workflow ([#13](https://github.com/FantasticDevHQ/effect-config/issues/13)) ([c41ac87](https://github.com/FantasticDevHQ/effect-config/commit/c41ac879030788a60548107e5081d74e4a205a00))

## [0.1.2](https://github.com/FantasticDevHQ/effect-config/compare/v0.1.1...v0.1.2) (2026-11-21)


### Documentation

* **community:** adopt organization community health defaults ([#11](https://github.com/FantasticDevHQ/effect-config/issues/11)) ([b79a42e](https://github.com/FantasticDevHQ/effect-config/commit/b79a42ecc7013824cc49859a5e58ef175efd975f))


### Continuous Integration

* **release:** OSS-43 make release PRs meet the PR standard ([#14](https://github.com/FantasticDevHQ/effect-config/issues/14)) ([b1835d5](https://github.com/FantasticDevHQ/effect-config/commit/b1835d5ddb2c60799985b28a79c295c5e202b986))

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
