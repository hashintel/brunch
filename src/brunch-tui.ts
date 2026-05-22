import { createInterface } from "node:readline/promises"
import process from "node:process"

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
  type CreateAgentSessionRuntimeFactory,
  type ExtensionFactory,
  type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent"

import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionChromeState,
  type WorkspaceSessionCoordinator,
  type WorkspaceSessionReadyState,
} from "./workspace-session-coordinator.js"

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState
  coordinator: WorkspaceSessionCoordinator
}

export interface BrunchTuiOptions {
  cwd?: string
  coordinator?: WorkspaceSessionCoordinator
  selectSpecTitle?: () => Promise<string | undefined>
  launchInteractive?: (context: BrunchTuiLaunchContext) => Promise<void>
}

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

type BrunchChromeInputState = WorkspaceSessionChromeState | BrunchChromeState

export async function runBrunchTui(
  options: BrunchTuiOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const coordinator =
    options.coordinator ?? createWorkspaceSessionCoordinator({ cwd })

  let workspaceState = await coordinator.openExisting()
  if (workspaceState.status === "select_spec") {
    const title = await (options.selectSpecTitle ?? promptForSpecTitle)()
    if (!title) {
      return
    }
    workspaceState = await coordinator.startOrCreate({ specTitle: title })
  }

  if (workspaceState.status === "needs_human") {
    throw new Error(workspaceState.reason)
  }

  await (options.launchInteractive ?? launchPiInteractive)({
    workspace: workspaceState,
    coordinator,
  })
}

export function formatBrunchChromeHeaderLines(
  state: BrunchChromeInputState,
): string[] {
  const chrome = normalizeBrunchChromeState(state)
  return [
    "brunch specification workspace",
    `${formatSpec(chrome)} · ${formatSession(chrome)} · ${chrome.phase}`,
  ]
}

export function formatChromeWidgetLines(
  state: BrunchChromeInputState,
): string[] {
  const chrome = normalizeBrunchChromeState(state)
  return [
    `cwd: ${chrome.cwd}`,
    `spec: ${formatSpec(chrome)}  session: ${formatSession(chrome)}  stage: ${chrome.stage}`,
    `lens: ${chrome.activeLens ?? "none"}  coherence: ${chrome.coherenceVerdict}  needs: ${chrome.reconciliationNeedCount}`,
    `observer: ${chrome.observerStatus}  reviewer: ${chrome.reviewerStatus}  reconciler: ${chrome.reconcilerStatus}`,
  ]
}

export function formatBrunchChromeFooterLines(
  state: BrunchChromeInputState,
): string[] {
  const chrome = normalizeBrunchChromeState(state)
  const offer = chrome.latestEstablishmentOfferSummary
    ? `offer: ${chrome.latestEstablishmentOfferSummary}`
    : "offer: none"
  return [
    `observer: ${chrome.observerStatus} · reviewer: ${chrome.reviewerStatus} · reconciler: ${chrome.reconcilerStatus}`,
    offer,
  ]
}

export function renderBrunchChrome(
  ui: Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setWorkingIndicator" | "setTitle">,
  state: BrunchChromeInputState,
): void {
  const chrome = normalizeBrunchChromeState(state)
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

function normalizeBrunchChromeState(
  state: BrunchChromeInputState,
): BrunchChromeState {
  if ("session" in state) {
    return state
  }
  return {
    ...state,
    session: { id: "unbound" },
    stage: state.phase === "elicitation" ? "idle" : "idle",
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

function formatSpec(chrome: BrunchChromeState): string {
  return chrome.spec?.title ?? "no spec selected"
}

function formatSession(chrome: BrunchChromeState): string {
  return chrome.session.label ?? chrome.session.id
}

export function createBrunchChromeExtension(
  chrome: WorkspaceSessionChromeState,
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

async function promptForSpecTitle(): Promise<string | undefined> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question("Create/select Brunch spec title: ")
    const title = answer.trim()
    return title.length > 0 ? title : undefined
  } finally {
    rl.close()
  }
}

async function launchPiInteractive({
  workspace,
  coordinator,
}: BrunchTuiLaunchContext): Promise<void> {
  const agentDir = getAgentDir()
  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    agentDir: runtimeAgentDir,
    sessionManager,
  }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir: runtimeAgentDir,
      resourceLoaderOptions: {
        extensionFactories: [
          createBrunchChromeExtension(
            workspace.chrome,
            async (sessionManager) => {
              await coordinator.bindCurrentSpecToSession(sessionManager)
            },
          ),
        ],
      },
    })
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
    })
    return {
      ...created,
      services,
      diagnostics: services.diagnostics,
    }
  }

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: workspace.cwd,
    agentDir,
    sessionManager: workspace.session.manager,
  })

  await new InteractiveMode(runtime).run()
}
