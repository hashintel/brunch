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

export const BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE =
  "brunch.agent_runtime_state"

export type OperationalModeId = "elicit"
export type AgentRoleId = "elicitor"
export type AgentStrategyId = "step-by-step" | "disambiguate-via-examples"
export type AgentLensId = AgentStrategyId
export type ToolPolicyId = "elicit-read-only"
export type PromptPackId = "brunch-base" | "elicit" | "elicitor"
export type ModelPreference = "default"
export type ThinkingLevel = "low" | "medium" | "high"

export interface BrunchAgentState {
  schemaVersion: 1
  operationalMode: OperationalModeId
  agentRole: AgentRoleId
  agentStrategy: AgentStrategyId
  agentLens: AgentLensId | null
}

export interface OperationalModeDefinition {
  id: OperationalModeId
  defaultRole: AgentRoleId
  allowedRoles: readonly AgentRoleId[]
  toolPolicyId: ToolPolicyId
  promptPackIds: readonly PromptPackId[]
}

export interface AgentRoleDefinition {
  id: AgentRoleId
  operationalMode: OperationalModeId
  defaultStrategy: AgentStrategyId
  allowedStrategies: readonly AgentStrategyId[]
  defaultLens: AgentLensId | null
  allowedLenses: readonly AgentLensId[]
  promptPackIds: readonly PromptPackId[]
  modelPreference?: ModelPreference
  thinkingLevel?: ThinkingLevel
}

export interface ResolvedBrunchAgentState extends BrunchAgentState {
  operationalModeDefinition: OperationalModeDefinition
  agentRoleDefinition: AgentRoleDefinition
}

export interface BrunchAgentStateEntryData {
  schemaVersion: 1
  reason: "init" | "switch"
  state: BrunchAgentState
  previous?: BrunchAgentState
  source: "system" | "user" | "agent" | "extension"
}

export const DEFAULT_BRUNCH_AGENT_STATE: BrunchAgentState = {
  schemaVersion: 1,
  operationalMode: "elicit",
  agentRole: "elicitor",
  agentStrategy: "step-by-step",
  agentLens: "step-by-step",
}

export const OPERATIONAL_MODE_DEFINITIONS: Record<OperationalModeId, OperationalModeDefinition> =
  {
    elicit: {
      id: "elicit",
      defaultRole: "elicitor",
      allowedRoles: ["elicitor"],
      toolPolicyId: "elicit-read-only",
      promptPackIds: ["brunch-base", "elicit"],
    },
  }

export const AGENT_ROLE_DEFINITIONS: Record<AgentRoleId, AgentRoleDefinition> =
  {
    elicitor: {
      id: "elicitor",
      operationalMode: "elicit",
      defaultStrategy: "step-by-step",
      allowedStrategies: ["step-by-step", "disambiguate-via-examples"],
      defaultLens: "step-by-step",
      allowedLenses: ["step-by-step", "disambiguate-via-examples"],
      promptPackIds: ["elicitor"],
    },
  }

interface CustomEntryLike {
  type?: unknown
  customType?: unknown
  data?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T)
}

function parseBrunchAgentState(value: unknown): BrunchAgentState | undefined {
  if (!isRecord(value)) return undefined
  const operationalModes = Object.keys(
    OPERATIONAL_MODE_DEFINITIONS,
  ) as OperationalModeId[]
  const agentRoles = Object.keys(AGENT_ROLE_DEFINITIONS) as AgentRoleId[]

  if (value.schemaVersion !== 1) return undefined
  if (!isOneOf(value.operationalMode, operationalModes)) return undefined
  if (!isOneOf(value.agentRole, agentRoles)) return undefined

  const mode = OPERATIONAL_MODE_DEFINITIONS[value.operationalMode]
  const role = AGENT_ROLE_DEFINITIONS[value.agentRole]
  if (!mode.allowedRoles.includes(value.agentRole)) return undefined
  if (role.operationalMode !== value.operationalMode) return undefined
  if (!isOneOf(value.agentStrategy, role.allowedStrategies)) return undefined
  if (
    value.agentLens !== null &&
    !isOneOf(value.agentLens, role.allowedLenses)
  ) {
    return undefined
  }

  return {
    schemaVersion: 1,
    operationalMode: value.operationalMode,
    agentRole: value.agentRole,
    agentStrategy: value.agentStrategy,
    agentLens: value.agentLens,
  }
}

function parseBrunchAgentStateEntryData(
  value: unknown,
): BrunchAgentStateEntryData | undefined {
  if (!isRecord(value)) return undefined
  if (value.schemaVersion !== 1) return undefined
  if (value.reason !== "init" && value.reason !== "switch") return undefined
  if (
    value.source !== "system" &&
    value.source !== "user" &&
    value.source !== "agent" &&
    value.source !== "extension"
  ) {
    return undefined
  }
  const state = parseBrunchAgentState(value.state)
  if (!state) return undefined
  const previous =
    value.previous === undefined
      ? undefined
      : parseBrunchAgentState(value.previous)
  if (value.previous !== undefined && !previous) return undefined

  return {
    schemaVersion: 1,
    reason: value.reason,
    state,
    ...(previous ? { previous } : {}),
    source: value.source,
  }
}

function resolveBrunchAgentState(
  state: BrunchAgentState,
): ResolvedBrunchAgentState {
  return {
    ...state,
    operationalModeDefinition:
      OPERATIONAL_MODE_DEFINITIONS[state.operationalMode],
    agentRoleDefinition: AGENT_ROLE_DEFINITIONS[state.agentRole],
  }
}

export function projectBrunchAgentState(
  entries: readonly CustomEntryLike[],
): ResolvedBrunchAgentState {
  let state = DEFAULT_BRUNCH_AGENT_STATE

  for (const entry of entries) {
    if (
      entry.type !== "custom" ||
      entry.customType !== BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE
    ) {
      continue
    }
    const data = parseBrunchAgentStateEntryData(entry.data)
    if (data) state = data.state
  }

  return resolveBrunchAgentState(state)
}

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
