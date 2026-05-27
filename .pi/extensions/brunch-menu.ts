/**
 * Brunch workspace dialog demo extension.
 *
 * This project-local probe deliberately stays thin: the actual centered dialog
 * lives in `src/pi-components/workspace-dialog`, so startup and in-session
 * extension paths exercise the same pi-tui component.
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent"

import { createWorkspaceDialogComponent } from "../../src/pi-components/workspace-dialog/index.js"
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSwitchDecision,
} from "../../src/workspace-session-coordinator.js"

const COMMAND = "brunch-workspace-demo"
const SHORTCUT = "ctrl+shift+k"

export default function brunchMenu(pi: ExtensionAPI) {
  pi.registerCommand(COMMAND, {
    description: "Open the shared Brunch workspace dialog demo",
    handler: async (_args, ctx) => openWorkspaceDialog(ctx),
  })
  pi.registerShortcut(SHORTCUT, {
    description: "Open the shared Brunch workspace dialog demo",
    handler: async (ctx) => openWorkspaceDialog(ctx as ExtensionCommandContext),
  })
}

async function openWorkspaceDialog(
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui?.notify?.("Brunch workspace dialog requires UI mode", "warning")
    return
  }

  await ctx.waitForIdle()
  const coordinator = createWorkspaceSessionCoordinator({ cwd: ctx.cwd })
  const inventory = await coordinator.inspectWorkspace()
  const decision = await ctx.ui.custom<WorkspaceSwitchDecision>(
    (_tui, theme, _keybindings, done) =>
      createWorkspaceDialogComponent({ inventory, theme, onDecision: done }),
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: 72,
        maxHeight: "90%",
        margin: 1,
      },
    },
  )
  const activated = await coordinator.activateWorkspace(decision)

  if (activated.status === "cancelled") {
    ctx.ui.notify("Workspace dialog cancelled.", "info")
    return
  }
  if (activated.status === "needs_human") {
    ctx.ui.notify(activated.reason, "warning")
    return
  }

  const targetFile = activated.session.file
  if (ctx.sessionManager.getSessionFile() === targetFile) {
    ctx.ui.notify("Already using the selected Brunch workspace.", "info")
    return
  }

  await ctx.switchSession(targetFile, {
    withSession: async (replacementCtx) => {
      replacementCtx.ui.notify(
        `Switched Brunch workspace to ${activated.spec.title} (${activated.session.id}).`,
        "info",
      )
    },
  })
}
