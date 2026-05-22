import { readFile } from "node:fs/promises"

import {
  type FileEntry,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent"

import {
  isSessionBindingEntry,
  type SessionBindingData,
} from "./session-binding.js"

export interface BrunchSessionEnvelope {
  header: PiSessionHeader
  binding: SessionBindingData
  entries: FileEntry[]
}

export type BrunchSessionEnvelopeReadResult = {
  ok: true
  envelope: BrunchSessionEnvelope
} | {
  ok: false
  observedSessionIds: string[]
}

export class NonLinearTranscriptError extends Error {
  readonly code = "BRUNCH_NON_LINEAR_TRANSCRIPT"

  constructor(message: string) {
    super(message)
    this.name = "NonLinearTranscriptError"
  }
}

export async function readBrunchSessionEnvelope(
  file: string,
): Promise<BrunchSessionEnvelopeReadResult> {
  const entries = await readJsonlEntries(file)

  const headers = entries.filter(isPiSessionHeader)
  const bindings = entries
    .filter(isSessionBindingEntry)
    .map((entry) => entry.data)

  if (headers.length !== 1 || bindings.length !== 1) {
    return {
      ok: false,
      observedSessionIds: uniqueStrings([
        ...headers.map((header) => header.id),
        ...bindings.map((binding) => binding.sessionId),
      ]),
    }
  }

  const header = headers[0]!
  const binding = bindings[0]!
  if (binding.sessionId !== header.id) {
    return {
      ok: false,
      observedSessionIds: uniqueStrings([header.id, binding.sessionId]),
    }
  }

  assertFileBackedTranscriptEntries(entries)
  return { ok: true, envelope: { header, binding, entries } }
}

export function assertLinearBrunchSessionEnvelope(
  envelope: BrunchSessionEnvelope,
): void {
  assertLinearTranscriptEntries(envelope.entries)
}

export async function loadJsonlTranscriptEntries(
  file: string,
): Promise<FileEntry[]> {
  const entries = await readJsonlEntries(file)
  assertFileBackedTranscriptEntries(entries)
  assertLinearTranscriptEntries(entries)
  return entries
}

async function readJsonlEntries(file: string): Promise<unknown[]> {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
}

function assertFileBackedTranscriptEntries(
  entries: readonly unknown[],
): asserts entries is FileEntry[] {
  const headerCount = entries.filter(isPiSessionHeader).length
  if (headerCount !== 1) {
    throw new Error(
      `Invalid Pi JSONL transcript: expected exactly one Pi session header, found ${headerCount}`,
    )
  }

  for (const entry of entries) {
    if (isPiSessionHeader(entry)) {
      continue
    }

    if (!hasRequiredSessionEntryShape(entry)) {
      throw new Error(
        "Invalid Pi JSONL transcript: every non-header entry must have a string id, string-or-null parentId, and string type",
      )
    }
  }
}

function assertLinearTranscriptEntries(entries: readonly FileEntry[]): void {
  for (const entry of entries) {
    if (isPiSessionHeader(entry) && typeof entry.parentSession === "string") {
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

interface PiSessionHeader extends Extract<FileEntry, { type: "session" }> {
  id: string
}

function isPiSessionHeader(value: unknown): value is PiSessionHeader {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "session" &&
    typeof (value as { id?: unknown }).id === "string"
  )
}

function isSessionEntry(value: unknown): value is SessionEntry {
  return isTranscriptEntry(value) && hasStringOrNullParentId(value)
}

function hasRequiredSessionEntryShape(value: unknown): value is SessionEntry {
  return isTranscriptEntry(value) && hasStringOrNullParentId(value)
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

function hasStringOrNullParentId(value: unknown): boolean {
  return (
    (value as { parentId?: unknown }).parentId === null ||
    typeof (value as { parentId?: unknown }).parentId === "string"
  )
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}
