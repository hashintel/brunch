# Live gap-legality wiring — make the composition root supply real gap reads

Frontier: capability-readiness
Status:   active
Mode:     single
Created:  2026-06-11

> Sequencing: builds on `ln/fe-847-turn-boundary-closure` after the
> `turn-boundary-reconciliation--continuity-chain.md` cards (shared write path:
> `src/app/brunch-tui.ts`). User-routed here by the 2026-06-11 ln-induct pass;
> the defect originated on PR #201 but is fixed at the top of the stack, no restack.

## Orientation

- Seam: the `BrunchPromptContext` / `GraphReaders` dependency surface between the live TUI composition root (`src/app/brunch-tui.ts`) and the system-prompts legality gating (`src/.pi/extensions/system-prompts/index.ts`).
- Frontier: `capability-readiness` (done) — this card closes a wiring hole that frontier left: legality reads `ElicitationGap[]`, but the live `reads` object never implements `getElicitationGaps`, so every live session falls through to `conservativeUncoveredGaps` and is frozen at the most-gated legality floor regardless of real graph coverage.
- The selected-spec gap reader already exists (`src/graph/workspace-store.ts` exposes one; `getElicitationGaps(db, specId)` in `src/graph/queries.ts` is the canonical read).
- Posture: earned (inherited from `capability-readiness`) — no unknown; this closes the optional/required ambiguity on a settled seam.

## Target Behavior

A live TUI session's prompt/tool legality is derived from the selected spec's real elicitation gaps, and a composition root that fails to supply gap reads is a type error, not a silent fallback.

### Full-card cold-start reads

```
- memory/SPEC.md   — D75-L (gaps reference node kinds), D77-L context, I-rows for capability readiness; §Verification Design
- memory/PLAN.md    — frontier: capability-readiness (Frontier Definitions; done 2026-06-11)
- src/.pi/extensions/graph/index.ts        — GraphReaders interface (getElicitationGaps currently optional)
- src/.pi/extensions/system-prompts/index.ts — gapsForPrompt + conservativeUncoveredGaps fallback
- src/graph/workspace-store.ts             — existing selected-spec gap reader seam
- src/dev/README.md                        — Tier-2 harness ownership (the real-boot oracle)
```

### Boundary Crossings

```
→ src/app/brunch-tui.ts (live composition root: reads object)
→ src/.pi/extensions/graph/index.ts (GraphReaders contract)
→ src/.pi/extensions/system-prompts/index.ts (legality gating consumer)
→ src/projections/session/capability-readiness.ts (readiness evaluation, read-only)
```

### Risks and Assumptions

```
- RISK: making getElicitationGaps required breaks other GraphReaders constructors
  (probes, fixtures, RPC adapters) that legitimately lack a DB handle.
  → MITIGATION: sweep all GraphReaders construction sites first; where a real reader
    is impossible, the constructor must opt in loudly (explicit stub named as such),
    never via interface optionality.
- RISK: removing conservativeUncoveredGaps changes live legality from "floor-locked"
  to "real coverage" — sessions that previously had everything gated may now unlock
  capabilities. → MITIGATION: this is the intended fix; cover with a Tier-2 assertion
  that a seeded spec with covered floor gaps actually unlocks the gated posture.
- ASSUMPTION: distinguishing intended-optional context members (context?, session?)
  from must-wire capability members is worth recording on BrunchPromptContext.
    → IMPACT IF FALSE: none beyond a comment.
    → VALIDATE: n/a — documentation move.
```

### Posture check (earned)

- **Closes:** the optional-vs-required ambiguity on `GraphReaders.getElicitationGaps` that let the live composition root silently diverge from every test harness.
- **Locks in:** the invariant that legality-bearing capabilities on dependency interfaces are required members — optionality is reserved for ergonomic extras (`clock?`, `telemetry?`), and that distinction is written at the interface.
- **Deletes:** `conservativeUncoveredGaps` (the silent fallback) or demotes it to an explicitly-named test stub if a harness still needs one.

### Acceptance Criteria

```
✓ getElicitationGaps is a required member of GraphReaders; `npm run verify` fails to
  type-check if the live composition root omits it (proven by the wiring existing —
  the contract is the compiler).
✓ live reads object in brunch-tui.ts supplies selected-spec gap reads via the
  existing workspace-store/queries seam (respecting the currentWorkspace.spec.id
  getter — gaps follow spec switches).
✓ conservativeUncoveredGaps is deleted from the production path; if any test stub
  replaces it, it is named as a stub and lives with the tests.
✓ Tier-2 real-boot assertion: a session over a seeded spec derives prompt/tool
  legality from that spec's actual gap coverage — covered floor gaps unlock the
  posture that the conservative floor previously kept locked.
✓ BrunchPromptContext documents which optional members are intended-optional
  (context bundle, session) vs. must-wire, so the next optional hook is a
  deliberate choice.
```

### Verification Approach

```
- Inner: type-level enforcement (required member) + existing capability-readiness
  unit tests unchanged.
- Middle: Tier-2 real-boot legality assertion (the ownership-axis oracle from the
  ln-induct pass — live posture pinned through runBrunchTui, no harness substitution).
```

### Cross-cutting obligations

```
- Preserve D39-L sealed-profile boundary — gap reads observe; they do not let the
  prompt path mutate.
- Multi-spec discipline: gap reads are selected-spec scoped; never workspace-global.
- Do not fold this into the continuity-chain cards' commits; same branch, separate
  commit-sized slice after them (shared brunch-tui.ts write path).
```

### Expected touched paths (tentative)

```
src/app/
└── brunch-tui.ts                       ~
src/.pi/extensions/graph/
└── index.ts                            ~
src/.pi/extensions/system-prompts/
├── index.ts                            ~
└── index.test.ts                       ?
src/dev/
└── tier-2-harness.test.ts              ~
src/graph/
└── workspace-store.ts                  ?
```
