import { type ExtensionAPI, type ExtensionFactory } from '@earendil-works/pi-coding-agent';

import { registerBrunchAlternatives } from './extensions/alternatives.js';
import { registerBrunchChrome } from './extensions/chrome.js';
import { type BrunchChromeState } from './extensions/chrome.js';
import { registerBrunchBranchPolicyHandlers } from './extensions/command-policy.js';
import { registerBrunchCommands, type BrunchCommandsOptions } from './extensions/commands.js';
import { registerBrunchGraph, type BrunchGraphDeps } from './extensions/graph/index.js';
import { type GraphMentionSource } from './extensions/mention-autocomplete.js';
import {
  FIXTURE_GRAPH_MENTION_SOURCE,
  registerBrunchMentionAutocomplete,
} from './extensions/mention-autocomplete.js';
import { registerBrunchOperationalModePolicy } from './extensions/operational-mode.js';
import { registerBrunchPrompting, type BrunchPromptContextProvider } from './extensions/prompting.js';
import { registerBrunchSessionBoundary } from './extensions/session-lifecycle.js';
import { type BrunchSessionBoundaryHandler } from './extensions/session-lifecycle.js';
import { registerStructuredExchange } from './extensions/structured-exchange/index.js';

export { registerBrunchAlternatives } from './extensions/alternatives.js';
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from './extensions/command-policy.js';
export {
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from './extensions/mention-autocomplete.js';
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
} from './extensions/operational-mode.js';
export { registerBrunchPrompting } from './extensions/prompting.js';
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
} from './extensions/chrome.js';
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from './extensions/session-lifecycle.js';
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
} from './extensions/commands.js';
export {
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchSpecSessionPickerOptions,
} from './extensions/workspace-dialog.js';

export {
  registerBrunchGraph,
  type BrunchGraphDeps,
  type GraphSnapshotReaders,
} from './extensions/graph/index.js';

export interface BrunchPiExtensionShellOptions extends BrunchCommandsOptions {
  graphMentionSource?: GraphMentionSource;
  graph?: BrunchGraphDeps;
  promptContext?: BrunchPromptContextProvider;
}

type BrunchProductExtensionRegistrar = (pi: ExtensionAPI) => void | Promise<void>;

export function createBrunchPiExtensionShell(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchPiExtensionShellOptions,
): ExtensionFactory {
  return async (pi) => {
    const graphMentionSource = options.graphMentionSource ?? FIXTURE_GRAPH_MENTION_SOURCE;
    const extensions: BrunchProductExtensionRegistrar[] = [
      (api) => registerBrunchSessionBoundary(api, onSessionBoundary),
      (api) => registerBrunchChrome(api, chrome),
      registerBrunchBranchPolicyHandlers,
      registerBrunchOperationalModePolicy,
      (api) => registerBrunchMentionAutocomplete(api, graphMentionSource),
      registerBrunchAlternatives,
      registerStructuredExchange,
      (api) => registerBrunchCommands(api, options),
      ...(options.graph ? [(api: ExtensionAPI) => registerBrunchGraph(api, options.graph!)] : []),
    ];
    if (options.promptContext) {
      extensions.splice(4, 0, (api) => registerBrunchPrompting(api, options.promptContext!));
    }

    for (const registerExtension of extensions) {
      await registerExtension(pi);
    }
  };
}
