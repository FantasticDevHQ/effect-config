// The npm integrity of a tarball, computed from its bytes: "sha512-<base64>".
// Usage: node scripts/release/integrity.mjs <file.tgz>
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const integrityPattern = /^sha512-[A-Za-z0-9+/]{86}==$/

export function integrityOf(bytes) {
  if (bytes.length === 0) throw new Error("Empty tarball")
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(integrityOf(readFileSync(process.argv[2])))
}
