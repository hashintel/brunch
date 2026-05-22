import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  isSessionBindingEntry,
  type SessionBindingData,
} from "./session-binding.js"

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

export async function resolveExplicitSessionProjectionTarget(
  cwd: string,
  params: ExplicitSessionProjectionParams,
): Promise<SessionProjectionTarget> {
  const files = await listSessionFiles(cwd)
  for (const file of files) {
    const selfDescription = await readBrunchSessionSelfDescription(file)
    if (!selfDescription.targetsSession(params.sessionId)) {
      continue
    }
    if (!selfDescription.ok) {
      return invalidSessionSelfDescription()
    }

    const binding = selfDescription.binding
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
  const selfDescription = await readBrunchSessionSelfDescription(file)
  return selfDescription.ok ? selfDescription.binding : null
}

type SessionSelfDescription = ValidSessionSelfDescription | InvalidSessionSelfDescription

interface ValidSessionSelfDescription {
  ok: true
  binding: SessionBindingData
  headerSessionId: string
  targetsSession(sessionId: string): boolean
}

interface InvalidSessionSelfDescription {
  ok: false
  targetsSession(sessionId: string): boolean
}

async function readBrunchSessionSelfDescription(
  file: string,
): Promise<SessionSelfDescription> {
  const entries = (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
  const headers = entries.filter(isPiSessionHeader)
  const bindings = entries
    .filter(isSessionBindingEntry)
    .map((entry) => entry.data)

  if (headers.length !== 1 || bindings.length !== 1) {
    return {
      ok: false,
      targetsSession: (sessionId) =>
        bindings.some((binding) => binding.sessionId === sessionId),
    }
  }

  const headerSessionId = headers[0]!.id
  const binding = bindings[0]!
  if (binding.sessionId !== headerSessionId) {
    return {
      ok: false,
      targetsSession: (sessionId) =>
        binding.sessionId === sessionId || headerSessionId === sessionId,
    }
  }

  return {
    ok: true,
    binding,
    headerSessionId,
    targetsSession: (sessionId) => binding.sessionId === sessionId,
  }
}

interface PiSessionHeader {
  type: "session"
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

function invalidSessionSelfDescription(): SessionProjectionTarget {
  return {
    ok: false,
    code: -32005,
    message: "Brunch session self-description is invalid",
  }
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
