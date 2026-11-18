import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createHash } from "node:crypto"
import { gzipSync } from "node:zlib"
import { contentDigest, tarEntries } from "./digest.mjs"
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
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets/)
  assert.match(workflow, /^on:\n  push:\n    tags: \["v\*"\]/m)
  // Only the publish job may mint an OIDC token.
  assert.equal(workflow.match(/id-token: write/g)?.length, 1)
})

test("Publish builds the tag on its runner and publishes that build only if it matches the verified content", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  const publish = workflow.slice(workflow.indexOf("\n  publish:"))
  const order = [
    "ref: ${{ needs.verify.outputs.sha }}",
    'test "$TAG_SHA" = "$VERIFIED_SHA"',
    "pnpm install --frozen-lockfile --ignore-scripts",
    "pnpm build",
    "npm pack --json --ignore-scripts",
    'node .release-tools/scripts/release/compare.mjs "$VERIFIED_DIGEST"',
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
  assert.doesNotMatch(workflow, /node scripts\/release\//, "release scripts run from .release-tools")
})

test("recovery dispatch takes an existing tag and re-checks published contents", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8")
  assert.match(workflow, /workflow_dispatch:\n    inputs:\n      release_tag:/)
  assert.match(workflow, /RELEASE_TAG: \$\{\{ inputs\.release_tag \|\| github\.ref_name \}\}/)
  assert.match(workflow, /npm view "\$PACKAGE_NAME@\$PACKAGE_VERSION" version/)
  assert.match(workflow, /already on npm with different contents/)
})

const tar = (files) => {
  const blocks = []
  for (const [name, text] of files) {
    const body = Buffer.from(text)
    const header = Buffer.alloc(512)
    header.write(name, 0)
    header.write(body.length.toString(8).padStart(11, "0"), 124)
    header.write("0", 156)
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512))
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)])
}

test("content digest depends on file paths and contents, not archive order or gzip bytes", () => {
  const a = tar([["package/a.js", "1"], ["package/b.js", "2"]])
  const reordered = tar([["package/b.js", "2"], ["package/a.js", "1"]])
  assert.deepEqual(tarEntries(a), [
    ["package/a.js", createHash("sha256").update("1").digest("hex")],
    ["package/b.js", createHash("sha256").update("2").digest("hex")]
  ])
  assert.equal(contentDigest(gzipSync(a, { level: 1 })), contentDigest(gzipSync(reordered, { level: 9 })))
  assert.notEqual(contentDigest(gzipSync(a)), contentDigest(gzipSync(tar([["package/a.js", "1"], ["package/b.js", "3"]]))))
  assert.notEqual(contentDigest(gzipSync(a)), contentDigest(gzipSync(tar([["package/a.js", "1"]]))))
})

test("compare.mjs fails on a content mismatch, which stops Publish before npm publish", async () => {
  const { spawnSync } = await import("node:child_process")
  const script = new URL("./compare.mjs", import.meta.url).pathname
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" })
  assert.equal(run("sha256-a", "sha256-a").status, 0)
  const mismatch = run("sha256-a", "sha256-b")
  assert.equal(mismatch.status, 1)
  assert.match(mismatch.stderr, /Content digest mismatch/)
  assert.equal(run("", "").status, 1, "a missing verified digest never passes")
})
