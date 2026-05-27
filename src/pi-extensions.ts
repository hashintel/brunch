import {
  SessionManager,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent"

import { registerBrunchBranchPolicyHandlers } from "./pi-extensions/command-policy.js"
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
  registerBrunchWorkspaceCommand,
  type BrunchWorkspaceCommandOptions,
} from "./pi-extensions/settings-switcher-menu.js"

export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./pi-extensions/command-policy.js"
export {
  chromeStateForWorkspace,
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
  registerBrunchWorkspaceCommand,
  runBrunchWorkspaceCommand,
  type BrunchWorkspaceCommandOptions,
} from "./pi-extensions/settings-switcher-menu.js"

export function createBrunchPiExtensionShell(
  chrome: BrunchChromeState,
  onSessionBoundary: BrunchSessionBoundaryHandler | undefined,
  options: BrunchWorkspaceCommandOptions,
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
    registerBrunchWorkspaceCommand(pi, options)
  }
}
