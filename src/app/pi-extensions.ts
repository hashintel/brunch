import {
  type ExtensionAPI,
  type ExtensionFactory,
  type SessionManager,
} from '@earendil-works/pi-coding-agent';

import { registerBrunchAlternatives } from '../.pi/components/alternatives.js';
import { registerBrunchExecuteCookLaunch } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookPlanFile } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookPlanPreview } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookPopulate } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookReportInit } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookRunCreate } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookSourceCopy } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookSourcePolicy } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookSliceStart } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteCookWorktreeCreate } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecutePlanCheck } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecutePlanDraftArtifact } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecutePlanDraft } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecutePlanOutlineArtifact } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecutePlanOutline } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteSnapshot } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchExecuteStatus } from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchOrchestratorStub } from '../.pi/extensions/agent-runtime/index.js';
import {
  conservativeUncoveredFloorGaps,
  registerBrunchOperationalModePolicy,
} from '../.pi/extensions/agent-runtime/index.js';
import {
  registerBrunchPrompting,
  type BrunchPromptContextProvider,
} from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchContext } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchElicitation } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchGraph, type BrunchGraphDeps } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchReconciliation } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchChrome } from '../.pi/extensions/chrome/index.js';
import { type BrunchChromeState } from '../.pi/extensions/chrome/index.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from '../.pi/extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers } from '../.pi/extensions/commands/policy.js';
import {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  registerBrunchIntrospectQuery,
} from '../.pi/extensions/dev-mode/index.js';
import {
  appendEntryContentToDebugCache,
  registerBrunchIntrospection,
  type BrunchDebugCacheOptions,
  type BrunchIntrospectionOptions,
} from '../.pi/extensions/dev-mode/index.js';
import { BRUNCH_SESSION_QUERY_TOOL, registerBrunchSessionQuery } from '../.pi/extensions/dev-mode/index.js';
import { registerStructuredExchange } from '../.pi/extensions/exchanges/index.js';
import { type GraphMentionSource } from '../.pi/extensions/mentions/index.js';
import { registerBrunchMentionAutocomplete } from '../.pi/extensions/mentions/index.js';
import { registerBrunchSessionBoundary } from '../.pi/extensions/session-hooks/index.js';
import {
  type BrunchSessionBoundaryHandler,
  type BrunchSessionBoundaryPipelineStep,
} from '../.pi/extensions/session-hooks/index.js';
import {
  BRUNCH_SUBAGENT_TOOL,
  registerBrunchSubagents,
  type BrunchSubagentsDeps,
} from '../.pi/extensions/subagents/index.js';
import { registerBrunchWebTools } from '../.pi/extensions/web-tools/index.js';
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
} from '../.pi/extensions/agent-runtime/index.js';
export { registerBrunchPrompting } from '../.pi/extensions/agent-runtime/index.js';
export { registerBrunchContext } from '../.pi/extensions/brunch-data/index.js';
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
} from '../.pi/extensions/session-hooks/index.js';
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
export { registerBrunchWebTools } from '../.pi/extensions/web-tools/index.js';

export { registerBrunchGraph } from '../.pi/extensions/brunch-data/index.js';
export {
  BRUNCH_EXECUTE_COOK_LAUNCH_TOOL,
  createExecuteCookLaunchTool,
  registerBrunchExecuteCookLaunch,
  BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL,
  createExecuteCookPlanFileTool,
  registerBrunchExecuteCookPlanFile,
  BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
  createExecuteCookPlanPreviewTool,
  registerBrunchExecuteCookPlanPreview,
  BRUNCH_EXECUTE_COOK_POPULATE_TOOL,
  createExecuteCookPopulateTool,
  registerBrunchExecuteCookPopulate,
  BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL,
  createExecuteCookReportInitTool,
  registerBrunchExecuteCookReportInit,
  BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL,
  createExecuteCookRunCreateTool,
  registerBrunchExecuteCookRunCreate,
  BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL,
  createExecuteCookSourceCopyTool,
  registerBrunchExecuteCookSourceCopy,
  BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL,
  createExecuteCookSourcePolicyTool,
  registerBrunchExecuteCookSourcePolicy,
  BRUNCH_EXECUTE_COOK_SLICE_START_TOOL,
  createExecuteCookSliceStartTool,
  registerBrunchExecuteCookSliceStart,
  BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL,
  createExecuteCookWorktreeCreateTool,
  registerBrunchExecuteCookWorktreeCreate,
  BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
  createExecutePlanCheckTool,
  registerBrunchExecutePlanCheck,
  BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
  createExecutePlanDraftArtifactTool,
  registerBrunchExecutePlanDraftArtifact,
  BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
  createExecutePlanDraftTool,
  registerBrunchExecutePlanDraft,
  BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
  createExecutePlanOutlineArtifactTool,
  registerBrunchExecutePlanOutlineArtifact,
  BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
  createExecutePlanOutlineTool,
  registerBrunchExecutePlanOutline,
  BRUNCH_EXECUTE_SNAPSHOT_TOOL,
  createExecuteSnapshotTool,
  registerBrunchExecuteSnapshot,
  BRUNCH_EXECUTE_STATUS_TOOL,
  createExecuteStatusTool,
  registerBrunchExecuteStatus,
  BRUNCH_ORCHESTRATOR_STUB_TOOL,
  createOrchestratorStubTool,
  registerBrunchOrchestratorStub,
} from '../.pi/extensions/agent-runtime/index.js';
export { registerBrunchReconciliation } from '../.pi/extensions/brunch-data/index.js';
export {
  BRUNCH_SUBAGENT_TOOL,
  registerBrunchSubagents,
  type BrunchSubagentsDeps,
} from '../.pi/extensions/subagents/index.js';
export {
  BRUNCH_INTROSPECTION_COMMAND,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchIntrospection,
  type BrunchIntrospectionBaseReport,
  type BrunchIntrospectionStore,
  type BrunchIntrospectionTurnCapture,
} from '../.pi/extensions/dev-mode/index.js';
export {
  BRUNCH_SESSION_QUERY_TOOL,
  createBrunchSessionQueryTool,
  registerBrunchSessionQuery,
} from '../.pi/extensions/dev-mode/index.js';
export {
  BRUNCH_INTROSPECT_QUERY_TOOL,
  createBrunchIntrospectQueryTool,
  registerBrunchIntrospectQuery,
} from '../.pi/extensions/dev-mode/index.js';

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
  /**
   * Optional subagent registry (D44-L/D92-L). When provided with a non-empty
   * code-owned delegatable set, the `subagent` tool is registered and opted
   * into the active-tool set; when omitted or empty it is absent/default-off.
   */
  subagents?: BrunchSubagentsDeps;
}

export interface BrunchPiIntrospectionOptions extends BrunchIntrospectionOptions {
  readonly queryTools?: boolean;
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
    // Opt-in tool channel: tools registered but kept out of the base `elicit`
    // allowlist (D40-L) are made active only when explicitly opted in here —
    // dev introspection query tools (D69-L) and the `subagent` tool (D44-L).
    const hasDelegatableSubagents = (options.subagents?.delegatableAgents.length ?? 0) > 0;
    const optInAllowedToolNames = [
      ...(introspectionOptions?.queryTools ? [BRUNCH_SESSION_QUERY_TOOL, BRUNCH_INTROSPECT_QUERY_TOOL] : []),
      ...(hasDelegatableSubagents ? [BRUNCH_SUBAGENT_TOOL] : []),
    ];
    const devAllowedToolNames = optInAllowedToolNames.length > 0 ? optInAllowedToolNames : undefined;
    const entryDebugCache = introspectionOptions?.debugCache;
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
      registerBrunchExecuteStatus,
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteCookLaunch(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteCookPlanFile(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteCookPlanPreview(api, graph)] : []),
      registerBrunchExecuteCookPopulate,
      registerBrunchExecuteCookReportInit,
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteCookRunCreate(api, graph)] : []),
      registerBrunchExecuteCookSourcePolicy,
      registerBrunchExecuteCookSourceCopy,
      registerBrunchExecuteCookSliceStart,
      registerBrunchExecuteCookWorktreeCreate,
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanCheck(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanDraftArtifact(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanDraft(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanOutlineArtifact(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanOutline(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteSnapshot(api, graph)] : []),
      registerBrunchOrchestratorStub,
      ...(hasDelegatableSubagents
        ? [(api: ExtensionAPI) => registerBrunchSubagents(api, options.subagents!)]
        : []),
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
      ...(introspectionOptions
        ? [
            (api: ExtensionAPI) => {
              const { store, clock, debugCache, queryTools } = introspectionOptions;
              const introspectionStore = registerBrunchIntrospection(api, {
                ...(store ? { store } : {}),
                ...(clock ? { clock } : {}),
                ...(debugCache ? { debugCache } : {}),
              });
              if (queryTools) {
                registerBrunchSessionQuery(api);
                registerBrunchIntrospectQuery(api, { store: introspectionStore });
              }
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
