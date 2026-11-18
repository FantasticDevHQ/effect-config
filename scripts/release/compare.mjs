// Fails unless two content digests are equal. Usage: compare.mjs <expected> <actual>
const [expected, actual] = process.argv.slice(2)
if (!expected || expected !== actual) {
  console.error(`Content digest mismatch: verified ${expected || "(none)"}, got ${actual || "(none)"}`)
  process.exit(1)
}
console.log(`Content digest matches the verified build: ${actual}`)
