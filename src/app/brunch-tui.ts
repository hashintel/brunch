import { join } from 'node:path';
import process from 'node:process';

import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  AuthStorage,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  type CreateAgentSessionFromServicesOptions,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionServicesOptions,
} from '@earendil-works/pi-coding-agent';

import {
  runWorkspaceDialogPreflight,
  type WorkspaceDialogPreflightOptions,
} from '../.pi/components/workspace-dialog.js';
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
import type { SessionOpenAsksHandle } from '../rpc/methods/session-open-asks.js';
import { createProductUpdatePublisher, type ProductUpdatePublisher } from '../rpc/product-updates.js';
import { createSessionEventRelay, type SessionEventRelay } from '../rpc/session-event-relay.js';
import { startWebHost, type RunningWebHost } from '../rpc/web-host.js';
import { createLiveAskRegistry, type LiveAskRegistry } from '../session/live-ask-registry.js';
import type { KickCompletionOutcome } from '../session/originate-assistant-turn.js';
import { operationalModeLabel } from '../session/schema/kinds.js';
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
import { openUrlBestEffort } from './open-url.js';
import {
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  createInMemoryBrunchIntrospectionStore,
  projectBrunchAgentState,
  type BrunchChromeStartupHeaderState,
  type BrunchIntrospectionStore,
  type BrunchStartupHeaderResumeFacts,
} from './pi-extensions.js';
import { projectBrunchPiSessionOptions } from './pi-session-options.js';
import {
  applyBrunchOfflineDefault,
  createBrunchPiSettings,
  resolveBrunchStartupTheme,
} from './pi-settings.js';
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
  sessionOpenAsks?: SessionOpenAsksHandle;
  routePath: string;
}

type BrunchWebSidecar = Pick<RunningWebHost, 'url' | 'close'>;

export interface BrunchTuiLaunchContext {
  workspace: WorkspaceSessionReadyState;
  coordinator: BrunchTuiCoordinator;
  productUpdates?: ProductUpdatePublisher;
  sessionEvents?: SessionEventRelay;
  sessionTurnDriver?: SessionTurnDriver;
  liveExchange?: LiveAskRegistry;
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
  readonly debugCache?: { readonly cwd: string };
}

export interface BrunchTuiOptions {
  cwd?: string;
  coordinator?: BrunchTuiCoordinator;
  selectSpecTitle?: () => Promise<string | undefined>;
  runWorkspaceDialogPreflight?: (
    inventory: WorkspaceLaunchInventory,
    options: Pick<WorkspaceDialogPreflightOptions, 'theme'>,
  ) => Promise<SpecSessionActivationDecision>;
  launchInteractive?: (context: BrunchTuiLaunchContext) => Promise<void>;
  webSidecarRunner?: (options: BrunchWebSidecarRunnerOptions) => Promise<BrunchWebSidecar | null>;
  /** CLI-resolved browser preference; `--no-webui` supplies false. */
  openWeb?: boolean;
  /** Override the automatic source/dev-build debug-cache default. */
  debugMirror?: boolean;
  /** Programmatic dev/eval-only intervention; normal product launch has no selector. */
  evaluationDirectiveAblation?: 'warrant-before-commit';
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
  const liveExchange = createLiveAskRegistry();
  const inventory = await coordinator.inspectWorkspace();
  const decision = await chooseSpecSessionActivationDecision(inventory, options);
  const workspaceState = await coordinator.activateWorkspace(decision);
  const introspection = createBrunchTuiIntrospection(cwd, {
    debugMirror:
      options.debugMirror ??
      (isBrunchDevelopmentRuntime() || options.evaluationDirectiveAblation !== undefined),
    ...(options.evaluationDirectiveAblation
      ? { directiveAblation: options.evaluationDirectiveAblation }
      : {}),
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
    sessionOpenAsks: { reader: liveExchange.reader },
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
  options: {
    readonly debugMirror: boolean;
    readonly directiveAblation?: 'warrant-before-commit';
  },
): BrunchTuiIntrospectionOptions | undefined {
  if (!options.debugMirror && !options.directiveAblation) return undefined;
  return {
    store: createInMemoryBrunchIntrospectionStore(),
    ...(options.debugMirror ? { debugCache: { cwd } } : {}),
    ...(options.directiveAblation ? { directiveAblation: options.directiveAblation } : {}),
  };
}

export type StartupHeaderResumeFacts = BrunchStartupHeaderResumeFacts;
export type StartupHeaderChromeState = BrunchChromeStartupHeaderState;

export function startupHeaderForActivation(
  decision: SpecSessionActivationDecision | undefined,
  resumeFacts?: StartupHeaderResumeFacts,
): StartupHeaderChromeState | undefined {
  if (!decision || decision.action === 'cancel') return undefined;
  return {
    decision: decision.action,
    ...(decision.action === 'openSession' && resumeFacts ? { resumeFacts } : {}),
  };
}

async function chooseSpecSessionActivationDecision(
  inventory: WorkspaceLaunchInventory,
  options: BrunchTuiOptions,
): Promise<SpecSessionActivationDecision> {
  const startupTheme = await resolveBrunchStartupTheme({
    cwd: inventory.cwd,
    agentDir: getAgentDir(),
  });
  const preflightOptions = startupTheme ? { theme: startupTheme } : {};
  if (options.runWorkspaceDialogPreflight) {
    return options.runWorkspaceDialogPreflight(inventory, preflightOptions);
  }
  if (options.selectSpecTitle && inventory.needsNewSpec) {
    const title = await options.selectSpecTitle();
    return title ? { action: 'newSpec', title } : { action: 'cancel' };
  }
  return runWorkspaceDialogPreflight(inventory, preflightOptions);
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

/**
 * How long the boot kick's `sendCustomMessage` chain is deferred so that
 * `bindExtensions()` can return and InteractiveMode can subscribe + render
 * before the opening turn starts. Imperceptible against turn latency;
 * exported so tests can await past it deterministically.
 */
export const BRUNCH_KICK_SEND_DEFER_MS = 50;

export interface KickSendSerialChain {
  tail: Promise<void>;
  failed: boolean;
}

export function createKickSendSerialChain(deferMs = BRUNCH_KICK_SEND_DEFER_MS): KickSendSerialChain {
  return {
    tail: new Promise<void>((resolve) => {
      setTimeout(resolve, deferMs);
    }),
    failed: false,
  };
}

/**
 * Schedules a kick-context send instead of awaiting it. The J1/J2 junctures run
 * inside `session.bindExtensions()`'s `session_start` emit, and pi's
 * `sendCustomMessage(…, { triggerTurn: true })` resolves only when the whole
 * turn completes — awaiting it in the handler parks `InteractiveMode` before
 * `subscribeToAgent()` / `renderInitialMessages()`, so the entire opening turn
 * (including its interactive exchanges) runs over a dead transcript: dialogs
 * float over an empty chat and review sets never render.
 *
 * Deferring lets the TUI subscribe first; chaining sends on the per-kick
 * context preserves seed-before-kick ordering after that single defer window.
 * A `'fired'` kick outcome therefore means "send scheduled" (matching the J5
 * adapter's fire-and-forget semantics), and send failures surface through
 * `reportAsyncDiagnostic`. Once a chained send fails, later sends in the same
 * kick context are skipped so a directed kick cannot run with a missing seed.
 *
 * ceiling: 50ms timer — pi exposes no "extensions bound + TUI subscribed"
 * signal to defer against; switch to that event if pi grows one while keeping
 * the per-kick serial chain.
 */
export function scheduleKickSend(input: {
  readonly send: () => Promise<unknown>;
  readonly reportAsyncDiagnostic?:
    | ((diagnostic: { readonly type: 'warning'; readonly message: string }) => void)
    | undefined;
  readonly chain?: KickSendSerialChain;
  readonly deferMs?: number;
}): Promise<void> {
  const chain = input.chain ?? createKickSendSerialChain(input.deferMs);
  chain.tail = chain.tail.then(async () => {
    if (chain.failed) {
      input.reportAsyncDiagnostic?.({
        type: 'warning',
        message: 'Skipping assistant kick send after an earlier scheduled send failed.',
      });
      return;
    }

    try {
      await input.send();
    } catch (error: unknown) {
      chain.failed = true;
      input.reportAsyncDiagnostic?.({
        type: 'warning',
        message: `Assistant kick turn failed after scheduling: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });
  return Promise.resolve();
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
        forSpec: (specId: number) => ({
          queryGraph: (
            filter?: Parameters<ReturnType<WorkspaceGraphRuntime['forSpec']>['queryGraph']>[0],
            options?: Parameters<ReturnType<WorkspaceGraphRuntime['forSpec']>['queryGraph']>[1],
          ) => graph.forSpec(specId).queryGraph(filter, options),
          latestLsn: () => graph.forSpec(specId).latestLsn(),
        }),
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
    const startupHeader = startupHeaderForActivation(
      context.activationDecision,
      sampleResumeFactsForHeader({
        activationDecision: context.activationDecision,
        specName: graph.commandExecutor.getSpec(currentWorkspace.spec.id)?.name,
        graph,
        specId: currentWorkspace.spec.id,
        sessionManager,
      }),
    );
    const agentState = projectBrunchAgentState(sessionManager.getBranch());
    const allowProductSubagents = context.allowSubagents !== false;
    const shouldLoadSubagents = allowProductSubagents || agentState.operationalMode === 'execute';
    const subagents = shouldLoadSubagents
      ? await loadBrunchSubagents({
          cwd,
          agentDir: runtimeAgentDir,
          delegatableAgents:
            allowProductSubagents && agentState.operationalMode === 'specify'
              ? ['explorer', 'researcher', 'projector', 'reviewer']
              : [],
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
            ...(context.liveExchange ? { liveExchange: context.liveExchange.opener } : {}),
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
            sessionOrientation: {
              // Option-2 J1: origination + kick now run inside the
              // `session_start` (reason `startup`) handler in the
              // session-orientation extension registrar, which fires from
              // inside `bindExtensions()` — so `ctx.ui` and the live
              // `AgentSession` both exist. The old pre-session-binding
              // origination + fire-and-forget kick were deleted from this
              // launch path; the callbacks below preserve the boot-time
              // debug-cache mirror (D97-L) and kick-status chrome that the
              // deleted block used to run.
              resolveKickContext: async () => {
                const session = liveAgentSession.current;
                if (!session) return undefined;
                const specId = currentWorkspace.spec.id;
                const specRecord = graph.commandExecutor.getSpec(specId);
                const kickUi = session.createReplacedSessionContext().ui;
                const kickSendChain = createKickSendSerialChain();
                return {
                  specId,
                  ...(specRecord?.name ? { specName: specRecord.name } : {}),
                  reads: graph.forSpec(specId),
                  workspaceContext: await renderWorkspaceOverviewContext(cwd),
                  ...(specRecord
                    ? {
                        posture: {
                          kind: specRecord.kind,
                          origin: specRecord.origin,
                          relatesToSpecId: specRecord.relatesToSpecId,
                        },
                      }
                    : {}),
                  // Deferred fire-and-forget — see `scheduleKickSend` for why
                  // awaiting the turn here would park the TUI unsubscribed.
                  sendCustomMessage: (message, sendOptions) =>
                    scheduleKickSend({
                      send: () => session.sendCustomMessage(message, sendOptions),
                      reportAsyncDiagnostic: context.reportAsyncDiagnostic,
                      chain: kickSendChain,
                    }),
                  onOriginationDecision: async (decision, { modelAvailable }) => {
                    if (context.introspection?.debugCache) {
                      const debugCache = context.introspection.debugCache;
                      for (const entry of decision.seedEntries) {
                        await appendEntryContentToDebugCache(debugCache, entry).catch(() => {});
                      }
                      await appendOriginationRecordToDebugCache(debugCache, { decision }).catch(() => {});
                    }
                    if (decision.action === 'start' && modelAvailable) {
                      // F14: drive the salient streaming loader instead of a
                      // footer status entry. Reset in chrome's `turn_end`
                      // handler so the message never leaks into a later turn.
                      kickUi.setWorkingMessage('Opening assistant turn…');
                    }
                  },
                  onKickOutcome: (outcome, decision) => {
                    if (context.introspection?.debugCache) {
                      void appendOriginationRecordToDebugCache(context.introspection.debugCache, {
                        decision,
                        outcome,
                      }).catch(() => {});
                    }
                    const message = formatKickDiagnostic(outcome);
                    if (message) context.reportAsyncDiagnostic?.({ type: 'warning', message });
                  },
                };
              },
            },
          },
        ),
      ],
    });

    const authStorage =
      context.agentServices?.authStorage ?? AuthStorage.create(join(runtimeAgentDir, 'auth.json'));
    const services = await createAgentSessionServices({
      cwd,
      agentDir: runtimeAgentDir,
      settingsManager: profile.settingsManager,
      resourceLoaderOptions: profile.resourceLoaderOptions,
      authStorage,
      ...(context.agentServices?.modelRegistry ? { modelRegistry: context.agentServices.modelRegistry } : {}),
    });
    const created = await createAgentSessionFromServices({
      services,
      sessionManager,
      ...projectBrunchPiSessionOptions({
        ...(sessionStartEvent ? { sessionStartEvent } : {}),
        ...(context.agentServices?.model ? { model: context.agentServices.model } : {}),
      }),
    });
    liveAgentSession.current = created.session;
    context.sessionEvents?.attachSession(created.session);
    return {
      ...created,
      services,
      diagnostics: services.diagnostics,
    };
  };
}

interface SampleResumeFactsInput {
  readonly activationDecision: SpecSessionActivationDecision | undefined;
  readonly specName: string | undefined;
  readonly graph: WorkspaceGraphRuntime;
  readonly specId: number;
  readonly sessionManager: {
    readonly getBranch: () => readonly { type?: unknown; customType?: unknown; data?: unknown }[];
  };
}

/**
 * F16a: sample deterministic resume-state facts for the startup-header resume
 * block. Only computed for `openSession` activations; other decisions return
 * undefined so the header omits the block entirely.
 */
function sampleResumeFactsForHeader(input: SampleResumeFactsInput): StartupHeaderResumeFacts | undefined {
  if (input.activationDecision?.action !== 'openSession') return undefined;
  const slice = input.graph.forSpec(input.specId).queryGraph(undefined, { visibility: 'all' });
  const agentState = projectBrunchAgentState(input.sessionManager.getBranch());
  return {
    ...(input.specName ? { specTitle: input.specName } : {}),
    nodeCount: slice.nodes.length,
    edgeCount: slice.edges.length,
    modeLabel: operationalModeLabel(agentState.operationalMode),
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
  sessionOpenAsks,
}: BrunchWebSidecarRunnerOptions): Promise<BrunchWebSidecar> {
  const host = await startWebHost({
    cwd,
    coordinator: coordinator as WorkspaceSessionCoordinator,
    productUpdates,
    sessionEvents,
    ...(sessionTurnDriver ? { sessionTurnDriver } : {}),
    ...(sessionExchangeAnswer ? { sessionExchangeAnswer } : {}),
    ...(sessionOpenAsks ? { sessionOpenAsks } : {}),
  });
  return host;
}

function webSidecarRoutePath(specId: number): string {
  return `/spec/${specId}`;
}

async function openBrowser(url: string): Promise<void> {
  openUrlBestEffort(url);
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
