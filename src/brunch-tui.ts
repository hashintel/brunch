import process from 'node:process';

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  type CreateAgentSessionRuntimeFactory,
} from '@earendil-works/pi-coding-agent';

import { applyBrunchOfflineDefault, createBrunchPiProfile } from './.pi/brunch-pi-profile.js';
import { runWorkspaceDialogPreflight } from './.pi/components/workspace-dialog.js';
import { chromeStateForWorkspace, createBrunchPiExtensionShell } from './.pi/pi-extension-shell.js';
import { openWorkspaceGraphRuntime } from './graph/index.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionBoundaryCoordinator,
  type WorkspaceSessionReadyState,
  type SpecSessionActivationCoordinator,
  type SpecSessionActivationDecision,
} from './session/workspace-session-coordinator.js';
export {
  BRUNCH_SETTINGS_AUDITED_GETTERS,
  BRUNCH_SETTINGS_POLICY,
  applyBrunchOfflineDefault,
  brunchResourceLoaderOptions,
  createBrunchPiProfile,
  createBrunchSettingsManager,
} from './.pi/brunch-pi-profile.js';
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
} from './.pi/pi-extension-shell.js';
export { runWorkspaceDialogPreflight } from './.pi/components/workspace-dialog.js';

export type BrunchTuiCoordinator = SpecSessionActivationCoordinator & WorkspaceSessionBoundaryCoordinator;

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState;
  coordinator: BrunchTuiCoordinator;
}

export interface BrunchTuiOptions {
  cwd?: string;
  coordinator?: BrunchTuiCoordinator;
  selectSpecTitle?: () => Promise<string | undefined>;
  runWorkspaceDialogPreflight?: (
    inventory: WorkspaceLaunchInventory,
  ) => Promise<SpecSessionActivationDecision>;
  launchInteractive?: (context: BrunchTuiLaunchContext) => Promise<void>;
}

export async function runBrunchTui(options: BrunchTuiOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const coordinator = options.coordinator ?? createWorkspaceSessionCoordinator({ cwd });

  const inventory = await coordinator.inspectWorkspace();
  const decision = await chooseSpecSessionActivationDecision(inventory, options);
  const workspaceState = await coordinator.activateWorkspace(decision);

  if (workspaceState.status === 'cancelled') {
    return;
  }
  if (workspaceState.status === 'needs_human') {
    throw new Error(workspaceState.reason);
  }

  await (options.launchInteractive ?? launchPiInteractive)({
    workspace: workspaceState,
    coordinator,
  });
}

async function chooseSpecSessionActivationDecision(
  inventory: WorkspaceLaunchInventory,
  options: BrunchTuiOptions,
): Promise<SpecSessionActivationDecision> {
  if (options.runWorkspaceDialogPreflight) {
    return options.runWorkspaceDialogPreflight(inventory);
  }
  if (options.selectSpecTitle && inventory.needsNewSpec) {
    const title = await options.selectSpecTitle();
    return title ? { action: 'newSpec', title } : { action: 'cancel' };
  }
  return runWorkspaceDialogPreflight(inventory);
}

export function createBrunchAgentSessionRuntimeFactory({
  workspace,
  coordinator,
}: BrunchTuiLaunchContext): CreateAgentSessionRuntimeFactory {
  return async ({ cwd, agentDir: runtimeAgentDir, sessionManager }) => {
    const graph = await openWorkspaceGraphRuntime(cwd);
    const profile = createBrunchPiProfile({
      cwd,
      agentDir: runtimeAgentDir,
      extensionFactories: [
        createBrunchPiExtensionShell(
          chromeStateForWorkspace(workspace),
          async (replacementSessionManager) => {
            await coordinator.bindCurrentSpecToReplacementSession(replacementSessionManager);
          },
          { coordinator, graph },
        ),
      ],
    });
    const services = await createAgentSessionServices({
      cwd,
      agentDir: runtimeAgentDir,
      settingsManager: profile.settingsManager,
      resourceLoaderOptions: profile.resourceLoaderOptions,
    });
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
    });
    return {
      ...created,
      services,
      diagnostics: services.diagnostics,
    };
  };
}

async function launchPiInteractive(context: BrunchTuiLaunchContext): Promise<void> {
  const agentDir = getAgentDir();
  const createRuntime = createBrunchAgentSessionRuntimeFactory(context);

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: context.workspace.cwd,
    agentDir,
    sessionManager: context.workspace.session.manager,
  });

  applyBrunchOfflineDefault();
  await new InteractiveMode(runtime).run();
}
