import { ProcessTerminal, TUI } from "@earendil-works/pi-tui"

import type {
  WorkspaceLaunchInventory,
  WorkspaceSwitchDecision,
} from "../workspace-session-coordinator.js"
import { createWorkspaceSwitchComponent } from "./component.js"

export async function runWorkspaceSwitchPreflight(
  inventory: WorkspaceLaunchInventory,
): Promise<WorkspaceSwitchDecision> {
  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal)

  return await new Promise<WorkspaceSwitchDecision>((resolve) => {
    const finish = (decision: WorkspaceSwitchDecision) => {
      tui.stop()
      resolve(decision)
    }
    const component = createWorkspaceSwitchComponent({
      inventory,
      onDecision: finish,
    })
    tui.addChild(component)
    tui.setFocus(component)
    terminal.clearScreen()
    tui.start()
  })
}
