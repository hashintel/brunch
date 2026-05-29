import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createRpcHandlers } from "../rpc/handlers.js"
import { createWorkspaceSessionCoordinator } from "../workspace-session-coordinator.js"

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0"
  id: number
  result: T
}

interface PendingOption {
  id: string
  label: string
}

interface PendingExchange {
  exchangeId: string
  mode: "text" | "single-select" | "multi-select"
  prompt: string
  options: PendingOption[]
}

interface RpcExchange {
  promptEntryIds: string[]
  responseEntryIds: string[]
}

interface RpcExchangeProjection {
  status: string
  exchanges: RpcExchange[]
}

interface TranscriptDisplayRow {
  role: string
  text: string
}

interface TranscriptDisplayProjection {
  rows: TranscriptDisplayRow[]
}

interface WorkspaceSelectionResult {
  requiresSelection: boolean
}

interface PendingResult {
  status: "pending"
  exchange: PendingExchange
}

export interface PublicRpcParityProofReport {
  mission: string
  evaluationFocus: string
  maxTurnBudget: number
  completedTurns: number
  friction: string[]
  cwd: string
  specId: string
  sessionId: string
  toolCoverage: string[]
  exchangeIds: string[]
  transcriptDisplayRows: number
}

function success<T>(response: unknown): T {
  if (
    typeof response === "object" &&
    response !== null &&
    "result" in response
  ) {
    return (response as JsonRpcSuccess<T>).result
  }
  throw new Error(
    `Expected JSON-RPC success response: ${JSON.stringify(response)}`,
  )
}

interface ToolResultDetails {
  exchangeId?: string
  schema?: string
  requestTool?: string
  presentTool?: string
}

interface ToolResultEntry {
  toolName: string
  details?: ToolResultDetails
}

interface JsonlMessageEntry {
  message?: {
    role?: string
    toolName?: string
    details?: unknown
  }
}

function toolResultEntries(sessionText: string): ToolResultEntry[] {
  return sessionText
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as JsonlMessageEntry)
    .filter((entry) => entry.message?.role === "toolResult")
    .map((entry) => ({
      toolName: entry.message?.toolName ?? "",
      details: entry.message?.details as never,
    }))
}

interface ProofResponse {
  answer: unknown
  note?: string
}

function responseFor(exchange: PendingExchange): ProofResponse {
  if (exchange.mode === "text") {
    return { answer: { text: `Answer for ${exchange.exchangeId}` } }
  }
  if (exchange.mode === "multi-select") {
    return {
      answer: { optionIds: ["transcript", "other"] },
      note: "Other: keep a compact blocker/friction report.",
    }
  }
  return {
    answer: { optionId: exchange.options[0]?.id ?? "new-from-scratch" },
    note: "Chosen by deterministic public-RPC proof.",
  }
}

export async function runPublicRpcParityProof(): Promise<PublicRpcParityProofReport> {
  const cwd = await mkdtemp(join(tmpdir(), "brunch-public-rpc-parity-"))
  const coordinator = createWorkspaceSessionCoordinator({ cwd })
  const handlers = createRpcHandlers({ coordinator, cwd })
  const friction: string[] = []

  const discovery = success<{ methods: Array<{ method: string }> }>(
    await handlers.handle({ jsonrpc: "2.0", id: 1, method: "rpc.discover" }),
  )
  for (const method of [
    "workspace.selectionState",
    "workspace.activate",
    "session.startElicitation",
    "session.pendingExchange",
    "elicitation.respond",
    "session.elicitationExchanges",
    "session.transcriptDisplay",
  ]) {
    if (!discovery.methods.some((entry) => entry.method === method)) {
      throw new Error(`rpc.discover did not include ${method}`)
    }
  }

  const selection = success<WorkspaceSelectionResult>(
    await handlers.handle({
      jsonrpc: "2.0",
      id: 2,
      method: "workspace.selectionState",
    }),
  )
  if (!selection.requiresSelection) {
    friction.push("Fresh cwd did not report selection-required state.")
  }

  await handlers.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "workspace.activate",
    params: {
      decision: { action: "newSpec", title: "Public RPC parity spec" },
    },
  })
  const workspace = await coordinator.openDefaultWorkspace()
  if (workspace.status !== "ready") {
    throw new Error(
      "workspace.activate(newSpec) did not create a ready workspace",
    )
  }

  const exchangeIds: string[] = []
  for (let turn = 0; turn < 10; turn += 1) {
    const started = success<PendingResult>(
      await handlers.handle({
        jsonrpc: "2.0",
        id: 10 + turn * 3,
        method: "session.startElicitation",
      }),
    )
    const pending = success<PendingResult>(
      await handlers.handle({
        jsonrpc: "2.0",
        id: 11 + turn * 3,
        method: "session.pendingExchange",
      }),
    )
    if (pending.exchange.exchangeId !== started.exchange.exchangeId) {
      friction.push(
        `Turn ${turn + 1}: pendingExchange differed from startElicitation.`,
      )
    }
    exchangeIds.push(started.exchange.exchangeId)
    const response = responseFor(started.exchange)
    await handlers.handle({
      jsonrpc: "2.0",
      id: 12 + turn * 3,
      method: "elicitation.respond",
      params: {
        exchangeId: started.exchange.exchangeId,
        answer: response.answer,
        ...(response.note === undefined ? {} : { note: response.note }),
      },
    })
  }

  const exchanges = success<RpcExchangeProjection>(
    await handlers.handle({
      jsonrpc: "2.0",
      id: 50,
      method: "session.elicitationExchanges",
    }),
  )
  const display = success<TranscriptDisplayProjection>(
    await handlers.handle({
      jsonrpc: "2.0",
      id: 51,
      method: "session.transcriptDisplay",
    }),
  )
  if (exchanges.exchanges.length !== 10) {
    throw new Error(
      `Expected 10 completed exchanges, got ${exchanges.exchanges.length}`,
    )
  }

  const sessionText = await readFile(workspace.session.file, "utf8")
  if (
    sessionText.includes("brunch.elicitation_prompt") ||
    sessionText.includes("brunch.elicitation_response")
  ) {
    throw new Error(
      "Public RPC parity transcript used the retired lightweight elicitation entries",
    )
  }
  const tools = toolResultEntries(sessionText)
  const toolCoverage = [...new Set(tools.map((entry) => entry.toolName))].sort()
  for (const required of [
    "present_question",
    "request_answer",
    "present_options",
    "request_choice",
    "request_choices",
  ]) {
    if (!toolCoverage.includes(required)) {
      throw new Error(`Missing tool coverage for ${required}`)
    }
  }

  for (const exchangeId of new Set(exchangeIds)) {
    const presentIndex = tools.findIndex(
      (entry) =>
        entry.details?.exchangeId === exchangeId &&
        entry.details.schema === "brunch.structured_exchange.present",
    )
    const requestIndex = tools.findIndex(
      (entry) =>
        entry.details?.exchangeId === exchangeId &&
        entry.details.schema === "brunch.structured_exchange.request",
    )
    if (presentIndex < 0 || requestIndex < 0 || presentIndex > requestIndex) {
      throw new Error(
        `Exchange ${exchangeId} did not preserve present-before-request order`,
      )
    }
  }

  return {
    mission:
      "Drive an assistant-first Brunch elicitation session through public JSON-RPC only.",
    evaluationFocus:
      "Ten-turn tuple transcript/projection parity without raw Pi RPC or legacy prompt/response entries.",
    maxTurnBudget: 10,
    completedTurns: exchanges.exchanges.length,
    friction,
    cwd,
    specId: workspace.spec.id,
    sessionId: workspace.session.id,
    toolCoverage,
    exchangeIds,
    transcriptDisplayRows: display.rows.length,
  }
}
