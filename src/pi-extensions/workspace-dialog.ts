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
  WORKSPACE_DIALOG_WIDTH,
  createWorkspaceDialogComponent,
} from "../pi-components/workspace-dialog/index.js"
import { chromeStateForWorkspace, renderBrunchChrome } from "./chrome.js"

export const BRUNCH_WORKSPACE_COMMAND = "brunch"
export const BRUNCH_WORKSPACE_SHORTCUT = "ctrl+shift+b"

export interface BrunchWorkspaceDialogOptions {
  coordinator: WorkspaceSwitchCoordinator
}

export function registerBrunchWorkspaceDialog(
  pi: ExtensionAPI,
  { coordinator }: BrunchWorkspaceDialogOptions,
): void {
  pi.registerCommand(BRUNCH_WORKSPACE_COMMAND, {
    description: "Open the Brunch spec/session picker",
    handler: async (_args, ctx) => {
      await runBrunchWorkspaceCommand(ctx, coordinator)
    },
  })
  pi.registerShortcut?.(BRUNCH_WORKSPACE_SHORTCUT, {
    description: "Open the Brunch spec/session picker",
    handler: async (ctx) => {
      await runBrunchWorkspaceCommand(
        ctx as ExtensionCommandContext,
        coordinator,
      )
    },
  })
}

export async function runBrunchWorkspaceCommand(
  ctx: ExtensionCommandContext,
  coordinator: WorkspaceSwitchCoordinator,
): Promise<void> {
  await runBrunchWorkspaceAction(ctx, coordinator)
}

export async function runBrunchWorkspaceAction(
  ctx: ExtensionCommandContext,
  coordinator: WorkspaceSwitchCoordinator,
  options: { waitForIdle?: boolean } = {},
): Promise<void> {
  if (options.waitForIdle !== false && canWaitForIdle(ctx)) {
    await ctx.waitForIdle()
  }
  const inventory = await coordinator.inspectWorkspace()
  const decision = await ctx.ui.custom<WorkspaceSwitchDecision>(
    (_tui, theme, _keybindings, done) =>
      createWorkspaceDialogComponent({ inventory, theme, onDecision: done }),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: WORKSPACE_DIALOG_WIDTH,
        maxHeight: "90%",
        margin: 1,
      },
    },
  )
  const activated = await coordinator.activateWorkspace(decision)

  if (activated.status === "cancelled") {
    ctx.ui.notify("Spec/session switch cancelled.", "info")
    return
  }
  if (activated.status === "needs_human") {
    ctx.ui.notify(activated.reason, "warning")
    return
  }

  await switchToActivatedWorkspace(ctx, activated)
}

function canWaitForIdle(
  ctx: ExtensionCommandContext,
): ctx is ExtensionCommandContext & { waitForIdle: () => Promise<void> } {
  return typeof ctx.waitForIdle === "function"
}

async function switchToActivatedWorkspace(
  ctx: ExtensionCommandContext,
  activated: WorkspaceSessionReadyState,
): Promise<void> {
  const targetFile = activated.session.file
  if (ctx.sessionManager.getSessionFile() === targetFile) {
    renderBrunchChrome(ctx.ui, chromeStateForWorkspace(activated))
    ctx.ui.notify("Already using the selected Brunch spec/session.", "info")
    return
  }

  const targetSessionId = activated.session.id
  const targetSpecTitle = activated.spec.title
  const targetChrome = chromeStateForWorkspace(activated)

  const result = await ctx.switchSession(targetFile, {
    withSession: async (replacementCtx) => {
      renderBrunchChrome(replacementCtx.ui, targetChrome)
      replacementCtx.ui.notify(
        `Switched Brunch spec/session to ${targetSpecTitle} (${targetSessionId}).`,
        "info",
      )
    },
  })

  if (result.cancelled) {
    ctx.ui.notify("Spec/session switch was cancelled by Pi.", "warning")
  }
}
