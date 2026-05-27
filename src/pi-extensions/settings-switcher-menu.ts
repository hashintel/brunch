import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent"

import {
  type WorkspaceSessionReadyState,
  type WorkspaceSwitchCoordinator,
  type WorkspaceSwitchDecision,
} from "../workspace-session-coordinator.js"
import { createWorkspaceSwitchComponent } from "../workspace-switcher/index.js"
import { chromeStateForWorkspace, renderBrunchChrome } from "./chrome.js"

export const BRUNCH_WORKSPACE_COMMAND = "brunch-workspace"

export interface BrunchWorkspaceCommandOptions {
  coordinator: WorkspaceSwitchCoordinator
}

export function registerBrunchWorkspaceCommand(
  pi: ExtensionAPI,
  { coordinator }: BrunchWorkspaceCommandOptions,
): void {
  pi.registerCommand(BRUNCH_WORKSPACE_COMMAND, {
    description: "Switch Brunch spec/session workspace",
    handler: async (_args, ctx) => {
      await runBrunchWorkspaceCommand(ctx, coordinator)
    },
  })
}

export async function runBrunchWorkspaceCommand(
  ctx: ExtensionCommandContext,
  coordinator: WorkspaceSwitchCoordinator,
): Promise<void> {
  await ctx.waitForIdle()
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
