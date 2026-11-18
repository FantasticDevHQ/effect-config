// After `npm publish`, waits until the registry serves the exact version with
// the expected integrity and an SLSA provenance attestation.
import { pathToFileURL } from "node:url"

const provenanceType = "https://slsa.dev/provenance/v1"

export function publicationErrors(metadata, { name, version, integrity }) {
  const errors = []
  if (metadata?.name !== name) errors.push(`Registry name ${metadata?.name} is not ${name}`)
  if (metadata?.version !== version) errors.push(`Registry version ${metadata?.version} is not ${version}`)
  if (integrity !== undefined && metadata?.dist?.integrity !== integrity) {
    errors.push(`Registry integrity ${metadata?.dist?.integrity} does not match the verified tarball ${integrity}`)
  }
  if (metadata?.dist?.attestations?.provenance?.predicateType !== provenanceType) {
    errors.push("Registry has no SLSA provenance attestation for this version")
  }
  return errors
}

async function fetchVersion(name, version) {
  const response = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2f")}/${version}`, {
    headers: { accept: "application/json" }
  })
  return response.ok ? response.json() : undefined
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = {
    name: process.env.PACKAGE_NAME,
    version: process.env.PACKAGE_VERSION,
    integrity: process.env.PACKAGE_INTEGRITY || undefined
  }
  let errors = ["not checked"]
  for (let attempt = 1; attempt <= 20; attempt++) {
    errors = publicationErrors(await fetchVersion(expected.name, expected.version), expected)
    if (errors.length === 0) break
    await new Promise((resolve) => setTimeout(resolve, 15_000))
  }
  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
  console.log(`${expected.name}@${expected.version} is public with provenance (${expected.integrity ?? "integrity not pinned"})`)
}
