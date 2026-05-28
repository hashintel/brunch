import process from "node:process"

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SettingsManager,
  type CreateAgentSessionRuntimeFactory,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import {
  createWorkspaceSessionCoordinator,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionBoundaryCoordinator,
  type WorkspaceSessionReadyState,
  type SpecSessionActivationCoordinator,
  type SpecSessionActivationDecision,
} from "./workspace-session-coordinator.js"
import {
  chromeStateForWorkspace,
  createBrunchPiExtensionShell,
} from "./tui-client/pi-extension-shell.js"
import { runWorkspaceDialogPreflight } from "./tui-client/.pi/components/workspace-dialog.js"
export {
  BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE,
  chromeStateForWorkspace,
  createBrunchPiExtensionShell,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeFooterTelemetry,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeWorkerStatus,
} from "./tui-client/pi-extension-shell.js"
export { runWorkspaceDialogPreflight } from "./tui-client/.pi/components/workspace-dialog.js"

export type BrunchTuiCoordinator = SpecSessionActivationCoordinator & WorkspaceSessionBoundaryCoordinator

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState
  coordinator: BrunchTuiCoordinator
}

export interface BrunchTuiOptions {
  cwd?: string
  coordinator?: BrunchTuiCoordinator
  selectSpecTitle?: () => Promise<string | undefined>
  runWorkspaceDialogPreflight?: (
    inventory: WorkspaceLaunchInventory,
  ) => Promise<SpecSessionActivationDecision>
  launchInteractive?: (context: BrunchTuiLaunchContext) => Promise<void>
}

export async function runBrunchTui(
  options: BrunchTuiOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd()
  const coordinator =
    options.coordinator ?? createWorkspaceSessionCoordinator({ cwd })

  const inventory = await coordinator.inspectWorkspace()
  const decision = await chooseSpecSessionActivationDecision(inventory, options)
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

async function chooseSpecSessionActivationDecision(
  inventory: WorkspaceLaunchInventory,
  options: BrunchTuiOptions,
): Promise<SpecSessionActivationDecision> {
  if (options.runWorkspaceDialogPreflight) {
    return options.runWorkspaceDialogPreflight(inventory)
  }
  if (options.selectSpecTitle && inventory.needsNewSpec) {
    const title = await options.selectSpecTitle()
    return title ? { action: "newSpec", title } : { action: "cancel" }
  }
  return runWorkspaceDialogPreflight(inventory)
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
      resourceLoaderOptions: brunchResourceLoaderOptions([
        createBrunchPiExtensionShell(
          chromeStateForWorkspace(workspace),
          async (sessionManager) => {
            await coordinator.bindCurrentSpecToReplacementSession(
              sessionManager,
            )
          },
          { coordinator },
        ),
      ]),
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

  applyBrunchOfflineDefault()
  await new InteractiveMode(runtime).run()
}

export function brunchResourceLoaderOptions(
  extensionFactories: ExtensionFactory[],
) {
  return {
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    extensionFactories,
  }
}

export function applyBrunchOfflineDefault(
  env: { PI_OFFLINE?: string } = process.env,
): void {
  env.PI_OFFLINE ??= "1"
}

export function createBrunchSettingsManager(
  cwd: string,
  agentDir: string,
): SettingsManager {
  const settingsManager = SettingsManager.create(cwd, agentDir)
  settingsManager.getQuietStartup = () => true
  return settingsManager
}
