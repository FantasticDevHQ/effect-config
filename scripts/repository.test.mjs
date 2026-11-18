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

// FantasticDevHQ/oss-standards header and README standards.
test("README header follows the Fantastic.Dev header standard", () => {
  const readme = read("README.md")
  const header = readme.slice(0, readme.indexOf("\n---\n"))
  assert.match(header, /^<p align="center">\n {2}<a href="https:\/\/fantastic\.dev"><img src="assets\/fantastic-dev-logo\.svg" width="80" height="80" alt="Fantastic\.Dev" \/><\/a>/)
  assert.match(header, /<h1 align="center">Effect Config<\/h1>/)
  assert.ok(header.includes('<p align="center">A <a href="https://fantastic.dev">Fantastic.Dev</a> Project</p>'))
  for (const button of ["Fantastic.dev-94C173", "GitHub-0c0e13", "YouTube-FF0033", "Twitter_%2F_X-0c0e13"]) {
    assert.ok(header.includes(`https://img.shields.io/badge/${button}?style=for-the-badge`), `${button} button`)
  }
  assert.ok(header.includes('<a href="#quick-start">Quick start</a>'))
  assert.ok(header.includes('<a href="#have-my-agent-set-this-up">Agent setup</a>'))
  assert.doesNotMatch(header, /&(?!amp;)[a-z]+=/, "HTML query separators must be &amp;")
})

test("README quick start has a self-contained public agent prompt and manual setup", () => {
  const readme = read("README.md")
  const quick = readme.slice(readme.indexOf("## Quick start\n"), readme.indexOf("\n## ", readme.indexOf("## Quick start\n") + 1))
  assert.ok(quick.includes("### Have my agent set this up\n"))
  assert.ok(quick.includes("### Manual setup\n"))
  const prompts = [...quick.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1])
  assert.equal(prompts.length, 1, "exactly one text prompt")
  const prompt = prompts[0]
  assert.ok(prompt.includes("https://github.com/FantasticDevHQ/effect-config"))
  assert.ok(prompt.includes("effect-config check"))
  assert.doesNotMatch(prompt, /oss-standards|brand-kit|linear\.app|localhost/i, "no private URLs")
  for (const url of prompt.match(/https:\/\/\S+/g) ?? []) assert.match(url, /^https:\/\/(github\.com\/FantasticDevHQ\/effect-config|www\.npmjs\.com\/package\/@fantastic\.dev\/effect-config)/)
})

// The only approved exception: npm trusted publishing and provenance reject
// self-hosted runners, so the release Publish job runs GitHub-hosted.
const approvedExceptions = new Map([["release.yml:publish", "ubuntu-24.04"]])

test(`every CI job runs on ${runner}, except the approved Publish job`, () => {
  const dir = new URL("../.github/workflows/", import.meta.url)
  const workflows = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name))
  assert.ok(workflows.length > 0)
  const seenExceptions = []
  for (const name of workflows) {
    const text = readFileSync(new URL(name, dir), "utf8")
    const jobs = text.slice(text.search(/^jobs:\n/m))
    const blocks = jobs.split(/^ {2}(?=[A-Za-z0-9_-]+:\s*$)/m).slice(1)
    const labels = [...text.matchAll(/^\s+runs-on:\s*(\S+)\s*$/gm)]
    assert.equal(labels.length, blocks.length, `${name}: each job declares runs-on`)
    for (const block of blocks) {
      const job = block.slice(0, block.indexOf(":"))
      const label = block.match(/^\s+runs-on:\s*(\S+)\s*$/m)?.[1]
      const exception = approvedExceptions.get(`${name}:${job}`)
      if (exception !== undefined) seenExceptions.push(`${name}:${job}`)
      assert.equal(label, exception ?? runner, `${name} job ${job} uses ${label}`)
    }
  }
  assert.deepEqual(seenExceptions, [...approvedExceptions.keys()])
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
