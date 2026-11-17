import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { keys } from "./fixtures.ts"
import { defineKeys } from "./keys.ts"

describe("defineKeys", () => {
  it("shape", () => {
    expect(keys.keys).toHaveLength(3)
    expect(keys.names).toEqual(["PORT", "API_KEY", "LOG_LEVEL"])
    for (const key of keys.keys) {
      expect(Object.keys(key)).toEqual(expect.arrayContaining(["name", "schema", "required", "secret", "consumers"]))
      expect(typeof key.name).toBe("string")
      expect(Schema.isSchema(key.schema)).toBe(true)
      expect(typeof key.required).toBe("boolean")
      expect(typeof key.secret).toBe("boolean")
      expect(Array.isArray(key.consumers)).toBe(true)
    }
    expect(keys.keys[1]).toMatchObject({ name: "API_KEY", required: true, secret: true, consumers: ["api", "worker"] })
    expect(keys.keys[2]).toMatchObject({ name: "LOG_LEVEL", required: false, secret: false, consumers: ["api"] })
  })

  it("rejects duplicate names", () => {
    expect(() =>
      defineKeys([
        { name: "A", schema: Schema.String, required: true, secret: false, consumers: [] },
        { name: "A", schema: Schema.String, required: true, secret: false, consumers: [] }
      ])
    ).toThrow("key A is declared more than once")
  })

  it("rejects names that are not environment variable names", () => {
    expect(() => defineKeys([{ name: "1-BAD", schema: Schema.String, required: true, secret: false, consumers: [] }]))
      .toThrow("invalid key name")
  })
})
