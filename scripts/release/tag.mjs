// Checks that a release tag matches the package version: `v<semver>` equal to
// package.json `version`. Used by the release workflow before anything runs.
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/

export function releaseTagErrors(tag, version) {
  const errors = []
  if (typeof tag !== "string" || !tag.startsWith("v")) errors.push(`Release tag must look like v<semver>, got ${JSON.stringify(tag)}`)
  else if (!semver.test(tag.slice(1))) errors.push(`Release tag ${tag} is not v<semver>`)
  if (!semver.test(version ?? "")) errors.push(`package.json version ${JSON.stringify(version)} is not semver`)
  else if (version === "0.0.0") errors.push("package.json version 0.0.0 is not releasable")
  if (errors.length === 0 && tag.slice(1) !== version) errors.push(`Tag ${tag} does not match package.json version ${version}`)
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The release source is the current directory (the tag's checkout), which
  // can differ from where this script lives during a recovery run.
  const { version } = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8"))
  const errors = releaseTagErrors(process.env.RELEASE_TAG, version)
  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
  console.log(`Release tag ${process.env.RELEASE_TAG} matches package.json version ${version}`)
}
