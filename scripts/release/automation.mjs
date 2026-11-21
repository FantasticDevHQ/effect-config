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

export const footer = "No-ticket: automated release"
export const hasTicketFooter = (message) => /^No-ticket:[ \t]*\S/m.test(message ?? "")

/** The commit message with the footer appended as its last line. */
export function withTicketFooter(message) {
  if (hasTicketFooter(message)) return message
  return `${message.replace(/\s+$/, "")}\n\n${footer}\n`
}

const git = (cwd, env = {}) => async (args) => (await execute("git", args, { cwd, env: { ...process.env, ...env } })).stdout

/**
 * Release PRs get no validator exemption, so the generated release commit must
 * carry a ticket footer. Amend the head commit of the checked-out release branch
 * so its body ends with `No-ticket: automated release` (skipped when present),
 * keeping author, dates and subject so a rerun yields the same commit, then
 * force-push it with a lease. Returns the head SHA and its message.
 */
export async function amendReleaseCommit({ dir, branch, remote = "origin", env = {} }) {
  if (!/^release-please--[\w@./-]+$/.test(branch ?? "")) throw new Error(`Refusing to amend a non-release branch: ${branch}`)
  const run = git(dir, env)
  const head = (await run(["rev-parse", "HEAD"])).trim()
  const message = await run(["log", "-1", "--format=%B", head])
  if (hasTicketFooter(message)) return { sha: head, message, amended: false }
  const [name, email, authorDate, committerDate] = (await run(["log", "-1", "--format=%an%x00%ae%x00%aI%x00%cI", head])).trim().split("\0")
  const dirName = mkdtempSync(join(tmpdir(), "release-commit-"))
  try {
    writeFileSync(join(dirName, "message"), withTicketFooter(message))
    await git(dir, { ...env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: authorDate, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_COMMITTER_DATE: committerDate })(["commit", "--amend", "--no-verify", "--allow-empty", "--cleanup=verbatim", "-F", join(dirName, "message")])
  } finally {
    rmSync(dirName, { recursive: true, force: true })
  }
  const sha = (await run(["rev-parse", "HEAD"])).trim()
  await run(["push", `--force-with-lease=refs/heads/${branch}:${head}`, remote, `${sha}:refs/heads/${branch}`])
  return { sha, message: withTicketFooter(message), amended: true }
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
    if (current.head.ref !== pr.headBranchName) throw new Error("Unexpected generated release branch")
    const checkout = process.argv[2]
    if (!checkout) throw new Error("Release branch checkout directory is required")
    const message = withTicketFooter(await git(checkout)(["log", "-1", "--format=%B", "HEAD"]))
    const body = releaseBody({ body: current.body, repository, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, sha: process.env.GITHUB_SHA })
    const errors = validatePullRequest({ title: current.title, body }, [], [{ sha: current.head.sha, message }])
    if (errors.length) throw new Error(errors.join("\n"))
    // Edit the body before pushing, so every check run on the final head sees it.
    const file = join(dir, "body.md")
    writeFileSync(file, body)
    await command(["pr", "edit", String(pr.number), "--repo", repository, "--body-file", file])
    // The release branch checkout dropped its credentials; pass the App token for this push only.
    const basic = Buffer.from(`x-access-token:${process.env.GH_TOKEN}`).toString("base64")
    const commit = await amendReleaseCommit({ dir: checkout, branch: current.head.ref, env: { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}` } })
    console.log(commit.amended ? `Amended and pushed release commit ${commit.sha}` : `Release commit ${commit.sha} already has the footer`)
    console.log(`Release auto-merge: ${await enableReleaseAutoMerge({ repository, prNumber: pr.number })}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
