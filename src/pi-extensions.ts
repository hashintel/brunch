import {
  SessionManager,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { registerBrunchAlternatives } from "./pi-extensions/alternatives.js"
import { registerBrunchBranchPolicyHandlers } from "./pi-extensions/command-policy.js"
import {
  registerBrunchMentionAutocomplete,
  type GraphMentionSource,
} from "./pi-extensions/mention-autocomplete.js"
import { registerBrunchOperationalModePolicy } from "./pi-extensions/operational-mode.js"
import {
  renderBrunchChrome,
  type BrunchChromeState,
} from "./pi-extensions/chrome.js"
import {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./pi-extensions/session-lifecycle.js"
import {
  registerBrunchWorkspaceDialog,
  type BrunchWorkspaceDialogOptions,
} from "./pi-extensions/workspace-dialog.js"

export { registerBrunchAlternatives } from "./pi-extensions/alternatives.js"
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./pi-extensions/command-policy.js"
export {
  extractHashPrefix,
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from "./pi-extensions/mention-autocomplete.js"
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
} from "./pi-extensions/operational-mode.js"
export {
  chromeStateForWorkspace,
  formatBrunchChromeFooterLines,
  formatBrunchChromeHeaderLines,
  formatBrunchStatus,
  formatChromeWidgetLines,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeUi,
  type BrunchChromeWorkerStatus,
} from "./pi-extensions/chrome.js"
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./pi-extensions/session-lifecycle.js"
export {
  BRUNCH_WORKSPACE_COMMAND,
  BRUNCH_WORKSPACE_SHORTCUT,
  registerBrunchWorkspaceDialog,
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchWorkspaceDialogOptions,
} from "./pi-extensions/workspace-dialog.js"

export interface BrunchPiExtensionShellOptions
  extends BrunchWorkspaceDialogOptions {
  graphMentionSource?: GraphMentionSource
}

export function createBrunchPiExtensionShell(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchPiExtensionShellOptions,
): ExtensionFactory {
  return (pi) => {
    pi.on("session_start", async (_event, ctx) => {
      await bindBrunchSessionBoundary(
        ctx.sessionManager as SessionManager,
        onSessionBoundary,
      )
      renderBrunchChrome(ctx.ui, chrome)
    })
    registerBrunchSessionBoundaryRefreshHandlers(pi, onSessionBoundary)
    registerBrunchBranchPolicyHandlers(pi)
    registerBrunchOperationalModePolicy(pi)
    registerBrunchMentionAutocomplete(pi, options.graphMentionSource)
    registerBrunchAlternatives(pi)
    registerBrunchWorkspaceDialog(pi, options)
  }
}
