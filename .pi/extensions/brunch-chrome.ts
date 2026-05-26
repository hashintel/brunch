/**
 * Brunch — chrome (sandbox: header + footer)
 *
 * Owns Pi's header and footer surfaces as the only Brunch chrome wrapper.
 * Deliberately scoped to what we can render *honestly* today, with no
 * speculation about a Brunch state schema we haven't designed yet.
 *
 * Division of labor between Pi's chrome surfaces:
 *
 *   HEADER  = identity / "where am I". Static-ish; replaced rarely.
 *             Brand + version + cwd. Not for runtime telemetry.
 *   FOOTER  = runtime telemetry / "what's happening". Updated on every render.
 *             Brunch workspace identity + current spec + git branch + model /
 *             thinking + context-window gauge + foreign status entries.
 *   STATUS  = lateral contribution channel for *other* extensions and future
 *             dynamic Brunch state. This file does NOT call `setStatus`. The
 *             footer compositor merges `footerData.getExtensionStatuses()` so
 *             foreign keys surface in the footer without anyone needing to own
 *             the whole footer.
 *   TITLE / HIDDEN-THINKING-LABEL = deferred. See SPEC.md
 *             "Chrome surface evolution": both are state-indicative surfaces
 *             that require canonical Brunch state to drive them. We don't have
 *             that schema yet, so these stay at Pi defaults.
 *
 * What's NOT in this file (and why):
 *   - No `BrunchChromeState` snapshot. The coordinator's
 *     `WorkspaceSessionChromeState` (cwd / spec / phase / chatMode) is the
 *     only canonical chrome state with a real producer, and the sandbox does
 *     not currently wire the coordinator in. Until it does, this extension
 *     renders only `ctx`-derived facts.
 *   - No speculative fields (lens, coherence verdict, worker statuses,
 *     reconciliation needs, establishment offer summaries). Those correspond
 *     to subsystems that don't exist yet.
 *   - No mutation theater. Without a real producer there's nothing to mutate.
 *
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

const SESSION_BINDING_TYPE = "brunch.session_binding"
const STATE_SCHEMA_VERSION = 1
const CONTEXT_GAUGE_WIDTH = 12
const BAR_FILLED = "━"
const BAR_EMPTY = "─"

// Letterform copied from: cfonts "brunch" -f tiny -c candy
// Colors are intentionally applied through the active Pi theme at render time.
const BRUNCH_WORDMARK = ["█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █", "█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█"]

const LOCAL_BUILD_TIME = formatBuildTime(new Date())
const ESC = String.fromCharCode(27)
const ANSI_SEQUENCE = new RegExp(`^${ESC}\\[[0-9;?]*[ -/]*[@-~]`)

type BrunchSpecIdentity = {
  id: string
  title: string
}

type WorkspaceStateFile = {
  schemaVersion?: unknown
  currentSpec?: {
    id?: unknown
    title?: unknown
  }
}

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

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim()
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  if (count < 1000000) return `${Math.round(count / 1000)}k`
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`
  return `${Math.round(count / 1000000)}M`
}

function readWorkspaceSpec(cwd: string): BrunchSpecIdentity | null {
  try {
    const parsed = JSON.parse(
      readFileSync(path.join(cwd, ".brunch", "state.json"), "utf8"),
    ) as WorkspaceStateFile
    if (
      parsed.schemaVersion === STATE_SCHEMA_VERSION &&
      typeof parsed.currentSpec?.id === "string" &&
      typeof parsed.currentSpec.title === "string"
    ) {
      return { id: parsed.currentSpec.id, title: parsed.currentSpec.title }
    }
  } catch {
    // No selected Brunch workspace state yet.
  }
  return null
}

function readSessionBindingSpec(
  ctx: ExtensionContext,
): BrunchSpecIdentity | null {
  const entries = ctx.sessionManager.getEntries()
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (
      entry?.type === "custom" &&
      entry.customType === SESSION_BINDING_TYPE &&
      typeof entry.data === "object" &&
      entry.data !== null &&
      typeof (entry.data as { specId?: unknown }).specId === "string" &&
      typeof (entry.data as { specTitle?: unknown }).specTitle === "string"
    ) {
      return {
        id: (entry.data as { specId: string }).specId,
        title: (entry.data as { specTitle: string }).specTitle,
      }
    }
  }
  return null
}

function currentSpec(ctx: ExtensionContext): BrunchSpecIdentity | null {
  return readWorkspaceSpec(ctx.cwd) ?? readSessionBindingSpec(ctx)
}

function renderContextGauge(ctx: ExtensionContext, theme: Theme): string {
  const usage = ctx.getContextUsage()
  const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0
  const percent = usage?.percent ?? null
  const tokens = usage?.tokens ?? null

  const clamped = Math.max(0, Math.min(100, percent ?? 0))
  const filled =
    percent === null ? 0 : Math.round((clamped / 100) * CONTEXT_GAUGE_WIDTH)
  const empty = CONTEXT_GAUGE_WIDTH - filled
  const bar = BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(empty)
  const percentText = percent === null ? "?%" : `${Math.round(clamped)}%`
  const counts =
    tokens === null || contextWindow === 0
      ? `?/${formatTokens(contextWindow)}`
      : `${formatTokens(tokens)}/${formatTokens(contextWindow)}`

  return theme.fg("dim", `${bar} ${percentText} ${counts}`)
}

function rightAlign(left: string, right: string, width: number): string {
  const leftWidth = visibleWidth(left)
  const rightWidth = visibleWidth(right)
  const minPadding = 2
  if (leftWidth + minPadding + rightWidth <= width) {
    return left + " ".repeat(width - leftWidth - rightWidth) + right
  }

  const availableForRight = width - leftWidth - minPadding
  if (availableForRight <= 0) return truncateToWidth(left, width)
  const truncatedRight = truncateToWidth(right, availableForRight, "")
  return (
    left +
    " ".repeat(Math.max(2, width - leftWidth - visibleWidth(truncatedRight))) +
    truncatedRight
  )
}

function projectName(cwd: string): string {
  return path.basename(path.resolve(cwd))
}

function paddedHeaderLine(content: string, width: number): string {
  if (width <= 2) return truncateToWidth(content, width)
  const inner = truncateToWidth(content, width - 2)
  return ` ${inner}${" ".repeat(Math.max(0, width - 1 - visibleWidth(inner)))}`
}

function emptyHeaderLine(width: number): string {
  return " ".repeat(Math.max(0, width))
}

// ── Header ─────────────────────────────────────────────────────────────
function installHeader(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return

  const logoLines = readLogo(ctx.cwd)

  ctx.ui.setHeader((_tui, theme) => ({
    render: (width: number) => {
      const versionInfo = brunchVersion(ctx.cwd)
      const versionLine =
        theme.fg("accent", `brunch ${versionInfo.version}`) +
        (versionInfo.dev ? ` ${theme.fg("success", versionInfo.dev)}` : "")
      const piLine = theme.fg("dim", `built on Pi v${PI_VERSION}`)
      const projectRootLine = theme.fg(
        "dim",
        `project root: ${shortenPath(path.resolve(ctx.cwd))}`,
      )

      return [
        emptyHeaderLine(width),
        ...logoLines.map((line) => paddedHeaderLine(line, width)),
        emptyHeaderLine(width),
        ...BRUNCH_WORDMARK.map((line) =>
          paddedHeaderLine(theme.fg("muted", line), width),
        ),
        emptyHeaderLine(width),
        paddedHeaderLine(versionLine, width),
        paddedHeaderLine(piLine, width),
        paddedHeaderLine(projectRootLine, width),
        emptyHeaderLine(width),
      ]
    },
    invalidate: () => {},
  }))
}

// ── Footer ─────────────────────────────────────────────────────────────
function installFooter(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  setRequestFooterRender: (requestRender: (() => void) | null) => void,
): void {
  if (!ctx.hasUI) return

  ctx.ui.setFooter((tui, theme, footerData) => {
    // Re-render whenever the git branch changes — free signal Pi already
    // provides. Model/thinking changes are handled by extension-level event
    // listeners below.
    setRequestFooterRender(() => tui.requestRender())
    const unsub = footerData.onBranchChange(() => tui.requestRender())

    return {
      dispose: () => {
        unsub()
        setRequestFooterRender(null)
      },
      invalidate: () => {},
      render: (width: number): string[] => {
        const branch = footerData.getGitBranch() ?? "no branch"
        const spec = currentSpec(ctx)
        const specTitle = spec?.title ?? "none"

        const projectLine = rightAlign(
          `${theme.fg("accent", "project:")} ${theme.fg("success", projectName(ctx.cwd))}`,
          `${theme.fg("accent", "specification:")} ${theme.fg("success", specTitle)}`,
          width,
        )

        const modelName = ctx.model?.id ?? "no-model"
        const thinkingLevel = pi.getThinkingLevel()
        let modelLabel = modelName
        if (ctx.model?.reasoning) {
          modelLabel =
            thinkingLevel === "off"
              ? `${modelName} • thinking off`
              : `${modelName} • ${thinkingLevel}`
        }
        if (footerData.getAvailableProviderCount() > 1 && ctx.model) {
          modelLabel = `(${ctx.model.provider}) ${modelLabel}`
        }

        const rootLine = rightAlign(
          theme.fg("dim", shortenPath(path.resolve(ctx.cwd))),
          theme.fg("dim", modelLabel),
          width,
        )
        const branchLine = rightAlign(
          theme.fg("dim", branch),
          renderContextGauge(ctx, theme),
          width,
        )

        const lines = [projectLine, rootLine, branchLine]

        const extensionStatuses = footerData.getExtensionStatuses()
        if (extensionStatuses.size > 0) {
          const statusLine = Array.from(extensionStatuses.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, text]) => sanitizeStatusText(text))
            .filter(Boolean)
            .join(" ")
          if (statusLine.length > 0) {
            lines.push(
              truncateToWidth(statusLine, width, theme.fg("dim", "...")),
            )
          }
        }

        // One trailing row keeps VS Code's terminal from visually pinning the
        // footer against the bottom edge; Ghostty already adds some external
        // breathing room, so a single blank row is the least surprising shim.
        lines.push("")
        return lines
      },
    }
  })
}

// ── Extension entry ────────────────────────────────────────────────────
export default function brunchChrome(pi: ExtensionAPI) {
  let requestFooterRender: (() => void) | null = null

  pi.on("session_start", async (_event, ctx) => {
    installHeader(ctx)
    installFooter(ctx, pi, (requestRender) => {
      requestFooterRender = requestRender
    })
  })

  pi.on("model_select", async () => {
    requestFooterRender?.()
  })

  pi.on("thinking_level_select", async () => {
    requestFooterRender?.()
  })

  pi.on("turn_end", async () => {
    requestFooterRender?.()
  })
}
