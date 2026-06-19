import {
  type ExtensionAPI,
  type ExtensionFactory,
  type SessionManager,
} from '@earendil-works/pi-coding-agent';

import { registerBrunchAlternatives } from '../.pi/components/alternatives.js';
import { registerBrunchChrome } from '../.pi/extensions/chrome/index.js';
import { type BrunchChromeState } from '../.pi/extensions/chrome/index.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from '../.pi/extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers } from '../.pi/extensions/commands/policy.js';
import { registerBrunchContext } from '../.pi/extensions/context/index.js';
import { registerBrunchElicitation } from '../.pi/extensions/elicitation/index.js';
import { registerStructuredExchange } from '../.pi/extensions/exchanges/index.js';
import { registerBrunchGraph, type BrunchGraphDeps } from '../.pi/extensions/graph/index.js';
import {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  registerBrunchIntrospectQuery,
} from '../.pi/extensions/introspect-query/index.js';
import {
  appendEntryContentToDebugCache,
  registerBrunchIntrospection,
  type BrunchDebugCacheOptions,
  type BrunchIntrospectionOptions,
} from '../.pi/extensions/introspection/index.js';
import { type GraphMentionSource } from '../.pi/extensions/mentions/index.js';
import { registerBrunchMentionAutocomplete } from '../.pi/extensions/mentions/index.js';
import { registerBrunchReconciliation } from '../.pi/extensions/reconciliation/index.js';
import {
  conservativeUncoveredFloorGaps,
  registerBrunchOperationalModePolicy,
} from '../.pi/extensions/runtime/index.js';
import {
  BRUNCH_SESSION_QUERY_TOOL,
  registerBrunchSessionQuery,
} from '../.pi/extensions/session-query/index.js';
import { registerBrunchSessionBoundary } from '../.pi/extensions/session/lifecycle.js';
import {
  type BrunchSessionBoundaryHandler,
  type BrunchSessionBoundaryPipelineStep,
} from '../.pi/extensions/session/lifecycle.js';
import {
  registerBrunchPrompting,
  type BrunchPromptContextProvider,
} from '../.pi/extensions/system-prompts/index.js';
import { registerBrunchWebTools } from '../.pi/extensions/web/index.js';
import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import {
  CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
  prepareCaptureSweepAdvance,
} from '../projections/session/sweep-watermark.js';
import type { LiveExchangeAwaiter } from '../session/live-exchange-broker.js';
import { mentionFactsFromEntries } from '../session/mention-ledger.js';
import {
  appendPreparedContinuityEntry,
  guardBeforeProviderRequest,
  prepareNextTurn,
  type ContinuityDrain,
  type GraphChangeItem,
  type PrepareNextTurnResult,
} from '../session/prepare-next-turn.js';

export { registerBrunchAlternatives } from '../.pi/components/alternatives.js';
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from '../.pi/extensions/commands/policy.js';
export { registerBrunchMentionAutocomplete } from '../.pi/extensions/mentions/index.js';
export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  activeToolNamesForBrunchAgentState,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
} from '../.pi/extensions/runtime/index.js';
export { registerBrunchPrompting } from '../.pi/extensions/system-prompts/index.js';
export { registerBrunchContext } from '../.pi/extensions/context/index.js';
export {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  registerBrunchChrome,
  renderBrunchChrome,
  type BrunchChromeState,
} from '../.pi/extensions/chrome/index.js';
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from '../.pi/extensions/session/lifecycle.js';
export {
  BRUNCH_COMMAND_PREFIX,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  BRUNCH_SWITCH_SHORTCUT,
  registerBrunchCommands,
} from '../.pi/extensions/commands/index.js';
export { runBrunchWorkspaceAction, runBrunchWorkspaceCommand } from '../.pi/extensions/workspace/index.js';
export { registerBrunchWebTools } from '../.pi/extensions/web/index.js';

export { registerBrunchGraph } from '../.pi/extensions/graph/index.js';
export { registerBrunchReconciliation } from '../.pi/extensions/reconciliation/index.js';
export {
  BRUNCH_INTROSPECTION_COMMAND,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchIntrospection,
  type BrunchIntrospectionBaseReport,
  type BrunchIntrospectionStore,
  type BrunchIntrospectionTurnCapture,
} from '../.pi/extensions/introspection/index.js';
export {
  BRUNCH_SESSION_QUERY_TOOL,
  createBrunchSessionQueryTool,
  registerBrunchSessionQuery,
} from '../.pi/extensions/session-query/index.js';
export {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  createBrunchIntrospectQueryTool,
  registerBrunchIntrospectQuery,
} from '../.pi/extensions/introspect-query/index.js';

export interface BrunchPiExtensionsOptions extends Omit<BrunchCommandsOptions, 'getElicitationGaps'> {
  /**
   * Optional override; when omitted, the composition derives the commands'
   * gap reader from `graph` (selected-spec reads) or, with no graph in the
   * composition, an explicitly conservative uncovered floor.
   */
  getElicitationGaps?: BrunchCommandsOptions['getElicitationGaps'];
  graphMentionSource?: GraphMentionSource;
  graph?: BrunchGraphDeps;
  liveExchange?: LiveExchangeAwaiter;
  promptContext?: BrunchPromptContextProvider;
  introspection?: BrunchPiIntrospectionOptions;
  continuityDrains?: () => readonly ContinuityDrain[];
}

export interface BrunchPiIntrospectionOptions extends BrunchIntrospectionOptions {
  readonly enabled: boolean;
}

type BrunchProductExtensionRegistrar = (pi: ExtensionAPI) => void | Promise<void>;

function graphMentionSourceFromDeps(graph: BrunchGraphDeps | undefined): GraphMentionSource {
  if (!graph) return { listMentionCandidates: () => [] };
  return {
    listMentionCandidates: () =>
      graph.reads.queryGraph().nodes.map((node) => ({
        code: formatGraphNodeCode(node.kind, node.kindOrdinal),
        title: node.title,
        plane: node.plane,
        ...(node.body ? { description: node.body } : {}),
      })),
  };
}

export function createBrunchPiExtensions(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchPiExtensionsOptions,
): ExtensionFactory {
  return async (pi) => {
    const graphMentionSource = options.graphMentionSource ?? graphMentionSourceFromDeps(options.graph);
    const promptContext = options.promptContext;
    const introspectionOptions = options.introspection;
    const devAllowedToolNames = introspectionOptions?.enabled
      ? [BRUNCH_SESSION_QUERY_TOOL, BRUNCH_INTROSPECT_QUERY_TOOL]
      : undefined;
    const entryDebugCache = introspectionOptions?.enabled ? introspectionOptions.debugCache : undefined;
    const continuitySteps = options.graph
      ? [
          createPrepareNextTurnContinuityStep(options.graph, options.continuityDrains, entryDebugCache),
          createCaptureSweepAdvanceStep(entryDebugCache),
        ]
      : [];
    const chromeRefresh: { current: (() => void) | null } = { current: null };
    const graph = options.graph;
    const commandGapReads =
      options.getElicitationGaps ??
      (graph ? () => graph.reads.getElicitationGaps(graph.specId) : conservativeUncoveredFloorGaps); // no graph in this composition: explicit fail-closed floor
    const extensions: BrunchProductExtensionRegistrar[] = [
      (api) => {
        registerBrunchSessionBoundary(api, onSessionBoundary, {
          continuitySteps,
        });
        if (options.graph) {
          registerBrunchContinuityGuard(api, options.graph, options.continuityDrains, entryDebugCache);
        }
      },
      (api) =>
        registerBrunchChrome(api, chrome, {
          bindChromeRefresh: (refresh) => {
            chromeRefresh.current = refresh;
          },
        }),
      registerBrunchBranchPolicyHandlers,
      (api) => registerBrunchOperationalModePolicy(api, { devAllowedToolNames }),
      registerBrunchContext,
      registerBrunchWebTools,
      // Prompting registers immediately after operational-mode policy and
      // before mention autocomplete when prompt context is provided; its
      // position in this list is the registration order, not a splice index.
      ...(promptContext
        ? [(api: ExtensionAPI) => registerBrunchPrompting(api, promptContext, { devAllowedToolNames })]
        : []),
      (api) => registerBrunchMentionAutocomplete(api, graphMentionSource),
      registerBrunchAlternatives,
      (api) =>
        registerStructuredExchange(api, {
          review: options.graph
            ? { specId: options.graph.specId, commandExecutor: options.graph.commandExecutor }
            : undefined,
          liveExchange: options.liveExchange,
        }),
      (api) =>
        registerBrunchCommands(api, {
          ...options,
          requestChromeRefresh: () => chromeRefresh.current?.(),
          getElicitationGaps: commandGapReads,
        }),
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchGraph(api, options.graph!)] : []),
      // Elicitation and reconciliation registers are distinct surfaces from the
      // graph register, but they read through the same workspace graph runtime deps.
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchElicitation(api, options.graph!)] : []),
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchReconciliation(api, options.graph!)] : []),
      ...(introspectionOptions?.enabled
        ? [
            (api: ExtensionAPI) => {
              const { store, clock, debugCache } = introspectionOptions;
              const introspectionStore = registerBrunchIntrospection(api, {
                ...(store ? { store } : {}),
                ...(clock ? { clock } : {}),
                ...(debugCache ? { debugCache } : {}),
              });
              registerBrunchSessionQuery(api);
              registerBrunchIntrospectQuery(api, { store: introspectionStore });
            },
          ]
        : []),
    ];

    for (const registerExtension of extensions) {
      await registerExtension(pi);
    }
  };
}

function createPrepareNextTurnContinuityStep(
  graph: BrunchGraphDeps,
  getContinuityDrains: (() => readonly ContinuityDrain[]) | undefined,
  entryDebugCache: BrunchDebugCacheOptions | undefined,
): BrunchSessionBoundaryPipelineStep {
  return ({ sessionManager }) => {
    const result = prepareNextTurnForGraph(graph, sessionManager, getContinuityDrains);
    for (const entry of result.entriesToAppend) {
      appendPreparedContinuityEntry(sessionManager, entry);
      if (entryDebugCache) void appendEntryContentToDebugCache(entryDebugCache, entry).catch(() => {});
    }
  };
}

function createCaptureSweepAdvanceStep(
  entryDebugCache: BrunchDebugCacheOptions | undefined,
): BrunchSessionBoundaryPipelineStep {
  return ({ phase, sessionManager }) => {
    if (phase !== 'before_agent_start') return;
    const advance = prepareCaptureSweepAdvance(sessionManager.getEntries());
    if (!advance.marker) return;
    sessionManager.appendCustomEntry(CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE, advance.marker);
    if (entryDebugCache) {
      void appendEntryContentToDebugCache(entryDebugCache, {
        type: 'custom',
        customType: CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
        data: { ...advance.marker },
      }).catch(() => {});
    }
  };
}

function registerBrunchContinuityGuard(
  pi: ExtensionAPI,
  graph: BrunchGraphDeps,
  getContinuityDrains: (() => readonly ContinuityDrain[]) | undefined,
  entryDebugCache: BrunchDebugCacheOptions | undefined,
): void {
  pi.on('before_provider_request', async (_event, ctx) => {
    const sessionManager = ctx.sessionManager as SessionManager;
    await guardBeforeProviderRequest({
      prepare: () => prepareNextTurnForGraph(graph, sessionManager, getContinuityDrains),
      append: (entry) => {
        appendPreparedContinuityEntry(sessionManager, entry);
        if (entryDebugCache) void appendEntryContentToDebugCache(entryDebugCache, entry).catch(() => {});
      },
    });
  });
}

function prepareNextTurnForGraph(
  graph: BrunchGraphDeps,
  sessionManager: SessionManager,
  getContinuityDrains: (() => readonly ContinuityDrain[]) | undefined,
): PrepareNextTurnResult {
  const snapshot = graph.reads.queryGraph(undefined, { visibility: 'all' });
  const entries = sessionManager.getEntries();
  return prepareNextTurn({
    specId: graph.specId,
    currentLsn: snapshot.lsn,
    entries,
    changes: graphChangesFromSnapshot(graph.specId, snapshot),
    mentions: mentionFactsFromEntries(entries),
    drains: getContinuityDrains?.() ?? [],
  });
}

function graphChangesFromSnapshot(
  specId: number,
  snapshot: ReturnType<BrunchGraphDeps['reads']['queryGraph']>,
): readonly GraphChangeItem[] {
  return [
    ...snapshot.nodes.map((node) => ({
      specId,
      lsn: node.updatedAtLsn,
      entityId: node.id,
      kind: node.kind,
      title: node.title,
    })),
    ...snapshot.edges.map((edge) => ({
      specId,
      lsn: edge.updatedAtLsn,
      entityId: edge.id,
      kind: edge.category,
    })),
  ];
}
