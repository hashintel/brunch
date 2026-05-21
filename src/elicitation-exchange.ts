import { readFile } from "node:fs/promises"

const STRUCTURED_RESPONSE_TYPES = new Set([
  "brunch.elicitation_response",
  "brunch.action_response",
  "brunch.choice_response",
])

export interface EntryRange {
  start: string
  end: string
}

export interface ElicitationExchange {
  promptRange: EntryRange
  responseRange: EntryRange
  promptEntryIds: string[]
  responseEntryIds: string[]
}

export interface OpenPromptProjection {
  promptRange: EntryRange
  promptEntryIds: string[]
}

export interface ElicitationExchangeProjection {
  status: "empty" | "open_prompt" | "ready"
  exchanges: ElicitationExchange[]
  openPrompt: OpenPromptProjection | null
}

interface TranscriptEntry {
  id: string
  type?: string
  role?: string
  customType?: string
}

export async function loadJsonlTranscriptEntries(
  file: string,
): Promise<unknown[]> {
  const content = await readFile(file, "utf8")
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
}

export function projectElicitationExchanges(
  entries: unknown[],
): ElicitationExchangeProjection {
  const exchanges: ElicitationExchange[] = []
  let promptIds: string[] = []
  let responseIds: string[] = []

  for (const entry of entries) {
    if (!isTranscriptEntry(entry)) {
      continue
    }

    if (isPromptSideEntry(entry)) {
      flushResponse()
      promptIds.push(entry.id)
      continue
    }

    if (isResponseSideEntry(entry)) {
      responseIds.push(entry.id)
    }
  }

  flushResponse()

  if (promptIds.length > 0) {
    return {
      status: "open_prompt",
      exchanges,
      openPrompt: {
        promptRange: rangeFor(promptIds),
        promptEntryIds: promptIds,
      },
    }
  }

  return {
    status: exchanges.length === 0 ? "empty" : "ready",
    exchanges,
    openPrompt: null,
  }

  function flushResponse(): void {
    if (promptIds.length === 0 || responseIds.length === 0) {
      return
    }

    exchanges.push({
      promptRange: rangeFor(promptIds),
      responseRange: rangeFor(responseIds),
      promptEntryIds: promptIds,
      responseEntryIds: responseIds,
    })
    promptIds = []
    responseIds = []
  }
}

function rangeFor(ids: string[]): EntryRange {
  return { start: ids[0]!, end: ids[ids.length - 1]! }
}

function isTranscriptEntry(value: unknown): value is TranscriptEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  )
}

function isPromptSideEntry(entry: TranscriptEntry): boolean {
  if (entry.type === "custom" && entry.customType?.includes("prompt")) {
    return true
  }
  return (
    entry.role === "assistant" ||
    entry.role === "system" ||
    entry.role === "tool"
  )
}

function isResponseSideEntry(entry: TranscriptEntry): boolean {
  if (entry.role === "user") {
    return true
  }
  return (
    entry.type === "custom" &&
    STRUCTURED_RESPONSE_TYPES.has(entry.customType ?? "")
  )
}
