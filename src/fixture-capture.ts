import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { PassThrough } from "node:stream"

import { runBrunchCli } from "./brunch.js"
import type { ElicitationExchangeProjection } from "./elicitation-exchange.js"
import type { WorkspaceSnapshot } from "./print-snapshot.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

export interface FixtureCaptureOptions {
  cwd: string
  briefId: string
  runId: string
  timestamp?: string
  coordinator?: WorkspaceSessionCoordinator
}

export interface FixtureCaptureResult {
  runDir: string
  jsonlFile: string
  metaFile: string
}

interface JsonRpcResponse<T> {
  result?: T
  error?: {
    code: number
    message: string
  }
}

export async function captureFixtureRun(
  options: FixtureCaptureOptions,
): Promise<FixtureCaptureResult> {
  const workspace = await callRpc<WorkspaceSnapshot>(
    options,
    "workspace.snapshot",
  )
  if (!workspace.session) {
    throw new Error("Cannot capture fixture without a selected Brunch session")
  }

  const projection = await callRpc<ElicitationExchangeProjection>(
    options,
    "session.elicitationExchanges",
  )
  const runDir = join(
    options.cwd,
    ".brunch-fixtures",
    options.briefId,
    options.runId,
  )
  const jsonlFile = join(runDir, `${options.runId}.jsonl`)
  const metaFile = join(runDir, `${options.runId}.meta.json`)

  await mkdir(runDir, { recursive: true })
  await copyFile(workspace.session.file, jsonlFile)
  await writeFile(
    metaFile,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        briefId: options.briefId,
        runId: options.runId,
        timestamp: options.timestamp ?? new Date().toISOString(),
        brunchVersion: await readPackageVersion(),
        session: {
          id: workspace.session.id,
          sourceFile: workspace.session.file,
        },
        projectionSummary: {
          status: projection.status,
          exchangeCount: projection.exchanges.length,
          openPrompt: projection.openPrompt !== null,
        },
        artifacts: {
          jsonl: `${options.runId}.jsonl`,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  )

  return { runDir, jsonlFile, metaFile }
}

async function callRpc<T>(
  options: FixtureCaptureOptions,
  method: string,
): Promise<T> {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const chunks: string[] = []
  stdout.on("data", (chunk) => chunks.push(String(chunk)))
  stdin.end(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method })}\n`)

  await runBrunchCli({
    argv: ["--mode=rpc"],
    cwd: options.cwd,
    ...(options.coordinator ? { coordinator: options.coordinator } : {}),
    stdin,
    stdout,
  })

  const response = JSON.parse(chunks.join("")) as JsonRpcResponse<T>
  if (response.error) {
    throw new Error(response.error.message)
  }
  if (response.result === undefined) {
    throw new Error(`RPC ${method} returned no result`)
  }
  return response.result
}

async function readPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    version?: unknown
  }
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0"
}
