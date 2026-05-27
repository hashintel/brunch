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
  registerBrunchSettingsSwitcherMenu,
  type BrunchSettingsSwitcherMenuOptions,
} from "./pi-extensions/settings-switcher-menu.js"

export { registerBrunchAlternatives } from "./pi-extensions/alternatives.js"
export { BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE } from "./pi-extensions/command-policy.js"
export {
  extractHashPrefix,
  registerBrunchMentionAutocomplete,
  type GraphMentionCandidate,
  type GraphMentionSource,
} from "./pi-extensions/mention-autocomplete.js"
export { registerBrunchOperationalModePolicy } from "./pi-extensions/operational-mode.js"
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
  BRUNCH_MENU_COMMAND,
  BRUNCH_MENU_SHORTCUT,
  registerBrunchSettingsSwitcherMenu,
  runBrunchMenuCommand,
  runBrunchSettingsSwitcherAction,
  type BrunchSettingsSwitcherMenuOptions,
} from "./pi-extensions/settings-switcher-menu.js"

export interface BrunchPiExtensionShellOptions
  extends BrunchSettingsSwitcherMenuOptions {
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
    registerBrunchSettingsSwitcherMenu(pi, options)
  }
}
