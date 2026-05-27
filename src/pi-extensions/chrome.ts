import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent"

import type {
  WorkspaceSessionChromeState,
  WorkspaceSessionReadyState,
} from "../workspace-session-coordinator.js"

export type BrunchChromeStage = "idle" | "streaming" | "observer-review"
export type BrunchChromeWorkerStatus = "idle" | "queued" | "running" | "blocked"
export type BrunchChromeCoherenceVerdict = "unknown" | "coherent" | "needs_review" | "incoherent"

export interface BrunchChromeState extends WorkspaceSessionChromeState {
  session: {
    id: string
    label?: string
  }
}

export type BrunchChromeUi = Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setTitle">

export function formatBrunchChromeHeaderLines(
  chrome: BrunchChromeState,
): string[] {
  return [
    "brunch specification workspace",
    `cwd: ${chrome.cwd}`,
    `${formatSpec(chrome)} · ${formatSession(chrome)}`,
  ]
}

export function formatBrunchChromeFooterLines(
  chrome: BrunchChromeState,
): string[] {
  return [
    `phase: ${chrome.phase} · chat: ${chrome.chatMode}`,
    `spec: ${formatSpec(chrome)} · session: ${formatSession(chrome)}`,
    "",
  ]
}

export function formatBrunchStatus(chrome: BrunchChromeState): string {
  return `Brunch · ${chrome.phase} · ${formatSpec(chrome)}`
}

export function formatChromeWidgetLines(chrome: BrunchChromeState): string[] {
  return [
    `cwd: ${chrome.cwd}`,
    `spec: ${formatSpec(chrome)}`,
    `session: ${formatSession(chrome)}`,
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
  ui.setFooter(() => ({
    render: () => formatBrunchChromeFooterLines(chrome),
    invalidate: () => {},
  }))
  ui.setStatus("brunch.chrome", formatBrunchStatus(chrome))
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
