import type {
  ExtensionAPI,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent"
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"

import { BRUNCH_COMPACT_WORDMARK } from "../components/brunch-identity.js"
import type {
  WorkspaceSessionChromeState,
  WorkspaceSessionReadyState,
} from "../../../workspace-session-coordinator.js"

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

export interface BrunchChromeFooterTelemetry {
  gitBranch?: string | null
  statuses?: ReadonlyMap<string, string>
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

export function formatBrunchChromeHeaderLines(
  chrome: BrunchChromeState,
): string[] {
  return [
    ...BRUNCH_COMPACT_WORDMARK,
    `runtime: ${formatRuntime(chrome)}`,
    `${formatChromeIdentity(chrome)} · phase: ${chrome.phase}`,
  ]
}

export function projectBrunchChromeFooterLines(
  chrome: BrunchChromeState,
  telemetry?: BrunchChromeFooterTelemetry,
  width?: number,
): string[] {
  const statuses = sanitizeChromeStatuses(telemetry?.statuses)
  const branch = telemetry?.gitBranch
  const identity = `${formatChromeIdentity(chrome)}${
    branch ? ` · branch: ${branch}` : ""
  }`
  const runtime = `brunch · runtime: ${formatRuntime(chrome)} · build: ${formatBuild(chrome)}`
  const context = `context: ${formatContextUsage(chrome.contextUsage)}`
  return [
    width === undefined ? runtime : alignChromeColumns(runtime, context, width),
    ...(width === undefined ? [context] : []),
    `state: ${chrome.chatMode} · coherence: ${chrome.coherence ?? "unknown"} · worker: ${formatWorker(chrome)}`,
    identity,
    statuses.length > 0 ? `status: ${statuses.join(" · ")}` : "",
  ]
}

export function formatChromeWidgetLines(chrome: BrunchChromeState): string[] {
  return [
    `brunch: ${formatCompactWordmark()}`,
    `cwd: ${chrome.cwd}`,
    `spec: ${formatSpec(chrome)}`,
    `session: ${formatSession(chrome)}`,
    `runtime: ${formatRuntime(chrome)}`,
    `context: ${formatContextUsage(chrome.contextUsage)}`,
    `chat mode: ${chrome.chatMode}`,
  ]
}

function formatChromeIdentity(chrome: BrunchChromeState): string {
  return `spec: ${formatSpec(chrome)} · session: ${formatSession(chrome)}`
}

function formatCompactWordmark(): string {
  return BRUNCH_COMPACT_WORDMARK.join(" / ")
}

function sanitizeChromeStatuses(
  statuses: ReadonlyMap<string, string> | undefined,
): string[] {
  return [...(statuses ?? new Map())]
    .filter(
      ([key, value]) => key !== "brunch.chrome" && value.trim().length > 0,
    )
    .map(([, value]) => value.trim())
}

function alignChromeColumns(
  left: string,
  right: string,
  width: number,
): string {
  const available = Math.max(0, width)
  const gap = Math.max(1, available - visibleWidth(left) - visibleWidth(right))
  return truncateToWidth(`${left}${" ".repeat(gap)}${right}`, available)
}

export function chromeStateForWorkspace(
  workspace: WorkspaceSessionReadyState,
): BrunchChromeState {
  return {
    ...workspace.chrome,
    session: {
      id: workspace.session.id,
      label: workspace.session.name ?? workspace.session.id,
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
      render: (width: number) =>
        projectBrunchChromeFooterLines(
          chrome,
          {
            gitBranch: footerData.getGitBranch(),
            statuses: footerData.getExtensionStatuses(),
          },
          width,
        ),
      invalidate: () => {},
      dispose: unsubscribe,
    }
  })
  ui.setWidget("brunch.chrome", formatChromeWidgetLines(chrome), {
    placement: "aboveEditor",
  })
  ui.setTitle(`brunch — ${chrome.spec?.title ?? chrome.cwd}`)
}

export function registerBrunchChrome(
  pi: ExtensionAPI,
  chrome: BrunchChromeState,
): void {
  pi.on("session_start", async (_event, ctx) => {
    renderBrunchChrome(ctx.ui, chrome)
  })
}

export default function brunchChrome(_pi: ExtensionAPI): void {}

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
