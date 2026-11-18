#!/usr/bin/env node
/**
 * The `effect-config` command line.
 *
 * ```sh
 * effect-config check --keys ./src/config/keys.ts --env-example .env.example
 * ```
 *
 * Exit codes: 0 when the key list and the env example list the same keys,
 * 1 when they differ, 2 when the check could not run (bad flags, unreadable
 * files, no key list export).
 *
 * @since 0.1.0
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, Option } from "effect"
import { Command, Flag } from "effect/cli"
import { createRequire } from "node:module"
import { check, isClean } from "./check.ts"

const { version } = createRequire(import.meta.url)("../../package.json") as { readonly version: string }

const checkCommand = Command.make(
  "check",
  {
    keys: Flag.File("keys", { mustExist: true }).pipe(
      Flag.withDescription("Module that exports the key list built with defineKeys")
    ),
    envExample: Flag.File("env-example").pipe(
      Flag.withDefault(".env.example"),
      Flag.withDescription("Env example file to compare (default .env.example)")
    ),
    exportName: Flag.String("export").pipe(
      Flag.optional,
      Flag.withDescription("Named export to use when the module exports several key lists")
    )
  },
  (input) =>
    check({ keys: input.keys, envExample: input.envExample, exportName: Option.getOrUndefined(input.exportName) }).pipe(
      Effect.flatMap((drift) =>
        isClean(drift) ? Effect.void : Effect.sync(() => {
          process.exitCode = 1
        })
      ),
      Effect.catchTag("CheckInputError", (error) =>
        Console.error(error.message).pipe(Effect.andThen(Effect.sync(() => {
          process.exitCode = 2
        }))))
    )
).pipe(Command.withDescription("Compare a key list with an env example file"))

const cli = Command.make("effect-config").pipe(
  Command.withDescription("Typed configuration keys for Effect"),
  Command.withSubcommands([checkCommand])
)

Command.run(cli, { version }).pipe(
  // Usage errors are already rendered by Command.run; keep exit 1 for drift.
  Effect.catch(() =>
    Effect.sync(() => {
      process.exitCode = 2
    })
  ),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
)
