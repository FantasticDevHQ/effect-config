import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const manifest = JSON.parse(read("package.json"))

// FantasticDevHQ/fantastic-dev-brand-kit assets/brand/logo-mark.svg @ 0ce1aebc3e8418d7e59ce171e117cf9793dd2f3a
const brandLogoSha256 = "4869b13bae195ef7f934fb3a1dd2b37e86700ce33bf88f9c863e7597e20c2075"
const runner = "ubicloud-standard-2-ubuntu-2404"

test("package is the public @fantastic.dev/effect-config workspace package", () => {
  assert.equal(manifest.name, "@fantastic.dev/effect-config")
  assert.notEqual(manifest.private, true)
  assert.equal(manifest.publishConfig?.access, "public")
  assert.match(read("pnpm-workspace.yaml"), /^\s+- "\."$/m)
})

test("effect is a peer dependency with range ^4.1.4 and pinned for development", () => {
  assert.equal(manifest.peerDependencies?.effect, "^4.1.4")
  assert.equal(manifest.devDependencies?.effect, "4.1.4")
  assert.equal(manifest.dependencies?.effect, undefined)
})

test("logo is the unchanged brand-kit asset", () => {
  const logo = readFileSync(new URL("../assets/fantastic-dev-logo.svg", import.meta.url))
  assert.equal(createHash("sha256").update(logo).digest("hex"), brandLogoSha256)
})

test("README header shows the logo and the Fantastic.Dev note first", () => {
  const head = read("README.md").split("\n").slice(0, 10).join("\n")
  assert.match(head, /<img src="assets\/fantastic-dev-logo\.svg"/)
  assert.ok(head.includes("[A Fantastic.Dev Project](https://fantastic.dev)"))
})

test(`every CI job runs on ${runner}`, () => {
  const dir = new URL("../.github/workflows/", import.meta.url)
  const workflows = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name))
  assert.ok(workflows.length > 0)
  for (const name of workflows) {
    const text = readFileSync(new URL(name, dir), "utf8")
    const jobs = text.match(/^jobs:\n([\s\S]*)$/m)?.[1] ?? ""
    const jobNames = [...jobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map((m) => m[1])
    const labels = [...text.matchAll(/^\s+runs-on:\s*(\S+)\s*$/gm)].map((m) => m[1])
    assert.equal(labels.length, jobNames.length, `${name}: each job declares runs-on`)
    for (const label of labels) assert.equal(label, runner, `${name} uses ${label}`)
  }
})

test("tracked files stay generic", () => {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  }).split("\n").filter((f) => f && !f.endsWith(".svg") && f !== "pnpm-lock.yaml" && f !== "scripts/repository.test.mjs" && existsSync(new URL(`../${f}`, import.meta.url)))
  for (const file of files) {
    assert.doesNotMatch(read(file), /tinykit|handiwork/i, `${file} names a private app`)
  }
})
