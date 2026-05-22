import {
  SessionManager,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { registerBrunchBranchPolicyHandlers } from "./branch-policy.js"
import { renderBrunchChrome, type BrunchChromeState } from "./chrome.js"
import {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./session-boundary.js"

export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./branch-policy.js"
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
} from "./chrome.js"
export {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundaryRefreshHandlers,
  type BrunchSessionBoundaryHandler,
} from "./session-boundary.js"

export function createBrunchChromeExtension(
  chrome: BrunchChromeState,
  onSessionBoundary?: BrunchSessionBoundaryHandler,
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
  }
}
