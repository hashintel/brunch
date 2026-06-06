import { type ExtensionAPI, type ExtensionFactory } from '@earendil-works/pi-coding-agent';

import { registerBrunchAlternatives } from './components/alternatives.js';
import { registerBrunchChrome } from './extensions/chrome/index.js';
import { type BrunchChromeState } from './extensions/chrome/index.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from './extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers } from './extensions/commands/policy.js';
import { registerStructuredExchange } from './extensions/exchanges/index.js';
import { registerBrunchGraph, type BrunchGraphDeps } from './extensions/graph/index.js';
import { type GraphMentionSource } from './extensions/mentions/index.js';
import {
  FIXTURE_GRAPH_MENTION_SOURCE,
  registerBrunchMentionAutocomplete,
} from './extensions/mentions/index.js';
import { registerBrunchOperationalModePolicy } from './extensions/runtime/index.js';
import { registerBrunchSessionBoundary } from './extensions/session/lifecycle.js';
import { type BrunchSessionBoundaryHandler } from './extensions/session/lifecycle.js';
import {
  registerBrunchPrompting,
  type BrunchPromptContextProvider,
} from './extensions/system-prompts/index.js';

export { registerBrunchAlternatives } from './components/alternatives.js';
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from './extensions/commands/policy.js';
export {
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from './extensions/mentions/index.js';
export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  activeToolNamesForBrunchAgentState,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
  type AgentGoalSelection,
  type AgentGoalId,
  type AgentLensId,
  type AgentLensSelection,
  type AgentRoleDefinition,
  type AgentRoleId,
  type AgentStrategyId,
  type AgentStrategySelection,
  type AutoAxisSelection,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  type BrunchAgentStateEntrySessionManager,
  type OperationalModeDefinition,
  type OperationalModeId,
  type ResolvedBrunchAgentState,
} from './extensions/runtime/index.js';
export { registerBrunchPrompting } from './extensions/system-prompts/index.js';
export {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  registerBrunchChrome,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeFooterTelemetry,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeUi,
  type BrunchChromeWorkerStatus,
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
  type BrunchCommandsOptions,
} from './extensions/commands/index.js';
export {
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchSpecSessionPickerOptions,
} from './extensions/workspace/index.js';

export {
  registerBrunchGraph,
  type BrunchGraphDeps,
  type GraphSnapshotReaders,
} from './extensions/graph/index.js';

export interface BrunchPiExtensionsOptions extends BrunchCommandsOptions {
  graphMentionSource?: GraphMentionSource;
  graph?: BrunchGraphDeps;
  promptContext?: BrunchPromptContextProvider;
}

type BrunchProductExtensionRegistrar = (pi: ExtensionAPI) => void | Promise<void>;

export function createBrunchPiExtensions(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchPiExtensionsOptions,
): ExtensionFactory {
  return async (pi) => {
    const graphMentionSource = options.graphMentionSource ?? FIXTURE_GRAPH_MENTION_SOURCE;
    const promptContext = options.promptContext;
    const extensions: BrunchProductExtensionRegistrar[] = [
      (api) => registerBrunchSessionBoundary(api, onSessionBoundary),
      (api) => registerBrunchChrome(api, chrome),
      registerBrunchBranchPolicyHandlers,
      registerBrunchOperationalModePolicy,
      // Prompting registers immediately after operational-mode policy and
      // before mention autocomplete when prompt context is provided; its
      // position in this list is the registration order, not a splice index.
      ...(promptContext ? [(api: ExtensionAPI) => registerBrunchPrompting(api, promptContext)] : []),
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
    ];

    for (const registerExtension of extensions) {
      await registerExtension(pi);
    }
  };
}
