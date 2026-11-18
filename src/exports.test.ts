import { describe, expect, it } from "@effect/vitest"
import { readFileSync } from "node:fs"
import * as Doppler from "./doppler/index.ts"
import * as Root from "./index.ts"

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

describe("package exports", () => {
  it("doppler is subpath only", () => {
    const rootNames = Object.keys(Root)
    expect(rootNames.filter((name) => /doppler|stage/i.test(name))).toEqual([])
    expect(Object.keys(Doppler)).toEqual(
      expect.arrayContaining(["DopplerConfigError", "layerDoppler", "makeDopplerConfigProvider", "stageToConfig"])
    )
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./doppler", "./package.json"])
    expect(manifest.exports["./doppler"].default).toBe("./dist/doppler/index.js")
    expect(readFileSync(new URL("./index.ts", import.meta.url), "utf8")).not.toMatch(/doppler/i)
  })

  it("keeps the Doppler client an optional peer", () => {
    expect(manifest.dependencies?.["@distilled.cloud/doppler"]).toBeUndefined()
    expect(manifest.peerDependencies["@distilled.cloud/doppler"]).toBeDefined()
    expect(manifest.peerDependenciesMeta["@distilled.cloud/doppler"].optional).toBe(true)
  })
})
