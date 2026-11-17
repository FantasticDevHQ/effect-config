# Agent notes

- Package: `@fantastic.dev/effect-config`, a generic Effect 4 library. Keep it free of any specific app's names.
- `effect` is pinned to `4.1.4` for development and declared as the peer range `^4.1.4`.
- Run `pnpm check` before opening a PR. It runs the Effect-patched typecheck (`effect-tsgo tsc`), `@effect/vitest` tests, the build, the PR-standard tests and the repository guard tests.
- One Linear ticket = one branch = one PR. Follow `docs/pull-request-standard.md`.
- CI runs only on `ubicloud-standard-2-ubuntu-2404`; `scripts/repository.test.mjs` enforces it.
- Do not edit `assets/fantastic-dev-logo.svg`; it is a verbatim copy of the brand-kit asset.
