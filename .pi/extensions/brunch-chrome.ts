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

// Pre-generated with: cfonts "brunch" -f tiny -c candy
const BRUNCH_WORDMARK =
  "\x1b[33m \x1b[39m\x1b[32m█▄▄\x1b[39m\x1b[33m \x1b[39m\x1b[95m█▀█\x1b[39m\x1b[33m \x1b[39m\x1b[95m█ █\x1b[39m\x1b[33m \x1b[39m\x1b[31m█▄ █\x1b[39m\x1b[33m \x1b[39m\x1b[94m█▀▀\x1b[39m\x1b[33m \x1b[39m\x1b[32m█ █\x1b[39m\n" +
  "\x1b[96m \x1b[39m\x1b[91m█▄█\x1b[39m\x1b[96m \x1b[39m\x1b[93m█▀▄\x1b[39m\x1b[96m \x1b[39m\x1b[31m█▄█\x1b[39m\x1b[96m \x1b[39m\x1b[92m█ ▀█\x1b[39m\x1b[96m \x1b[39m\x1b[96m█▄▄\x1b[39m\x1b[96m \x1b[39m\x1b[96m█▀█\x1b[39m"

const LOCAL_BUILD_TIME = formatBuildTime(new Date())
const ESC = String.fromCharCode(27)

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

function brunchVersion(cwd: string): string {
  const pkg = readPackage(cwd)
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0"
  const isLocalDev = pkg.private === true || version === "0.0.0"
  if (!isLocalDev) return `v${version}`

  const gitSha = getGitSha(cwd)
  const devMeta = [gitSha, `@ ${LOCAL_BUILD_TIME}`].filter(Boolean).join(" ")
  return `v${version} (${devMeta ? `dev ${devMeta}` : "dev"})`
}

function readLogo(cwd: string): string[] {
  try {
    return readFileSync(
      path.join(cwd, "assets", "brunch-logo-quad-56x18.ansi"),
      "utf8",
    )
      .replace(new RegExp(`${ESC}\\[\\?25[lh]`, "g"), "")
      .replace(new RegExp(`${ESC}\\[0m$`, "g"), "")
      .split("\n")
      .filter((line) => line.length > 0)
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
  const color = clamped >= 90 ? "error" : clamped >= 70 ? "warning" : "accent"
  const bar =
    theme.fg(color, BAR_FILLED.repeat(filled)) +
    theme.fg("dim", BAR_EMPTY.repeat(empty))
  const percentText = percent === null ? "?%" : `${Math.round(clamped)}%`
  const counts =
    tokens === null || contextWindow === 0
      ? `?/${formatTokens(contextWindow)}`
      : `${formatTokens(tokens)}/${formatTokens(contextWindow)}`

  return `${theme.fg("dim", "ctx ")}${bar} ${theme.fg("dim", `${percentText} ${counts}`)}`
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

// ── Header ─────────────────────────────────────────────────────────────
function installHeader(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return

  const logoLines = readLogo(ctx.cwd)
  const wordmarkLines = BRUNCH_WORDMARK.split("\n")

  ctx.ui.setHeader((_tui, theme) => ({
    render: (width: number) => {
      const version = theme.fg("muted", brunchVersion(ctx.cwd))
      const piLine = theme.fg("dim", `built in Pi v${PI_VERSION}`)
      const cwdLine = theme.fg(
        "dim",
        `cwd: ${shortenPath(path.resolve(ctx.cwd))}`,
      )
      const textBlock = [
        ...wordmarkLines,
        `${theme.fg("dim", "brunch")} ${version}`,
        piLine,
        cwdLine,
      ]

      if (logoLines.length === 0 || width < 88) {
        return [
          ...wordmarkLines.map((line) => truncateToWidth(line, width)),
          truncateToWidth(`${theme.fg("dim", "brunch")} ${version}`, width),
          truncateToWidth(piLine, width),
          truncateToWidth(cwdLine, width),
          "",
        ]
      }

      const logoWidth = Math.max(...logoLines.map((line) => visibleWidth(line)))
      const gap = "  "
      const lines: string[] = []
      const maxLines = Math.max(logoLines.length, textBlock.length)
      for (let index = 0; index < maxLines; index += 1) {
        const logo = logoLines[index] ?? ""
        const paddedLogo =
          logo + " ".repeat(Math.max(0, logoWidth - visibleWidth(logo)))
        const text = textBlock[index] ?? ""
        lines.push(truncateToWidth(`${paddedLogo}${gap}${text}`, width))
      }
      lines.push("")
      return lines
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
        const branch = footerData.getGitBranch()
        const spec = currentSpec(ctx)
        const locationParts = [
          theme.fg("accent", shortenPath(path.resolve(ctx.cwd))),
          spec
            ? `${theme.fg("dim", "spec:")} ${theme.fg("muted", spec.title)}`
            : theme.fg("dim", "spec: none"),
          branch
            ? `${theme.fg("dim", "branch:")} ${theme.fg("muted", branch)}`
            : "",
        ].filter(Boolean)
        const locationLine = truncateToWidth(
          locationParts.join(theme.fg("dim", " · ")),
          width,
          theme.fg("dim", "..."),
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

        const context = renderContextGauge(ctx, theme)
        const telemetryLine = rightAlign(
          context,
          theme.fg("dim", modelLabel),
          width,
        )

        const lines = [locationLine, telemetryLine]

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
