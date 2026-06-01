import {
  type ExtensionAPI,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { registerBrunchAlternatives } from "./extensions/alternatives.js"
import { registerBrunchChrome } from "./extensions/chrome.js"
import { registerBrunchBranchPolicyHandlers } from "./extensions/command-policy.js"
import { type GraphMentionSource } from "./extensions/mention-autocomplete.js"
import {
  FIXTURE_GRAPH_MENTION_SOURCE,
  registerBrunchMentionAutocomplete,
} from "./extensions/mention-autocomplete.js"
import { registerBrunchOperationalModePolicy } from "./extensions/operational-mode.js"
import { registerBrunchPrompting } from "./extensions/prompting.js"
import { registerBrunchSessionBoundary } from "./extensions/session-lifecycle.js"
import { registerStructuredExchange } from "./extensions/structured-exchange/index.js"
import { type BrunchChromeState } from "./extensions/chrome.js"
import { type BrunchSessionBoundaryHandler } from "./extensions/session-lifecycle.js"
import { type BrunchSpecSessionPickerOptions } from "./extensions/workspace-dialog.js"
import { registerBrunchWorkspaceDialog } from "./extensions/workspace-dialog.js"
import {
  registerBrunchGraph,
  type BrunchGraphDeps,
} from "./extensions/graph/index.js"

export { registerBrunchAlternatives } from "./extensions/alternatives.js"
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./extensions/command-policy.js"
export {
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from "./extensions/mention-autocomplete.js"
export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  activeToolNamesForBrunchAgentState,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
  type AgentLensId,
  type AgentRoleDefinition,
  type AgentRoleId,
  type AgentStrategyId,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  type BrunchAgentStateEntrySessionManager,
  type OperationalModeDefinition,
  type OperationalModeId,
  type ResolvedBrunchAgentState,
} from "./extensions/operational-mode.js"
export { registerBrunchPrompting } from "./extensions/prompting.js"
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
} from "./extensions/chrome.js"
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./extensions/session-lifecycle.js"
export {
  BRUNCH_WORKSPACE_COMMAND,
  BRUNCH_WORKSPACE_SHORTCUT,
  registerBrunchWorkspaceDialog,
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchSpecSessionPickerOptions,
} from "./extensions/workspace-dialog.js"

export {
  registerBrunchGraph,
  type BrunchGraphDeps,
  type GraphSnapshotReaders,
} from "./extensions/graph/index.js"

export interface BrunchPiExtensionShellOptions
  extends BrunchSpecSessionPickerOptions {
  graphMentionSource?: GraphMentionSource
  graph?: BrunchGraphDeps
}

type BrunchProductExtensionRegistrar = (
  pi: ExtensionAPI,
) => void | Promise<void>

export function createBrunchPiExtensionShell(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchPiExtensionShellOptions,
): ExtensionFactory {
  return async (pi) => {
    const graphMentionSource =
      options.graphMentionSource ?? FIXTURE_GRAPH_MENTION_SOURCE
    const extensions: readonly BrunchProductExtensionRegistrar[] = [
      (api) => registerBrunchSessionBoundary(api, onSessionBoundary),
      (api) => registerBrunchChrome(api, chrome),
      registerBrunchBranchPolicyHandlers,
      registerBrunchOperationalModePolicy,
      registerBrunchPrompting,
      (api) => registerBrunchMentionAutocomplete(api, graphMentionSource),
      registerBrunchAlternatives,
      registerStructuredExchange,
      (api) => registerBrunchWorkspaceDialog(api, options),
      ...(options.graph
        ? [(api: ExtensionAPI) => registerBrunchGraph(api, options.graph!)]
        : []),
    ]

    for (const registerExtension of extensions) {
      await registerExtension(pi)
    }
  }
}
