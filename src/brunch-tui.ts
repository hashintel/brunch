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

export function formatChromeWidgetLines(
  chrome: WorkspaceSessionChromeState,
): string[] {
  const spec = chrome.spec ? chrome.spec.title : "<none>"
  return [
    `brunch  cwd: ${chrome.cwd}`,
    `        spec: ${spec}  phase: ${chrome.phase}  chat: ${chrome.chatMode}`,
  ]
}

export function createBrunchChromeExtension(
  chrome: WorkspaceSessionChromeState,
  onSessionBoundary?: (sessionManager: SessionManager) => Promise<void> | void,
): ExtensionFactory {
  return (pi) => {
    pi.on("session_start", async (_event, ctx) => {
      await onSessionBoundary?.(ctx.sessionManager as SessionManager)
      ctx.ui.setWidget("brunch.chrome", formatChromeWidgetLines(chrome), {
        placement: "aboveEditor",
      })
      ctx.ui.setTitle(`brunch — ${chrome.spec?.title ?? chrome.cwd}`)
    })
    pi.on("before_agent_start", async (_event, ctx) => {
      await onSessionBoundary?.(ctx.sessionManager as SessionManager)
    })
    pi.on("message_start", async (event, ctx) => {
      if (event.message.role === "assistant") {
        await onSessionBoundary?.(ctx.sessionManager as SessionManager)
      }
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
