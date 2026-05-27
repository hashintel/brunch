import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { VERSION as PI_VERSION } from "@earendil-works/pi-coding-agent"
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent"
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type Component,
} from "@earendil-works/pi-tui"

import type {
  WorkspaceLaunchInventory,
  SpecSessionActivationDecision,
} from "../../workspace-session-coordinator.js"
import {
  buildWorkspaceSelectionView,
  selectWorkspaceSelectionOption,
  type WorkspaceSelectionStage,
  type WorkspaceSelectionView,
} from "./model.js"

export const WORKSPACE_DIALOG_WIDTH = 80
const ESC = String.fromCharCode(27)
const CTRL_C = "\x03"
const ANSI_SEQUENCE = new RegExp(`^${ESC}\\[[0-9;?]*[ -/]*[@-~]`)
const ANSI_SEQUENCE_GLOBAL = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g")
const ASSET_DIR = new URL("./assets/", import.meta.url)
const PACKAGE_JSON_URL = new URL("../../../package.json", import.meta.url)
const LOCAL_BUILD_TIME = formatBuildTime(new Date())

// Letterform copied from: cfonts "brunch" -f tiny -c candy
const BRUNCH_WORDMARK = ["█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █", "█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█"]

export type WorkspaceDialogTheme = Pick<Theme, "fg">

export interface WorkspaceDialogComponentOptions {
  inventory: WorkspaceLaunchInventory
  onDecision: (decision: SpecSessionActivationDecision) => void
  theme?: WorkspaceDialogTheme
  includeContinue?: boolean
}

export function createWorkspaceDialogComponent(
  options: WorkspaceDialogComponentOptions,
): Component {
  return new WorkspaceDialogComponent(options)
}

class WorkspaceDialogComponent implements Component {
  #inventory: WorkspaceLaunchInventory
  #onDecision: (decision: SpecSessionActivationDecision) => void
  #theme: WorkspaceDialogTheme | undefined
  #includeContinue: boolean
  #selectedIndex = 0
  #stage: WorkspaceSelectionStage = { stage: "home" }
  #history: WorkspaceSelectionStage[] = []
  #title = ""

  constructor(options: WorkspaceDialogComponentOptions) {
    this.#inventory = options.inventory
    this.#onDecision = options.onDecision
    this.#theme = options.theme
    this.#includeContinue = options.includeContinue ?? true
  }

  handleInput(data: string): void {
    if (data === CTRL_C) {
      this.#onDecision({ action: "cancel" })
      return
    }

    if (this.#stage.stage === "newSpecTitle") {
      this.#handleTitleInput(data)
      return
    }

    const view = this.#view()

    if (matchesKey(data, Key.up)) {
      this.#selectedIndex = Math.max(0, this.#selectedIndex - 1)
      return
    }
    if (matchesKey(data, Key.down)) {
      this.#selectedIndex = Math.min(
        view.options.length - 1,
        this.#selectedIndex + 1,
      )
      return
    }
    if (matchesKey(data, Key.escape)) {
      this.#backOrCancel()
      return
    }
    if (matchesKey(data, Key.enter)) {
      this.#selectCurrentOption()
    }
  }

  render(width: number): string[] {
    const dialogWidth = Math.max(24, Math.min(width, WORKSPACE_DIALOG_WIDTH))
    const content = this.#contentLines()
    return renderFrame(content, dialogWidth, this.#theme)
  }

  invalidate(): void {}

  #contentLines(): string[] {
    const view = this.#view()
    const title = style(this.#theme, "accent", view.title)
    const subtitle = style(
      this.#theme,
      "dim",
      "Choose or create the spec/session before the agent loop runs.",
    )
    const logo = readLogo()
    const version = brunchVersion()
    const versionLine = style(
      this.#theme,
      "accent",
      `brunch ${version.version}`,
    )
    const devLine = version.dev
      ? style(this.#theme, "success", version.dev)
      : null
    const piLine = style(this.#theme, "dim", `built on Pi v${PI_VERSION}`)
    const lines = [
      ...logo,
      ...(logo.length > 0 ? [""] : []),
      ...BRUNCH_WORDMARK.map((line) => style(this.#theme, "muted", line)),
      "",
      versionLine,
      ...(devLine ? [devLine] : []),
      piLine,
      "",
      title,
      subtitle,
      "",
    ]

    if (this.#stage.stage === "newSpecTitle") {
      lines.push("New specification title:", `› ${this.#title}`)
      lines.push("", style(this.#theme, "dim", "enter create • esc back"))
      return lines
    }

    for (const [index, option] of view.options.entries()) {
      const selected = index === this.#selectedIndex
      const prefix = selected ? style(this.#theme, "accent", "› ") : "  "
      const label = selected
        ? style(this.#theme, "accent", option.label)
        : option.label
      lines.push(`${prefix}${label}`)
      lines.push(`    ${style(this.#theme, "dim", option.description)}`)
    }
    lines.push(
      "",
      style(this.#theme, "dim", "↑↓ navigate • enter select • esc cancel"),
    )
    return lines
  }

  #selectCurrentOption(): void {
    const result = selectWorkspaceSelectionOption(
      this.#view(),
      this.#selectedIndex,
      this.#inventory,
      { includeContinue: this.#includeContinue },
    )
    if ("decision" in result) {
      this.#onDecision(result.decision)
      return
    }
    this.#history.push(this.#stage)
    this.#stage = viewToStage(result.view)
    this.#selectedIndex = 0
    if (this.#stage.stage === "newSpecTitle") this.#title = ""
  }

  #handleTitleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.#backOrCancel()
      return
    }
    if (matchesKey(data, Key.backspace)) {
      this.#title = this.#title.slice(0, -1)
      return
    }
    if (matchesKey(data, Key.enter)) {
      const title = this.#title.trim()
      if (title.length > 0) {
        this.#onDecision({ action: "newSpec", title })
      }
      return
    }
    if (isPrintableInput(data)) {
      this.#title += data
    }
  }

  #view(): WorkspaceSelectionView {
    return buildWorkspaceSelectionView(this.#inventory, this.#stage, {
      includeContinue: this.#includeContinue,
    })
  }

  #backOrCancel(): void {
    const previous = this.#history.pop()
    if (!previous) {
      this.#onDecision({ action: "cancel" })
      return
    }
    this.#stage = previous
    this.#selectedIndex = 0
    this.#title = ""
  }
}

function viewToStage(view: WorkspaceSelectionView): WorkspaceSelectionStage {
  if (view.stage === "newSpecTitle") return { stage: "newSpecTitle", title: "" }
  if (view.stage === "specAction" && view.specId)
    return { stage: "specAction", specId: view.specId }
  if (view.stage === "sessionList" && view.specId)
    return { stage: "sessionList", specId: view.specId }
  if (view.stage === "specList") return { stage: "specList" }
  return { stage: "home" }
}

function renderFrame(
  content: string[],
  width: number,
  theme: WorkspaceDialogTheme | undefined,
): string[] {
  return [
    topBorderLine(width, theme),
    emptyLine(width, theme),
    ...content.map((line) => contentLine(line, width, theme)),
    emptyLine(width, theme),
    bottomBorderLine(width, theme),
  ]
}

interface PackageJson {
  version?: unknown
  private?: unknown
}

interface BrunchVersionInfo {
  version: string
  dev: string | null
}

function formatBuildTime(date: Date): string {
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC")
}

function readPackage(): PackageJson {
  try {
    return JSON.parse(
      readFileSync(fileURLToPath(PACKAGE_JSON_URL), "utf8"),
    ) as PackageJson
  } catch {
    return {}
  }
}

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return ""
  }
}

function brunchVersion(): BrunchVersionInfo {
  const pkg = readPackage()
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0"
  const isLocalDev = pkg.private === true || version === "0.0.0"
  if (!isLocalDev) return { version: `v${version}`, dev: null }

  const gitSha = getGitSha()
  const devMeta = [gitSha, `@ ${LOCAL_BUILD_TIME}`].filter(Boolean).join(" ")
  return { version: `v${version}`, dev: devMeta ? `(dev ${devMeta})` : "(dev)" }
}

function contentLine(
  content: string,
  width: number,
  theme: WorkspaceDialogTheme | undefined,
): string {
  if (width <= 4) return truncateToWidth(content, width)
  const innerWidth = width - 4
  const inner = truncateToWidth(content, innerWidth)
  const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(inner)))
  const vertical = style(theme, "borderMuted", "│")
  return `${vertical} ${inner}${padding} ${vertical}`
}

function emptyLine(
  width: number,
  theme: WorkspaceDialogTheme | undefined,
): string {
  if (width <= 2) return " ".repeat(Math.max(0, width))
  const vertical = style(theme, "borderMuted", "│")
  return `${vertical}${" ".repeat(width - 2)}${vertical}`
}

function topBorderLine(
  width: number,
  theme: WorkspaceDialogTheme | undefined,
): string {
  if (width <= 2) return " ".repeat(Math.max(0, width))
  return style(theme, "borderMuted", `╭${"─".repeat(width - 2)}╮`)
}

function bottomBorderLine(
  width: number,
  theme: WorkspaceDialogTheme | undefined,
): string {
  if (width <= 2) return " ".repeat(Math.max(0, width))
  return style(theme, "borderMuted", `╰${"─".repeat(width - 2)}╯`)
}

function readLogo(): string[] {
  const asset = supportsTruecolor()
    ? "brunch-logo-quad-56x18.ansi"
    : "brunch-logo-quad-56x18-240.ansi"
  try {
    return cropLogo(
      readFileSync(fileURLToPath(new URL(asset, ASSET_DIR)), "utf8")
        .replace(new RegExp(`${ESC}\\[\\?25[lh]`, "g"), "")
        .replace(new RegExp(`${ESC}\\[0m$`, "g"), "")
        .split("\n"),
    )
  } catch {
    return []
  }
}

function supportsTruecolor(): boolean {
  const colorterm = process.env.COLORTERM?.toLowerCase() ?? ""
  const term = process.env.TERM?.toLowerCase() ?? ""
  return (
    colorterm === "truecolor" ||
    colorterm === "24bit" ||
    term.includes("truecolor")
  )
}

function cropLogo(lines: string[]): string[] {
  const cropped = [...lines]
  while (cropped.length > 0 && stripAnsi(cropped[0]!).trim().length === 0)
    cropped.shift()
  while (
    cropped.length > 0 &&
    stripAnsi(cropped[cropped.length - 1]!).trim().length === 0
  )
    cropped.pop()
  if (cropped.length === 0) return []

  const commonLeft = Math.min(...cropped.map(visibleLeadingSpaces))
  return cropped.map((line) => removeVisibleColumns(line, commonLeft))
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE_GLOBAL, "")
}

function visibleLeadingSpaces(line: string): number {
  const match = stripAnsi(line).match(/^ */)
  return match?.[0].length ?? 0
}

function removeVisibleColumns(line: string, columns: number): string {
  if (columns <= 0) return line

  let output = ""
  let removed = 0
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === ESC) {
      const match = line.slice(index).match(ANSI_SEQUENCE)
      if (match) {
        output += match[0]
        index += match[0].length - 1
        continue
      }
    }

    if (removed < columns) {
      removed += 1
      continue
    }
    output += line[index]!
  }
  return output
}

function style(
  theme: WorkspaceDialogTheme | undefined,
  color: ThemeColor,
  text: string,
): string {
  return theme ? theme.fg(color, text) : text
}

function isPrintableInput(data: string): boolean {
  return data.length === 1 && data >= " " && data !== "\u007f"
}
