#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { validatePullRequest } from "../pr-standard.mjs";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const execute = promisify(execFile);
const command = async (args) => (await execute("gh", args)).stdout;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry only GitHub's explicit stale-head rejection, always matching a fresh head. */
export async function enableReleaseAutoMerge({
  repository,
  prNumber,
  command: run = command,
  wait: pause = wait,
}) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") ||
    !Number.isSafeInteger(prNumber) ||
    prNumber <= 0
  )
    throw new Error("Repository and release PR number are required.");
  let releaseBranch;
  for (let attempt = 0; attempt < 3; attempt++) {
    const pr = JSON.parse(
      await run(["api", `repos/${repository}/pulls/${prNumber}`]),
    );
    if (
      pr.base?.ref !== "main" ||
      pr.base.repo?.full_name !== repository ||
      pr.head?.repo?.full_name !== repository ||
      !pr.head.ref?.startsWith("release-please--") ||
      (releaseBranch !== undefined && pr.head.ref !== releaseBranch) ||
      !/^[0-9a-f]{40}$/.test(pr.head.sha ?? "")
    )
      throw new Error("Refusing to merge an unexpected generated release PR.");
    releaseBranch = pr.head.ref;
    if (pr.state === "closed") return pr.merged ? "merged" : "closed";
    if (pr.state !== "open")
      throw new Error("Unexpected generated release PR state.");
    try {
      await run([
        "pr",
        "merge",
        String(prNumber),
        "--repo",
        repository,
        "--auto",
        "--squash",
        "--match-head-commit",
        pr.head.sha,
      ]);
      return "enabled";
    } catch (error) {
      if (
        attempt === 2 ||
        !/expected head oid does not match (?:the )?current head oid/i.test(
          typeof error.stderr === "string" ? error.stderr : "",
        )
      )
        throw error;
      await pause(2000);
    }
  }
}

export function releaseBody({ body, repository, runId, attempt, sha }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !/^\d+$/.test(runId ?? "") || !/^\d+$/.test(attempt ?? "") || !/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("Valid automation identity is required")
  const parts = body.replace(/\r\n/g, "\n").split(/^---$/m)
  if (parts.length !== 3 || !/^## \[?\d+\.\d+\.\d+/.test(parts[1].trim())) throw new Error("Release Please version notes and exactly two delimiters are required")
  const url = `https://github.com/${repository}/actions/runs/${runId}/attempts/${attempt}`
  return `## Summary

Maintain the automated package release candidate.

Relates to FORG-162

## What

Update the package version, manifest and changelog from merged Conventional Commits.
---
${parts[1]}
---

## Why

Publish verified changes through the standard release workflow.

## Evidence

UI changes: No

[Release PR verification](${url}): pnpm check passed on source commit ${sha} before generating this candidate. Required PR checks validate the generated head before auto-merge. This is source verification; npm publication has not run for this candidate.

## Agent

- Agent: Release Please via GitHub Actions
- Session/thread ID: ${runId}:${attempt}
- Session link: ${url}

## Acceptance checklist

- [x] Generated version notes retain Release Please parsing boundaries.
- [x] Source verification passed; required checks gate the generated candidate.
- [ ] Publication and public artifact verification complete.
`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = mkdtempSync(join(tmpdir(), "release-pr-"))
  try {
    const pr = JSON.parse(process.env.RELEASE_PR ?? "null")
    const repository = process.env.GITHUB_REPOSITORY
    if (!Number.isSafeInteger(pr?.number) || pr.number <= 0) throw new Error("Release PR number is required")
    const current = JSON.parse(await command(["api", `repos/${repository}/pulls/${pr.number}`]))
    if (current.state !== "open" || current.base?.ref !== "main" || current.base.repo?.full_name !== repository || current.head.repo?.full_name !== repository || !current.head.ref?.startsWith("release-please--")) throw new Error("Unexpected generated release PR")
    const body = releaseBody({ body: current.body, repository, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, sha: process.env.GITHUB_SHA })
    const errors = validatePullRequest({ title: current.title, body })
    if (errors.length) throw new Error(errors.join("\n"))
    const file = join(dir, "body.md")
    writeFileSync(file, body)
    await command(["pr", "edit", String(pr.number), "--repo", repository, "--body-file", file])
    console.log(`Release auto-merge: ${await enableReleaseAutoMerge({ repository, prNumber: pr.number })}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
