# Details-driven transcript rendering — D104-L revision + candidates renderer

Frontier: main-editor-chrome
Status:   active
Mode:     single
Created:  2026-07-08

Orientation:

- Containing seam: the `renderResult` hooks in `src/.pi/extensions/exchanges/*` (ask.ts:621, present-candidates.ts:39, present-digest.ts:38, present-review-set.ts:96), all currently markdown pass-through of `content` per D104-L.
- Frontier: `main-editor-chrome` (FE-1169) thread 3 — the frontier's one deliberate SPEC revision.
- Ordering: lands **after** `main-editor-chrome--ask-surface-ux.md` (its Card 3 settles the content form this card must not re-churn).
- Main open risk: the rich layout for candidates is a design judgment, not a settled sketch — the mechanism is clear, the aesthetics get iterated in `dev:components`.

Posture: proving (inherited from main-editor-chrome).

**Deliberately not pre-scoped:** the `present_review_set` rich renderer. It should follow the pattern this card establishes — pre-scoping it would violate the anti-speculation gate (its scope shifts based on what the candidates renderer teaches about layout primitives). Scope it immediately after this lands; digest can be assessed then too.

## Card (full) — `present_candidates` renders richly from details; D104-L revised

### Target Behavior

`present_candidates` transcript results render as a structured TUI layout built from toolResult `details` (candidate cards with title/summary/status, not a markdown blob), while `content` remains the unchanged canonical model-facing record.

### Full-card cold-start reads

```
- memory/SPEC.md   — D104-L (the rule being revised: render-honesty KEEPS, pass-through GOES),
  D108-L (details constructed only via src/exchanges/projections + Zod schemas), D37-L (renderCall
  stays non-semantic), I57-L (capture reads details — untouched)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 3 (revision framing + expected breakage note)
- src/.pi/extensions/exchanges/TOPOLOGY.md — current render rule statement (update it)
- src/exchanges/schemas/ — PresentCandidatesDetails shape
- src/.pi/components/cards.ts + rounded-box.ts + exchange-markdown-body.ts — the layout primitives
  to compose, not duplicate
```

### Boundary Crossings

```
→ present-candidates.ts renderResult(result, options, theme)
→ result.details (validated PresentCandidatesDetails) — NEW render source
→ new render component/projection in src/.pi/components/ (pure, theme-injected, previewable)
→ pi-tui rendered lines (differential renderer)
→ SPEC D104-L row rewritten (event: revision; current state → exchanges TOPOLOGY)
```

### Risks and Assumptions

```
- RISK: renderResult receives legacy/malformed persisted details (old sessions) — a throw here
  breaks session RESUME rendering, not just one turn
  → MITIGATION: parse with the Zod schema; on failure fall back to the markdown pass-through of
    content (never an uncaught exception) — the fallback IS the compatibility story, assert it
    explicitly; build the parse+fallback as a shared helper (shared/details-rendering.ts) so every
    later details-backed renderer inherits it
- RISK: rich renderer duplicates content-formatter knowledge and the two drift
  → MITIGATION: renderer consumes projection outputs (D108-L discipline), never re-derives
    domain text; render-honesty suite still ties details to content
- RISK: rich offer rendering can visually imply graph commitment (candidates/review material is
  PROPOSAL, not accepted truth)
  → MITIGATION: render proposal vocabulary only; acceptance/commit language stays on the terminal
    ask/result path — carry this as a named obligation into the review-set follow-up card
- ASSUMPTION: current PresentCandidatesDetails carries enough structure for a useful card-like render
    → IMPACT IF FALSE: this card lands only the validation/fallback dispatch seam and routes payload
      widening to ln-spec — do not widen schemas here
    → VALIDATE: direct renderer fixture tests over existing details before any layout work
- ASSUMPTION: theme + width available in renderResult are sufficient for card-style layout
    → IMPACT IF FALSE: layout degrades to simpler list form — contained to this renderer
    → VALIDATE: dev:components preview entry during red phase (cheap, immediate)
```

### Posture check

Proving. Proof of life: first details-driven transcript render path (the seam every later rich
renderer — review-set, digest, ask — reuses). Uncertainty: retires "can renderResult carry a real
component layout without fighting pi's transcript renderer?" — the load-bearing unknown for the
rest of thread 3.

### Acceptance Criteria

```
✓ new render component test (src/.pi/components/__tests__/) — candidates details render titled
  card rows with status/summary at multiple widths; snapshot per theme
✓ exchanges-present-request.test.ts (or present-candidates suite) — renderResult with valid details
  uses the rich renderer; with unparseable details falls back to content pass-through (both asserted)
✓ render-honesty suite — details → content mapping still enforced (render-honesty is NOT retired)
✓ exchange-family-completeness.test.ts — updated coverage expectation: candidates entry points at
  the rich renderer; other families still pass-through (deliberate meaning change, not regression)
✓ dev:components — candidates preview entry renders the rich layout in both themes
✓ SPEC D104-L row — rewritten to: render-honesty invariant retained; per-family renderResult may
  render from validated details with content fall-back; exchanges TOPOLOGY.md render rule updated
✓ capture probes (present-candidates-supersession-proof.test.ts, exchange-capture-contract-proof
  .test.ts) — stay green (stop-the-line)
```

### Invariants preserved

```
- content = canonical, self-contained model-facing record (D106-L) — guarded by: writer goldens +
  render-honesty suite (unchanged by this card)
- renderCall stays non-semantic (D37-L) — guarded by: no renderCall edits in this card (touched-paths
  fence)
- Capture/sweep semantics read details (I57-L) — guarded by: the named probes above
```

### Verification Approach

```
- Inner: component render tests (width/theme matrix) + renderer dispatch tests + render-honesty
- Middle: family-completeness + capture probes as blast-radius tripwires
- Outer: dev:components both themes; one live session beat with a real present_candidates call
```

### Cross-cutting obligations

```
- Border semantics (thread 6): the candidates layout uses theme roles, no raw colors
- SPEC reconciliation is IN this card (D104-L rewrite + TOPOLOGY update), not deferred to ln-sync —
  the frontier definition's "record via ln-sync at first landing" is superseded by doing it here,
  atomically with the code
- Layout primitives composed from cards.ts / rounded-box.ts — extend those, do not fork box drawing
```

### Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── present-candidates.ts                     ~  (renderResult dispatch)
├── shared/details-rendering.ts               +  (shared parse-details-or-fallback helper)
└── TOPOLOGY.md                               ~  (render rule)
src/.pi/components/
├── exchange-candidates-result.ts             +  (pure render component/projection)
└── __tests__/exchange-candidates-result.test.ts +
src/.pi/extensions/__tests__/
├── exchange-family-completeness.test.ts      ~
└── exchanges-present-request.test.ts         ~
src/agents/contexts/exchanges/TOPOLOGY.md     ~  (two-render-sources note)
src/dev/component-preview/
├── registry.ts                               ~
└── exchange-fixtures.ts                      ?
memory/SPEC.md                                ~  (D104-L rewrite)
```

Merged 2026-07-08 from `--second-look-details-render.md` (superseded/deleted): its session-resume
risk framing, proposal-vocabulary obligation, payload-sufficiency assumption with the ln-spec escape,
and the shared fallback helper. Its both-offers-in-one-card breadth was rejected — review-set (and
digest assessment) is scoped as a fast-follow after this card's layout learnings, reusing
shared/details-rendering.ts and carrying the proposal-vocabulary obligation forward.
