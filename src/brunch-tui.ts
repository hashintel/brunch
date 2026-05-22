import process from "node:process"

import { ProcessTerminal, TUI } from "@earendil-works/pi-tui"

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SettingsManager,
  type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent"

import {
  createWorkspaceSessionCoordinator,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionBoundaryCoordinator,
  type WorkspaceSessionReadyState,
  type WorkspaceSwitchCoordinator,
  type WorkspaceSwitchDecision,
} from "./workspace-session-coordinator.js"
import {
  chromeStateForWorkspace,
  createBrunchChromeExtension,
} from "./pi-extensions/brunch/index.js"
import { createWorkspaceSwitchComponent } from "./workspace-switcher.js"

export {
  BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE,
  chromeStateForWorkspace,
  createBrunchChromeExtension,
  formatBrunchChromeFooterLines,
  formatBrunchChromeHeaderLines,
  formatChromeWidgetLines,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeWorkerStatus,
} from "./pi-extensions/brunch/index.js"

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState
  coordinator: WorkspaceSessionBoundaryCoordinator
}

export type BrunchTuiCoordinator = WorkspaceSwitchCoordinator & WorkspaceSessionBoundaryCoordinator

export interface BrunchTuiOptions {
  cwd?: string
  coordinator?: BrunchTuiCoordinator
  selectSpecTitle?: () => Promise<string | undefined>
  runWorkspaceSwitchPreflight?: (
    inventory: WorkspaceLaunchInventory,
  ) => Promise<WorkspaceSwitchDecision>
  launchInteractive?: (context: BrunchTuiLaunchContext) => Promise<void>
}

export async function runBrunchTui(
  options: BrunchTuiOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const coordinator =
    options.coordinator ?? createWorkspaceSessionCoordinator({ cwd })

  const inventory = await coordinator.inspectWorkspace()
  const decision = await chooseWorkspaceSwitchDecision(inventory, options)
  const workspaceState = await coordinator.activateWorkspace(decision)

  if (workspaceState.status === "cancelled") {
    return
  }
  if (workspaceState.status === "needs_human") {
    throw new Error(workspaceState.reason)
  }

  await (options.launchInteractive ?? launchPiInteractive)({
    workspace: workspaceState,
    coordinator,
  })
}

async function chooseWorkspaceSwitchDecision(
  inventory: WorkspaceLaunchInventory,
  options: BrunchTuiOptions,
): Promise<WorkspaceSwitchDecision> {
  if (options.runWorkspaceSwitchPreflight) {
    return options.runWorkspaceSwitchPreflight(inventory)
  }
  if (options.selectSpecTitle && inventory.needsNewSpec) {
    const title = await options.selectSpecTitle()
    return title ? { action: "newSpec", title } : { action: "cancel" }
  }
  return runWorkspaceSwitchPreflight(inventory)
}

export async function runWorkspaceSwitchPreflight(
  inventory: WorkspaceLaunchInventory,
): Promise<WorkspaceSwitchDecision> {
  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal)

  return await new Promise<WorkspaceSwitchDecision>((resolve) => {
    const finish = (decision: WorkspaceSwitchDecision) => {
      tui.stop()
      resolve(decision)
    }
    const component = createWorkspaceSwitchComponent({
      inventory,
      onDecision: finish,
    })
    tui.addChild(component)
    tui.setFocus(component)
    terminal.clearScreen()
    tui.start()
  })
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
    const settingsManager = createBrunchSettingsManager(cwd, runtimeAgentDir)
    const services = await createAgentSessionServices({
      cwd,
      agentDir: runtimeAgentDir,
      settingsManager,
      resourceLoaderOptions: {
        noContextFiles: true,
        noExtensions: true,
        noPromptTemplates: true,
        noSkills: true,
        noThemes: true,
        extensionFactories: [
          createBrunchChromeExtension(
            chromeStateForWorkspace(workspace),
            async (sessionManager) => {
              await coordinator.bindCurrentSpecToReplacementSession(
                sessionManager,
              )
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

  process.env.PI_OFFLINE ??= "1"
  await new InteractiveMode(runtime).run()
}

function createBrunchSettingsManager(
  cwd: string,
  agentDir: string,
): SettingsManager {
  const settingsManager = SettingsManager.create(cwd, agentDir)
  settingsManager.getQuietStartup = () => true
  return settingsManager
}
