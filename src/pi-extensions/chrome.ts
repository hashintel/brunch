import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent"

import type {
  WorkspaceSessionChromeState,
  WorkspaceSessionReadyState,
} from "../workspace-session-coordinator.js"

export type BrunchChromeStage = "idle" | "streaming" | "observer-review"
export type BrunchChromeWorkerStatus = "idle" | "queued" | "running" | "blocked"
export type BrunchChromeCoherenceVerdict = "unknown" | "coherent" | "needs_review" | "incoherent"

export interface BrunchChromeContextUsage {
  usedTokens: number
  maxTokens: number
}

export interface BrunchChromeRuntimeState {
  bundle?: string
  role?: string
  model?: string
  thinking?: string
  lens?: string
}

export interface BrunchChromeBuildState {
  version?: string
  dev?: string
}

export interface BrunchChromeState extends WorkspaceSessionChromeState {
  session: {
    id: string
    label?: string
  }
  runtime?: BrunchChromeRuntimeState
  build?: BrunchChromeBuildState
  contextUsage?: BrunchChromeContextUsage
  worker?: {
    stage?: BrunchChromeStage
    status?: BrunchChromeWorkerStatus
  }
  coherence?: BrunchChromeCoherenceVerdict
}

export type BrunchChromeUi = Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setWidget" | "setTitle">

interface BrunchChromeFooterData {
  getGitBranch(): string | null
  getExtensionStatuses(): ReadonlyMap<string, string>
  onBranchChange(callback: () => void): () => void
}

export function formatBrunchChromeHeaderLines(
  chrome: BrunchChromeState,
): string[] {
  return [
    `brunch · ${formatSpec(chrome)}`,
    `cwd: ${chrome.cwd}`,
    `session: ${formatSession(chrome)} · phase: ${chrome.phase}`,
  ]
}

export function formatBrunchChromeFooterLines(
  chrome: BrunchChromeState,
  footerData?: BrunchChromeFooterData,
): string[] {
  const statuses = [...(footerData?.getExtensionStatuses() ?? new Map())]
    .filter(([key]) => key !== "brunch.chrome")
    .map(([, value]) => value)
  const branch = footerData?.getGitBranch()
  return [
    `runtime: ${formatRuntime(chrome)} · build: ${formatBuild(chrome)}`,
    `context: ${formatContextUsage(chrome.contextUsage)}`,
    `state: ${chrome.chatMode} · coherence: ${chrome.coherence ?? "unknown"} · worker: ${formatWorker(chrome)}`,
    `spec: ${formatSpec(chrome)} · session: ${formatSession(chrome)}${
      branch ? ` · branch: ${branch}` : ""
    }`,
    statuses.length > 0 ? `status: ${statuses.join(" · ")}` : "",
  ]
}

export function formatBrunchStatus(chrome: BrunchChromeState): string {
  return `Brunch · ${chrome.phase} · ${formatSpec(chrome)} · ${formatRuntime(chrome)}`
}

export function formatChromeWidgetLines(chrome: BrunchChromeState): string[] {
  return [
    `cwd: ${chrome.cwd}`,
    `spec: ${formatSpec(chrome)}`,
    `session: ${formatSession(chrome)}`,
    `runtime: ${formatRuntime(chrome)}`,
    `context: ${formatContextUsage(chrome.contextUsage)}`,
    `chat mode: ${chrome.chatMode}`,
  ]
}

export function chromeStateForWorkspace(
  workspace: WorkspaceSessionReadyState,
): BrunchChromeState {
  return {
    ...workspace.chrome,
    session: {
      id: workspace.session.id,
      label: workspace.session.id,
    },
  }
}

export function renderBrunchChrome(
  ui: BrunchChromeUi,
  chrome: BrunchChromeState,
): void {
  ui.setHeader(() => ({
    render: () => formatBrunchChromeHeaderLines(chrome),
    invalidate: () => {},
  }))
  ui.setFooter((tui, _theme, footerData) => {
    const unsubscribe = footerData.onBranchChange(() => tui.requestRender())
    return {
      render: () => formatBrunchChromeFooterLines(chrome, footerData),
      invalidate: () => {},
      dispose: unsubscribe,
    }
  })
  ui.setWidget("brunch.chrome", formatChromeWidgetLines(chrome), {
    placement: "aboveEditor",
  })
  ui.setTitle(`brunch — ${chrome.spec?.title ?? chrome.cwd}`)
}

function formatSpec(chrome: BrunchChromeState): string {
  return chrome.spec?.title ?? "no spec selected"
}

function formatSession(chrome: BrunchChromeState): string {
  return chrome.session.label ?? chrome.session.id
}

function formatRuntime(chrome: BrunchChromeState): string {
  const runtime = chrome.runtime
  if (!runtime) return "not reported"
  const parts = [
    runtime.bundle,
    runtime.role ? `role ${runtime.role}` : undefined,
    runtime.model,
    runtime.thinking ? `thinking ${runtime.thinking}` : undefined,
    runtime.lens ? `lens ${runtime.lens}` : undefined,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : "not reported"
}

function formatBuild(chrome: BrunchChromeState): string {
  const build = chrome.build
  if (!build) return "not reported"
  return [build.version, build.dev].filter(Boolean).join(" ") || "not reported"
}

function formatContextUsage(
  usage: BrunchChromeContextUsage | undefined,
): string {
  if (!usage) return "not reported"
  const max = Math.max(0, usage.maxTokens)
  const used = Math.max(0, usage.usedTokens)
  if (max === 0) return `${used.toLocaleString()} tokens · no limit reported`
  const ratio = Math.min(1, used / max)
  const filled = Math.round(ratio * 10)
  const bar = `${"█".repeat(filled)}${"░".repeat(10 - filled)}`
  const percent = Math.round(ratio * 100)
  return `[${bar}] ${used.toLocaleString()}/${max.toLocaleString()} tokens (${percent}%)`
}

function formatWorker(chrome: BrunchChromeState): string {
  const worker = chrome.worker
  if (!worker) return "not reported"
  return (
    [worker.stage, worker.status].filter(Boolean).join("/") || "not reported"
  )
}
