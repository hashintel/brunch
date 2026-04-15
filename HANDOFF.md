<!-- HANDOFF.md — volatile session state for thread continuity.
     This file is derivative and temporary. Canonical state lives in
     memory/SPEC.md and memory/PLAN.md. -->

# Handoff — 2026-04-15

## Phase

```
grill ✓ → spec ✓ → plan ✓ → scope (next) → build
```

- **Last completed skill**: `ln-plan` — rewrote `memory/PLAN.md` with layout architecture slices as Active #1–4.
- **Previous skills this session**: `ln-grill` (top bar, sidebars, center pane, knowledge grouping), `ln-spec` (D99–D106 + §Layout Architecture).
- **Current skill**: `ln-handoff`.

## What the session accomplished

### 1. Story-first card refinement (now complete)

Built and refined story components that establish the canonical card patterns:

- **DrawerCard** (`src/client/components/drawer-card.tsx`) — shared primitive with header/summary/children slots, `locked` prop for controlled state. Supports static, summary-peeking, and toggleable (minimized ↔ maximized) modes.
- **Knowledge detail cards** (`src/client/stories/knowledge-detail.stories.tsx`) — all permutations of summary/children/neither. Uses DrawerCard.
- **Question cards** (`src/client/stories/question-detail.stories.tsx`) — active (expanded, interactive checkboxes, edge-to-edge textarea with negative margin breakout) and answered (collapsed, locked, green check status) variants.
- **Chat transcript** (`src/client/stories/chat-transcript.stories.tsx`) — full composed story with answered cards, activity placeholders ("Thought for Ns" + tools), active question, Back/Skip/Submit controls. Uses ChatScroll.
- **ChatScroll** — composite component (in chat-transcript story, not yet extracted) wiring Radix `ScrollAreaPrimitive.Viewport` with `useStickToBottom` via merged callback ref. Custom scrollbar + auto-scroll-to-bottom + scroll-down indicator.

### 2. Design system refinements

- **Typography scale**: reset to 6 steps (11px `text-xxs` through 16px `text-base`). Question card titles use arbitrary `text-[17px]`. No `text-xxs` at 10px (removed).
- **Font weights**: locked to normal (400), medium (500), semibold (600). No bold (700+). Enforced via `--font-weight-*: initial` reset.
- **Knowledge kind prefixes**: D, R, CTX, CR, T, G, A, NG.
- **Checkbox blue**: `data-checked:bg-[#2070e6] data-checked:border-[#1060d6]` for question cards.
- **Removed `font-bold`** from `-project-list.tsx` and `-export-preview.tsx`.

### 3. Layout architecture grill + spec + plan

Grilled all three panes + top bar. Decisions captured as D99–D106 in SPEC.md. Plan reordered with layout slices as Active #1–4.

## In-flight state (volatile)

### ChatScroll is not yet extracted

The `ChatScroll` component exists only inside `chat-transcript.stories.tsx`. It needs extraction to a shared component file before route integration (Active #3 in the plan). The wiring pattern is:
- `useStickToBottom({ resize: 'smooth', initial: 'smooth' })`
- Merged ref: `scrollRef` → `ScrollAreaPrimitive.Viewport`
- `contentRef` → inner content div
- Radix `ScrollBar` for custom scrollbar
- Floating `ArrowDownIcon` button when `!isAtBottom`

### User made manual styling adjustments

Throughout the session the user directly edited files between my changes, adjusting spacings, paddings, font sizes, and layout details. All those edits are committed. Key ones to note:
- Answered question card header was restructured by the user: eyebrow moved above the code+title row, `items-baseline` alignment, `text-sm-plus` sizing
- Active question card header: `text-[17px]` for both code and title was a user choice after iterating through 18px and other values
- The user changed `text-xs-minus` to `text-xxs` in `index.css` — renaming the 11px step. The CSS variable name is now `--text-xxs` (not `--text-xs-minus`).
- Impact colors changed from `text-[#color]` to `text-[color:#color]` syntax by the formatter in some places

### Phase label mapping not yet applied to route code

D99 canonicalizes labels (Grounding, Elicitation, Requirements, Acceptance Criteria) but the `phaseLabels` map in `project/$id/route.tsx` still reads `{ scope: 'Framing', design: 'Elicitation', requirements: 'Requirements Review', criteria: 'Acceptance Review' }`. This is Active #1 in the plan.

### Knowledge grouping registry not yet created

D104 specifies the grouping but no code artifact exists yet. This is Active #4 in the plan.

## Git state

- **Branch**: `ln/fe-582-e2e-manual-refine-2`
- **Ahead of remote**: 9 commits (not pushed)
- **Working tree**: clean
- **Recent commits**:
  ```
  579e264 plan: reorder frontier for layout architecture slices
  2d0fef6 spec: add layout architecture section and decisions D99–D106
  ed88e7a plan updates re: migrations
  62f6f43 custom ChatScroll
  ddf3da5 WIP on conversation styling
  b0ca864 WIP on stories
  5f209a1 add an --all option to seed script
  5cb172e Refine design system stories and extract DrawerCard primitive
  ```

## Persisted artifacts

| Artifact | Status |
| -------- | ------ |
| `memory/SPEC.md` | Current — updated with §Layout Architecture and D99–D106 |
| `memory/PLAN.md` | Current — layout slices as Active #1–4 |
| `docs/archive/PLAN_HISTORY.md` | Current — older completed items archived |
| `src/client/components/drawer-card.tsx` | Current — shared primitive with `locked` prop |
| `src/client/stories/knowledge-detail.stories.tsx` | Current |
| `src/client/stories/question-detail.stories.tsx` | Current |
| `src/client/stories/chat-transcript.stories.tsx` | Current — includes inline ChatScroll (not yet extracted) |

## Verification

Last known: `npm run verify` passes (350 tests, build succeeds). The pre-existing type error in `db.ts` around `getProjectWideEntitiesForProject` was observed during the session but is unrelated to this work.

## Resume prompt

> Continue layout architecture implementation on branch `ln/fe-582-e2e-manual-refine-2`. Read `memory/PLAN.md` — Active #1 (top bar + phase label canonicalization) is next. The spec at `memory/SPEC.md` §Layout Architecture has all the decisions. Stories are proven at `src/client/stories/chat-transcript.stories.tsx`. Start with `/ln-scope` for Active #1.
