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

import {
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  createInMemoryBrunchIntrospectionStore,
  type BrunchIntrospectionStore,
} from '../.pi/brunch-pi-extensions.js';
import { applyBrunchOfflineDefault, createBrunchPiSettings } from '../.pi/brunch-pi-settings.js';
import { runWorkspaceDialogPreflight } from '../.pi/components/workspace-dialog.js';
import {
  openWorkspaceGraphRuntime,
  type EdgeCategory,
  type GraphSlice,
  type NodeKind,
  type ReadinessBand,
  type WorkspaceGraphRuntime,
} from '../graph/index.js';
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
import { isBrunchDevEnabled } from './brunch-dev.js';
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
} from '../.pi/brunch-pi-extensions.js';
export { runWorkspaceDialogPreflight } from '../.pi/components/workspace-dialog.js';

type BrunchTuiCoordinator = SpecSessionActivationCoordinator & WorkspaceSessionBoundaryCoordinator;

interface BrunchWebSidecarRunnerOptions {
  cwd: string;
  coordinator: BrunchTuiCoordinator;
  productUpdates: ProductUpdatePublisher;
  routePath: string;
}

type BrunchWebSidecar = Pick<RunningWebHost, 'url' | 'close'>;

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState;
  coordinator: BrunchTuiCoordinator;
  productUpdates?: ProductUpdatePublisher;
  dev?: BrunchTuiDevOptions;
}

export interface BrunchTuiDevOptions {
  readonly introspection: {
    readonly enabled: true;
    readonly store: BrunchIntrospectionStore;
  };
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
  const dev = createBrunchTuiDevOptions();

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
      ...(dev ? { dev } : {}),
    });
  } finally {
    await webSidecar?.close();
  }
}

function createBrunchTuiDevOptions(): BrunchTuiDevOptions | undefined {
  if (!isBrunchDevEnabled()) return undefined;
  return {
    introspection: {
      enabled: true,
      store: createInMemoryBrunchIntrospectionStore(),
    },
  };
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

type EdgeCompatibleNodeKinds = readonly NodeKind[];
type EdgeCompatibleReadinessBands = readonly ReadinessBand[];

type LegacyGraphOptions = { readonly show?: 'active' | 'all' } | undefined;

function toReadOptions(options: LegacyGraphOptions): { readonly visibility?: 'active' | 'all' } | undefined {
  return options?.show === undefined ? undefined : { visibility: options.show };
}

function graphSliceWithCounts(slice: GraphSlice) {
  return { ...slice, nodeCount: slice.nodes.length, edgeCount: slice.edges.length };
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function legacyRelatedNodes(
  readers: ReturnType<WorkspaceGraphRuntime['forSpec']>,
  options: {
    readonly anchorIds: readonly number[];
    readonly edgeCategory: EdgeCategory;
    readonly direction?: 'outgoing' | 'incoming' | 'both';
    readonly hops?: number;
    readonly show?: 'active' | 'all';
  },
) {
  const results = readers.getNodes(
    options.anchorIds.map((id) => ({ id })),
    { ...toReadOptions(options), hops: options.hops ?? 1 },
  );
  if (results.some((result) => result.status === 'not_found')) {
    return { status: 'not_found' as const };
  }
  const anchors = results
    .map((result) => (result.status === 'found' ? result.node : undefined))
    .filter(isPresent);
  const edges = results
    .flatMap((result) => (result.status === 'found' ? result.edges : []))
    .filter((edge) => edge.category === options.edgeCategory);
  const relatedIds = new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId]));
  for (const anchor of anchors) relatedIds.delete(anchor.id);
  const relatedNodesById = new Map(
    results.flatMap((result) =>
      result.status === 'found' ? result.related.map((node) => [node.id, node] as const) : [],
    ),
  );
  return {
    status: 'success' as const,
    anchors,
    relatedNodes: [...relatedIds].map((id) => relatedNodesById.get(id)).filter(isPresent),
    edges,
  };
}

export function createBrunchAgentSessionRuntimeFactory(
  context: BrunchTuiLaunchContext,
): CreateAgentSessionRuntimeFactory {
  const { coordinator, productUpdates } = context;
  return async ({ cwd, agentDir: runtimeAgentDir, sessionManager }) => {
    let currentWorkspace = await coordinator.bindCurrentSpecToReplacementSession(sessionManager);
    const graph = await openWorkspaceGraphRuntime(cwd);
    const graphDeps = {
      get specId() {
        return currentWorkspace.spec.id;
      },
      commandExecutor: graph.commandExecutor,
      reads: {
        queryGraph: (
          filter?: Parameters<ReturnType<WorkspaceGraphRuntime['forSpec']>['queryGraph']>[0],
          options?: Parameters<ReturnType<WorkspaceGraphRuntime['forSpec']>['queryGraph']>[1],
        ) => graph.forSpec(currentWorkspace.spec.id).queryGraph(filter, options),
        getOverview: (options?: { show?: 'active' | 'all' }) =>
          graphSliceWithCounts(
            graph.forSpec(currentWorkspace.spec.id).queryGraph(undefined, toReadOptions(options)),
          ),
        getGraphOverview: (options?: { show?: 'active' | 'all' }) =>
          graphSliceWithCounts(
            graph.forSpec(currentWorkspace.spec.id).queryGraph(undefined, toReadOptions(options)),
          ),
        getGraphSliceByKinds: (options: { show?: 'active' | 'all'; kinds: readonly string[] }) =>
          graphSliceWithCounts(
            graph
              .forSpec(currentWorkspace.spec.id)
              .queryGraph({ kinds: options.kinds as EdgeCompatibleNodeKinds }, toReadOptions(options)),
          ),
        getGraphSliceByReadinessBands: (options: {
          show?: 'active' | 'all';
          readinessBands: readonly string[];
        }) =>
          graphSliceWithCounts(
            graph
              .forSpec(currentWorkspace.spec.id)
              .queryGraph(
                { bands: options.readinessBands as EdgeCompatibleReadinessBands },
                toReadOptions(options),
              ),
          ),
        getGraphGaps: (options: {
          show?: 'active' | 'all';
          kinds?: readonly string[];
          readinessBands?: readonly string[];
          absentEdgeCategory: EdgeCategory;
          direction?: 'outgoing' | 'incoming' | 'both';
        }) =>
          graphSliceWithCounts(
            graph.forSpec(currentWorkspace.spec.id).queryGraph(
              {
                ...(options.kinds != null ? { kinds: options.kinds as EdgeCompatibleNodeKinds } : {}),
                ...(options.readinessBands != null
                  ? { bands: options.readinessBands as EdgeCompatibleReadinessBands }
                  : {}),
                lacksEdge: {
                  categories: [options.absentEdgeCategory],
                  ...(options.direction !== undefined ? { direction: options.direction } : {}),
                },
              },
              toReadOptions(options),
            ),
          ),
        getRelatedNodes: (options: {
          anchorIds: readonly number[];
          edgeCategory: EdgeCategory;
          direction?: 'outgoing' | 'incoming' | 'both';
          hops?: number;
          show?: 'active' | 'all';
        }) => legacyRelatedNodes(graph.forSpec(currentWorkspace.spec.id), options),
        getNodes: (
          selectors: readonly ({ id: number } | { code: string })[],
          options?: { hops?: number; show?: 'active' | 'all' },
        ) => graph.forSpec(currentWorkspace.spec.id).getNodes(selectors, toReadOptions(options)),
        getNodeNeighborhood: (nodeId: number, options?: { hops?: number; show?: 'active' | 'all' }) => {
          const [result] = graph
            .forSpec(currentWorkspace.spec.id)
            .getNodes([{ id: nodeId }], { ...toReadOptions(options), hops: options?.hops ?? 1 });
          return !result || result.status === 'not_found'
            ? { status: 'not_found' as const }
            : {
                status: 'success' as const,
                anchor: result.node,
                neighbors: result.related,
                edges: result.edges,
              };
        },
        resolveNodeCode: (code: string) => graph.forSpec(currentWorkspace.spec.id).resolveNodeCode(code),
      },
      ...(productUpdates && { productUpdates }),
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
          ...(context.dev ? { introspection: context.dev.introspection } : {}),
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

  await runWithScopedBrunchOfflineDefault({
    dev: context.dev?.introspection.enabled === true,
    env: process.env,
    run: async () => {
      await new InteractiveMode(runtime).run();
    },
  });
}

export async function runWithScopedBrunchOfflineDefault(options: {
  readonly dev: boolean;
  readonly env?: { PI_OFFLINE?: string; PI_SKIP_VERSION_CHECK?: string };
  readonly run: () => Promise<void>;
}): Promise<void> {
  const env = options.env ?? process.env;
  const previousOffline = env.PI_OFFLINE;
  const previousSkipVersionCheck = env.PI_SKIP_VERSION_CHECK;
  const hadPreviousOffline = Object.hasOwn(env, 'PI_OFFLINE');
  const hadPreviousSkipVersionCheck = Object.hasOwn(env, 'PI_SKIP_VERSION_CHECK');
  try {
    applyBrunchOfflineDefault(env);
    await options.run();
  } finally {
    if (hadPreviousOffline && previousOffline !== undefined) {
      env.PI_OFFLINE = previousOffline;
    } else {
      delete env.PI_OFFLINE;
    }
    if (hadPreviousSkipVersionCheck && previousSkipVersionCheck !== undefined) {
      env.PI_SKIP_VERSION_CHECK = previousSkipVersionCheck;
    } else {
      delete env.PI_SKIP_VERSION_CHECK;
    }
  }
}
