import {
  type ExtensionAPI,
  type ExtensionFactory,
  type SessionManager,
} from '@earendil-works/pi-coding-agent';

import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import {
  prepareNextTurn,
  type GraphChangeItem,
  type PrepareNextTurnResult,
} from '../session/prepare-next-turn.js';
import { registerBrunchAlternatives } from './components/alternatives.js';
import { registerBrunchChrome } from './extensions/chrome/index.js';
import { type BrunchChromeState } from './extensions/chrome/index.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from './extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers } from './extensions/commands/policy.js';
import { registerBrunchContext } from './extensions/context/index.js';
import { registerStructuredExchange } from './extensions/exchanges/index.js';
import { registerBrunchGraph, type BrunchGraphDeps } from './extensions/graph/index.js';
import {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  registerBrunchIntrospectQuery,
} from './extensions/introspect-query/index.js';
import {
  registerBrunchIntrospection,
  type BrunchIntrospectionOptions,
} from './extensions/introspection/index.js';
import { type GraphMentionSource } from './extensions/mentions/index.js';
import { registerBrunchMentionAutocomplete } from './extensions/mentions/index.js';
import { registerBrunchOperationalModePolicy } from './extensions/runtime/index.js';
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

export interface BrunchPiExtensionsOptions extends BrunchCommandsOptions {
  graphMentionSource?: GraphMentionSource;
  graph?: BrunchGraphDeps;
  promptContext?: BrunchPromptContextProvider;
  introspection?: BrunchPiIntrospectionOptions;
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
    const continuityStep = options.graph ? createPrepareNextTurnContinuityStep(options.graph) : undefined;
    const extensions: BrunchProductExtensionRegistrar[] = [
      (api) => {
        registerBrunchSessionBoundary(api, onSessionBoundary, {
          continuitySteps: continuityStep ? [continuityStep] : [],
        });
        if (options.graph) registerBrunchContinuityGuard(api, options.graph);
      },
      (api) => registerBrunchChrome(api, chrome),
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
      (api) => registerBrunchCommands(api, options),
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchGraph(api, options.graph!)] : []),
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

function createPrepareNextTurnContinuityStep(graph: BrunchGraphDeps): BrunchSessionBoundaryPipelineStep {
  return ({ sessionManager }) => {
    const result = prepareNextTurnForGraph(graph, sessionManager);
    for (const entry of result.entriesToAppend) {
      sessionManager.appendCustomEntry(entry.customType, entry.data);
    }
  };
}

function registerBrunchContinuityGuard(pi: ExtensionAPI, graph: BrunchGraphDeps): void {
  pi.on('before_provider_request', async (_event, ctx) => {
    const result = prepareNextTurnForGraph(graph, ctx.sessionManager as SessionManager);
    if (result.entriesToAppend.length > 0) {
      throw new Error(
        'Continuity drift remained before provider request; prepareNextTurn must run before prompt composition.',
      );
    }
  });
}

function prepareNextTurnForGraph(
  graph: BrunchGraphDeps,
  sessionManager: SessionManager,
): PrepareNextTurnResult {
  const snapshot = graph.reads.queryGraph(undefined, { visibility: 'all' });
  return prepareNextTurn({
    specId: graph.specId,
    currentLsn: snapshot.lsn,
    entries: sessionManager.getEntries(),
    changes: graphChangesFromSnapshot(graph.specId, snapshot),
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
