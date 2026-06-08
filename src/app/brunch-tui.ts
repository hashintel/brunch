import { spawn } from 'node:child_process';
import process from 'node:process';

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  type CreateAgentSessionRuntimeFactory,
} from '@earendil-works/pi-coding-agent';

import { chromeStateForWorkspace, createBrunchPiExtensions } from '../.pi/brunch-pi-extensions.js';
import { applyBrunchOfflineDefault, createBrunchPiSettings } from '../.pi/brunch-pi-settings.js';
import { runWorkspaceDialogPreflight } from '../.pi/components/workspace-dialog.js';
import { openWorkspaceGraphRuntime } from '../graph/index.js';
import { createProductUpdatePublisher, type ProductUpdatePublisher } from '../rpc/product-updates.js';
import { startWebHost, type RunningWebHost } from '../rpc/web-host.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionBoundaryCoordinator,
  type WorkspaceSessionCoordinator,
  type WorkspaceSessionReadyState,
  type SpecSessionActivationCoordinator,
  type SpecSessionActivationDecision,
} from '../session/workspace-session-coordinator.js';
export {
  BRUNCH_SETTINGS_AUDITED_GETTERS,
  BRUNCH_SETTINGS_POLICY,
  applyBrunchOfflineDefault,
  brunchResourceLoaderOptions,
  createBrunchPiSettings,
  createBrunchSettingsManager,
} from '../.pi/brunch-pi-settings.js';
export {
  BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE,
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeFooterTelemetry,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeWorkerStatus,
} from '../.pi/brunch-pi-extensions.js';
export { runWorkspaceDialogPreflight } from '../.pi/components/workspace-dialog.js';

export type BrunchTuiCoordinator = SpecSessionActivationCoordinator & WorkspaceSessionBoundaryCoordinator;

export interface BrunchWebSidecarRunnerOptions {
  cwd: string;
  coordinator: BrunchTuiCoordinator;
  productUpdates: ProductUpdatePublisher;
  routePath: string;
}

export type BrunchWebSidecar = Pick<RunningWebHost, 'url' | 'close'>;

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState;
  coordinator: BrunchTuiCoordinator;
  productUpdates?: ProductUpdatePublisher;
}

export interface BrunchTuiOptions {
  cwd?: string;
  coordinator?: BrunchTuiCoordinator;
  selectSpecTitle?: () => Promise<string | undefined>;
  runWorkspaceDialogPreflight?: (
    inventory: WorkspaceLaunchInventory,
  ) => Promise<SpecSessionActivationDecision>;
  launchInteractive?: (context: BrunchTuiLaunchContext) => Promise<void>;
  webSidecarRunner?: (options: BrunchWebSidecarRunnerOptions) => Promise<BrunchWebSidecar | null>;
  autoOpen?: boolean;
  openBrowser?: (url: string) => Promise<void>;
  advertiseWebSidecar?: (url: string) => void;
}

export async function runBrunchTui(options: BrunchTuiOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const coordinator = options.coordinator ?? createWorkspaceSessionCoordinator({ cwd });

  const productUpdates = createProductUpdatePublisher();
  const inventory = await coordinator.inspectWorkspace();
  const decision = await chooseSpecSessionActivationDecision(inventory, options);
  const workspaceState = await coordinator.activateWorkspace(decision);

  if (workspaceState.status === 'cancelled') {
    return;
  }
  if (workspaceState.status === 'needs_human') {
    throw new Error(workspaceState.reason);
  }

  const routePath = webSidecarRoutePath(workspaceState.spec.id);
  const webSidecar = await (options.webSidecarRunner ?? startDefaultWebSidecar)({
    cwd,
    coordinator,
    productUpdates,
    routePath,
  });
  const webSidecarUrl = webSidecar ? `${webSidecar.url}${routePath}` : null;
  if (webSidecarUrl) {
    (options.advertiseWebSidecar ?? advertiseWebSidecar)(webSidecarUrl);
    if (options.autoOpen !== false) {
      await (options.openBrowser ?? openBrowser)(webSidecarUrl);
    }
  }
  try {
    await (options.launchInteractive ?? launchPiInteractive)({
      workspace: workspaceState,
      coordinator,
      productUpdates,
    });
  } finally {
    await webSidecar?.close();
  }
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
  coordinator,
  productUpdates,
}: BrunchTuiLaunchContext): CreateAgentSessionRuntimeFactory {
  return async ({ cwd, agentDir: runtimeAgentDir, sessionManager }) => {
    let currentWorkspace = await coordinator.bindCurrentSpecToReplacementSession(sessionManager);
    const graph = await openWorkspaceGraphRuntime(cwd);
    const graphDeps = {
      get specId() {
        return currentWorkspace.spec.id;
      },
      commandExecutor: graph.commandExecutor,
      reads: {
        getOverview: (options?: { show?: 'active' | 'all' }) =>
          graph.forSpec(currentWorkspace.spec.id).getOverview(options),
        getGraphOverview: (options?: { show?: 'active' | 'all' }) =>
          graph.forSpec(currentWorkspace.spec.id).getOverview(options),
        getGraphSliceByKinds: (options: { show?: 'active' | 'all'; kinds: readonly string[] }) =>
          graph.forSpec(currentWorkspace.spec.id).getGraphSliceByKinds(options),
        getGraphSliceByReadinessBands: (options: {
          show?: 'active' | 'all';
          readinessBands: readonly string[];
        }) => graph.forSpec(currentWorkspace.spec.id).getGraphSliceByReadinessBands(options),
        getGraphGaps: (options: {
          show?: 'active' | 'all';
          kinds?: readonly string[];
          readinessBands?: readonly string[];
          absentEdgeCategory:
            | 'dependency'
            | 'proof'
            | 'support'
            | 'realization'
            | 'boundary'
            | 'composition'
            | 'association'
            | 'supersession';
          direction?: 'outgoing' | 'incoming' | 'both';
        }) => graph.forSpec(currentWorkspace.spec.id).getGraphGaps(options),
        getRelatedNodes: (options: {
          anchorIds: readonly number[];
          edgeCategory:
            | 'dependency'
            | 'proof'
            | 'support'
            | 'realization'
            | 'boundary'
            | 'composition'
            | 'association'
            | 'supersession';
          direction?: 'outgoing' | 'incoming' | 'both';
          hops?: number;
          show?: 'active' | 'all';
        }) => graph.forSpec(currentWorkspace.spec.id).getRelatedNodes(options),
        getNodes: (
          selectors: readonly ({ id: number } | { code: string })[],
          options?: { hops?: number; show?: 'active' | 'all' },
        ) => graph.forSpec(currentWorkspace.spec.id).getNodes(selectors, options),
        getNodeNeighborhood: (nodeId: number, options?: { hops?: number; show?: 'active' | 'all' }) =>
          graph.forSpec(currentWorkspace.spec.id).getNodeNeighborhood(nodeId, options),
        resolveNodeCode: (code: string) => graph.forSpec(currentWorkspace.spec.id).resolveNodeCode(code),
      },
      ...(productUpdates ? { productUpdates } : {}),
    };
    const bindCurrentWorkspace = async (replacementSessionManager: typeof sessionManager) => {
      currentWorkspace = await coordinator.bindCurrentSpecToReplacementSession(replacementSessionManager);
    };
    const profile = createBrunchPiSettings({
      cwd,
      agentDir: runtimeAgentDir,
      extensionFactories: [
        createBrunchPiExtensions(chromeStateForWorkspace(currentWorkspace), bindCurrentWorkspace, {
          coordinator,
          graph: graphDeps,
          promptContext: () => {
            const specId = currentWorkspace.spec.id;
            const selectedSpec = graph.commandExecutor.getSpec(specId);
            if (!selectedSpec) {
              throw new Error(`No selected spec found for Brunch prompt context: ${specId}`);
            }
            return {
              spec: {
                id: selectedSpec.id,
                name: selectedSpec.name,
                readinessGrade: selectedSpec.readinessGrade,
              },
              workspace: { cwd },
              session: {
                id: currentWorkspace.session.id,
                ...(currentWorkspace.session.name ? { label: currentWorkspace.session.name } : {}),
              },
              graphReads: graphDeps.reads,
            };
          },
        }),
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

async function startDefaultWebSidecar({
  cwd,
  coordinator,
  productUpdates,
}: BrunchWebSidecarRunnerOptions): Promise<BrunchWebSidecar> {
  const host = await startWebHost({
    cwd,
    coordinator: coordinator as WorkspaceSessionCoordinator,
    productUpdates,
  });
  return host;
}

function webSidecarRoutePath(specId: number): string {
  return `/spec/${specId}`;
}

function advertiseWebSidecar(url: string): void {
  process.stdout.write(`Brunch web sidecar listening on ${url}\n`);
}

async function openBrowser(url: string): Promise<void> {
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
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
