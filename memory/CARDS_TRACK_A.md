# Track A — Scope Cards

## Card 1: Multi-part turn rendering seam `[status: next]`

**Weight: full scope card**

### Orientation

- **Containing seam**: workspace stream projector → transcript artifact renderer → interview controller
- **Frontier item**: PLAN.md Next §Track A #1 — Multi-part turn rendering seam
- **Volatile state**: grounding free-text and homepage workspace binding are done; this is the next structural prerequisite
- **Main risk**: the current projector assumes one primary artifact per turn (grounding card XOR question card XOR review set). Changing this to a stacked list touches projection, rendering, response submission wiring, and test helpers.

### Target Behavior

A single turn projects and renders a stack of assistant-part artifacts (e.g. a grounding card above a question card, or a revision card above a review set) with one unified response submission attached to the bottom card.

### Boundary Crossings

```
→ materializeTurnArtifacts (server/turn-artifacts.ts): already persists both data-grounding-card and tool-ask_question parts on the same turn — no server change needed
→ getPersistedGroundingCard / getPersistedReviewSet (shared/specification-state.ts): extraction helpers currently used in exclusive-OR dispatch — need to return both when present
→ projectHistoryArtifacts (client/-workspace-stream-projector.ts): currently emits one artifact kind per turn via if/else-if chain — must emit a composite artifact when multiple parts coexist
→ projectBottomArtifact (client/-workspace-stream-projector.ts): same exclusive dispatch for the active turn — must support composite
→ WorkspaceStreamArtifact union type: needs composite variants or a stacked wrapper
→ renderWorkspaceHistoryArtifact / renderWorkspaceInteractiveArtifact (client/-workspace-transcript-artifacts.tsx): must render stacked cards inside one WorkspaceArtifactRow with response wiring on the bottom card only
→ test helpers (createTurn, projector tests, transcript-parity tests): must cover multi-part turns
```

### Risks and Assumptions

```
- RISK: Composite artifact type inflates the WorkspaceStreamArtifact union with too many combinations → MITIGATION: use a single 'stacked-turn' variant that carries an ordered list of part descriptors plus the response-bearing bottom part, rather than one variant per combination
- RISK: Answered multi-part turns need distinct collapse/replay behavior (grounding card collapses differently than a question card) → MITIGATION: keep per-part rendering inside the stacked wrapper; each part uses its existing answered-card component
- ASSUMPTION: The server already persists both grounding-card and question parts on the same turn in assistant_parts → VALIDATE: confirmed by reading materializeTurnArtifacts — it appends both persistedGroundingCard and persistedReviewMetadata when present → memory/SPEC.md §D112, §D117
- ASSUMPTION: Response submission stays on the bottom card of the stack (question card or review set), not on the grounding/revision card → VALIDATE: matches D117 and D119 spec text → memory/SPEC.md §A61
```

### Acceptance Criteria

```
✓ projector-stacked-history — projectHistoryArtifacts emits a composite artifact for a turn that has both data-grounding-card and tool-ask_question parts, preserving grounding card above question card in render order
✓ projector-stacked-active — projectBottomArtifact emits a composite artifact for an active turn with both grounding card and question parts; the question code increments correctly
✓ render-stacked-answered — renderWorkspaceHistoryArtifact renders a grounding card stacked above an answered question card inside one WorkspaceArtifactRow
✓ render-stacked-active — renderWorkspaceInteractiveArtifact renders a grounding card stacked above an active question card with response submission wired to the question card only
✓ grounding-only-fallback — a turn with only a grounding card and no question (degenerate brownfield case) still renders as a standalone grounding card with its own continue submission
✓ review-only-fallback — a turn with only a review set and no revision card still renders as a standalone review set (no regression)
✓ npm-run-verify — full verification gate passes
```

### Verification Approach

```
- Inner: vitest unit tests on workspace-stream-projector (projector-stacked-* cases) and workspace-transcript-artifacts (render-stacked-* snapshot/assertion cases)
- Middle: transcript-parity.test.tsx extended with a multi-part turn fixture to prove hydration/replay round-trips stacked artifacts
- Outer: manual grounding walkthrough on a brownfield specification confirming stacked grounding-card + question renders live and on replay
```

---

## Card 2: Phase section headers `[status: next]`

**Weight: light scope card**

### Objective

Each realized phase section in the workspace stream opens with a projected phase section header that states the phase purpose and what kinds of knowledge are captured there, derived from workflow state rather than persisted as a turn.

### Acceptance Criteria

```
✓ Each of the four phases (grounding, design, requirements, criteria) projects a phase section header at the top of its section with phase-specific copy (purpose + knowledge kinds)
✓ Phase section headers are projected artifacts (kind 'phase-section-header'), not durable turn rows
✓ Headers re-project correctly on hydration/reload
✓ Headers appear only for realized phases (not future unreachable phases)
✓ npm run verify passes
```

### Verification Approach

```
- Inner: vitest unit tests on workspace-stream-projector — projectPhaseMarkers (or new projectPhaseSectionHeader) emits a phase-section-header artifact for each realized phase with correct phase-specific copy
- Middle: transcript-parity.test.tsx confirms headers survive hydration
- Outer: manual visual check on a multi-phase specification
```

### Promotion checklist

- [ ] Does this change a requirement? — No (Req 24 already specifies this)
- [ ] Does this create, retire, or invalidate an assumption? — No
- [ ] Does this make or reverse a non-trivial design decision? — No (D116 already decided)
- [ ] Does this establish a new seam-level invariant? — No
- [ ] Does it cross more than two major seams? — No (projector + renderer)
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? — No
- [ ] Can you not name the containing seam or current rationale from the live docs? — No (D116, A60)

Stays light.

---

## Card 3: Granular query domain design `[status: next]`

**Weight: light scope card**

### Objective

Design the TanStack Query decomposition — query hook count, shapes, invalidation targets, and migration path — so that transcript/turn data, knowledge state, and workflow state become independently invalidable query domains scoped to the specification, replacing the coarse `router.invalidate()` cascade.

### Acceptance Criteria

```
✓ A written design document (in memory/ or docs/) specifying: query key taxonomy, hook signatures, invalidation triggers per mutation/SSE event, and the router loader's reduced role
✓ The design identifies which existing loader data moves to query hooks vs. stays in the loader
✓ The design covers observer-update invalidation (the scroll-jank trigger) as a targeted query invalidation rather than full-route invalidation
✓ No code changes — design only
```

### Verification Approach

```
- Inner: design review against current loader/invalidation code paths
- Middle: n/a (design artifact, not code)
- Outer: n/a
```

### Promotion checklist

- [ ] Does this change a requirement? — No
- [ ] Does this create, retire, or invalidate an assumption? — No (validates A64)
- [ ] Does this make or reverse a non-trivial design decision? — Produces a design, but D121 already decided the direction
- [ ] Does this establish a new seam-level invariant? — No
- [ ] Does it cross more than two major seams? — No (design artifact)
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? — No
- [ ] Can you not name the containing seam or current rationale from the live docs? — No (D121, A64)

Stays light.

---

## Dependency summary

```
Card 1 (multi-part turn rendering seam) — unblocked, structural prerequisite
  ├──→ turn-internal-grounding-cards (future card, depends on Card 1)
  └──→ review-per-item-commenting-and-regeneration (future card, depends on Card 1)

Card 2 (phase section headers) — unblocked, fully independent of Card 1 and Card 3

Card 3 (granular query domain design) — unblocked, fully independent of Card 1 and Card 2
  └──→ granular-query-domain-implementation (future card, depends on Card 3 + interaction-model seams settling)
```

All three cards are independently buildable. Card 1 is the highest-priority structural prerequisite. Cards 2 and 3 can proceed in parallel with Card 1 or after it.
