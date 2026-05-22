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
}

export type BrunchChromeUi = Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setWorkingIndicator" | "setTitle">

export function formatBrunchChromeHeaderLines(
  chrome: BrunchChromeState,
): string[] {
  return [
    "brunch specification workspace",
    `${formatSpec(chrome)} · ${formatSession(chrome)}`,
  ]
}

export function formatBrunchStatus(chrome: BrunchChromeState): string {
  return `Brunch · ${chrome.phase} · ${chrome.coherenceVerdict} · needs ${chrome.reconciliationNeedCount}`
}

export function formatChromeWidgetLines(chrome: BrunchChromeState): string[] {
  const lines = [
    `cwd: ${chrome.cwd}`,
    `chat mode: ${chrome.chatMode}  stage: ${chrome.stage}`,
    `lens: ${chrome.activeLens ?? "none"}`,
    `workers: observer ${chrome.observerStatus} · reviewer ${chrome.reviewerStatus} · reconciler ${chrome.reconcilerStatus}`,
  ]
  if (chrome.latestEstablishmentOfferSummary) {
    lines.push(`offer: ${chrome.latestEstablishmentOfferSummary}`)
  }
  return lines
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
  ui.setFooter(undefined)
  ui.setStatus("brunch.chrome", formatBrunchStatus(chrome))
  ui.setWidget("brunch.chrome", formatChromeWidgetLines(chrome), {
    placement: "aboveEditor",
  })
  ui.setWorkingIndicator(undefined)
  ui.setTitle(`brunch — ${chrome.spec?.title ?? chrome.cwd}`)
}

function formatSpec(chrome: BrunchChromeState): string {
  return chrome.spec?.title ?? "no spec selected"
}

function formatSession(chrome: BrunchChromeState): string {
  return chrome.session.label ?? chrome.session.id
}
