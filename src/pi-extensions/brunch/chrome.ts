import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent"

import type {
  WorkspaceSessionChromeState,
  WorkspaceSessionReadyState,
} from "../../workspace-session-coordinator.js"

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

export type BrunchChromeUi = Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setWorkingIndicator" | "setTitle">

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
  ui: BrunchChromeUi,
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

function formatSpec(chrome: BrunchChromeState): string {
  return chrome.spec?.title ?? "no spec selected"
}

function formatSession(chrome: BrunchChromeState): string {
  return chrome.session.label ?? chrome.session.id
}
