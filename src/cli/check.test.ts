import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { check, diffKeys, parseEnvExample } from "./check.ts"

const root = fileURLToPath(new URL("../..", import.meta.url))
const keysModule = join(root, "test/fixtures/keys.ts")
const main = join(root, "src/cli/main.ts")

const envFile = (contents: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "effect-config-")), ".env.example")
  writeFileSync(path, contents)
  return path
}

/** Runs the real `effect-config` command line in a child process. */
const cli = (...args: ReadonlyArray<string>) => {
  const result = spawnSync(process.execPath, [main, ...args], { cwd: root, encoding: "utf8" })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe("parseEnvExample", () => {
  it("reads names, ignoring comments, blanks, export prefixes and values", () => {
    expect(parseEnvExample("# header\n\nexport PORT=3000\nAPI_KEY=\"x=y\"\r\n  LOG_LEVEL = info\nPORT=4000\nnot a line\n"))
      .toEqual(["PORT", "API_KEY", "LOG_LEVEL"])
  })
})

describe("parseEnvExample with quoted values", () => {
  it("skips the lines inside multiline quoted values", () => {
    const text = [
      "PORT=\"line one",
      "FAKE_KEY=secret",
      "end\"",
      "API_KEY='first",
      "NOT_A_KEY=x",
      "last'",
      "TEMPLATE=`a",
      "ALSO_NOT=b`",
      "LOG_LEVEL=info"
    ].join("\n")
    expect(parseEnvExample(text)).toEqual(["PORT", "API_KEY", "TEMPLATE", "LOG_LEVEL"])
  })

  it("handles quotes that close on the same line, escapes and inner quotes", () => {
    const text = [
      "A=\"one line\"",
      "B=\"escaped \\\" quote\"",
      "C='it''s'",
      "D=no\"quote at start",
      "E=\"ends with escaped backslash \\\\\"",
      "F=1"
    ].join("\n")
    expect(parseEnvExample(text)).toEqual(["A", "B", "C", "D", "E", "F"])
  })

  it("treats an unterminated quote as running to the end of the file", () => {
    expect(parseEnvExample("A=\"open\nB=1\nC=2")).toEqual(["A"])
  })
})

describe("diffKeys", () => {
  it("lists declared names missing from the example and undeclared extras", () => {
    expect(diffKeys(["A", "B", "C"], ["B", "D"])).toEqual({ missing: ["A", "C"], extra: ["D"] })
  })
})

describe("effect-config check", () => {
  it.effect("reads inputs", () =>
    Effect.gen(function*() {
      const example = envFile("PORT=1\nLOG_LEVEL=info\nFROM_EXAMPLE_ONLY=1\n")
      const drift = yield* check({ keys: keysModule, envExample: example })
      // API_KEY comes from the key list module, FROM_EXAMPLE_ONLY from the example file.
      expect(drift).toEqual({ missing: ["API_KEY"], extra: ["FROM_EXAMPLE_ONLY"] })

      const run = cli("check", "--keys", keysModule, "--env-example", example)
      expect(run.stdout).toContain("missing: API_KEY")
      expect(run.stdout).toContain("extra: FROM_EXAMPLE_ONLY")
      expect(run.status).toBe(1)
    }).pipe(Effect.provide(NodeServices.layer)))

  it("drift", () => {
    const run = cli("check", "--keys", keysModule, "--env-example", envFile("PORT=1\nLOG_LEVEL=info\n"))
    expect(run.stdout.trim().split("\n")).toEqual(["missing: API_KEY"])
    expect(run.status).toBe(1)
  })

  it("prints every missing and extra key", () => {
    const run = cli("check", "--keys", keysModule, "--env-example", envFile("PORT=1\nOLD_KEY=1\nOTHER=2\n"))
    expect(run.stdout.trim().split("\n")).toEqual([
      "missing: API_KEY",
      "missing: LOG_LEVEL",
      "extra: OLD_KEY",
      "extra: OTHER"
    ])
    expect(run.status).toBe(1)
  })

  it("clean", () => {
    const run = cli("check", "--keys", keysModule, "--env-example", envFile("PORT=1\nAPI_KEY=\nLOG_LEVEL=info\n"))
    expect(run.stdout).toContain("ok: 3 keys match")
    expect(run.stdout).not.toContain("missing:")
    expect(run.status).toBe(0)
  })

  it("clean with a multiline quoted value whose lines look like keys", () => {
    const example = envFile("PORT=\"multi\nFAKE_KEY=sk_live_123\nline\"\nAPI_KEY=\nLOG_LEVEL=info\n")
    const run = cli("check", "--keys", keysModule, "--env-example", example)
    expect(run.stdout).toContain("ok: 3 keys match")
    expect(run.stdout + run.stderr).not.toContain("FAKE_KEY")
    expect(run.stdout + run.stderr).not.toContain("sk_live_123")
    expect(run.status).toBe(0)
  })

  it("exits 2 when the inputs cannot be read", () => {
    expect(cli("check", "--keys", keysModule, "--env-example", "/nonexistent/.env.example").status).toBe(2)
    expect(cli("check", "--keys", "/nonexistent/keys.ts").status).toBe(2)
  })
})
