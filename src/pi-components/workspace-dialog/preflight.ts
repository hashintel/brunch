import { ProcessTerminal, TUI } from "@earendil-works/pi-tui"

import type {
  WorkspaceLaunchInventory,
  WorkspaceSwitchDecision,
} from "../../workspace-session-coordinator.js"
import { createWorkspaceDialogComponent } from "./component.js"

export async function runWorkspaceDialogPreflight(
  inventory: WorkspaceLaunchInventory,
): Promise<WorkspaceSwitchDecision> {
  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal)

  return await new Promise<WorkspaceSwitchDecision>((resolve) => {
    const finish = (decision: WorkspaceSwitchDecision) => {
      overlay.hide()
      tui.stop()
      resolve(decision)
    }
    const component = createWorkspaceDialogComponent({
      inventory,
      onDecision: finish,
    })
    const overlay = tui.showOverlay(component, {
      anchor: "center",
      width: 72,
      maxHeight: "90%",
      margin: 1,
    })
    terminal.clearScreen()
    tui.start()
  })
}
