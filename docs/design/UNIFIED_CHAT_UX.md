<!-- Reading note (FE-716, 2026-05-15)

This brief is the canonical UX ceiling for the unified chat surface and is preserved verbatim from PR #138 (commit cd48b49a). It is intentionally **not** trimmed to the FE-716 V1 scope; future tracks can edit it as their scope evolves.

Two translation rules apply when reading this brief on the FE-716 substrate (see `memory/PLAN.md` `chat-runtime-secondary-chats` and `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.2):

- **Vocabulary:** "thread" in this brief = "secondary chat" in PR #139 / FE-716. The user-facing term is "secondary chat"; "thread" remains in this brief as the original design vocabulary.
- **Substrate:** Decision D153 defers the schema-level `thread` table. Wherever this brief names `thread.kind`, `thread.invoked_in_turn_id`, `thread_context_item`, or similar, the FE-716 substrate uses columns on the existing `chat` table (`chat.parent_chat_id`, `chat.invoked_in_turn_id`, `chat.pinned_item_id`, `chat.pinned_span_hint`) and the existing `chat.kind` enum (unchanged at `interview` + `side_chat`). Thread "flavor" (side / reconciliation / agent-run / strategy) is derived in projection, not encoded as an enum value.

V1 narrowing (Ask/Edit only, `#` knowledge-item injection only, lightweight reconciliation-element view, agent-run inline, turn-zero) is tracked in `memory/CARDS.md`. Items in this brief outside that V1 surface are explicitly deferred to follow-up frontiers; see the deferred list at the bottom of `memory/CARDS.md`.

-->

# Unified Chat UX — Design Brief

> Status: **brief**. Sets scope for the visual design layer that pairs with the FE-710 substrate work. Companion to `CONVERSATIONAL_WORKSPACE_RUNTIME.md` (substrate) the way `SIDE_CHAT.md` paired with `MULTI_CHAT.md`. Not a UX spec yet — the spec emerges from the Ladle prototype this brief unblocks.
>
> Authority boundary: structural primitives (thread kinds, target attachment, kickoff, lifecycle, mention substrate) are governed by `CONVERSATIONAL_WORKSPACE_RUNTIME.md` and `memory/SPEC.md` (Req 45, D153 / D154, I111). Library/stack labels (`ai-elements`, `useChat`, `streamdown`, `motion`, `lucide-react`) are inferred from the existing interview surface and may not be re-decided here.

## 1. Purpose

Design the visual and interaction layer for **threads** rendered inline in the unified chat surface. Threads are durable kickoff-anchored sub-runs of five kinds (`interview` / `side` / `reconciliation` / `qa` / `agent_run`). The interview thread is the spine; other threads render inline as collapsibles invoked from a turn.

## 2. Modes (Shift+Tab)

The chat composer carries a **mode chip**. **Shift+Tab** toggles between two user modes. The mode at submit time determines which `thread.kind` is created.

| Mode (visible label) | `thread.kind` | When |
| --- | --- | --- |
| **Ask** | `qa` | Open-ended question scoped to mentioned items; assistant is read-only (no `propose_*` tools). |
| **Edit** | `side` | Refine, tighten, or annotate a specific item; assistant can `propose_edit` / `propose_annotate` / `propose_drill_down` / `propose_edge`; cascades resolve in-thread. |
| *(batch-surfaced, no user mode)* | `reconciliation` | Reaches users through **"Reconcile Now"** (§7 dec 10) or auto-surfacing when needs accumulate. Not a composer mode — users don't *author* a reconcile, the system *surfaces* one. |
| *(assistant-spawned, no user mode)* | `agent_run` | Spawned by the assistant from inside any other thread; rendered inline via `thread.invoked_in_turn_id`. |
| *(implicit)* | `interview` | The chat's spine; not user-selectable. |

**Persistence:** the mode at submit time is the thread's kind **forever**. Reopening a thread shows the kind chip; switching modes mid-thread is not allowed — open a new thread instead.

**Implementation note:** the existing code uses internal mode state values `explore` (= Ask) and `edit` (= Edit) per slice 8 (`401f4037`). The composer label and `<ThreadModeChip>` text use the brief's *Ask* / *Edit* register; the internal state name can stay `explore/edit` or rename to `ask/edit` in a later refactor.

**Suggestions on turn-zero:** fresh threads show a `<Suggestions>` row (ai-elements) with 3 mode-appropriate prompts. Replaced by a normal composer once the user types.

**Suggestion source:** **static per mode** in V1 (hard-coded prompt lists keyed by mode + thread-kind context). LLM-generated, context-aware suggestions are a future improvement.

## 3. Mention vocabulary

| Symbol | Resolves to | Behavior |
| --- | --- | --- |
| `#` | **Knowledge items** — typed intent items (goal / term / context / constraint / decision / assumption / requirement / criterion / invariant / example). | Chip shows the item's **reference code** (e.g. `#A12`, `#CTX13`, `#GOAL3`); kind is read from the prefix; chip tint comes from `kindAccentHex` (already used by `knowledge-card.tsx`). Adds a durable `thread_context_item` row (Track 5); revocable. |
| `$` | **Threads** (current spec's open / closed threads). | Chip linking to the thread; click jumps and expands it inline. |
| `!` | **Annotations and other (untyped) artifacts** — anything in the workspace that isn't a typed intent item with a reference code (durable `annotation` rows, free-text artifacts, in-view selections). | Chip shows a short label; resolves at type-time against workspace state; persists into the turn as a snapshot reference. |
| `@` | **Reserved — later for code references** (files / symbols / locations in the workspace's source). | Not wired in V1; do not surface autocomplete on `@` until the code-reference use is implemented. |
| `-` | **Omitted.** | Not used as a mention symbol — too overloaded in plain text. |

Autocomplete pops on `#`, `$`, or `!` press via Radix `Combobox` / `cmdk` (already a dep). `#` autocomplete reads the spec's intent graph (with refcodes + kind tints); `$` reads the spec's threads; `!` reads annotations + currently-visible workspace artifacts. Mentions are durable mutations — they outlive the turn that authored them.

## 4. Layout presentations

Four states, user-toggleable from a header control on the chat. State persists per workspace (localStorage). **Default: Side-docked** — matches today's two-pane workspace shell.

| State | Footprint | Use |
| --- | --- | --- |
| **Compact** | small floating dock, ~360–420 px wide | quick check; minimal surface; suggestions condensed or hidden |
| **Side-docked** *(default)* | right rail, ~50% width | Notion-style; two-task — spec on left, chat on right |
| **Maximize** | wide center, ~70% with rails | Linear-style; chat focus, spec view still visible |
| **Full** | 100% workspace | chat-only; spec recedes; deep dialog or agent-run inspection |

State transitions animate via `motion`. The mode chip and the layout-state control share the chat's header strip.

## 5. Canonical scenes

Each becomes one Ladle story in the prototype.

| # | Scene | What it shows |
| --- | --- | --- |
| 1 | **Reference — side-docked** | Spine + collapsed side thread + open reconciliation thread + collapsed agent run. The hero. |
| 2 | **Mode toggle in composer** | Mode chip toggles Ask ↔ Edit via Shift+Tab; suggestions row updates per mode. |
| 3 | **Side thread — first open** | `Edit` submit on `'<item>'` with impact > soft; kickoff card + suggestions visible. |
| 4 | **Reconciliation thread — batch surfaced** | Target-grouped, topo-sorted upstream-first; classifier states visible (auto-edit one-click apply chip, substantive judgment affordance); auto-confirm rows never visible. |
| 5 | **QA thread — with mentions** | User-initiated; one `#A12` chip (knowledge item, refcode-prefixed + kind-tinted), one `!selection` chip (workspace artifact), one `$thread` chip (linking another thread); mention autocomplete shown in a parallel state. |
| 6 | **Agent-run — inline collapsible** | `<Tool>` components nested; progress narration *Reviewing… / Building… / Generating…* with timer; collapsed-by-default once complete. |
| 7 | **Subtle surfacing — structured-list** | Knowledge items with open-thread chips per kind (trailing badge `◉ 2`). |
| 8 | **Subtle surfacing — graph view** | Same chips, graph projection. |
| 9 | **Layout — compact** | Small floating dock with one open thread. |
| 10 | **Layout — full** | Chat at 100% workspace; spine + collapsibles; no spec rail. |

## 6. Kickoff copy

Simple, declarative, second-person where conversational. Modeled on the existing Figma register (*"Ask me everything…"*, *"Now generating the new questions…"*). One default per kind; alternates iterate in the prototype.

### Side (Edit)

- **Kickoff:** "Editing **'<item>'**. **<N>** related items may need updating."
- **Suggestions:** *Refine the wording* · *Tighten the constraint* · *Add a counterexample*

### Reconciliation (batch-surfaced or "Reconcile Now")

- **Kickoff:** "**<N>** reconciliations on **'<target>'**. **<X>** auto-edit, **<Y>** need review."
- **Suggestions:** *Apply auto-edits* · *Show only substantive* · *Skip for now*
- *Note:* not a user composer mode; the thread is surfaced when the classifier accumulates needs against a target, or when the user clicks **Reconcile Now** (§7 dec 10).

### QA (Ask)

- **Kickoff:** "Anchored to **<items>**. Ask anything."
- **Composer placeholder:** *"Ask me everything…"*
- **Suggestions:** *What's the goal?* · *Show related decisions* · *Where's the friction?*

### Agent run (assistant-spawned)

- **Kickoff:** "**<verb-ing>** …" — e.g. *Summarizing what's open across all phases…*
- **Progress steps:** *Reviewing the prompt* · *Building the plan* · *Generating clarifying questions* (verb-first task narration with timer)

### Interview spine

Unchanged — inherits existing phase-entry kickoff turns; not redesigned here.

## 7. Visual decisions (recommendations)

► = recommended; revise in the prototype.

1. **Spine reflow** (not overlay) when a thread expands. ►
2. **Collapsed thread row:** kind chip + target/title + turn count + relative time. ►
3. **No per-kind background tint.** Icon + neutral chrome; subtle accent only on the kind chip. ►
4. **Sticky in-thread header** when expanded body exceeds viewport: kind chip + target link + lifecycle status + close. ►
5. **Animation curve:** `motion` spring, soft (mass 0.6, stiffness 220, damping 30), ~250 ms. ►
6. **Item-anchored badge** in structured-list / graph views: trailing, persistent, with count; hover reveals kind breakdown; click jumps to the thread. ►
7. **Multiple open threads on one item:** sibling collapsibles in stream order; partial unique indexes bound to one open per (kind, target). ►
8. **Close behavior:** explicit close for `side` / `qa`; auto-close on resolution for `reconciliation` / `agent_run` with a brief "done" affordance. ►
9. **Mention chip behavior:** `#` (knowledge item) chips jump to the item in structured-list / graph view, kind shown by refcode prefix + `kindAccentHex` tint; `$` (thread) chips jump and expand inline; `!` (annotation / artifact) chips show the snapshot reference inline. All revocable via dropdown. ►
10. **"Reconcile Now" placement:** sidebar with count badge, near readiness / turn-count metadata. Not top bar, not in-stream banner. ►

## 8. Motion + chip vocabulary

- **Motion library:** `motion` (Framer Motion).
- **Expand/collapse:** spring per Decision 5; reflows surrounding stream.
- **Streaming live state:** kickoff card shows pulsing "generating…" with timer (mirror *"Now generating the new questions…"*). Reuse `Reasoning` live-state pattern.
- **Chips:** kind chip = `lucide-react` icon + label. Icon family locked to `lucide-react`; no custom set.

| `thread.kind` | `lucide-react` icon | Notes |
| --- | --- | --- |
| `interview` | — (no chip; it's the spine) | |
| `side` | `PencilLine` | Edit/refine register |
| `reconciliation` | `GitMerge` or `RefreshCw` | Cascade-cleanup register |
| `qa` | `MessageCircleQuestion` | Open-ended question |
| `agent_run` | `Sparkles` or `Workflow` | Assistant-driven task |

Accent: kind chip carries one subtle color (~8–12% tint of the kind's accent on a white chip background). No competing palettes in stream.

## 9. Color, type, density

Inherit from the interview surface + `kindAccentHex` (`src/client/components/knowledge-card.tsx`). Concretely:

- **Base:** `#ffffff` page, `#fafafa` rail / panel tint, `#e3e3e3` hairlines.
- **Text:** `#202020` / `#5b5b5b` / `#a6a6a6` (primary / secondary / tertiary).
- **Inter** everywhere; Gotham reserved for the HASH wordmark.
- **Radii:** 6 (chip) / 8–12 (card) / 16 (overlay).
- **Shadow stack** (cards, composer, dock): `0 4 4 -2 rgba(0,0,0,0.02), 0 2 2 -1 rgba(0,0,0,0.02), 0 0 0 1 rgba(0,0,0,0.08)`.
- **Density:** Inter Medium / 13–14 px / line-height 1.6.

## 10. Accessibility

Non-negotiable in this layer (dark mode deferred).

- **Keyboard:**
  - **Shift+Tab** cycles modes (preserves browser tab behavior outside the composer).
  - **⌘/Ctrl+Enter** submits.
  - **Esc** collapses an open thread (or steps the layout state down by one tier).
  - **↑/↓** within the suggestions row.
- **Focus management:** on thread creation, autofocus the new thread's composer; on expand, focus the kickoff card; on collapse, return focus to the invoking turn.
- **ARIA:** `role="region"` on thread collapsibles with `aria-label` = kind + target; `aria-expanded` on the toggle.
- **Live regions:** streaming progress narration uses `aria-live="polite"`.
- **Color is never the sole carrier** of kind information — icons + labels (and refcode prefix for `#`) accompany every chip.

## 11. Generative / typed UI parts

The chat continues to use **typed data parts** via `BrunchUIMessage` / `brunchDataPartSchemas`. Threads compose around them; the **review-set surface** (requirements, criteria) keeps its current component vocabulary and renders as a typed data part inside the interview thread, not absorbed into a thread-generic shell.

New typed parts likely needed (substrate-allowing): `thread.kickoff`, `thread.suggestions`, `thread.mention_resolved`, `thread.reconciliation_summary`, `thread.agent_progress`. Schemas land alongside the build slices that introduce each thread kind.

## 12. Constraints & non-goals

### Constraints (inherited; not negotiable here)

- Compose above `ai-elements/*` (vendored); vendor additional ai-elements (e.g. `Reasoning`, `Suggestions`, `Sources`) rather than fork.
- Each active thread mounts its own `useChat<BrunchUIMessage>` (working assumption per HANDOFF; confirm at S2).
- Layout shells unchanged: `AppLayout` / `SpecificationWorkspaceLayout` / `ViewLayout` (SPEC §Layout Architecture).
- Existing routed interview surface preserves SPEC I24.
- **Suggestion content must respect relation-policy validity** (SPEC D137 / I118). No suggestion may propose an edge, item, or action that violates relation directionality or kind constraints. Applies to static-per-mode V1 and any future LLM-generated variant.

### Non-goals

- Dark mode — explicitly deferred.
- Per-thread background tints / brand gradients / glow rings.
- Spatial canvas graph view — deferred per PLAN horizon.
- SideChatPopover persistence (V4a) — superseded by threads.
- Strategy chats as separate routes — strategies are thread-local (D148).
- `@` (future code-references) and `-` mention behavior — reserved / omitted in V1.
- TOON serializer — owned by Track 5 (`thread-context-provision`).
- Reconciliation classifier scheduling — owned by Track 3 (`reconciliation-runtime`).
- Mode-switching mid-thread — not allowed; open a new thread instead.

## 13. Next step — Ladle prototype

The prototype lives at `.ladle/` (existing harness, `npm run ladle`). One story per canonical scene from §5, composed from `ai-elements/*` + new `src/client/components/threads/*` shells. The prototype confirms or revises every §7 / §8 / §10 decision in code; this brief is the starting frame, not the verdict.

Deliverable: a Ladle build that renders all ten canonical scenes from §5 with mock data and the recommended decisions. Iterate visually; promote stabilized components into S2/S3 of FE-710 when the substrate-landing slice merges.

### Build order

Four phases; each one ends in a reviewable commit on the FE-710 branch.

- **Phase A** — Scene 1 (reference side-docked hero) + Scene 4 (reconciliation thread). Covers multi-kind rendering and the most distinct thread shape in one go.
- **Phase B** — Scene 2 (mode toggle) + Scene 3 (side first-open) + Scene 5 (QA with mentions). Interactive composer + mention-chip work.
- **Phase C** — Scene 6 (agent run) + Scenes 7 / 8 (structured-list & graph view chips).
- **Phase D** — Scene 9 (compact) + Scene 10 (full). Layout-state coverage.

## 14. Prototype-settle questions

Decisions the Ladle prototype will resolve in code; not blocking the brief.

- **Compact-state composer affordances** — in the smallest layout, suggestions probably can't fit. Cut to one suggestion? Hide entirely until input has focus?
- **Mode chip placement** — leading edge of composer (with the icon) vs trailing edge (next to send)?
- **Per-kind icon family iteration** — the table in §8 is a first pass; iterate against the rest of the app's icon usage for cohesion.
- **Progress-step narration** — server-streamed verb-list requires routes to emit named steps. Worth wiring as a typed data part (`thread.agent_progress`) so UI is purely declarative.
