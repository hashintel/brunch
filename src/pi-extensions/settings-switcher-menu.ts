import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent"

import {
  type WorkspaceSessionReadyState,
  type WorkspaceSwitchCoordinator,
  type WorkspaceSwitchDecision,
} from "../workspace-session-coordinator.js"
import {
  createBrunchMenuComponent,
  type BrunchMenuDecision,
} from "../pi-components/brunch-menu.js"
import { createWorkspaceSwitchComponent } from "../pi-components/workspace-switcher/index.js"
import { chromeStateForWorkspace, renderBrunchChrome } from "./chrome.js"

export const BRUNCH_MENU_COMMAND = "brunch"
export const BRUNCH_MENU_SHORTCUT = "ctrl+shift+b"

export interface BrunchWorkspaceCommandOptions {
  coordinator: WorkspaceSwitchCoordinator
}

export function registerBrunchWorkspaceCommand(
  pi: ExtensionAPI,
  { coordinator }: BrunchWorkspaceCommandOptions,
): void {
  pi.registerCommand(BRUNCH_MENU_COMMAND, {
    description: "Open the Brunch menu",
    handler: async (_args, ctx) => {
      await runBrunchMenuCommand(ctx, coordinator)
    },
  })
  pi.registerShortcut?.(BRUNCH_MENU_SHORTCUT, {
    description: "Open the Brunch menu",
    handler: async (ctx) => {
      await runBrunchMenuCommand(ctx as ExtensionCommandContext, coordinator)
    },
  })
}

export async function runBrunchMenuCommand(
  ctx: ExtensionCommandContext,
  coordinator: WorkspaceSwitchCoordinator,
): Promise<void> {
  await ctx.waitForIdle()
  const decision = await ctx.ui.custom<BrunchMenuDecision>(
    (_tui, _theme, _keybindings, done) =>
      createBrunchMenuComponent({ onDecision: done }),
  )

  if (decision === "cancel") {
    ctx.ui.notify("Brunch menu closed.", "info")
    return
  }

  await runBrunchWorkspaceCommand(ctx, coordinator, { waitForIdle: false })
}

export async function runBrunchWorkspaceCommand(
  ctx: ExtensionCommandContext,
  coordinator: WorkspaceSwitchCoordinator,
  options: { waitForIdle?: boolean } = {},
): Promise<void> {
  if (options.waitForIdle !== false) {
    await ctx.waitForIdle()
  }
  const inventory = await coordinator.inspectWorkspace()
  const decision = await ctx.ui.custom<WorkspaceSwitchDecision>(
    (_tui, _theme, _keybindings, done) =>
      createWorkspaceSwitchComponent({ inventory, onDecision: done }),
  )
  const activated = await coordinator.activateWorkspace(decision)

  if (activated.status === "cancelled") {
    ctx.ui.notify("Workspace switch cancelled.", "info")
    return
  }
  if (activated.status === "needs_human") {
    ctx.ui.notify(activated.reason, "warning")
    return
  }

  await switchToActivatedWorkspace(ctx, activated)
}

async function switchToActivatedWorkspace(
  ctx: ExtensionCommandContext,
  activated: WorkspaceSessionReadyState,
): Promise<void> {
  const targetFile = activated.session.file
  if (ctx.sessionManager.getSessionFile() === targetFile) {
    renderBrunchChrome(ctx.ui, chromeStateForWorkspace(activated))
    ctx.ui.notify("Already using the selected Brunch workspace.", "info")
    return
  }

  const targetSessionId = activated.session.id
  const targetSpecTitle = activated.spec.title
  const targetChrome = chromeStateForWorkspace(activated)

  const result = await ctx.switchSession(targetFile, {
    withSession: async (replacementCtx) => {
      renderBrunchChrome(replacementCtx.ui, targetChrome)
      replacementCtx.ui.notify(
        `Switched Brunch workspace to ${targetSpecTitle} (${targetSessionId}).`,
        "info",
      )
    },
  })

  if (result.cancelled) {
    ctx.ui.notify("Workspace switch was cancelled by Pi.", "warning")
  }
}
