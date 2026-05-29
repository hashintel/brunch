import {
  type ExtensionAPI,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { registerBrunchAlternatives } from "./.pi/extensions/alternatives.js"
import { registerBrunchChrome } from "./.pi/extensions/chrome.js"
import { registerBrunchBranchPolicyHandlers } from "./.pi/extensions/command-policy.js"
import { type GraphMentionSource } from "./.pi/extensions/mention-autocomplete.js"
import {
  FIXTURE_GRAPH_MENTION_SOURCE,
  registerBrunchMentionAutocomplete,
} from "./.pi/extensions/mention-autocomplete.js"
import { registerBrunchOperationalModePolicy } from "./.pi/extensions/operational-mode.js"
import { registerBrunchSessionBoundary } from "./.pi/extensions/session-lifecycle.js"
import { registerStructuredExchange } from "./.pi/extensions/structured-exchange/index.js"
import { type BrunchChromeState } from "./.pi/extensions/chrome.js"
import { type BrunchSessionBoundaryHandler } from "./.pi/extensions/session-lifecycle.js"
import { type BrunchSpecSessionPickerOptions } from "./.pi/extensions/workspace-dialog.js"
import { registerBrunchWorkspaceDialog } from "./.pi/extensions/workspace-dialog.js"

export { registerBrunchAlternatives } from "./.pi/extensions/alternatives.js"
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./.pi/extensions/command-policy.js"
export {
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from "./.pi/extensions/mention-autocomplete.js"
export {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
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
} from "./.pi/extensions/operational-mode.js"
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
} from "./.pi/extensions/chrome.js"
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./.pi/extensions/session-lifecycle.js"
export {
  BRUNCH_WORKSPACE_COMMAND,
  BRUNCH_WORKSPACE_SHORTCUT,
  registerBrunchWorkspaceDialog,
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchSpecSessionPickerOptions,
} from "./.pi/extensions/workspace-dialog.js"

export interface BrunchPiExtensionShellOptions
  extends BrunchSpecSessionPickerOptions {
  graphMentionSource?: GraphMentionSource
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
      (api) => registerBrunchMentionAutocomplete(api, graphMentionSource),
      registerBrunchAlternatives,
      registerStructuredExchange,
      (api) => registerBrunchWorkspaceDialog(api, options),
    ]

    for (const registerExtension of extensions) {
      await registerExtension(pi)
    }
  }
}
