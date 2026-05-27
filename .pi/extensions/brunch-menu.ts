/**
 * Brunch — menu (centered overlay splash)
 *
 * Opens a centered overlay modal showing the same Brunch identity panel that
 * `brunch-chrome.ts` renders into the header (logo + wordmark + version + Pi
 * version + project root). Invoked via `ctrl+shift+k`. Dismisses on any key.
 *
 * This deliberately mirrors only the header *visuals*; nothing here writes to
 * footer/header/status. Persistent chrome stays owned by `brunch-chrome.ts`.
 *
 * The rendering helpers (logo loader, wordmark, version block) are duplicated
 * from `brunch-chrome.ts` to keep the two extensions independent. If a third
 * caller appears, lift the helpers into a shared module then.
 */

import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent"
import { VERSION as PI_VERSION } from "@earendil-works/pi-coding-agent"
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"

const OVERLAY_WIDTH = 60

// Letterform copied from: cfonts "brunch" -f tiny -c candy
const BRUNCH_WORDMARK = ["█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █", "█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█"]

const LOCAL_BUILD_TIME = formatBuildTime(new Date())
const ESC = String.fromCharCode(27)
const ANSI_SEQUENCE = new RegExp(`^${ESC}\\[[0-9;?]*[ -/]*[@-~]`)

type PackageJson = {
  version?: unknown
  private?: unknown
}

type BrunchVersionInfo = {
  version: string
  dev: string | null
}

function formatBuildTime(date: Date): string {
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC")
}

function getGitSha(cwd: string): string {
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return ""
  }
}

function readPackage(cwd: string): PackageJson {
  try {
    return JSON.parse(
      readFileSync(path.join(cwd, "package.json"), "utf8"),
    ) as PackageJson
  } catch {
    return {}
  }
}

function brunchVersion(cwd: string): BrunchVersionInfo {
  const pkg = readPackage(cwd)
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0"
  const isLocalDev = pkg.private === true || version === "0.0.0"
  if (!isLocalDev) return { version: `v${version}`, dev: null }

  const gitSha = getGitSha(cwd)
  const devMeta = [gitSha, `@ ${LOCAL_BUILD_TIME}`].filter(Boolean).join(" ")
  return { version: `v${version}`, dev: devMeta ? `(dev ${devMeta})` : "(dev)" }
}

function stripAnsi(text: string): string {
  return text.replace(new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g"), "")
}

function visibleLeadingSpaces(line: string): number {
  const plain = stripAnsi(line)
  const match = plain.match(/^ */)
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

function supportsTruecolor(): boolean {
  const colorterm = process.env.COLORTERM?.toLowerCase() ?? ""
  const term = process.env.TERM?.toLowerCase() ?? ""
  return (
    colorterm === "truecolor" ||
    colorterm === "24bit" ||
    term.includes("truecolor")
  )
}

function readLogo(cwd: string): string[] {
  const asset = supportsTruecolor()
    ? "brunch-logo-quad-56x18.ansi"
    : "brunch-logo-quad-56x18-240.ansi"
  try {
    return cropLogo(
      readFileSync(path.join(cwd, "assets", asset), "utf8")
        .replace(new RegExp(`${ESC}\\[\\?25[lh]`, "g"), "")
        .replace(new RegExp(`${ESC}\\[0m$`, "g"), "")
        .split("\n"),
    )
  } catch {
    return []
  }
}

function shortenPath(p: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (home && p.startsWith(home)) return `~${p.slice(home.length)}`
  return p
}

function borderedContentLine(
  content: string,
  width: number,
  theme: Theme,
): string {
  // width includes the two border columns. Inner content area is width - 4
  // (left border + space + content + space + right border).
  if (width <= 4) return truncateToWidth(content, width)
  const innerWidth = width - 4
  const inner = truncateToWidth(content, innerWidth)
  const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(inner)))
  const vertical = theme.fg("borderMuted", "│")
  return `${vertical} ${inner}${padding} ${vertical}`
}

function borderedEmptyLine(width: number, theme: Theme): string {
  if (width <= 2) return " ".repeat(Math.max(0, width))
  const vertical = theme.fg("borderMuted", "│")
  return `${vertical}${" ".repeat(width - 2)}${vertical}`
}

function topBorderLine(width: number, theme: Theme): string {
  if (width <= 2) return " ".repeat(Math.max(0, width))
  return theme.fg("borderMuted", `╭${"─".repeat(width - 2)}╮`)
}

function bottomBorderLine(width: number, theme: Theme): string {
  if (width <= 2) return " ".repeat(Math.max(0, width))
  return theme.fg("borderMuted", `╰${"─".repeat(width - 2)}╯`)
}

function renderOverlayLines(
  ctx: ExtensionContext,
  theme: Theme,
  width: number,
): string[] {
  const logoLines = readLogo(ctx.cwd)
  const versionInfo = brunchVersion(ctx.cwd)
  const versionLine =
    theme.fg("accent", `brunch ${versionInfo.version}`) +
    (versionInfo.dev ? ` ${theme.fg("success", versionInfo.dev)}` : "")
  const piLine = theme.fg("dim", `built on Pi v${PI_VERSION}`)
  const projectRootLine = theme.fg(
    "dim",
    `project root: ${shortenPath(path.resolve(ctx.cwd))}`,
  )
  const hintLine = theme.fg("dim", "press any key to dismiss")

  return [
    topBorderLine(width, theme),
    borderedEmptyLine(width, theme),
    ...logoLines.map((line) => borderedContentLine(line, width, theme)),
    borderedEmptyLine(width, theme),
    ...BRUNCH_WORDMARK.map((line) =>
      borderedContentLine(theme.fg("muted", line), width, theme),
    ),
    borderedEmptyLine(width, theme),
    borderedContentLine(versionLine, width, theme),
    borderedContentLine(piLine, width, theme),
    borderedContentLine(projectRootLine, width, theme),
    borderedEmptyLine(width, theme),
    borderedContentLine(hintLine, width, theme),
    bottomBorderLine(width, theme),
  ]
}

async function openMenu(ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui?.notify?.("Brunch menu requires UI mode", "warning")
    return
  }

  await ctx.ui.custom<void>(
    (_tui, theme, _kb, done) => {
      let width = OVERLAY_WIDTH
      return {
        render: (w: number) => {
          width = w
          return renderOverlayLines(ctx, theme, width)
        },
        // Any key dismisses, matching the pi-powerline-footer welcome overlay.
        handleInput: (_data: string) => done(),
        invalidate: () => {},
      }
    },
    {
      overlay: true,
      overlayOptions: () => ({
        anchor: "center",
        width: OVERLAY_WIDTH,
      }),
    },
  )
}

export default function brunchMenu(pi: ExtensionAPI) {
  pi.registerShortcut("ctrl+shift+k", {
    description: "Open the Brunch identity menu",
    handler: async (ctx) => openMenu(ctx),
  })
}
