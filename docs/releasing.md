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
   - **Verify release** (`ubicloud-standard-2-ubuntu-2404`) checks out the
     tag, runs `pnpm check`, then checks that the tag equals `v` +
     `package.json` version and that `CHANGELOG.md` has that version. It packs
     the package and records its npm integrity (sha512 of the tarball bytes,
     cross-checked against npm's report), and installs the tarball in a clean
     consumer.
   - **Publish** (`ubuntu-24.04`) checks out the exact commit Verify tested
     and fails if the tag has moved. It installs with the frozen lockfile and
     `--ignore-scripts`, builds and packs on that runner, so the provenance
     attestation describes the build that is published. It fails unless that
     tarball has **exactly** the verified integrity. npm pack output is
     byte-identical across npm 10 and 11 for the same files. It then runs
     `npm publish <its own tarball> --provenance --access public
     --ignore-scripts`. If the version is already on npm, it requires the
     registry's integrity to equal the verified one and skips the write;
     anything else fails. It then waits until the registry serves the version
     with that integrity and an SLSA provenance attestation, and creates the
     GitHub release if it is missing.

A failed publish is never retried automatically. Check the registry before
recovering.

## Recover an existing tag

Re-running an old run uses the old workflow. To verify and publish an existing
tag with the current workflow, dispatch it from `main` without moving the tag:

```sh
gh workflow run release.yml --ref main -f release_tag=v0.1.0
```

The jobs check out `refs/tags/<release_tag>`. An already-published version is
compared by integrity and not published again. Do not move or delete a release
tag, and do not publish a version that differs from its tag.

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
