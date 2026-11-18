import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

const bundle = async (entry: string) => {
  const result = await build({
    entryPoints: [entry.startsWith("/") ? entry : fixture(entry)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    treeShaking: true,
    metafile: true,
    logLevel: "silent"
  })
  const code = result.outputFiles.map((file) => file.text).join("\n")
  const inputs = Object.keys(result.metafile.inputs)
  return { code, inputs }
}

// Strings that only the Doppler client contains.
const dopplerMarkers = ["api.doppler.com", "DopplerCredentials"]

describe("bundle", () => {
  it("tree-shaken", async () => {
    const root = await bundle("app-root.ts")
    expect(root.inputs.filter((input) => input.includes("@distilled.cloud"))).toEqual([])
    for (const marker of dopplerMarkers) expect(root.code).not.toContain(marker)
  })

  it("tree-shaken: the built root entry has no Doppler code", async () => {
    // `pnpm check` builds before testing; this bundles what consumers import.
    const root = await bundle(fileURLToPath(new URL("../dist/index.js", import.meta.url)))
    expect(root.inputs.filter((input) => input.includes("@distilled.cloud"))).toEqual([])
    for (const marker of dopplerMarkers) expect(root.code).not.toContain(marker)
  })

  it("includes the Doppler client when the subpath is imported (control)", async () => {
    const doppler = await bundle("app-doppler.ts")
    expect(doppler.inputs.some((input) => input.includes("@distilled.cloud/doppler"))).toBe(true)
    for (const marker of dopplerMarkers) expect(doppler.code).toContain(marker)
  })
})
