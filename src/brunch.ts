import process from "node:process"
import type { Readable, Writable } from "node:stream"
import { fileURLToPath } from "node:url"

import { runBrunchTui } from "./brunch-tui.js"
import {
  renderWorkspaceSnapshot,
  workspaceSnapshotFromState,
} from "./print-snapshot.js"
import { createRpcHandlers, runJsonRpcLineServer } from "./rpc.js"
import { startWebHost } from "./web-host.js"
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from "./workspace-session-coordinator.js"

export interface WebHostRunnerOptions {
  cwd: string
  coordinator: WorkspaceSessionCoordinator
}

export interface BrunchCliOptions {
  argv?: string[]
  cwd?: string
  coordinator?: WorkspaceSessionCoordinator
  stdin?: Readable
  stdout?: Writable | ((chunk: string) => void)
  webHostRunner?: (options: WebHostRunnerOptions) => Promise<void>
}

export async function runBrunchCli(
  options: BrunchCliOptions = {},
): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2)
  const cwd = options.cwd ?? process.cwd()
  const mode = parseMode(argv)
  const coordinator =
    options.coordinator ?? createWorkspaceSessionCoordinator({ cwd })

  if (mode === "print") {
    const state = await coordinator.openExisting()
    const snapshot = workspaceSnapshotFromState(state)
    writeStdout(options.stdout, renderWorkspaceSnapshot(snapshot))
    return 0
  }

  if (mode === "rpc") {
    await runJsonRpcLineServer({
      input: options.stdin ?? process.stdin,
      output: stdoutStream(options.stdout),
      handlers: createRpcHandlers({ coordinator, cwd }),
    })
    return 0
  }

  if (mode === "web") {
    await (options.webHostRunner ?? runDefaultWebHost)({ cwd, coordinator })
    return 0
  }

  if (mode === "tui") {
    await runBrunchTui({ cwd, coordinator })
    return 0
  }

  throw new Error(`Unsupported Brunch mode: ${mode}`)
}

async function runDefaultWebHost(options: WebHostRunnerOptions): Promise<void> {
  const host = await startWebHost({
    cwd: options.cwd,
    coordinator: options.coordinator,
  })
  process.stdout.write(`Brunch web listening on ${host.url}\n`)
  await new Promise<void>(() => {})
}

function writeStdout(
  stdout: Writable | ((chunk: string) => void) | undefined,
  chunk: string,
): void {
  if (!stdout) {
    process.stdout.write(chunk)
  } else if (typeof stdout === "function") {
    stdout(chunk)
  } else {
    stdout.write(chunk)
  }
}

function stdoutStream(
  stdout: Writable | ((chunk: string) => void) | undefined,
): Writable {
  if (!stdout) {
    return process.stdout
  }
  if (typeof stdout !== "function") {
    return stdout
  }
  return {
    write(chunk: string | Uint8Array) {
      stdout(String(chunk))
      return true
    },
  } as Writable
}

function parseMode(argv: string[]): string {
  const modeFlagIndex = argv.indexOf("--mode")
  if (modeFlagIndex >= 0) {
    return argv[modeFlagIndex + 1] ?? "tui"
  }

  const modeEquals = argv.find((arg) => arg.startsWith("--mode="))
  if (modeEquals) {
    return modeEquals.slice("--mode=".length)
  }

  return "tui"
}

async function main(): Promise<void> {
  process.exitCode = await runBrunchCli()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
