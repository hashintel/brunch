# Rounded-box primitive extraction

Frontier: component-dx | n/a
Status:   active
Mode:     slices
Created:  2026-07-01

## Orientation

- **Containing seam:** `src/.pi/components/` (Pi TUI presentation components) — bordered-box rendering
  specifically. No product/RPC/graph boundary is crossed; this is a pure presentation-layer
  consolidation.
- **Relevant frontier item:** `component-dx` (FE-1115), branch `ln/fe-1115-component-preview-dx`. No
  live scope card is current per the frontier's "Current execution pointer" note (the 2026-07-01
  `ln-sync` retired the prior two cards once their durable content was reconciled into
  `PLAN.md`/`TOPOLOGY.md`) — this file is the next one.
- **Volatile handoff state:** none (`HANDOFF.md` absent, retired in the same `ln-sync`).
- **Main open risk:** none load-bearing. The primitive's interface was fully designed and agreed in the
  prior session turn (the feature-coverage matrix, the interface shape, and the before/after dependency
  graph below are that design, not new exploration). The only real risk is mechanical — rendered-output
  regression during migration — and slices 2-4 each name their regression oracle explicitly.
- **Cross-cutting obligations to preserve:** `src/.pi/components/TOPOLOGY.md`'s "Build/test convention"
  — direct-render tests are the default; a harness test is only added when real TUI input/overlay
  routing is the point. None of these slices need a harness test; all four are pure-function or
  direct-`render(width)` work.

**Posture: earned** (inherited from `component-dx`; the frontier declares no explicit `Certainty:` —
earned is adopted deliberately for this slice, not by default, because the shape being materialized was
already fully decided in conversation before this file was written, not an open unknown. The hard
anti-speculation gate below is the safeguard: if building slice 1 surfaces a real interface gap the prior
design missed, stop the sequence and downgrade rather than guessing ahead through slices 2-4.)

**Closure move:** **Consolidates** three independent hand-rolled `╭─╮`/`│ │`/`╰─╯` box-drawing
implementations (`brunch-editor.ts`'s `projectBorderedChrome`, `workspace-dialog/component.ts`'s
`renderFrame` + border helpers, `cards.ts`'s `CardComponent`) into one canonical primitive.
**Canonicalizes:** `projectRoundedBox` (`.pi/components/rounded-box.ts`) as the one box-drawing
implementation in this subtree. **Locks in:** byte-identical rendered output for the three existing
callers (proven per-slice below), and removes the last structural obstacle to giving
`MultiChoicePickerComponent` a border in a later, separate slice (named in "Not this sequence" below,
not built here).

## Design (settled)

### Feature coverage today vs. the shared primitive

```
                        | brunch-editor (current) | workspace-dialog (current) | cards.ts (current) | shared primitive
------------------------|--------------------------|------------------------------|----------------------|------------------
box drawing             |  +                       |  +                           |  +                    |  + (the whole point)
width budget = 4        |  +                       |  +                           |  +                    |  +
label in top border     |  +                       |  .  (title is a content row) |  +                    |  + (optional)
label in bottom border  |  +                       |  .                           |  .                    |  + (optional)
per-row line truncation |  .  (trusts child render) |  +                          |  +                    |  + (always safe)
scroll thumb (▐) rows   |  .                        |  +                          |  .                    |  + (optional)
blank breathing-room row|  .                        |  +  (emptyLine, hand-rolled) |  .                   |  + (optional, replaces emptyLine)
pad to minimum height   |  +  (MIN_CONTENT_LINES)   |  .                           |  .                    |  x> stays caller-side (1 reader)
strip a wrapped child's own border | + (isEditorBorderLine) | . (owns content raw) | . (owns content raw) | x> stays caller-side (brunch-editor only)
belowLines (outside box)|  +                        |  .                           |  .                    |  x> stays caller-side (1 reader)

notes:
  - "pad to minimum", "strip wrapped child's border", and "belowLines" each have exactly ONE current
    reader (brunch-editor). They stay local rather than joining the shared interface — no clear second
    reader yet, and generalizing them now would be speculative.
  - workspace-dialog's `emptyLine()` is provably redundant with `contentLine('')` (identical output,
    same width math) — the primitive absorbs it for free; slice 3 deletes `emptyLine()`.
```

### The primitive's interface

```
RoundedBoxOptions:
  topLabel?:    string               # embedded right-aligned in the top border, e.g. "[ Specify ]"
  bottomLabel?: string               # embedded right-aligned in the bottom border, e.g. "Spec Title"
  thumbRows?:   ReadonlySet<number>  # indices into contentLines; right border becomes ▐ there
  preserveContentWidth?: boolean     # true for already-rendered child lines that must not be padded
  blankPadding?:
    top?:    number    # N blank bordered rows inserted just inside the top border
    bottom?: number    # N blank bordered rows inserted just inside the bottom border

projectRoundedBox(contentLines: string[], options: RoundedBoxOptions, width: number,
                  borderColor: (s: string) => string) -> string[]

_rules:
  - signature order (contentLines, options, width, borderColor) matches projectBorderedChrome's
    existing (innerLines, labels, width, borderColor) — same shape, no surprise for an existing reader
  - every contentLine is truncateToWidth-safe; callers never pre-truncate
  - blankPadding shifts thumbRows internally — callers index thumbRows against their OWN
    contentLines (pre-padding); the primitive owns the arithmetic
  - preserveContentWidth is only for pre-rendered child components such as BrunchEditor; ordinary
    callers get padded content rows so the visible box width is stable
  - returns [] for empty contentLines (matches projectBorderedChrome's existing empty-input contract)
```

### Before / after dependency structure

```
## Current

graph:
  nodes:
    brunch-editor.ts:              [owns: isEditorBorderLine, borderLine, padContentToMinimum, box-drawing]
    workspace-dialog/component.ts: [owns: topBorderLine, bottomBorderLine, contentLine, emptyLine, box-drawing]
    cards.ts:                      [owns: CardComponent box-drawing]
  edges:
    (none — three independent hand-rolled box-drawing implementations)

## Desired

graph:
  nodes:
    rounded-box.ts:                 [owns: projectRoundedBox — the one box-drawing implementation]
    brunch-editor.ts:               [owns: isEditorBorderLine, stripEditorBorder, padContentToMinimum, belowLines]
    workspace-dialog/component.ts:  [owns: option-line formatting only]
    cards.ts:                       [owns: nothing extra — pure passthrough]
  edges:
    brunch-editor.ts               -> rounded-box.ts: projectRoundedBox(strippedContent, labels, ...)
    workspace-dialog/component.ts  -> rounded-box.ts: projectRoundedBox(optionLines, {thumbRows}, ...)
    cards.ts                       -> rounded-box.ts: projectRoundedBox(bodyLines, {topLabel: title}, ...)
```

### The one non-trivial composition — `brunch-editor.ts` after the split

```
projectBorderedChrome(innerLines, labels, width, borderColor)
  -> findLastIndex(innerLines, isEditorBorderLine)          # locate the child's OWN bottom border
  -> stripEditorBorder(innerLines, bottomIndex)
       # splits at indices 0 (child's top border, discarded) and bottomIndex (child's bottom
       # border, discarded) into { content: innerLines[1..bottomIndex), trailing: innerLines(bottomIndex..] }
       # "trailing" is autocomplete rows that must stay AFTER any padding, never before
  -> padContentToMinimum(content, MIN_CONTENT_LINES)         # pads content only, not trailing
  -> [...paddedContent, ...trailing]                         # recombine into one linear array
  -> rounded-box.ts: projectRoundedBox(combined, {topLabel, bottomLabel}, width, borderColor)
  -> append belowLines (indent + optional OSC8 hyperlink)     # stays outside the box, brunch-editor-only

notes:
  - padContentToMinimum currently threads a { lines, bottomIndex } return shape solely to know
    where the border still is inside the same array. Once the border is stripped BEFORE padding,
    that bookkeeping disappears — slice 2 simplifies it to a plain length check. This is a real
    simplification the split buys, not just code motion.
```

## Slice 1 — `projectRoundedBox` primitive

Status: done (2026-07-01)

### Objective

A new pure `projectRoundedBox` function exists in `.pi/components/rounded-box.ts`, fully tested against
the interface above, with zero existing callers touched yet.

### Light-card cold-start reads

```
- memory/SPEC.md   — None (dev-DX presentation work, no product decision)
- memory/PLAN.md   — frontier: component-dx
- src/.pi/components/TOPOLOGY.md — "Build/test convention" section; layout sketch (this is a new
  top-level single-file component, same placement pattern as scroll-viewport.ts)
- src/.pi/components/brunch-editor.ts — projectBorderedChrome + borderLine(), the label/truncation
  conventions this generalizes from
- src/.pi/components/workspace-dialog/component.ts — renderFrame/contentLine/emptyLine, the
  thumb-row convention this generalizes from
- src/.pi/components/cards.ts — CardComponent, the title-in-top-border convention this generalizes from
- src/.pi/components/scroll-viewport.ts — sibling pure-primitive precedent for file placement,
  naming (`project*`), and doc-comment style
```

### Acceptance Criteria

```
✓ empty contentLines -> returns []
✓ plain box, no labels, no thumb — ╭─...─╮ / │ content │ (×N) / ╰─...─╯, width respected
✓ topLabel embeds right-aligned in the top border; bottomLabel in the bottom border; an omitted
  label produces a plain rule (matches projectBorderedChrome's existing borderLine() truncation
  behavior when a label doesn't fit)
✓ every content line is truncateToWidth-safe (a line exceeding inner width truncates, never wraps
  or overflows the box)
✓ thumbRows: rows in the set render ▐ as the right border character; all other rows keep │; assert
  this for a row in the MIDDLE of the box, not just first/last, to prove it's row-indexed
✓ blankPadding.top / .bottom insert N blank bordered rows just inside the respective border, and a
  thumbRows index computed against the caller's un-padded contentLines still lands on the correct
  visual row once padding is applied
✓ borderColor wraps every border-drawn character (corners, rules, │/▐) but never the content text
```

### Verification Approach

```
- Inner: direct-render vitest unit tests (pure function, no TUI needed) — same style as
  scroll-viewport.test.ts / brunch-editor.test.ts's projectBorderedChrome suite.
```

### Cross-cutting obligations

```
- src/.pi/components/TOPOLOGY.md's Build/test convention (direct-render test is the default here)
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/
├── rounded-box.ts                  +
└── __tests__/
    └── rounded-box.test.ts         +
```

---

## Slice 2 — migrate `brunch-editor.ts`

Status: done (2026-07-01)

### Objective

`brunch-editor.ts`'s `projectBorderedChrome` delegates box-drawing to `projectRoundedBox`, keeping only
the editor-specific border-stripping/padding/`belowLines` logic locally; rendered output is
byte-identical to before.

### Light-card cold-start reads

```
- memory/PLAN.md — frontier: component-dx
- src/.pi/components/rounded-box.ts (slice 1) — the settled interface to call into
- src/.pi/components/brunch-editor.ts + src/.pi/components/__tests__/brunch-editor.test.ts —
  current behavior to preserve exactly
- this file's "The one non-trivial composition" sketch above — the stripEditorBorder /
  pad / recombine / box / belowLines decomposition to implement
```

### Acceptance Criteria

```
✓ every existing brunch-editor.test.ts assertion passes unmodified — byte-identical output
✓ padContentToMinimum no longer threads a { lines, bottomIndex } return shape — border-stripping
  happens before padding, not interleaved with it (the simplification named in the design)
✓ isEditorBorderLine / border-finding logic stays local to brunch-editor.ts, not moved into
  rounded-box.ts
```

### Verification Approach

```
- Inner: the full existing brunch-editor.test.ts suite, run unmodified, is the regression oracle.
  No new test cases required unless the refactor exposes a branch the current suite doesn't reach.
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/
├── brunch-editor.ts                       ~
└── __tests__/
    └── brunch-editor.test.ts              ?
```

---

## Slice 3 — migrate `workspace-dialog/component.ts`

Status: done (2026-07-01)

### Objective

`WorkspaceDialogComponent`'s `renderFrame` / `topBorderLine` / `bottomBorderLine` / `contentLine` /
`emptyLine` collapse into one call to `projectRoundedBox` (using `blankPadding: { top: 1, bottom: 1 }`
for the existing breathing-room rows); rendered output — including the scroll-thumb rows from the
`scroll-viewport` slice — is byte-identical to before.

### Light-card cold-start reads

```
- memory/PLAN.md — frontier: component-dx
- src/.pi/components/rounded-box.ts (slice 1)
- src/.pi/components/workspace-dialog/component.ts +
  src/.pi/components/__tests__/workspace-dialog.test.ts — current behavior, especially the
  thumbRows wiring added by the scroll-viewport slice
- src/.pi/components/scroll-viewport.ts — projectScrollViewport's isThumbRow contract this
  still composes with (unchanged by this slice)
```

### Acceptance Criteria

```
✓ every existing workspace-dialog.test.ts assertion passes unmodified, including the long-list
  scroll/thumb tests
✓ emptyLine() is deleted, not kept as a redundant helper alongside the primitive
✓ thumbRows index math correctly accounts for the blankPadding.top shift — the option-list's
  start offset changes by however many blank rows precede it, and the primitive (not this file)
  owns that arithmetic per the interface's _rules
```

### Verification Approach

```
- Inner: the existing workspace-dialog.test.ts suite, run unmodified, is the regression oracle.
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/workspace-dialog/
└── component.ts                          ~
src/.pi/components/__tests__/
└── workspace-dialog.test.ts              ?
```

---

## Slice 4 — migrate `cards.ts`

Status: resumed as 4a/4b below (2026-07-01) — stop finding preserved as history, resolution follows

### Objective

`CardComponent`'s hand-rolled top/bottom border and `│ │` wrapping delegate to `projectRoundedBox`
(`topLabel` = the card title, no `bottomLabel`); rendered output is byte-identical to before.

### Stop finding

The baseline `cards.test.ts` added for this slice proved the migration premise stale before any
`cards.ts` refactor. `CardComponent`'s current top border left-places the bold title after the opening
rule and colors border runs plus adjacent padding spaces as grouped chunks. The settled
`projectRoundedBox` contract right-aligns labels and colors border glyphs individually. A byte-identical
CardComponent migration would therefore require widening `projectRoundedBox` for legacy card title
placement/color grouping, or accepting visual byte drift. Per user choice, this scope stops here for
rescoping instead of widening the primitive inside this sequence.

**Scoping finding, named explicitly:** unlike slices 2 and 3, `CardComponent` has **no existing test at
all** today (confirmed: no `cards.test.ts`, and its only consumer, `alternatives.ts`, also has no
render-output test covering the card box). There is no regression oracle to migrate against. This slice
must add one *before* refactoring, not skip the safety net because none currently exists.

### Resolution (2026-07-01, this thread)

The stop finding is precise but conflates two independently-sized problems — traced exactly against
both `cards.ts`'s real code and `rounded-box.ts`'s real code, not re-guessed:

1. **Content-row side-border coloring** (`│ content │`): `CardComponent` colors the border glyph
   *and* its adjacent padding space together (`c('│ ')`, `c(' │')`). `projectRoundedBox` colors only
   the bare glyph (`borderColor('│')`, space is plain) — and this is *already* what both
   `brunch-editor.ts`'s and `workspace-dialog/component.ts`'s original code did, proven byte-identical
   in slices 2 and 3. A space carries no visible color either way. This is a pure byte-representation
   difference with zero visual effect, already 2-of-3-canonical — **no primitive change needed; slice
   4b re-baselines `cards.test.ts` to the already-proven bare-glyph convention.**

2. **Top-border label placement**: `CardComponent` left-aligns its title immediately after `╭─`;
   `projectRoundedBox`'s `topLabel`/`bottomLabel` right-align (matching `brunch-editor.ts`'s original
   `borderLine()`). This is a **real, visible difference** — title position on screen actually differs
   — not a byte-level artifact. It's also a real scoping gap: the original feature-coverage matrix
   recorded "label in top border" as one shared `+` feature across brunch-editor and cards.ts without
   checking they use opposite alignments. Left alignment is the semantically correct choice for cards
   (title is the primary heading of a comparison card, read left-to-right) — not something to
   homogenize away. **This does need a small, narrow primitive widening**, below.

   Incidentally, `colorBorderText`'s current *per-glyph* scanning (coloring every `─`/`╭`/etc.
   character as its own separate call) was never actually proven necessary by any of the three original
   implementations — all three color contiguous corner+dash *runs* as one span each side of a label,
   never per-character. Switching to run-based coloring is simpler than the current scanner, not more
   complex, and is what slice 4a below specifies.

#### Slice 4a — widen `projectRoundedBox` for label alignment (narrow, targeted)

Status: done (2026-07-01)

**Objective:** `RoundedBoxOptions` gains `labelAlign?: 'left' | 'right'` (default `'right'`, preserving
brunch-editor's and workspace-dialog's current behavior unchanged). Border-line-with-label construction
switches from per-glyph scanning to two contiguous colored runs (left run, raw label, right run) — the
no-label case (already one colored run across all three original implementations) is unaffected.

**Light-card cold-start reads:**
```
- src/.pi/components/rounded-box.ts + __tests__/rounded-box.test.ts (slice 1, as landed)
- src/.pi/components/cards.ts — the exact left-aligned layout to match: `╭─` + label + dashes + `╮`
- src/.pi/components/brunch-editor.ts — the exact right-aligned layout to keep matching: dashes +
  ` label ` + `─` + corner
```

**Acceptance Criteria:**
```
✓ existing rounded-box.test.ts suite passes unmodified (labelAlign defaults to 'right', current
  behavior is the default, not a breaking change)
✓ labelAlign: 'left' produces `╭leftCorner─` + label + dashes + `╮` matching cards.ts's exact
  current layout math (topFiller = width - 2 - 1 - visibleWidth(titleText))
✓ for both alignments, the label text itself is never wrapped in borderColor; only the corner/dash
  runs are, each as ONE colored span (not per-character)
✓ an oversized label still truncates gracefully without throwing (assert a concrete case; exact
  truncation edge behavior is this slice's to settle via TDD, not pre-specified here)
```

**Verification:** Inner — direct-render vitest tests, extending rounded-box.test.ts.

**Expected touched paths (tentative):**
```
src/.pi/components/
├── rounded-box.ts                    ~
└── __tests__/
    └── rounded-box.test.ts           ~
```

#### Slice 4b — migrate `cards.ts` (resumed)

**Objective:** `CardComponent`'s hand-rolled top/bottom border and `│ │` wrapping delegate to
`projectRoundedBox` with `labelAlign: 'left'`; rendered output is byte-identical to before **except**
the already-justified content-row space-coloring simplification from the Resolution above, which
`cards.test.ts`'s baseline is updated to reflect explicitly (not silently).

**Light-card cold-start reads:**
```
- src/.pi/components/rounded-box.ts (slice 4a, as landed) — the labelAlign contract
- src/.pi/components/cards.ts + __tests__/cards.test.ts — the existing baseline from the stopped
  attempt; update its content-row lines to the bare-glyph convention as part of this slice, not a
  separate step
- src/.pi/components/alternatives.ts — CardComponent's one real consumer
```

**Acceptance Criteria:**
```
✓ cards.test.ts's title/border-rune/label-position assertions are byte-identical to the original
  (left-aligned title, matching dash counts)
✓ cards.test.ts's content-row assertions are updated to bare-glyph coloring (│ then plain space,
  not │-and-space colored together) — the change is named in the test/commit, not silent
✓ ResponsiveColumns and chunk (also exported from cards.ts) are untouched — this slice only
  touches CardComponent's render()
```

**Verification:** Inner — `cards.test.ts`, updated per the acceptance criteria, as the regression
oracle for the refactor.

**Expected touched paths (tentative):**
```
src/.pi/components/
├── cards.ts                        ~
└── __tests__/
    └── cards.test.ts               ~
```

---

## Not this sequence (named, not built)

- Giving `MultiChoicePickerComponent` a border + `projectScrollViewport` wiring — the actual next
  `request_*` picker work this extraction unblocks, deliberately sequenced *after* this file, not
  part of it.
- Restyling `choice`/`review` response kinds with new Brunch components — separate, larger scope
  (new components, not a primitive extraction); see
  `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` for why that's safe to do independently of
  Brunch's RPC-driven answering path.
