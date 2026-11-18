# Releasing

Releases publish `@fantastic.dev/effect-config` to npm from
`.github/workflows/release.yml`, with npm provenance. Nobody publishes from a
laptop.

## Cut a release

1. In a PR, set `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Push the tag `v<version>` on the reviewed commit:

   ```sh
   git tag v0.1.0 <commit>
   git push origin v0.1.0
   ```

3. The `Release` workflow runs:
   - **Verify release** (`ubicloud-standard-2-ubuntu-2404`) checks that the tag
     equals `v` + `package.json` version, runs `pnpm check`, packs the tarball
     once and uploads it with its integrity.
   - **Publish** (`ubuntu-24.04`) downloads that tarball, checks its integrity,
     and runs `npm publish <tarball> --provenance --access public
     --ignore-scripts`. It installs and builds nothing. If the version is
     already on npm with the same integrity it skips the write; different
     contents fail the job. It then waits until the registry serves the
     version with an SLSA provenance attestation, and creates the GitHub
     release.

A failed publish is never retried automatically. Check the registry before
re-running the workflow at the same tag.

## Why one job runs on a GitHub-hosted runner

All CI runs on UbiCloud except the Publish job. npm trusted publishing and
provenance reject self-hosted runners
([trusted publishers](https://docs.npmjs.com/trusted-publishers/),
[provenance](https://docs.npmjs.com/generating-provenance-statements/)).
The owner approved this exception for the Publish job only (FORG-155).
`scripts/repository.test.mjs` fails if any other job leaves UbiCloud.

## Authentication

Publish uses npm trusted publishing (GitHub OIDC). There is no npm token in
the repository. The job has `id-token: write` and runs in the `npm` GitHub
environment.

One-time setup by an npm owner of the `@fantastic.dev` scope:

1. npm allows a trusted publisher only for a package that already exists. If
   the package has never been published, publish a placeholder under the
   `bootstrap` dist-tag (never `latest`):

   ```sh
   npm publish --tag bootstrap --access public   # in a folder with a stub package.json
   ```

2. On npmjs.com, open the package settings and add a trusted publisher:
   GitHub Actions, organization `FantasticDevHQ`, repository `effect-config`,
   workflow `release.yml`, environment `npm`.
