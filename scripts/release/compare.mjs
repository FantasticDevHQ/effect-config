// Fails unless two npm integrity values are well-formed and equal.
// Usage: compare.mjs <expected> <actual>
import { pathToFileURL } from "node:url"
import { integrityPattern } from "./integrity.mjs"

export function integrityErrors(expected, actual) {
  const errors = []
  if (!integrityPattern.test(expected ?? "")) errors.push(`Verified integrity is missing or malformed: ${expected || "(none)"}`)
  if (!integrityPattern.test(actual ?? "")) errors.push(`Integrity to compare is missing or malformed: ${actual || "(none)"}`)
  if (errors.length === 0 && expected !== actual) errors.push(`Integrity mismatch: verified ${expected}, got ${actual}`)
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [expected, actual] = process.argv.slice(2)
  const errors = integrityErrors(expected, actual)
  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
  console.log(`Integrity matches the verified tarball: ${actual}`)
}
