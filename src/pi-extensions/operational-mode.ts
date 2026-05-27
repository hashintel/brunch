/**
 * Brunch operational-mode policy.
 *
 * The current product runtime has one safe state: `elicit`. In that state the
 * embedded Pi harness exposes only Brunch's read-only inspection tools and
 * blocks side-effecting tools (`bash`, `edit`, `write`, etc.) at multiple Pi
 * seams. Later cards replace this fixed posture with transcript-backed
 * BrunchAgentState projection, but the policy remains operational-mode owned.
 */

import { homedir } from "node:os"

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import {
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
} from "@earendil-works/pi-coding-agent"
import { Text } from "@earendil-works/pi-tui"

const READ_ONLY_TOOLS = [
  "read",
  "grep",
  "find",
  "ls",
  "present_alternatives",
] as const
type ReadOnlyToolName = typeof READ_ONLY_TOOLS[number]

function shortenPath(path: string): string {
  const home = homedir()
  if (path.startsWith(home)) return `~${path.slice(home.length)}`
  return path
}

function availableReadOnlyToolNames(pi: ExtensionAPI): ReadOnlyToolName[] {
  const allToolNames = new Set(pi.getAllTools().map((tool) => tool.name))
  return READ_ONLY_TOOLS.filter((name) => allToolNames.has(name))
}

function applyBrunchToolPolicy(pi: ExtensionAPI): void {
  pi.setActiveTools(availableReadOnlyToolNames(pi))
}

interface TextLikeContent {
  type: string
  text?: string
}

interface TextToolResultLike {
  content?: TextLikeContent[]
}

interface TextContent {
  type: "text"
  text: string
}

function firstText(result: TextToolResultLike): TextContent | undefined {
  return result.content?.find(
    (content): content is TextContent =>
      content.type === "text" && typeof content.text === "string",
  )
}

function nonEmptyLineCount(text: string): number {
  return text
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0).length
}

function emptyResult() {
  return new Text("", 0, 0)
}

const toolCache = new Map<string, ReturnType<typeof createReadOnlyTools>>()

function createReadOnlyTools(cwd: string) {
  return {
    read: createReadTool(cwd),
    grep: createGrepTool(cwd),
    find: createFindTool(cwd),
    ls: createLsTool(cwd),
  }
}

function getReadOnlyTools(cwd: string) {
  let tools = toolCache.get(cwd)
  if (!tools) {
    tools = createReadOnlyTools(cwd)
    toolCache.set(cwd, tools)
  }
  return tools
}

function supportsOperationalModePolicy(pi: ExtensionAPI): boolean {
  const candidate = pi as Partial<ExtensionAPI>
  return (
    typeof candidate.registerTool === "function" &&
    typeof candidate.getAllTools === "function" &&
    typeof candidate.setActiveTools === "function"
  )
}

export function registerBrunchOperationalModePolicy(pi: ExtensionAPI) {
  if (!supportsOperationalModePolicy(pi)) {
    return
  }

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).read,
    label: "read",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).read.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
      )
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || "")
      const range =
        args.offset !== undefined || args.limit !== undefined
          ? theme.fg(
              "muted",
              `:${args.offset ?? 1}${
                args.limit !== undefined
                  ? `-${(args.offset ?? 1) + args.limit - 1}`
                  : ""
              }`,
            )
          : ""
      return new Text(
        `${theme.fg("toolTitle", theme.bold("read"))} ${theme.fg("accent", path || "…")}${range}`,
        0,
        0,
      )
    },
    renderResult() {
      return emptyResult()
    },
  })

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).grep,
    label: "grep",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).grep.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
      )
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || ".")
      const glob = args.glob ? theme.fg("muted", ` ${args.glob}`) : ""
      return new Text(
        `${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg("accent", `/${args.pattern || "…"}/`)} ${theme.fg("muted", path)}${glob}`,
        0,
        0,
      )
    },
    renderResult(result, { expanded }, theme) {
      const text = firstText(result)?.text ?? ""
      if (expanded && text.trim().length > 0) {
        return new Text(`\n${theme.fg("toolOutput", text.trim())}`, 0, 0)
      }
      const count = nonEmptyLineCount(text)
      return count > 0
        ? new Text(theme.fg("muted", `→ ${count} matches`), 0, 0)
        : emptyResult()
    },
  })

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).find,
    label: "find",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).find.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
      )
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || ".")
      return new Text(
        `${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg("accent", args.pattern || "…")} ${theme.fg("muted", path)}`,
        0,
        0,
      )
    },
    renderResult(result, { expanded }, theme) {
      const text = firstText(result)?.text ?? ""
      if (expanded && text.trim().length > 0) {
        return new Text(`\n${theme.fg("toolOutput", text.trim())}`, 0, 0)
      }
      const count = nonEmptyLineCount(text)
      return count > 0
        ? new Text(theme.fg("muted", `→ ${count} files`), 0, 0)
        : emptyResult()
    },
  })

  pi.registerTool({
    ...getReadOnlyTools(process.cwd()).ls,
    label: "ls",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getReadOnlyTools(ctx.cwd).ls.execute(
        toolCallId,
        params,
        signal,
        onUpdate,
      )
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || ".")
      return new Text(
        `${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", path)}`,
        0,
        0,
      )
    },
    renderResult(result, { expanded }, theme) {
      const text = firstText(result)?.text ?? ""
      if (expanded && text.trim().length > 0) {
        return new Text(`\n${theme.fg("toolOutput", text.trim())}`, 0, 0)
      }
      const count = nonEmptyLineCount(text)
      return count > 0
        ? new Text(theme.fg("muted", `→ ${count} entries`), 0, 0)
        : emptyResult()
    },
  })

  pi.on("session_start", async () => {
    applyBrunchToolPolicy(pi)
  })

  pi.on("before_agent_start", async (event) => {
    applyBrunchToolPolicy(pi)

    const tools = availableReadOnlyToolNames(pi).join(", ") || "none"
    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n[Brunch tool policy]\n` +
        `- Brunch exposes only read-only tools: ${tools}.\n` +
        `- Do not attempt to write files, edit code, run shell commands, change git state, install dependencies, start processes, or mutate external systems.\n` +
        `- If the user asks for a side-effecting action, explain that this Brunch prototype is read-only for now.`,
    }
  })

  pi.on("tool_call", async (event) => {
    const allowedToolNames = new Set(availableReadOnlyToolNames(pi))
    if (allowedToolNames.has(event.toolName as ReadOnlyToolName)) return

    return {
      block: true,
      reason:
        `Brunch tool policy blocks "${event.toolName}". ` +
        `Allowed tools: ${Array.from(allowedToolNames).join(", ") || "none"}.`,
    }
  })

  pi.on("user_bash", (event) => ({
    result: {
      output: `Brunch tool policy blocks shell commands: ${event.command}`,
      exitCode: 1,
      cancelled: false,
      truncated: false,
    },
  }))
}
