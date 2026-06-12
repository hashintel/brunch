import {
  type ExtensionAPI,
  type ExtensionFactory,
  type SessionManager,
} from '@earendil-works/pi-coding-agent';

import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import { mentionFactsFromEntries } from '../session/mention-ledger.js';
import {
  appendPreparedContinuityEntry,
  guardBeforeProviderRequest,
  prepareNextTurn,
  type ContinuityDrain,
  type GraphChangeItem,
  type PrepareNextTurnResult,
} from '../session/prepare-next-turn.js';
import { registerBrunchAlternatives } from './components/alternatives.js';
import { registerBrunchChrome } from './extensions/chrome/index.js';
import { type BrunchChromeState } from './extensions/chrome/index.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from './extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers } from './extensions/commands/policy.js';
import { registerBrunchContext } from './extensions/context/index.js';
import { registerBrunchElicitation } from './extensions/elicitation/index.js';
import { registerStructuredExchange } from './extensions/exchanges/index.js';
import { registerBrunchGraph, type BrunchGraphDeps } from './extensions/graph/index.js';
import {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  registerBrunchIntrospectQuery,
} from './extensions/introspect-query/index.js';
import {
  appendEntryContentToDebugCache,
  registerBrunchIntrospection,
  type BrunchDebugCacheOptions,
  type BrunchIntrospectionOptions,
} from './extensions/introspection/index.js';
import { type GraphMentionSource } from './extensions/mentions/index.js';
import { registerBrunchMentionAutocomplete } from './extensions/mentions/index.js';
import {
  conservativeUncoveredFloorGaps,
  registerBrunchOperationalModePolicy,
} from './extensions/runtime/index.js';
import { BRUNCH_SESSION_QUERY_TOOL, registerBrunchSessionQuery } from './extensions/session-query/index.js';
import { registerBrunchSessionBoundary } from './extensions/session/lifecycle.js';
import {
  type BrunchSessionBoundaryHandler,
  type BrunchSessionBoundaryPipelineStep,
} from './extensions/session/lifecycle.js';
import {
  registerBrunchPrompting,
  type BrunchPromptContextProvider,
} from './extensions/system-prompts/index.js';

export { registerBrunchAlternatives } from './components/alternatives.js';
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from './extensions/commands/policy.js';
export { registerBrunchMentionAutocomplete } from './extensions/mentions/index.js';
export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  activeToolNamesForBrunchAgentState,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
} from './extensions/runtime/index.js';
export { registerBrunchPrompting } from './extensions/system-prompts/index.js';
export { registerBrunchContext } from './extensions/context/index.js';
export {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  registerBrunchChrome,
  renderBrunchChrome,
  type BrunchChromeState,
} from './extensions/chrome/index.js';
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from './extensions/session/lifecycle.js';
export {
  BRUNCH_COMMAND_PREFIX,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  BRUNCH_SWITCH_SHORTCUT,
  registerBrunchCommands,
} from './extensions/commands/index.js';
export { runBrunchWorkspaceAction, runBrunchWorkspaceCommand } from './extensions/workspace/index.js';

export { registerBrunchGraph } from './extensions/graph/index.js';
export {
  BRUNCH_INTROSPECTION_COMMAND,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchIntrospection,
  type BrunchIntrospectionBaseReport,
  type BrunchIntrospectionStore,
  type BrunchIntrospectionTurnCapture,
} from './extensions/introspection/index.js';
export {
  BRUNCH_SESSION_QUERY_TOOL,
  createBrunchSessionQueryTool,
  registerBrunchSessionQuery,
} from './extensions/session-query/index.js';
export {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  createBrunchIntrospectQueryTool,
  registerBrunchIntrospectQuery,
} from './extensions/introspect-query/index.js';

export interface BrunchPiExtensionsOptions extends Omit<BrunchCommandsOptions, 'getElicitationGaps'> {
  /**
   * Optional override; when omitted, the composition derives the commands'
   * gap reader from `graph` (selected-spec reads) or, with no graph in the
   * composition, an explicitly conservative uncovered floor.
   */
  getElicitationGaps?: BrunchCommandsOptions['getElicitationGaps'];
  graphMentionSource?: GraphMentionSource;
  graph?: BrunchGraphDeps;
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
    const continuityStep = options.graph
      ? createPrepareNextTurnContinuityStep(options.graph, options.continuityDrains, entryDebugCache)
      : undefined;
    const chromeRefresh: { current: (() => void) | null } = { current: null };
    const graph = options.graph;
    const commandGapReads =
      options.getElicitationGaps ??
      (graph ? () => graph.reads.getElicitationGaps(graph.specId) : conservativeUncoveredFloorGaps); // no graph in this composition: explicit fail-closed floor
    const extensions: BrunchProductExtensionRegistrar[] = [
      (api) => {
        registerBrunchSessionBoundary(api, onSessionBoundary, {
          continuitySteps: continuityStep ? [continuityStep] : [],
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
        }),
      (api) =>
        registerBrunchCommands(api, {
          ...options,
          requestChromeRefresh: () => chromeRefresh.current?.(),
          getElicitationGaps: commandGapReads,
        }),
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchGraph(api, options.graph!)] : []),
      // Elicitation register is a distinct tool surface from the graph register,
      // but it reads through the same workspace graph runtime deps.
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchElicitation(api, options.graph!)] : []),
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
