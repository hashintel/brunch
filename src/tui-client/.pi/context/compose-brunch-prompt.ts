import { readFileSync } from "node:fs"

import { renderGraphContext } from "./builders/graph-context.js"
import { renderReadinessContext } from "./builders/readiness-context.js"
import { renderStructuredExchangeContext } from "./builders/structured-exchange-context.js"

export interface BrunchPromptCompositionState {
  operationalMode: string
  agentRole: string
  agentStrategy: string
  agentLens: string | null
  activeTools: readonly string[]
}

export interface BrunchPromptPack {
  id: string
  title: string
  markdown: string
}

export interface BrunchPromptCompositionResult {
  prompt: string
  packIds: readonly string[]
}

const PROMPT_PACK_ORDER = [
  "brunch-base",
  "elicit",
  "elicitor",
  "structured-exchange",
  "candidate-proposals",
  "capture-analysis",
] as const

type PromptPackId = typeof PROMPT_PACK_ORDER[number]

const PROMPT_PACK_TITLES: Record<PromptPackId, string> = {
  "brunch-base": "Brunch base",
  elicit: "Operational mode: elicit",
  elicitor: "Agent role: elicitor",
  "structured-exchange": "Structured exchanges",
  "candidate-proposals": "Candidate proposals",
  "capture-analysis": "Capture analysis",
}

function readPromptPack(id: PromptPackId): BrunchPromptPack {
  return {
    id,
    title: PROMPT_PACK_TITLES[id],
    markdown: readFileSync(
      new URL(`./prompt-packs/${id}.md`, import.meta.url),
      "utf8",
    ).trim(),
  }
}

const PROMPT_PACKS = PROMPT_PACK_ORDER.map(readPromptPack)

function renderAgentState(state: BrunchPromptCompositionState): string {
  const tools = state.activeTools.join(", ") || "none"
  const lens = state.agentLens ?? "none"

  return [
    "[Brunch agent state]",
    `- Operational mode: ${state.operationalMode}.`,
    `- Agent role: ${state.agentRole}.`,
    `- Agent strategy: ${state.agentStrategy}.`,
    `- Agent lens: ${lens}.`,
    `- Prompt packs: ${PROMPT_PACK_ORDER.join(", ")}.`,
    "",
    "[Brunch tool policy]",
    `- Brunch exposes only elicit-safe tools: ${tools}.`,
    "- Do not attempt to write files, edit code, run shell commands, change git state, install dependencies, start processes, or mutate external systems.",
    "- If the user asks for a side-effecting action, explain that this Brunch prototype is read-only for now.",
  ].join("\n")
}

function joinPromptSections(sections: readonly string[]): string {
  return sections
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .join("\n\n")
}

export function composeBrunchPrompt(
  state: BrunchPromptCompositionState,
): BrunchPromptCompositionResult {
  const packSections = PROMPT_PACKS.map((pack) => pack.markdown)
  const dynamicSections = [
    renderGraphContext(),
    renderReadinessContext(),
    renderStructuredExchangeContext(),
  ]
  const prompt = joinPromptSections([
    renderAgentState(state),
    ...packSections,
    ...dynamicSections,
  ])

  return {
    prompt,
    packIds: PROMPT_PACKS.map((pack) => pack.id),
  }
}
