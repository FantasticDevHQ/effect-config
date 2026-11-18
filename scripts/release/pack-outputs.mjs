// Prints `npm pack --json` results as GitHub step outputs: version, integrity, files.
import { readFileSync } from "node:fs"

const [pack] = JSON.parse(readFileSync(process.argv[2], "utf8"))
console.log(`version=${pack.version}`)
console.log(`integrity=${pack.integrity}`)
console.log(`files=${pack.files.length}`)
