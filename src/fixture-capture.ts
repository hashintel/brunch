import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PassThrough } from "node:stream"
import { fileURLToPath } from "node:url"

import { loadBriefLibrary, type FixtureBrief } from "./brief-library.js"
import { runBrunchCli } from "./brunch.js"
import type { ElicitationExchangeProjection } from "./elicitation-exchange.js"
import type { WorkspaceSnapshot } from "./print-snapshot.js"
import type { JsonRpcResponse } from "./json-rpc-protocol.js"
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from "./workspace-session-coordinator.js"

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

export interface DeterministicBriefRunOptions {
  cwd: string
  briefsDir?: string
  runId?: string
  timestamp?: string
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
        driver: {
          mode: "scripted-deterministic",
        },
        projectionSummary: {
          status: projection.status,
          exchangeCount: projection.exchanges.length,
          openPrompt: projection.openPrompt !== null,
        },
        artifacts: {
          jsonl: `${options.runId}.jsonl`,
          graph: { status: "deferred" },
          coherence: { status: "deferred" },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  )

  return { runDir, jsonlFile, metaFile }
}

export async function captureDeterministicBriefRuns(
  options: DeterministicBriefRunOptions,
): Promise<FixtureCaptureResult[]> {
  const briefs = await loadBriefLibrary(
    options.briefsDir ?? join(options.cwd, ".brunch-fixtures", "briefs"),
  )
  const coordinator = createWorkspaceSessionCoordinator({ cwd: options.cwd })
  const results: FixtureCaptureResult[] = []

  for (const brief of briefs) {
    const workspace = await openScriptedBriefSession(coordinator, brief)
    workspace.session.manager.appendCustomMessageEntry(
      "brunch.elicitation_prompt",
      `Elicitation prompt for ${brief.id} — ${brief.title}: ${brief.productBrief}`,
      true,
    )
    workspace.session.manager.appendMessage({
      role: "user",
      content: brief.scriptedUserNotes.join("\n"),
      timestamp: Date.parse(options.timestamp ?? new Date().toISOString()),
    })
    await coordinator.bindCurrentSpecToReplacementSession(
      workspace.session.manager,
    )

    results.push(
      await captureFixtureRun({
        cwd: options.cwd,
        briefId: brief.id,
        runId: options.runId ?? "scripted-001",
        ...(options.timestamp ? { timestamp: options.timestamp } : {}),
      }),
    )
  }

  return results
}

async function openScriptedBriefSession(
  coordinator: WorkspaceSessionCoordinator,
  brief: FixtureBrief,
) {
  return coordinator.createSetupSession({
    specTitle: brief.title,
    createNewSpec: true,
  })
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
  if ("error" in response) {
    throw new Error(response.error.message)
  }
  return response.result
}

async function readPackageVersion(): Promise<string> {
  try {
    const packageJson = JSON.parse(
      await readFile(
        join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
        "utf8",
      ),
    ) as {
      version?: unknown
    }
    return typeof packageJson.version === "string"
      ? packageJson.version
      : "unknown"
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "unknown"
    }
    throw error
  }
}
