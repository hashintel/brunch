import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

export interface ExplicitSessionProjectionParams {
  sessionId: string
  specId?: string
}

export type SessionProjectionTarget = {
  ok: true
  file: string
  nonLinearMessage: string
} | {
  ok: false
  code: number
  message: string
}

const SESSION_BINDING_TYPE = "brunch.session_binding"
const BINDING_SCHEMA_VERSION = 1

interface SessionBindingData {
  schemaVersion: 1
  sessionId: string
  specId: string
  specTitle: string
}

type SessionBindingEntry = {
  type: "custom"
  customType: typeof SESSION_BINDING_TYPE
  data: SessionBindingData
}

export async function resolveExplicitSessionProjectionTarget(
  cwd: string,
  params: ExplicitSessionProjectionParams,
): Promise<SessionProjectionTarget> {
  const files = await listSessionFiles(cwd)
  for (const file of files) {
    const binding = await readBrunchSessionBinding(file)
    if (!binding || binding.sessionId !== params.sessionId) {
      continue
    }
    if (params.specId && binding.specId !== params.specId) {
      return {
        ok: false,
        code: -32003,
        message: "Brunch session does not belong to requested spec",
      }
    }
    return {
      ok: true,
      file,
      nonLinearMessage: "Brunch session transcript is non-linear",
    }
  }

  return { ok: false, code: -32004, message: "Brunch session not found" }
}

export async function readBrunchSessionBinding(
  file: string,
): Promise<SessionBindingData | null> {
  const lines = (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
  for (const line of lines) {
    const entry = JSON.parse(line) as unknown
    if (isSessionBindingEntry(entry)) {
      return entry.data
    }
  }
  return null
}

async function listSessionFiles(cwd: string): Promise<string[]> {
  const sessionRoot = join(resolve(cwd), ".brunch", "sessions")
  try {
    const entries = await readdir(sessionRoot, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => join(sessionRoot, entry.name))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw error
  }
}

function isSessionBindingEntry(value: unknown): value is SessionBindingEntry {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { type?: unknown }).type !== "custom" ||
    (value as { customType?: unknown }).customType !== SESSION_BINDING_TYPE
  ) {
    return false
  }

  const data = (value as { data?: unknown }).data
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { schemaVersion?: unknown }).schemaVersion ===
      BINDING_SCHEMA_VERSION &&
    typeof (data as { sessionId?: unknown }).sessionId === "string" &&
    typeof (data as { specId?: unknown }).specId === "string" &&
    typeof (data as { specTitle?: unknown }).specTitle === "string"
  )
}
