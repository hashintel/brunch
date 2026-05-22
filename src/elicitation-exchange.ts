import { readFile } from "node:fs/promises"

import {
  type CustomEntry,
  type CustomMessageEntry,
  type FileEntry,
  type SessionEntry,
  type SessionMessageEntry,
} from "@earendil-works/pi-coding-agent"

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

export interface TranscriptDisplayRow {
  id: string
  role: "assistant" | "user"
  text: string
}

export interface TranscriptDisplayProjection {
  rows: TranscriptDisplayRow[]
}

export class NonLinearTranscriptError extends Error {
  readonly code = "BRUNCH_NON_LINEAR_TRANSCRIPT"

  constructor(message: string) {
    super(message)
    this.name = "NonLinearTranscriptError"
  }
}

export async function loadLinearElicitationExchangeProjection(
  file: string,
): Promise<ElicitationExchangeProjection> {
  return projectElicitationExchanges(await loadJsonlTranscriptEntries(file))
}

export async function loadLinearTranscriptDisplayProjection(
  file: string,
): Promise<TranscriptDisplayProjection> {
  return projectTranscriptDisplay(await loadJsonlTranscriptEntries(file))
}

export function projectTranscriptDisplay(
  entries: readonly unknown[],
): TranscriptDisplayProjection {
  const rows: TranscriptDisplayRow[] = []
  for (const entry of entries) {
    if (!isSessionEntry(entry) || !isMessageEntry(entry)) {
      continue
    }

    const role = entry.message.role
    if (role !== "assistant" && role !== "user") {
      continue
    }

    const text = textContent(entry.message.content)
    if (text.length === 0) {
      continue
    }

    rows.push({ id: entry.id, role, text })
  }
  return { rows }
}

export async function loadJsonlTranscriptEntries(
  file: string,
): Promise<FileEntry[]> {
  const content = await readFile(file, "utf8")
  const entries = content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)

  assertFileBackedTranscriptEntries(entries)
  assertLinearTranscriptEntries(entries)
  return entries
}

function assertFileBackedTranscriptEntries(
  entries: readonly unknown[],
): asserts entries is FileEntry[] {
  const headerCount = entries.filter(isSessionHeader).length
  if (headerCount !== 1) {
    throw new Error(
      `Invalid Pi JSONL transcript: expected exactly one Pi session header, found ${headerCount}`,
    )
  }

  for (const entry of entries) {
    if (isSessionHeader(entry)) {
      continue
    }

    if (!hasRequiredSessionEntryShape(entry)) {
      throw new Error(
        "Invalid Pi JSONL transcript: every non-header entry must have a string id, string-or-null parentId, and string type",
      )
    }
  }
}

export function assertLinearTranscriptEntries(
  entries: readonly FileEntry[],
): void {
  for (const entry of entries) {
    if (isSessionHeader(entry) && typeof entry.parentSession === "string") {
      throw new NonLinearTranscriptError(
        "Brunch does not support branch-derived Pi sessions",
      )
    }

    if (isSessionEntry(entry) && entry.type === "branch_summary") {
      throw new NonLinearTranscriptError(
        "Brunch does not support Pi branch-summary transcript entries",
      )
    }
  }

  const childrenByParent = new Map<string | null, string[]>()
  for (const entry of entries) {
    if (!isSessionEntry(entry)) {
      continue
    }

    const siblings = childrenByParent.get(entry.parentId) ?? []
    siblings.push(entry.id)
    childrenByParent.set(entry.parentId, siblings)

    if (siblings.length > 1) {
      throw new NonLinearTranscriptError(
        "Brunch does not support non-linear Pi transcript branches",
      )
    }
  }
}

export function projectElicitationExchanges(
  entries: readonly unknown[],
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

    if (isResponseSideEntry(entry) && promptIds.length > 0) {
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

function isTranscriptEntry(value: unknown): value is SessionEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type !== "session" &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { type?: unknown }).type === "string"
  )
}

function isSessionEntry(value: unknown): value is SessionEntry {
  return isTranscriptEntry(value) && hasStringOrNullParentId(value)
}

function hasRequiredSessionEntryShape(value: unknown): value is SessionEntry {
  return isTranscriptEntry(value) && hasStringOrNullParentId(value)
}

function hasStringOrNullParentId(value: unknown): boolean {
  return (
    (value as { parentId?: unknown }).parentId === null ||
    typeof (value as { parentId?: unknown }).parentId === "string"
  )
}

function isSessionHeader(
  value: unknown,
): value is Extract<FileEntry, { type: "session" }> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "session"
  )
}

function isPromptSideEntry(entry: SessionEntry): boolean {
  if (isCustomTranscriptEntry(entry) && entry.customType.includes("prompt")) {
    return true
  }

  const role = roleOf(entry)
  return role === "assistant" || role === "toolResult"
}

function isResponseSideEntry(entry: SessionEntry): boolean {
  if (roleOf(entry) === "user") {
    return true
  }
  return (
    isCustomTranscriptEntry(entry) &&
    STRUCTURED_RESPONSE_TYPES.has(entry.customType)
  )
}

function isCustomTranscriptEntry(
  entry: SessionEntry,
): entry is CustomEntry | CustomMessageEntry {
  return entry.type === "custom" || entry.type === "custom_message"
}

function roleOf(
  entry: SessionEntry,
): SessionMessageEntry["message"]["role"] | undefined {
  if (isMessageEntry(entry)) {
    return entry.message.role
  }
  return undefined
}

function isMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === "message"
}

function textContent(content: unknown): string {
  if (typeof content === "string") {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" &&
        part !== null &&
        typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .filter((text) => text.length > 0)
      .join("\n")
  }

  return ""
}
