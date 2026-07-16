import {
  type ExtensionAPI,
  type ExtensionFactory,
  type SessionManager,
} from '@earendil-works/pi-coding-agent';

import { registerBrunchAlternatives as registerBrunchAlternativesComponent } from '../.pi/components/alternatives.js';
import { registerBrunchOperationalModePolicy } from '../.pi/extensions/agent-runtime/index.js';
import {
  registerBrunchPrompting,
  type BrunchPromptContextProvider,
} from '../.pi/extensions/agent-runtime/index.js';
import { registerBrunchContext } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchElicitationScratchpad } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchGraph, type BrunchGraphDeps } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchReconciliation } from '../.pi/extensions/brunch-data/index.js';
import { registerBrunchChrome } from '../.pi/extensions/chrome/index.js';
import { type BrunchChromeState } from '../.pi/extensions/chrome/index.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from '../.pi/extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers } from '../.pi/extensions/commands/policy.js';
import { registerBrunchCompaction } from '../.pi/extensions/compaction/index.js';
import {
} from '../.pi/extensions/dev-mode/index.js';
import {
  appendEntryContentToDebugCache,
  registerBrunchIntrospection,
  type BrunchDebugCacheOptions,
  type BrunchIntrospectionOptions,
} from '../.pi/extensions/dev-mode/index.js';
import { registerStructuredExchange } from '../.pi/extensions/exchanges/index.js';
import { registerBrunchExecuteAgentResult } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteOrchestrate } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteLand } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteLaunch } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanFile } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanPreview } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePetriExport } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePromotionPrepare } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePopulate } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteReportInit } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteRunComplete } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteRunCreate } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteReplanRecommendation } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteReplanAbandonRun } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteReplanRegeneratePlan } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteReplanRetryCurrentStep } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteReplanStartNewRun } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteRunUpdates } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteSourceCopy } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteSourcePolicy } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteSliceComplete } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteSliceExecute } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteSliceStart } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteTestResult } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteWorktreeCreate } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanCheck } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanDraftArtifact } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanDraft } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanOutlineArtifact } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecutePlanOutline } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteSnapshot } from '../.pi/extensions/executor/index.js';
import { registerBrunchExecuteStatus } from '../.pi/extensions/executor/index.js';
import { type GraphMentionSource } from '../.pi/extensions/mentions/index.js';
import { registerBrunchMentionAutocomplete } from '../.pi/extensions/mentions/index.js';
import { registerBrunchSessionBoundary } from '../.pi/extensions/session-hooks/index.js';
import {
  type BrunchSessionBoundaryHandler,
  type BrunchSessionBoundaryPipelineStep,
} from '../.pi/extensions/session-hooks/index.js';
import {
  registerBrunchSessionOrientation,
  type BrunchSessionOrientationDeps,
} from '../.pi/extensions/session-orientation/registrar.js';
import { toolParameters } from '../.pi/extensions/shared/tool-schema.js';
import { registerBrunchSubagents, type BrunchSubagentsDeps } from '../.pi/extensions/subagents/index.js';
import { registerBrunchWebTools } from '../.pi/extensions/web-tools/index.js';
import type { ExecutionPorts } from '../executor/execution-ports.js';
import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import {
  CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
  prepareCaptureSweepAdvance,
} from '../projections/session/sweep-watermark.js';
import type { LiveAskOpener } from '../session/live-ask-registry.js';
import { mentionFactsFromEntries } from '../session/mention-ledger.js';
import {
  appendPreparedContinuityEntry,
  guardBeforeProviderRequest,
  prepareNextTurn,
  type ContinuityDrain,
  type GraphChangeItem,
  type PrepareNextTurnResult,
} from '../session/prepare-next-turn.js';
import { createAgentRunnerPort } from './agent-runner-port.js';
import { createGitHostLandPort } from './git-host-land-port.js';
import { createGitRunPromotionPort } from './git-run-promotion-port.js';
import { createGitSliceIntegrationPort } from './git-slice-integration-port.js';
import { createGitWorktreePort } from './git-worktree-port.js';
import { registerBrunchKeybindingPolicy } from './pi-keybindings.js';
import { createPlannerPort } from './planner-port.js';
import { createTestRunnerPort } from './test-runner-port.js';

import { createGitHostPromotionPort } from './git-host-promotion-port.js';
import { createGitLandPort } from './git-land-port.js';

export function registerBrunchAlternatives(pi: ExtensionAPI): void {
  registerBrunchAlternativesComponent(pi, (schema) => toolParameters(schema) as typeof schema);
}
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
  type BrunchChromeStartupHeaderState,
  type BrunchChromeState,
  type BrunchStartupHeaderResumeFacts,
} from '../.pi/extensions/chrome/index.js';
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from '../.pi/extensions/session-hooks/index.js';
export {
  BRUNCH_COMMAND_PREFIX,
  BRUNCH_CONSULT_COMMAND,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_MENU_COMMAND,
  BRUNCH_MENU_SHORTCUT,
  BRUNCH_MODE_COMMAND,
  BRUNCH_MODE_PICKER_SHORTCUT,
  registerBrunchCommands,
} from '../.pi/extensions/commands/index.js';
export { runBrunchWorkspaceAction, runBrunchWorkspaceCommand } from '../.pi/extensions/workspace/index.js';
export { registerBrunchWebTools } from '../.pi/extensions/web-tools/index.js';
export { registerBrunchKeybindingPolicy } from './pi-keybindings.js';

export { registerBrunchGraph } from '../.pi/extensions/brunch-data/index.js';
export {
  BRUNCH_EXECUTE_AGENT_RESULT_TOOL,
  createExecuteAgentResultTool,
  registerBrunchExecuteAgentResult,
  BRUNCH_EXECUTE_ORCHESTRATE_TOOL,
  createExecuteOrchestrateTool,
  registerBrunchExecuteOrchestrate,
  BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL,
  createExecuteLandPreflightTool,
  registerBrunchExecuteLand,
  BRUNCH_EXECUTE_LAUNCH_TOOL,
  createExecuteLaunchTool,
  registerBrunchExecuteLaunch,
  BRUNCH_EXECUTE_PLAN_FILE_TOOL,
  createExecutePlanFileTool,
  registerBrunchExecutePlanFile,
  BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL,
  createExecutePlanPreviewTool,
  registerBrunchExecutePlanPreview,
  BRUNCH_EXECUTE_PETRI_EXPORT_TOOL,
  createExecutePetriExportTool,
  registerBrunchExecutePetriExport,
  BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL,
  createExecutePromotionPrepareTool,
  registerBrunchExecutePromotionPrepare,
  BRUNCH_EXECUTE_POPULATE_TOOL,
  createExecutePopulateTool,
  registerBrunchExecutePopulate,
  BRUNCH_EXECUTE_REPORT_INIT_TOOL,
  createExecuteReportInitTool,
  registerBrunchExecuteReportInit,
  BRUNCH_EXECUTE_RUN_COMPLETE_TOOL,
  createExecuteRunCompleteTool,
  registerBrunchExecuteRunComplete,
  BRUNCH_EXECUTE_RUN_CREATE_TOOL,
  createExecuteRunCreateTool,
  registerBrunchExecuteRunCreate,
  BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL,
  createExecuteReplanAbandonRunTool,
  registerBrunchExecuteReplanAbandonRun,
  BRUNCH_EXECUTE_SOURCE_COPY_TOOL,
  createExecuteSourceCopyTool,
  registerBrunchExecuteSourceCopy,
  BRUNCH_EXECUTE_SOURCE_POLICY_TOOL,
  createExecuteSourcePolicyTool,
  registerBrunchExecuteSourcePolicy,
  BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL,
  createExecuteSliceCompleteTool,
  registerBrunchExecuteSliceComplete,
  BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL,
  createExecuteSliceExecuteTool,
  registerBrunchExecuteSliceExecute,
  BRUNCH_EXECUTE_SLICE_START_TOOL,
  createExecuteSliceStartTool,
  registerBrunchExecuteSliceStart,
  BRUNCH_EXECUTE_TEST_RESULT_TOOL,
  createExecuteTestResultTool,
  registerBrunchExecuteTestResult,
  BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL,
  createExecuteWorktreeCreateTool,
  registerBrunchExecuteWorktreeCreate,
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
} from '../.pi/extensions/executor/index.js';
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

export interface BrunchPiExtensionsOptions extends BrunchCommandsOptions {
  graphMentionSource?: GraphMentionSource;
  graph?: BrunchGraphDeps;
  liveExchange?: LiveAskOpener;
  promptContext?: BrunchPromptContextProvider;
  introspection?: BrunchPiIntrospectionOptions;
  continuityDrains?: () => readonly ContinuityDrain[];
  executionPorts?: Partial<ExecutionPorts>;
  /**
   * Optional subagent registry (D44-L/D92-L). When provided with a non-empty
   * code-owned delegatable set, the product `subagent` tool is registered and
   * eligible under Specify-mode tool policy; when omitted or empty it is absent.
   */
  subagents?: BrunchSubagentsDeps;
  /**
   * Optional session-orientation dependency (session-entry-orientation
   * frontier). When provided, the session-orientation extension is registered
   * and wires the dialog to junctures J2 (`session_start` reasons
   * `new`/`resume`), J3 (`session_tree`), J4 (`agent_end` esc-abort), and
   * J6 (`/brunch:consult`). When omitted, no juncture wiring is installed.
   */
  sessionOrientation?: BrunchSessionOrientationDeps;
}

export interface BrunchPiIntrospectionOptions extends BrunchIntrospectionOptions {
  /** Dev/eval-only prompt intervention; absent from normal product launches. */
  readonly directiveAblation?: 'warrant-before-commit';
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
    const hasDelegatableSubagents = (options.subagents?.delegatableAgents.length ?? 0) > 0;
    const entryDebugCache = introspectionOptions?.debugCache;
    const continuitySteps = options.graph
      ? [
          createPrepareNextTurnContinuityStep(options.graph, options.continuityDrains, entryDebugCache),
          createCaptureSweepAdvanceStep(entryDebugCache),
        ]
      : [];
    const chromeRefresh: { current: (() => void) | null } = { current: null };
    const graph = options.graph;
    const executionPorts: ExecutionPorts = {
      ...(options.executionPorts?.planner
        ? { planner: options.executionPorts.planner }
        : options.subagents
          ? { planner: createPlannerPort({ subagents: options.subagents }) }
          : {}),
      gitWorktree: options.executionPorts?.gitWorktree ?? createGitWorktreePort(),
      gitSliceIntegration: options.executionPorts?.gitSliceIntegration ?? createGitSliceIntegrationPort(),
      agentRunner:
        options.executionPorts?.agentRunner ??
        (options.subagents
          ? createAgentRunnerPort({ subagents: options.subagents })
          : createAgentRunnerPort()),
      testRunner: options.executionPorts?.testRunner ?? createTestRunnerPort(),
      gitRunPromotion: options.executionPorts?.gitRunPromotion ?? createGitRunPromotionPort(),
      gitHostLand: options.executionPorts?.gitHostLand ?? createGitHostLandPort(),
    };
    const extensions: BrunchProductExtensionRegistrar[] = [
      registerBrunchKeybindingPolicy,
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
      registerBrunchCompaction,
      registerBrunchOperationalModePolicy,
      registerBrunchContext,
      registerBrunchWebTools,
      registerBrunchExecuteStatus,
      ...(options.productUpdates
        ? [
            (api: ExtensionAPI) =>
              registerBrunchExecuteRunUpdates(api, { productUpdates: options.productUpdates! }),
          ]
        : []),
      (api) =>
        registerBrunchExecuteOrchestrate(
          api,
          executionPorts,
          options.productUpdates ? { productUpdates: options.productUpdates } : undefined,
        ),
      (api) => registerBrunchExecuteAgentResult(api, executionPorts.agentRunner),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteLaunch(api, graph)] : []),
      ...(graph
        ? [
            (api: ExtensionAPI) =>
              registerBrunchExecutePlanFile(api, {
                ...graph,
                ...(executionPorts.planner ? { planner: executionPorts.planner } : {}),
              }),
          ]
        : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanPreview(api, graph)] : []),
      registerBrunchExecutePetriExport,
      (api) => registerBrunchExecutePromotionPrepare(api, executionPorts.gitRunPromotion),
      (api) => registerBrunchExecuteLand(api, executionPorts.gitHostLand),
      registerBrunchExecutePopulate,
      registerBrunchExecuteReportInit,
      registerBrunchExecuteRunComplete,
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteRunCreate(api, graph)] : []),
      registerBrunchExecuteReplanAbandonRun,
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteReplanRecommendation(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteReplanRegeneratePlan(api, graph)] : []),
      ...(graph
        ? [(api: ExtensionAPI) => registerBrunchExecuteReplanRetryCurrentStep(api, executionPorts, graph)]
        : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteReplanStartNewRun(api, graph)] : []),
      registerBrunchExecuteSourcePolicy,
      registerBrunchExecuteSourceCopy,
      (api) => registerBrunchExecuteSliceComplete(api, executionPorts.gitSliceIntegration),
      (api) => registerBrunchExecuteSliceExecute(api, executionPorts.gitSliceIntegration),
      registerBrunchExecuteSliceStart,
      (api) => registerBrunchExecuteTestResult(api, executionPorts.testRunner),
      (api) => registerBrunchExecuteWorktreeCreate(api, executionPorts.gitWorktree),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanCheck(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanDraftArtifact(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanDraft(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanOutlineArtifact(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecutePlanOutline(api, graph)] : []),
      ...(graph ? [(api: ExtensionAPI) => registerBrunchExecuteSnapshot(api, graph)] : []),
      ...(hasDelegatableSubagents
        ? [(api: ExtensionAPI) => registerBrunchSubagents(api, options.subagents!)]
        : []),
      // Prompting registers immediately after operational-mode policy and
      // before mention autocomplete when prompt context is provided; its
      // position in this list is the registration order, not a splice index.
      ...(promptContext
        ? [
            (api: ExtensionAPI) =>
              registerBrunchPrompting(
                api,
                promptContext,
                introspectionOptions?.directiveAblation
                  ? { directiveAblation: introspectionOptions.directiveAblation }
                  : {},
              ),
          ]
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
        }),
      ...(options.sessionOrientation
        ? [(api: ExtensionAPI) => registerBrunchSessionOrientation(api, options.sessionOrientation!)]
        : []),
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchGraph(api, options.graph!)] : []),
      // Session-local elicitation scratchpad (D101-L): no graph dependency —
      // it reads/writes only the session branch via ctx.sessionManager.
      registerBrunchElicitationScratchpad,
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchReconciliation(api, options.graph!)] : []),
      ...(introspectionOptions
        ? [
            (api: ExtensionAPI) => {
              const { store, clock, debugCache } = introspectionOptions;
              registerBrunchIntrospection(api, {
                ...(store ? { store } : {}),
                ...(clock ? { clock } : {}),
                ...(debugCache ? { debugCache } : {}),
              });
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
    const advance = prepareCaptureSweepAdvance(sessionManager.getBranch());
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
  const entries = sessionManager.getBranch();
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
