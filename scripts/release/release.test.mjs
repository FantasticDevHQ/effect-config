import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createHash } from "node:crypto"
import { integrityErrors } from "./compare.mjs"
import { integrityOf, integrityPattern } from "./integrity.mjs"
import { publicationErrors } from "./published.mjs"
import { changelogErrors, releaseTagErrors } from "./tag.mjs"

test("release tag must be v<semver> and equal the package version", () => {
  assert.deepEqual(releaseTagErrors("v0.1.0", "0.1.0"), [])
  assert.deepEqual(releaseTagErrors("v1.2.3-rc.1", "1.2.3-rc.1"), [])
  assert.match(releaseTagErrors("v0.1.1", "0.1.0")[0], /does not match/)
  assert.match(releaseTagErrors("0.1.0", "0.1.0")[0], /v<semver>/)
  assert.match(releaseTagErrors("v0.1", "0.1")[0], /not v<semver>/)
  assert.match(releaseTagErrors("v0.0.0", "0.0.0").join(), /not releasable/)
  assert.equal(releaseTagErrors(undefined, "0.1.0").length, 1)
})

test("publication requires the exact version, integrity and SLSA provenance", () => {
  const expected = { name: "@fantastic.dev/effect-config", version: "0.1.0", integrity: "sha512-abc" }
  const good = {
    name: expected.name,
    version: "0.1.0",
    dist: { integrity: "sha512-abc", attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } } }
  }
  assert.deepEqual(publicationErrors(good, expected), [])
  assert.match(publicationErrors({ ...good, dist: { integrity: "sha512-abc" } }, expected).join(), /provenance/)
  assert.match(publicationErrors({ ...good, dist: { ...good.dist, integrity: "sha512-other" } }, expected).join(), /integrity/)
  assert.match(publicationErrors({ ...good, version: "0.0.9" }, expected).join(), /version/)
  assert.ok(publicationErrors(undefined, expected).length >= 2)
})

test("release workflow keeps the GitHub-hosted runner to the Publish job only", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  const runners = [...workflow.matchAll(/^\s+runs-on:\s*(\S+)/gm)].map((match) => match[1])
  assert.deepEqual(runners, ["ubicloud-standard-2-ubuntu-2404", "ubicloud-standard-2-ubuntu-2404", "ubuntu-24.04"])
  const publish = workflow.slice(workflow.indexOf("\n  publish:"))
  assert.match(publish, /runs-on: ubuntu-24\.04/)
  assert.match(publish, /environment: npm/)
  assert.match(publish, /id-token: write/)
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets/)
  assert.match(workflow, /^on:\n  push:\n    branches: \[main\]\n    tags: \["v\*"\]/m)
  // Only the publish job may mint an OIDC token.
  assert.equal(workflow.match(/id-token: write/g)?.length, 1)
})

test("Publish builds the verified commit on its runner and publishes that build only with the verified integrity", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  const publish = workflow.slice(workflow.indexOf("\n  publish:"))
  const order = [
    "ref: ${{ needs.verify.outputs.sha }}",
    'test "$TAG_SHA" = "$VERIFIED_SHA"',
    "pnpm install --frozen-lockfile --ignore-scripts",
    "pnpm build",
    "npm pack --json --ignore-scripts",
    'node .release-tools/scripts/release/compare.mjs "$VERIFIED_INTEGRITY"',
    'npm publish "$TARBALL" --provenance --access public --ignore-scripts'
  ].map((step) => {
    const index = publish.indexOf(step)
    assert.ok(index >= 0, `Publish job runs: ${step}`)
    return index
  })
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "steps run in this order")
  assert.doesNotMatch(publish, /download-artifact/, "Publish uses its own build, not the UbiCloud tarball")
  assert.doesNotMatch(publish, /ref: refs\/tags\//, "Publish checks out the verified SHA, not the tag name")
})

test("release tooling comes from the workflow commit, after the tag's own checks", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  const verify = workflow.slice(workflow.indexOf("\n  verify:"), workflow.indexOf("\n  publish:"))
  assert.ok(verify.indexOf("run: pnpm check") < verify.indexOf("path: .release-tools"), "tools checkout after pnpm check")
  assert.equal(workflow.match(/ref: \$\{\{ github\.sha \}\}\n {10}path: \.release-tools/g)?.length, 2)
  assert.doesNotMatch(workflow.slice(workflow.indexOf("\n  verify:")), /node scripts\/release\//, "release scripts run from .release-tools")
})

test("recovery dispatch takes an existing tag and re-checks published contents", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  assert.match(workflow, /workflow_dispatch:\n    inputs:\n      release_tag:/)
  assert.match(workflow, /RELEASE_TAG: \$\{\{ inputs\.release_tag \|\| needs\.release-please\.outputs\.tag_name \|\| github\.ref_name \}\}/)
  assert.match(workflow, /npm view "\$PACKAGE_NAME@\$PACKAGE_VERSION" version/)
  assert.match(workflow, /already on npm with a different integrity/)
})

test("integrity is npm's sha512 format and rejects empty input", () => {
  const value = integrityOf(Buffer.from("tarball bytes"))
  assert.equal(value, `sha512-${createHash("sha512").update("tarball bytes").digest("base64")}`)
  assert.match(value, integrityPattern)
  assert.match("sha512-zNhVIvOac4TsTZ9GaZFDqB7VdhP0m1BgYoPsycljCZZNYk4WlVrZG4N3Id2RdGwEnaU0WMS+V46dnqN54BOs8Q==", integrityPattern)
  assert.throws(() => integrityOf(Buffer.alloc(0)), /Empty tarball/)
})

test("integrity gate rejects missing, malformed and different values", () => {
  const a = integrityOf(Buffer.from("a"))
  const b = integrityOf(Buffer.from("b"))
  assert.deepEqual(integrityErrors(a, a), [])
  assert.match(integrityErrors(a, b).join(), /mismatch/)
  for (const bad of ["", undefined, "sha512-", "sha256-abc", `${a}x`, "sha1-AAAA"]) {
    assert.ok(integrityErrors(bad, a).length > 0, `expected ${bad}`)
    assert.ok(integrityErrors(a, bad).length > 0, `actual ${bad}`)
  }
})

test("tag check also requires a CHANGELOG entry for the version", () => {
  assert.deepEqual(changelogErrors("# Changelog\n\n## 0.1.0\n\nFirst release.", "0.1.0"), [])
  assert.deepEqual(changelogErrors("## [0.2.0] - 2026-11-18", "0.2.0"), [])
  assert.match(changelogErrors("## 0.1.0", "0.2.0").join(), /no "## 0.2.0" entry/)
  assert.equal(changelogErrors("", "0.1.0").length, 1)
})

test("Publish pins the verified integrity for the fresh and already-published paths", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  const publish = workflow.slice(workflow.indexOf("\n  publish:"))
  assert.match(publish, /echo "PACKAGE_INTEGRITY=\$VERIFIED_INTEGRITY" >> "\$GITHUB_ENV"/)
  assert.match(publish, /compare\.mjs "\$VERIFIED_INTEGRITY" "\$PUBLISHED"/)
  assert.doesNotMatch(workflow, /digest/i, "no content-digest gate remains")
})

test("compare.mjs exits non-zero on a mismatch, which stops Publish before npm publish", async () => {
  const { spawnSync } = await import("node:child_process")
  const script = new URL("./compare.mjs", import.meta.url).pathname
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" })
  const a = integrityOf(Buffer.from("a"))
  assert.equal(run(a, a).status, 0)
  const mismatch = run(a, integrityOf(Buffer.from("b")))
  assert.equal(mismatch.status, 1)
  assert.match(mismatch.stderr, /Integrity mismatch/)
  assert.equal(run("", "").status, 1, "a missing verified integrity never passes")
  assert.equal(run(a, "").status, 1, "a failed integrity computation never passes")
})
