import { spawn } from 'node:child_process';
import process from 'node:process';

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  type CreateAgentSessionFromServicesOptions,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionServicesOptions,
} from '@earendil-works/pi-coding-agent';

import { runWorkspaceDialogPreflight } from '../.pi/components/workspace-dialog.js';
import type { GraphReaders } from '../.pi/extensions/brunch-data/index.js';
import {
  appendEntryContentToDebugCache,
  appendOriginationRecordToDebugCache,
} from '../.pi/extensions/dev-mode/index.js';
import { isBrunchDevelopmentRuntime } from '../build-info.js';
import {
  openWorkspaceGraphRuntime,
  type EdgeCategory,
  type GraphSlice,
  type NodeKind,
  type ReadinessBand,
  type WorkspaceGraphRuntime,
} from '../graph/index.js';
import type { SessionTurnDriver } from '../rpc/methods/session-driver.js';
import type { SessionExchangeAnswerHandle } from '../rpc/methods/session-exchange-answer.js';
import { createProductUpdatePublisher, type ProductUpdatePublisher } from '../rpc/product-updates.js';
import { createSessionEventRelay, type SessionEventRelay } from '../rpc/session-event-relay.js';
import { startWebHost, type RunningWebHost } from '../rpc/web-host.js';
import { createLiveExchangeBroker, type LiveExchangeBroker } from '../session/live-exchange-broker.js';
import {
  completeAssistantKick,
  originateAssistantTurn,
  type KickCompletionOutcome,
} from '../session/originate-assistant-turn.js';
import { renderWorkspaceOverviewContext } from '../session/workspace-overview-context.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionBoundaryCoordinator,
  type WorkspaceSessionCoordinator,
  type WorkspaceSessionReadyState,
  type SpecSessionActivationCoordinator,
  type SpecSessionActivationDecision,
} from '../session/workspace-session-coordinator.js';
import {
  BRUNCH_KICK_ACTIVITY_STATUS_KEY,
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  createInMemoryBrunchIntrospectionStore,
  type BrunchIntrospectionStore,
} from './pi-extensions.js';
import { projectBrunchPiSessionOptions } from './pi-session-options.js';
import { applyBrunchOfflineDefault, createBrunchPiSettings } from './pi-settings.js';
import { loadBrunchSubagents } from './pi-subagents.js';
export {
  BRUNCH_SETTINGS_AUDITED_GETTERS,
  BRUNCH_SETTINGS_POLICY,
  applyBrunchOfflineDefault,
  brunchResourceLoaderOptions,
  createBrunchPiSettings,
  createBrunchSettingsManager,
} from './pi-settings.js';
export {
  BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE,
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
} from './pi-extensions.js';
export { runWorkspaceDialogPreflight } from '../.pi/components/workspace-dialog.js';

type BrunchTuiCoordinator = SpecSessionActivationCoordinator & WorkspaceSessionBoundaryCoordinator;

interface BrunchWebSidecarRunnerOptions {
  cwd: string;
  coordinator: BrunchTuiCoordinator;
  productUpdates: ProductUpdatePublisher;
  sessionEvents: SessionEventRelay;
  sessionTurnDriver?: SessionTurnDriver;
  sessionExchangeAnswer?: SessionExchangeAnswerHandle;
  routePath: string;
}

type BrunchWebSidecar = Pick<RunningWebHost, 'url' | 'close'>;

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState;
  coordinator: BrunchTuiCoordinator;
  productUpdates?: ProductUpdatePublisher;
  sessionEvents?: SessionEventRelay;
  sessionTurnDriver?: SessionTurnDriver;
  liveExchange?: LiveExchangeBroker;
  liveAgentSession?: {
    current: Awaited<ReturnType<typeof createAgentSessionFromServices>>['session'] | null;
  };
  webSidecarUrl?: string;
  activationDecision?: SpecSessionActivationDecision;
  introspection?: BrunchTuiIntrospectionOptions;
  /** Product subagent tool registration for Specify mode; defaults on for normal launches. */
  allowSubagents?: boolean;
  reportAsyncDiagnostic?: (diagnostic: { readonly type: 'warning'; readonly message: string }) => void;
  /**
   * Provider-backend substitution seam (faux provider in Tier-2 oracles).
   * Swaps only auth/model resolution; session creation, extension
   * registration, and origination choreography remain product wiring, so a
   * boot through this seam still proves product lifecycle claims.
   */
  agentServices?: BrunchAgentServicesOverride;
}

export interface BrunchAgentServicesOverride extends Pick<
  CreateAgentSessionServicesOptions,
  'authStorage' | 'modelRegistry'
> {
  readonly model?: CreateAgentSessionFromServicesOptions['model'];
}

export interface BrunchTuiIntrospectionOptions {
  readonly store: BrunchIntrospectionStore;
  readonly queryTools: boolean;
  readonly debugCache?: { readonly cwd: string };
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
  /** Opt-in (`--open-web`): launch the web sidecar URL in the default browser. */
  openWeb?: boolean;
  /** Opt-in prompt-affecting developer query tools. Product subagents are not dev-gated. */
  developerTools?: boolean;
  /** Override the automatic source/dev-build debug-cache default. */
  debugMirror?: boolean;
  openBrowser?: (url: string) => Promise<void>;
  advertiseWebSidecar?: (url: string) => void;
}

export async function runBrunchTui(options: BrunchTuiOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const coordinator = options.coordinator ?? createWorkspaceSessionCoordinator({ cwd });

  const productUpdates = createProductUpdatePublisher();
  const sessionEvents = createSessionEventRelay();
  const liveAgentSession: {
    current: Awaited<ReturnType<typeof createAgentSessionFromServices>>['session'] | null;
  } = { current: null };
  const sessionTurnDriver: SessionTurnDriver = {
    async prompt(input) {
      const session = liveAgentSession.current;
      if (!session) return { driven: false };
      await session.prompt(input.text, { expandPromptTemplates: false, source: 'rpc' });
      return { driven: true };
    },
  };
  const liveExchange = createLiveExchangeBroker();
  const inventory = await coordinator.inspectWorkspace();
  const decision = await chooseSpecSessionActivationDecision(inventory, options);
  const workspaceState = await coordinator.activateWorkspace(decision);
  const developerTools = options.developerTools === true;
  const introspection = createBrunchTuiIntrospection(cwd, {
    debugMirror: options.debugMirror ?? isBrunchDevelopmentRuntime(),
    queryTools: developerTools,
  });

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
    sessionEvents,
    sessionTurnDriver,
    sessionExchangeAnswer: { answerer: liveExchange.answerer },
    routePath,
  });
  const webSidecarUrl = webSidecar ? `${webSidecar.url}${routePath}` : null;
  if (webSidecarUrl) {
    options.advertiseWebSidecar?.(webSidecarUrl);
    if (options.openWeb === true) {
      await (options.openBrowser ?? openBrowser)(webSidecarUrl);
    }
  }
  try {
    await (options.launchInteractive ?? launchPiInteractive)({
      workspace: workspaceState,
      coordinator,
      productUpdates,
      sessionEvents,
      sessionTurnDriver,
      liveExchange,
      allowSubagents: true,
      ...(introspection ? { introspection } : {}),
      ...(webSidecarUrl ? { webSidecarUrl } : {}),
      activationDecision: decision,
      reportAsyncDiagnostic: (diagnostic) => {
        process.stderr.write(`[brunch] ${diagnostic.message}\n`);
      },
      liveAgentSession,
    });
  } finally {
    await webSidecar?.close();
  }
}

function createBrunchTuiIntrospection(
  cwd: string,
  options: { readonly debugMirror: boolean; readonly queryTools: boolean },
): BrunchTuiIntrospectionOptions | undefined {
  if (!options.debugMirror && !options.queryTools) return undefined;
  return {
    store: createInMemoryBrunchIntrospectionStore(),
    queryTools: options.queryTools,
    ...(options.debugMirror ? { debugCache: { cwd } } : {}),
  };
}

export function startupHeaderForActivation(
  decision: SpecSessionActivationDecision | undefined,
): { decision: Exclude<SpecSessionActivationDecision['action'], 'cancel'> } | undefined {
  return decision && decision.action !== 'cancel' ? { decision: decision.action } : undefined;
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

function formatKickDiagnostic(outcome: KickCompletionOutcome): string | undefined {
  if (outcome.status === 'fired') return undefined;
  if (outcome.status === 'failed') {
    const message = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
    return `Assistant-originated opening turn failed (${outcome.origin}): ${message}`;
  }
  if (outcome.reason === 'no_model_available') {
    return 'Assistant-originated opening turn skipped: no model available.';
  }
  return undefined;
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
  return async ({ cwd, agentDir: runtimeAgentDir, sessionManager, sessionStartEvent }) => {
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
        getOpenReconciliationNeeds: () =>
          graph.forSpec(currentWorkspace.spec.id).getOpenReconciliationNeeds(),
        latestLsn: () => graph.forSpec(currentWorkspace.spec.id).latestLsn(),
      },
      ...(productUpdates && { productUpdates }),
    };
    const bindCurrentWorkspace = async (replacementSessionManager: typeof sessionManager) => {
      currentWorkspace = await coordinator.bindCurrentSpecToReplacementSession(replacementSessionManager);
    };
    // Late-bound: the AgentSession exists only after createAgentSessionFromServices
    // below, but extension factories and the web sidecar driver close over this
    // ref now. Keyboard shortcuts borrow a command-capable context
    // (switchSession, waitForIdle) from the live session, which Pi's own
    // shortcut contexts do not carry.
    const liveAgentSession = context.liveAgentSession ?? { current: null };
    const startupHeader = startupHeaderForActivation(context.activationDecision);
    const subagents =
      context.allowSubagents !== false
        ? await loadBrunchSubagents({
            cwd,
            agentDir: runtimeAgentDir,
            // Always register the code-owned delegatable set; whether the
            // subagent tool is active/advertised is the per-mode tool policy's
            // call (elicitor allowlist includes it, executor's excludes it) —
            // never conditional registration (D86-L discipline).
            delegatableAgents: ['explorer', 'researcher', 'projector', 'reviewer'],
            world: {
              graph: {
                specId: currentWorkspace.spec.id,
                reads: graphReadersForSpec(graph, currentWorkspace.spec.id),
              },
              spec: selectedSpecContext(graph, currentWorkspace.spec.id),
              workspace: { cwd },
              session: {
                id: currentWorkspace.session.id,
                ...(currentWorkspace.session.name ? { label: currentWorkspace.session.name } : {}),
              },
              sessionBranch: sessionManager.getBranch(),
            },
          })
        : undefined;
    const profile = createBrunchPiSettings({
      cwd,
      agentDir: runtimeAgentDir,
      extensionFactories: [
        createBrunchPiExtensions(
          chromeStateForWorkspace(currentWorkspace, {
            ...(context.webSidecarUrl ? { webSidecarUrl: context.webSidecarUrl } : {}),
            ...(startupHeader ? { startupHeader } : {}),
          }),
          bindCurrentWorkspace,
          {
            coordinator,
            getCommandContext: () => liveAgentSession.current?.createReplacedSessionContext(),
            ...(productUpdates ? { productUpdates } : {}),
            graph: graphDeps,
            ...(context.liveExchange ? { liveExchange: context.liveExchange.awaiter } : {}),
            ...(context.introspection ? { introspection: context.introspection } : {}),
            ...(subagents ? { subagents } : {}),
            promptContext: () => {
              const specId = currentWorkspace.spec.id;
              const selectedSpec = selectedSpecContext(graph, specId);
              return {
                spec: selectedSpec,
                workspace: { cwd },
                session: {
                  id: currentWorkspace.session.id,
                  ...(currentWorkspace.session.name ? { label: currentWorkspace.session.name } : {}),
                },
                graphReads: graphDeps.reads,
              };
            },
          },
        ),
      ],
    });
    const specName = graph.commandExecutor.getSpec(currentWorkspace.spec.id)?.name;
    const origination = originateAssistantTurn({
      specId: currentWorkspace.spec.id,
      ...(specName ? { specName } : {}),
      reads: graph.forSpec(currentWorkspace.spec.id),
      entries: sessionManager.getEntries(),
      resumeOrigin: 'resume_debt',
      workspaceContext: await renderWorkspaceOverviewContext(cwd),
      manager: sessionManager,
    });
    if (context.introspection?.debugCache) {
      // Boot-time mirror is awaited (cheap, local fs) so a dev boot is
      // observable the moment the runtime exists; turn-time mirrors in the
      // reconciler/guard stay fire-and-forget.
      const debugCache = context.introspection.debugCache;
      for (const entry of origination.decision.seedEntries) {
        await appendEntryContentToDebugCache(debugCache, entry).catch(() => {});
      }
      await appendOriginationRecordToDebugCache(debugCache, { decision: origination.decision }).catch(
        () => {},
      );
    }

    const services = await createAgentSessionServices({
      cwd,
      agentDir: runtimeAgentDir,
      settingsManager: profile.settingsManager,
      resourceLoaderOptions: profile.resourceLoaderOptions,
      ...(context.agentServices?.authStorage ? { authStorage: context.agentServices.authStorage } : {}),
      ...(context.agentServices?.modelRegistry ? { modelRegistry: context.agentServices.modelRegistry } : {}),
    });
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
      ...projectBrunchPiSessionOptions({
        ...(sessionStartEvent ? { sessionStartEvent } : {}),
        thinkingLevel: 'medium',
        ...(context.agentServices?.model ? { model: context.agentServices.model } : {}),
      }),
    });
    liveAgentSession.current = created.session;
    context.sessionEvents?.attachSession(created.session);
    const kickStatusUi = created.session.createReplacedSessionContext().ui;
    const modelAvailable = services.modelRegistry.getAvailable().length > 0;
    if (origination.decision.action === 'start' && modelAvailable) {
      kickStatusUi.setStatus(BRUNCH_KICK_ACTIVITY_STATUS_KEY, 'opening assistant turn…');
    }
    // Complete the kick: a 'start' decision owes an actual assistant-originated
    // LLM turn, which only the live AgentSession can run. Fire-and-forget:
    // sendCustomMessage with triggerTurn awaits the whole turn, and boot must
    // not block on provider latency. The completion seam classifies every
    // exit, so launch paths no longer silently skip or bury failures in console
    // IO.
    void completeAssistantKick({
      decision: origination.decision,
      modelAvailable,
      sendCustomMessage: (message, options) => created.session.sendCustomMessage(message, options),
      onOutcome: (outcome) => {
        kickStatusUi.setStatus(BRUNCH_KICK_ACTIVITY_STATUS_KEY, undefined);
        if (context.introspection?.debugCache) {
          void appendOriginationRecordToDebugCache(context.introspection.debugCache, {
            decision: origination.decision,
            outcome,
          }).catch(() => {});
        }
        const message = formatKickDiagnostic(outcome);
        if (message) context.reportAsyncDiagnostic?.({ type: 'warning', message });
      },
    });
    return {
      ...created,
      services,
      diagnostics: services.diagnostics,
    };
  };
}

function selectedSpecContext(graph: WorkspaceGraphRuntime, specId: number): { id: number; name: string } {
  const selectedSpec = graph.commandExecutor.getSpec(specId);
  if (!selectedSpec) {
    throw new Error(`No selected spec found for Brunch prompt context: ${specId}`);
  }
  return {
    id: selectedSpec.id,
    name: selectedSpec.name,
  };
}

function graphReadersForSpec(graph: WorkspaceGraphRuntime, specId: number): GraphReaders {
  return {
    queryGraph: (filter, options) => graph.forSpec(specId).queryGraph(filter, options),
    getNodes: (selectors, options) => graph.forSpec(specId).getNodes(selectors, options),
    resolveNodeCode: (code) => graph.forSpec(specId).resolveNodeCode(code),
    getOpenReconciliationNeeds: () => graph.forSpec(specId).getOpenReconciliationNeeds(),
    latestLsn: () => graph.forSpec(specId).latestLsn(),
  };
}

async function startDefaultWebSidecar({
  cwd,
  coordinator,
  productUpdates,
  sessionEvents,
  sessionTurnDriver,
  sessionExchangeAnswer,
}: BrunchWebSidecarRunnerOptions): Promise<BrunchWebSidecar> {
  const host = await startWebHost({
    cwd,
    coordinator: coordinator as WorkspaceSessionCoordinator,
    productUpdates,
    sessionEvents,
    ...(sessionTurnDriver ? { sessionTurnDriver } : {}),
    ...(sessionExchangeAnswer ? { sessionExchangeAnswer } : {}),
  });
  return host;
}

function webSidecarRoutePath(specId: number): string {
  return `/spec/${specId}`;
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
    env: process.env,
    run: async () => {
      await new InteractiveMode(runtime).run();
    },
  });
}

export async function runWithScopedBrunchOfflineDefault(options: {
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
