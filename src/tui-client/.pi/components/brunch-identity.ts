import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { VERSION as PI_VERSION } from "@earendil-works/pi-coding-agent"
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent"

const ESC = String.fromCharCode(27)
const ANSI_SEQUENCE = new RegExp(`^${ESC}\\[[0-9;?]*[ -/]*[@-~]`)
const ANSI_SEQUENCE_GLOBAL = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g")
const LOGO_TRUECOLOR = "brunch-logo-quad-56x18.ansi"
const LOGO_240 = "brunch-logo-quad-56x18-240.ansi"

// Letterform copied from: cfonts "brunch" -f tiny -c candy.
export const BRUNCH_COMPACT_WORDMARK = [
  "█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █",
  "█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█",
] as const

export type BrunchIdentityColorMode = "dark" | "light" | "plain"
export type BrunchIdentityTheme = Pick<Theme, "fg">

export interface BrunchVersionInfo {
  version: string
  dev: string | null
}

export interface BrunchLogoReadOptions {
  assetUrl: URL
  truecolor: boolean
}

export interface BrunchProductIdentityOptions {
  logoLines?: readonly string[]
  version: BrunchVersionInfo
  theme?: BrunchIdentityTheme
  colorMode?: BrunchIdentityColorMode
  piVersion?: string
}

export function readBrunchAnsiLogo(options: BrunchLogoReadOptions): string[] {
  const asset = options.truecolor ? LOGO_TRUECOLOR : LOGO_240
  try {
    return cropLogo(
      readFileSync(fileURLToPath(new URL(asset, options.assetUrl)), "utf8")
        .replace(new RegExp(`${ESC}\\[\\?25[lh]`, "g"), "")
        .replace(new RegExp(`${ESC}\\[0m$`, "g"), "")
        .split("\n"),
    )
  } catch {
    return []
  }
}

export function formatBrunchProductIdentity(
  options: BrunchProductIdentityOptions,
): string[] {
  const logo = [...(options.logoLines ?? [])]
  const wordmark = BRUNCH_COMPACT_WORDMARK.map((line) =>
    identityStyle(options, "muted", line),
  )
  const versionLine = identityStyle(
    options,
    "accent",
    `brunch ${options.version.version}`,
  )
  const devLine = options.version.dev
    ? [identityStyle(options, "success", options.version.dev)]
    : []
  const piLine = identityStyle(
    options,
    "dim",
    `built on Pi v${options.piVersion ?? PI_VERSION}`,
  )

  return [
    ...logo,
    ...(logo.length > 0 ? [""] : []),
    ...wordmark,
    "",
    versionLine,
    ...devLine,
    piLine,
  ]
}

function identityStyle(
  options: BrunchProductIdentityOptions,
  color: ThemeColor,
  text: string,
): string {
  if (options.colorMode === "plain") return text
  return options.theme ? options.theme.fg(color, text) : text
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
