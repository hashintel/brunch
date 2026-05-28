import type { ThemeColor } from "@earendil-works/pi-coding-agent"
import { ProcessTerminal, TUI, type Terminal } from "@earendil-works/pi-tui"

import type {
  WorkspaceLaunchInventory,
  SpecSessionActivationDecision,
} from "../../../../workspace-session-coordinator.js"
import {
  WORKSPACE_DIALOG_WIDTH,
  createWorkspaceDialogComponent,
  type WorkspaceDialogTheme,
} from "./component.js"

interface WorkspaceDialogPreflightOptions {
  terminal?: Terminal
  theme?: WorkspaceDialogTheme
}

export async function runWorkspaceDialogPreflight(
  inventory: WorkspaceLaunchInventory,
  options: WorkspaceDialogPreflightOptions = {},
): Promise<SpecSessionActivationDecision> {
  const terminal = options.terminal ?? new ProcessTerminal()
  const tui = new TUI(terminal)
  const dialogTheme = options.theme ?? resolveStartupDialogTheme()

  return await new Promise<SpecSessionActivationDecision>((resolve) => {
    const finish = (decision: SpecSessionActivationDecision) => {
      overlay.hide()
      tui.stop()
      terminal.clearScreen()
      resolve(decision)
    }
    const component = createWorkspaceDialogComponent({
      inventory,
      theme: dialogTheme,
      onDecision: finish,
    })
    const overlay = tui.showOverlay(component, {
      anchor: "center",
      width: WORKSPACE_DIALOG_WIDTH,
      maxHeight: "90%",
      margin: 1,
    })
    terminal.clearScreen()
    tui.start()
  })
}

function resolveStartupDialogTheme(): WorkspaceDialogTheme {
  const colors = startupPalette(detectStartupThemeName())
  return {
    fg(color: ThemeColor, text: string) {
      const ansi = colors[color]
      return ansi ? `${ansi}${text}\x1B[39m` : text
    },
  }
}

function detectStartupThemeName(): "dark" | "light" {
  const colorfgbg = process.env.COLORFGBG ?? ""
  const background = Number.parseInt(colorfgbg.split(";").at(-1) ?? "", 10)
  if (!Number.isNaN(background)) {
    return background < 8 ? "dark" : "light"
  }
  return "dark"
}

function startupPalette(
  themeName: "dark" | "light",
): Partial<Record<ThemeColor, string>> {
  if (themeName === "light") {
    return {
      accent: "\x1B[38;2;90;128;128m",
      borderMuted: "\x1B[38;2;176;176;176m",
      dim: "\x1B[38;2;118;118;118m",
      muted: "\x1B[38;2;108;108;108m",
      success: "\x1B[38;2;88;132;88m",
    }
  }
  return {
    accent: "\x1B[38;2;138;190;183m",
    borderMuted: "\x1B[38;2;80;80;80m",
    dim: "\x1B[38;2;102;102;102m",
    muted: "\x1B[38;2;128;128;128m",
    success: "\x1B[38;2;181;189;104m",
  }
}
