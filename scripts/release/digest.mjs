// Content digest of an npm tarball: sha256 over the sorted "path sha256" lines
// of every file in the archive. Two packs of the same source have the same
// digest even when different npm versions produce different gzip bytes.
// Usage: node scripts/release/digest.mjs <file.tgz>
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { gunzipSync } from "node:zlib"

/** Lists `[path, sha256]` for every regular file in an uncompressed tar archive. */
export function tarEntries(tar) {
  const entries = []
  let offset = 0
  let longName
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const field = (start, length) => header.subarray(start, start + length).toString("utf8").replace(/\0.*$/s, "")
    const size = Number.parseInt(field(124, 12).trim() || "0", 8)
    const type = field(156, 1) || "0"
    const prefix = field(345, 155)
    const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100))
    const body = tar.subarray(offset + 512, offset + 512 + size)
    longName = undefined
    if (type === "L") longName = body.toString("utf8").replace(/\0.*$/s, "")
    else if (type === "0" || type === "\0") entries.push([name, createHash("sha256").update(body).digest("hex")])
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

export function contentDigest(tgz) {
  const lines = tarEntries(gunzipSync(tgz)).map(([path, sha]) => `${path} ${sha}\n`).join("")
  return `sha256-${createHash("sha256").update(lines).digest("hex")}`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(contentDigest(readFileSync(process.argv[2])))
}
