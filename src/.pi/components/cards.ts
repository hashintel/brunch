/**
 * Cards — pi-tui rendering primitives for bordered card layouts.
 *
 * Pure library module. It registers nothing with Pi; product extensions import
 * these primitives when they need transcript-rendered card layouts.
 *
 * Components here should remain stateless and stitch only pi-tui primitives.
 */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent"
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent"
import {
  type Component,
  Markdown,
  visibleWidth,
  truncateToWidth,
} from "@earendil-works/pi-tui"

/**
 * Lay components out side-by-side and fall back to vertical stacking once the
 * per-column width drops below `minChildWidth`.
 */
export class ResponsiveColumns implements Component {
  constructor(
    private children: Component[],
    private minChildWidth: number = 40,
    private gap: number = 2,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    if (this.children.length === 0) return []
    if (this.children.length === 1) return this.children[0]!.render(width)

    const n = this.children.length
    const totalGap = this.gap * (n - 1)
    const perChild = Math.floor((width - totalGap) / n)

    // Too narrow for columns — stack vertically.
    if (perChild < this.minChildWidth) {
      const lines: string[] = []
      this.children.forEach((c, i) => {
        if (i > 0) lines.push("")
        lines.push(...c.render(width))
      })
      return lines
    }

    const grids = this.children.map((c) => c.render(perChild))
    const rowCount = Math.max(...grids.map((g) => g.length))

    // Pad shorter columns with blank lines so all columns share rowCount.
    const blank = " ".repeat(perChild)
    const padded = grids.map((g) => {
      const result = [...g]
      while (result.length < rowCount) result.push(blank)
      return result
    })

    // Stitch rows. Each line is padded to perChild visible width before joining.
    const gapStr = " ".repeat(this.gap)
    const lines: string[] = []
    for (let r = 0; r < rowCount; r++) {
      const parts = padded.map((g) => {
        const line = g[r] ?? blank
        const vis = visibleWidth(line)
        const padding = vis < perChild ? " ".repeat(perChild - vis) : ""
        return line + padding
      })
      lines.push(parts.join(gapStr))
    }
    return lines
  }
}

/**
 * A titled, bordered card with a Markdown body. The title sits inside the top
 * border and the body fills the inner column at the requested width.
 */
export class CardComponent implements Component {
  constructor(
    private title: string,
    private body: string,
    private theme: Theme,
    private accent: ThemeColor = "accent",
  ) {}

  invalidate(): void {
    // Stateless render: nothing to invalidate.
  }

  render(width: number): string[] {
    // 4 = "│ " (2) + " │" (2). Markdown fills the inner column.
    const innerWidth = Math.max(10, width - 4)
    const bodyLines = new Markdown(this.body, 0, 0, getMarkdownTheme()).render(
      innerWidth,
    )

    const c = (s: string) => this.theme.fg(this.accent, s)
    const titleText = ` ${this.theme.bold(this.title)} `
    const titleVis = visibleWidth(titleText)

    // Top: ╭─ Title ──...──╮
    const topFiller = Math.max(0, width - 2 - 1 - titleVis) // border corners (2) + opening dash (1)
    const top = c("╭─") + titleText + c("─".repeat(topFiller) + "╮")

    // Bottom: ╰────────────╯
    const bottom = c("╰" + "─".repeat(Math.max(0, width - 2)) + "╯")

    // Body: │ <line padded to innerWidth> │
    const sided = bodyLines.map((line) => {
      const vis = visibleWidth(line)
      const padding = vis < innerWidth ? " ".repeat(innerWidth - vis) : ""
      // If a markdown line exceeds innerWidth, truncate to avoid wrapping.
      const safeLine =
        vis > innerWidth ? truncateToWidth(line, innerWidth) : line + padding
      return c("│ ") + safeLine + c(" │")
    })

    return [top, ...sided, bottom]
  }
}

/** Split an array into fixed-size chunks; last chunk may be shorter. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
