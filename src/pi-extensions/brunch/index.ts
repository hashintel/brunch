import {
  SessionManager,
  type ExtensionFactory,
  type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent"

import type {
  WorkspaceSessionChromeState,
  WorkspaceSessionReadyState,
} from "../../workspace-session-coordinator.js"

export const BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE =
  "Brunch does not support Pi session branches in this POC. Use /new to continue within the selected spec."

export type BrunchChromeStage = "idle" | "streaming" | "observer-review"
export type BrunchChromeWorkerStatus = "idle" | "queued" | "running" | "blocked"
export type BrunchChromeCoherenceVerdict = "unknown" | "coherent" | "needs_review" | "incoherent"

export interface BrunchChromeState extends WorkspaceSessionChromeState {
  session: {
    id: string
    label?: string
  }
  stage: BrunchChromeStage
  activeLens: string | null
  coherenceVerdict: BrunchChromeCoherenceVerdict
  observerStatus: BrunchChromeWorkerStatus
  reviewerStatus: BrunchChromeWorkerStatus
  reconcilerStatus: BrunchChromeWorkerStatus
  reconciliationNeedCount: number
  latestEstablishmentOfferSummary: string | null
  streaming: boolean
}

export function formatBrunchChromeHeaderLines(
  chrome: BrunchChromeState,
): string[] {
  return [
    "brunch specification workspace",
    `${formatSpec(chrome)} · ${formatSession(chrome)} · ${chrome.phase}`,
  ]
}

export function formatChromeWidgetLines(chrome: BrunchChromeState): string[] {
  return [
    `cwd: ${chrome.cwd}`,
    `spec: ${formatSpec(chrome)}  session: ${formatSession(chrome)}  stage: ${chrome.stage}`,
    `lens: ${chrome.activeLens ?? "none"}  coherence: ${chrome.coherenceVerdict}  needs: ${chrome.reconciliationNeedCount}`,
    `observer: ${chrome.observerStatus}  reviewer: ${chrome.reviewerStatus}  reconciler: ${chrome.reconcilerStatus}`,
  ]
}

export function formatBrunchChromeFooterLines(
  chrome: BrunchChromeState,
): string[] {
  const offer = chrome.latestEstablishmentOfferSummary
    ? `offer: ${chrome.latestEstablishmentOfferSummary}`
    : "offer: none"
  return [
    `observer: ${chrome.observerStatus} · reviewer: ${chrome.reviewerStatus} · reconciler: ${chrome.reconcilerStatus}`,
    offer,
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
    stage: "idle",
    activeLens: null,
    coherenceVerdict: "unknown",
    observerStatus: "idle",
    reviewerStatus: "idle",
    reconcilerStatus: "idle",
    reconciliationNeedCount: 0,
    latestEstablishmentOfferSummary: null,
    streaming: false,
  }
}

export function renderBrunchChrome(
  ui: Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setWorkingIndicator" | "setTitle">,
  chrome: BrunchChromeState,
): void {
  ui.setHeader(() => ({
    render: () => formatBrunchChromeHeaderLines(chrome),
    invalidate: () => {},
  }))
  ui.setFooter(() => ({
    render: () => formatBrunchChromeFooterLines(chrome),
    invalidate: () => {},
  }))
  ui.setStatus(
    "brunch.chrome",
    `Brunch · ${chrome.phase} · ${chrome.activeLens ?? "no active lens"} · ${chrome.coherenceVerdict} · needs ${chrome.reconciliationNeedCount}`,
  )
  ui.setWidget("brunch.chrome", formatChromeWidgetLines(chrome), {
    placement: "aboveEditor",
  })
  ui.setWorkingIndicator(
    chrome.streaming ? { frames: ["●"], intervalMs: 120 } : undefined,
  )
  ui.setTitle(`brunch — ${chrome.spec?.title ?? chrome.cwd}`)
}

export function createBrunchChromeExtension(
  chrome: BrunchChromeState,
  onSessionBoundary?: (sessionManager: SessionManager) => Promise<void> | void,
): ExtensionFactory {
  return (pi) => {
    pi.on("session_start", async (_event, ctx) => {
      await onSessionBoundary?.(ctx.sessionManager as SessionManager)
      renderBrunchChrome(ctx.ui, chrome)
    })
    pi.on("before_agent_start", async (_event, ctx) => {
      await onSessionBoundary?.(ctx.sessionManager as SessionManager)
    })
    pi.on("message_start", async (event, ctx) => {
      if (event.message.role === "assistant") {
        await onSessionBoundary?.(ctx.sessionManager as SessionManager)
      }
    })
    pi.on("session_before_tree", (_event, ctx) => {
      ctx.ui.notify(BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE, "warning")
      return { cancel: true }
    })
    pi.on("session_before_fork", (_event, ctx) => {
      ctx.ui.notify(BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE, "warning")
      return { cancel: true }
    })
  }
}

function formatSpec(chrome: BrunchChromeState): string {
  return chrome.spec?.title ?? "no spec selected"
}

function formatSession(chrome: BrunchChromeState): string {
  return chrome.session.label ?? chrome.session.id
}
