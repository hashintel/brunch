import {
  SessionManager,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { registerBrunchAlternatives } from "./tui-client/.pi/extensions/alternatives.js"
import { registerBrunchBranchPolicyHandlers } from "./tui-client/.pi/extensions/command-policy.js"
import {
  FIXTURE_GRAPH_MENTION_SOURCE,
  registerBrunchMentionAutocomplete,
  type GraphMentionSource,
} from "./tui-client/.pi/extensions/mention-autocomplete.js"
import { registerBrunchOperationalModePolicy } from "./tui-client/.pi/extensions/operational-mode.js"
import registerBrunchStructuredExchange from "./tui-client/.pi/extensions/structured-exchange/index.js"
import { registerBrunchStructuredQuestion } from "./tui-client/.pi/extensions/structured-question.js"
import {
  renderBrunchChrome,
  type BrunchChromeState,
} from "./tui-client/.pi/extensions/chrome.js"
import {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./tui-client/.pi/extensions/session-lifecycle.js"
import {
  registerBrunchWorkspaceDialog,
  type BrunchSpecSessionPickerOptions,
} from "./tui-client/.pi/extensions/workspace-dialog.js"

export { registerBrunchAlternatives } from "./tui-client/.pi/extensions/alternatives.js"
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./tui-client/.pi/extensions/command-policy.js"
export {
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from "./tui-client/.pi/extensions/mention-autocomplete.js"
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
} from "./tui-client/.pi/extensions/operational-mode.js"
export {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
  type BrunchChromeCoherenceVerdict,
  type BrunchChromeFooterTelemetry,
  type BrunchChromeStage,
  type BrunchChromeState,
  type BrunchChromeUi,
  type BrunchChromeWorkerStatus,
} from "./tui-client/.pi/extensions/chrome.js"
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./tui-client/.pi/extensions/session-lifecycle.js"
export {
  STRUCTURED_QUESTION_TOOL,
  answerStructuredQuestionWithTui,
  buildStructuredQuestionEditorPrefill,
  createStructuredQuestionTuiComponent,
  parseStructuredQuestionEditorResponse,
  registerBrunchStructuredQuestion,
  structuredQuestionResultFromEditor,
  type StructuredQuestionTuiResponse,
} from "./tui-client/.pi/extensions/structured-question.js"
export {
  BRUNCH_WORKSPACE_COMMAND,
  BRUNCH_WORKSPACE_SHORTCUT,
  registerBrunchWorkspaceDialog,
  runBrunchWorkspaceAction,
  runBrunchWorkspaceCommand,
  type BrunchSpecSessionPickerOptions,
} from "./tui-client/.pi/extensions/workspace-dialog.js"

export interface BrunchPiExtensionShellOptions
  extends BrunchSpecSessionPickerOptions {
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
    registerBrunchMentionAutocomplete(
      pi,
      options.graphMentionSource ?? FIXTURE_GRAPH_MENTION_SOURCE,
    )
    registerBrunchAlternatives(pi)
    registerBrunchStructuredQuestion(pi)
    registerBrunchStructuredExchange(pi)
    registerBrunchWorkspaceDialog(pi, options)
  }
}
