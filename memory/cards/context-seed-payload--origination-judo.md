# Origination judo: one choreography, owner-typed seams

Frontier: context-seed-payload (FE-857 — post-review cleanup residue, same branch)
Status:   active
Mode:     single
Created:  2026-06-11

Posture: earned (cleanup of just-landed settled seams; judo review 2026-06-11)

## Card — collapse duplicated origination choreography; restore owner-typed boundaries (light card)

### Objective

Both assistant-origination call sites (TUI boot, `session.triggerExchange`)
delegate to one session-layer `originateAssistantTurn` helper that derives
origin from projected transcript state, owns seed composition, and appends
seeds + the `present_*` exchange — deleting the RPC entry-count heuristic,
the dead `seedContent` fallback mode, and three shadow types.

### Light-card cold-start reads

```
- memory/SPEC.md  — I46-L (origin from projected state, not entry counts), I47-L (carriers), D77-L (writer seam)
- memory/PLAN.md  — frontier: context-seed-payload (done; Landed shape note)
- src/app/brunch-tui.ts — seedAndKickAssistantTurn (~L387)
- src/rpc/methods/session.ts — triggerExchange origination (~L515-540)
- src/session/{start-assistant-turn,context-seed,prepare-next-turn}.ts
- src/graph/workspace-store.ts — unexported SpecScopedReaders (the reads owner)
```

### Acceptance Criteria

```
✓ one originateAssistantTurn (src/session/) owns: origin derivation (projected transcript state —
  conversational message presence, never entry counts), seed composition, seed append, present_*
  append; TUI and RPC call sites collapse to a call (RPC supplies its exchange ordinal + flush)
✓ the RPC `entries.length <= 3` origin heuristic is gone; a test pins new-session vs
  manual_trigger derivation at the RPC boundary against projected state
✓ seedContent fallback string in contextSeedEntries deleted; composition is required/owned by the
  helper (tests exercise the real composer)
✓ ContextSeedSliceLike deleted — composeContextSeedContent takes GraphSlice (import from owner)
✓ SpecScopedReaders exported from workspace-store; consumers project (Pick) instead of re-declaring
✓ ContinuityEntryAppender = Pick<SessionManager, 'appendCustomEntry' | 'appendCustomMessageEntry'>
✓ behavior preserved: all existing origination/seed/carrier suites green unmodified in intent
```

### Verification Approach

```
- Inner: existing start-assistant-turn / context-seed / prepare-next-turn / rpc session / brunch-tui
  suites; one new RPC origin-derivation test (the restored I46-L claim)
- Middle: tier-2 startup-completeness + I45–I47 rows stay green
```

### Cross-cutting obligations

- D77-L: reconciler remains the only continuity writer; the helper is the origination seam, not a new writer.
- No behavior change beyond the RPC origin derivation fix (which restores the SPEC claim).

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/session/
├── originate-assistant-turn.ts        +   (or absorbed into start-assistant-turn.ts if it reads better)
├── originate-assistant-turn.test.ts   +?
├── start-assistant-turn.ts            ~   (seedContent required; fallback deleted)
├── start-assistant-turn.test.ts       ~
├── context-seed.ts                    ~   (GraphSlice import; ContextSeedSliceLike deleted)
├── context-seed.test.ts               ~
├── prepare-next-turn.ts               ~   (ContinuityEntryAppender = Pick<SessionManager, …>)
└── README.md                          ~   (origination seam note)
src/graph/workspace-store.ts           ~   (export SpecScopedReaders)
src/app/brunch-tui.ts                  ~
src/app/brunch-tui.test.ts             ~?
src/rpc/methods/session.ts             ~
src/rpc/methods/*.test.ts              ~?
```

### Promotion checklist

All no — no requirement/assumption/decision/invariant changes (the RPC fix *restores* I46-L's
existing claim); single settled seam; behavior-preserving collapse.
