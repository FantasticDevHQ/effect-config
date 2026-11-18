import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { publicationErrors } from "./published.mjs"
import { releaseTagErrors } from "./tag.mjs"

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
  assert.deepEqual(runners, ["ubicloud-standard-2-ubuntu-2404", "ubuntu-24.04"])
  const publish = workflow.slice(workflow.indexOf("\n  publish:"))
  assert.match(publish, /runs-on: ubuntu-24\.04/)
  assert.match(publish, /environment: npm/)
  assert.match(publish, /id-token: write/)
  assert.match(publish, /npm publish "\$TARBALL" --provenance --access public/)
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets/)
  assert.match(workflow, /^on:\n  push:\n    tags: \["v\*"\]/m)
})
