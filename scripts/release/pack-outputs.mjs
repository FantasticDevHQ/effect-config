// Prints `npm pack --json` results as GitHub step outputs: version, integrity,
// filename and files. Accepts npm's array output and its newer object output.
import { readFileSync } from "node:fs"

const parsed = JSON.parse(readFileSync(process.argv[2], "utf8"))
const pack = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0]
if (!pack?.version || !pack?.integrity || !pack?.filename) throw new Error("Unexpected npm pack output")
console.log(`version=${pack.version}`)
console.log(`integrity=${pack.integrity}`)
console.log(`filename=${pack.filename}`)
console.log(`files=${pack.files.length}`)
