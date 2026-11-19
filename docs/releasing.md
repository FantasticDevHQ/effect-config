# Releasing

Releases publish `@fantastic.dev/effect-config` to npm from
`.github/workflows/release.yml`, with npm provenance. Nobody publishes from a
laptop.

## Automatic releases

Release Please maintains a release PR on every push to `main`, starting from
published `v0.1.0`. Use Conventional Commit PR titles with the owning ticket:
`fix: FORG-123 correct config errors`, `feat: FORG-123 add a capability`, or
`ci: FORG-123 improve checks`. Fixes produce patches; features produce minor
releases. Breaking changes produce minor releases before 1.0. Maintenance and
documentation commits are included too, matching the organization release policy.
Do not manually bump `package.json`, `.release-please-manifest.json` or the
changelog during ordinary development.

The release PR uses the organization `fantasticdev-npm-releases` GitHub App so
its events trigger normal CI. The workflow verifies the source with `pnpm check`,
adds the five required PR sections with its actual Actions run identity and proof,
and preserves the generated version notes between standalone `---` delimiters.
Keep these boundaries intact; add review evidence in comments. Release PRs relate
to the automation setup ticket rather than closing it again.

Auto-merge uses squash and matches the current PR head. GitHub waits for the
required `PR standard` and `Repository quality gates` checks. The helper retries
only explicit stale-head errors, revalidating the same branch each time; all
other errors fail. The implementation PR still requires the owner's merge approval.
Once approved and merged, future generated release PRs auto-merge after checks.

After a release PR merges, Release Please creates the tag and GitHub release
with `GITHUB_TOKEN`. That token's tag events do not start workflows, so the same
run passes the created tag to Verify and then Publish. Ordinary main pushes
without a created release skip those jobs. Never use a successful maintenance run
with Publish skipped as proof of publication.

## Manual tags and publication gates

Manual `v<version>` tags remain supported for exceptional releases. First review
the version and changelog changes in a PR, then push the tag on the reviewed
commit. Do not publish from a laptop.

The `Release` workflow runs:
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

## Release App configuration

The organization App installation must include this repository. The organization
variable `RELEASE_APP_CLIENT_ID` and selected secret `RELEASE_APP_PRIVATE_KEY`
must be available here; the App needs contents, pull-request and issue write
permissions. Repository auto-merge must be enabled. Keep required checks active
without App bypasses. Only the Publish job uses the existing approved hosted
runner exception; maintenance and verification run on UbiCloud.

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
