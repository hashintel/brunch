import { readFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { ToolResultMessage } from "@earendil-works/pi-ai"
import type {
  CustomEntry,
  CustomMessageEntry,
  FileEntry,
  SessionHeader,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent"

import {
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from "./.pi/extensions/structured-exchange/shared/recovery.js"

type TranscriptEntry = FileEntry

type TranscriptToolResultMessage = ToolResultMessage<unknown>

export async function renderSessionTranscriptFile(
  sessionFile: string,
): Promise<string> {
  const text = await readFile(sessionFile, "utf8")
  return renderSessionTranscript(text, { title: basename(sessionFile) })
}

export function renderSessionTranscript(
  jsonl: string,
  options: { title?: string } = {},
): string {
  const entries = parseJsonl(jsonl)
  const lines: string[] = [
    `# Transcript${options.title ? ` — ${options.title}` : ""}`,
  ]

  for (const entry of entries) {
    lines.push("", ...renderEntry(entry))
  }

  return `${lines.join("\n").trimEnd()}\n`
}

function parseJsonl(jsonl: string): FileEntry[] {
  return jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as TranscriptEntry
      } catch (error) {
        throw new Error(
          `Invalid JSONL at line ${index + 1}: ${(error as Error).message}`,
        )
      }
    })
}

function renderEntry(entry: TranscriptEntry): string[] {
  if (isSessionHeaderEntry(entry)) {
    return renderSessionHeader(entry)
  }

  if (isCustomTranscriptEntry(entry)) {
    return renderCustomEntry(entry)
  }

  if (isMessageEntry(entry)) {
    return renderMessageEntry(entry)
  }

  return [
    `## Entry ${entryId(entry)}`,
    "",
    "```json",
    JSON.stringify(entry, null, 2),
    "```",
  ]
}

function renderSessionHeader(entry: SessionHeader): string[] {
  const fields = [
    typeof entry.id === "string" ? `- session: ${entry.id}` : undefined,
    typeof entry.cwd === "string" ? `- cwd: ${entry.cwd}` : undefined,
  ].filter((line): line is string => line !== undefined)
  return [
    "## Session",
    "",
    ...(fields.length > 0 ? fields : ["- session metadata present"]),
  ]
}

function renderCustomEntry(entry: CustomEntry | CustomMessageEntry): string[] {
  const customType =
    typeof entry.customType === "string" ? entry.customType : "custom"
  const title =
    customType === "brunch.session_binding"
      ? "Session binding"
      : `Custom: ${customType}`
  const payload = entry.type === "custom_message" ? entry.details : entry.data
  const text = textContent(
    entry.type === "custom_message" ? entry.content : undefined,
  )
  const body: string[] = []
  if (text.length > 0) body.push(text)
  if (payload !== undefined) {
    body.push("```json", JSON.stringify(payload, null, 2), "```")
  }
  return [
    `## ${title}`,
    "",
    ...(body.length > 0 ? body : ["_(no display content)_"]),
  ]
}

function renderMessageEntry(entry: SessionMessageEntry): string[] {
  const message = entry.message
  if (!message || typeof message !== "object") {
    return [`## Message ${entryId(entry)}`, "", "_(missing message payload)_"]
  }

  if (isToolResultMessage(message)) {
    return renderToolResult(entry, message)
  }

  const role =
    typeof message.role === "string" ? titleCase(message.role) : "Message"
  const text = textContent(
    (message as unknown as Record<string, unknown>).content,
  )
  return [`## ${role}`, "", text.length > 0 ? text : "_(empty)_"]
}

function renderToolResult(
  _entry: SessionMessageEntry,
  message: TranscriptToolResultMessage,
): string[] {
  const details = message.details
  const present = structuredPresent(details)
  if (present) {
    const expected =
      present.expectedRequest &&
      typeof present.expectedRequest.tool === "string"
        ? ` → ${present.expectedRequest.tool}`
        : ""
    return [
      `## Exchange ${present.exchangeId} — prompt (${present.presentTool}${expected})`,
      "",
      textContent(message.content) || "_(empty prompt)_",
    ]
  }

  const request = structuredRequest(details)
  if (request) {
    return [
      `## Exchange ${request.exchangeId} — response (${request.requestTool}, ${request.status})`,
      "",
      textContent(message.content) || "_(empty response)_",
    ]
  }

  return []
}

function structuredPresent(value: unknown) {
  return isStructuredExchangePresentDetails(value) ? value : null
}

function structuredRequest(value: unknown) {
  return isStructuredExchangeRequestDetails(value) ? value : null
}

function textContent(content: unknown): string {
  if (typeof content === "string") return content.trim()
  if (!Array.isArray(content)) return ""
  return content
    .map((part) =>
      isRecord(part) && typeof part.text === "string" ? part.text : "",
    )
    .filter((text) => text.length > 0)
    .join("\n")
    .trim()
}

function isSessionHeaderEntry(entry: TranscriptEntry): entry is SessionHeader {
  return entry.type === "session"
}

function isCustomTranscriptEntry(
  entry: TranscriptEntry,
): entry is CustomEntry | CustomMessageEntry {
  return entry.type === "custom" || entry.type === "custom_message"
}

function isMessageEntry(entry: TranscriptEntry): entry is SessionMessageEntry {
  return entry.type === "message"
}

function isToolResultMessage(
  message: SessionMessageEntry["message"],
): message is TranscriptToolResultMessage {
  return message.role === "toolResult"
}

function entryId(entry: TranscriptEntry): string {
  return typeof entry.id === "string" ? entry.id : "(unknown)"
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function main(): Promise<void> {
  const [, , sessionFile] = process.argv
  if (!sessionFile) {
    process.stderr.write(
      "Usage: tsx src/session-transcript.ts <session.jsonl>\n",
    )
    process.exitCode = 1
    return
  }
  process.stdout.write(await renderSessionTranscriptFile(sessionFile))
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch((error) => {
    process.stderr.write(`${(error as Error).stack ?? String(error)}\n`)
    process.exitCode = 1
  })
}
