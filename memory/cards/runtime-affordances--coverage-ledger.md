# Runtime affordances coverage ledger

Frontier: runtime-affordances-and-legality
Status:   active
Mode:     single
Created:  2026-06-08

## Orientation

- **Containing seam:** the runtime posture legality/default surface. Truth is the append-only `brunch.agent_runtime_state` projection; the legality/default rules already live in `src/projections/session/runtime-policy.ts` (allowed lists + `defaultStrategy`/`defaultLens`/`defaultGoal`) and `src/.pi/agents/state.ts` (`AUTO_EXCLUDED_STRATEGIES`, `isGradeLegal`/grade gating, `selectAxisResources`). The current RPC projection in `src/rpc/methods/session.ts` exposes only the *current* selection per axis (`agent.strategy`/`lens`/`goal`), **not** the available options or the default-on-switch value.
- **Relevant frontier item:** `runtime-affordances-and-legality` (PLAN.md §Frontier Definitions). This is a **coverage** frontier in the same mold as the landed `graph-observed-shapes` — a closed enumerated ledger of which affordance shapes are canonical per consumer, guarded by a drift test, plus one shared derivation so no client re-implements legality. It is buildable now; the legality/default tables already exist.
- **Volatile handoff state:** no `HANDOFF.md`. The `snapshot`→`reads/projections/renderers` migration (35eff395) is landed; use current paths. `graph-observed-shapes` (85e73ba7) is the precedent: `src/graph/README.md` owns its ledger and `src/graph/observed-shapes-coverage.test.ts` guards required-subset coverage **without shipping any transport shape it does not need**. Mirror that discipline exactly.
- **Main open risk:** scope creep into building TUI/web posture-switch UI, or into an xstate/persisted state machine. This card is a **coverage ledger + one pure derivation**, not a control surface. The genuinely product-state-gated rows (`active-review-set` affordances, freestyle-vs-structured `turn-mode`) must stay tripwired in the ledger, not built.

Posture: proving (inherited from `runtime-affordances-and-legality`).

Frontier-level cross-cutting obligations this slice carries:

- Keep runtime truth append-only in `brunch.agent_runtime_state`; affordances are **pure derivations** over the shared legality/default tables, never new persisted state.
- Do not add xstate or a persisted machine (PLAN cross-cutting obligation; SPEC D40-L projection-as-truth).
- Do not duplicate legality/default rules in any client (`web/`, `rpc/`, TUI); the derivation is the single owner.
- Preserve D66-L: `freestyle` is AUTO-excluded; the affordance derivation's available-under-AUTO set must reflect that, matching `AUTO_EXCLUDED_STRATEGIES`.

## Full scope card

### Target Behavior

A single Brunch-owned `affordances(resolvedState)` derivation reports, per posture axis (goal / strategy / lens), the legal options and the default-on-switch value from the existing shared legality/default tables, and a closed coverage ledger in `src/session/README.md` records which affordance rows each consumer (agent, RPC, web) requires versus defers, guarded by a drift test.

### Boundary Crossings

```
→ resolved runtime state (ResolvedBrunchAgentState from src/projections/session/runtime-policy.ts)
→ shared affordance derivation (new pure function over allowed lists + defaults + AUTO/grade rules)
→ coverage ledger (src/session/README.md): required vs deferred affordance rows per consumer
→ drift guard test (asserts the ledger's required subset against the real derivation + RPC schema)
```

### Risks and Assumptions

```
- RISK: the derivation re-implements legality instead of reusing src/.pi/agents/state.ts logic
    → MITIGATION: extract/lift the existing allowed + AUTO-excluded + isGradeLegal logic into the
      shared projection seam (projections/session) and have agent manifest composition consume it,
      OR have the new derivation import the same source-of-truth tables; do not fork the rules.
- RISK: scope drifts into shipping the affordance shape onto the RPC/web transport
    → MITIGATION: follow graph-observed-shapes — the ledger may mark a row "web-eligible deferred";
      shipping a transport shape is a separate later slice, not this card.
- ASSUMPTION: the legality/default knowledge needed for affordances is fully present in
  runtime-policy.ts + state.ts and needs no new product state.
    → IMPACT IF FALSE: a required affordance row would depend on active-review-set / turn-mode
      product state that does not exist yet; that row is then a tripwired deferred row, not a gap.
    → VALIDATE: enumerate the ledger rows first; any row that cannot be derived from current tables
      is marked product-state-gated with its tripwire, not built.
    → memory/SPEC.md D40-L, D59-L
```

### Posture check

Proving slice. It scores on **invariants** (locates and stabilizes the affordance-derivation seam as the single owner of legality/default truth across transports) and **proof of life** (a shared `affordances(resolvedState)` derivation exists and is consumed where legality was previously implicit). It retires the fog that runtime affordances are unbuildable until a UI pass: the ledger proves how much is derivable now. No high-impact assumption is left unretired — rows that cannot be derived become explicit tripwired deferrals.

### Acceptance Criteria

```
✓ affordances-derivation.test.ts — affordances(resolvedState) returns, per axis (goal/strategy/lens),
  the legal option set and the default-on-switch value, matching runtime-policy.ts defaults.
✓ affordances-derivation.test.ts — under AUTO the strategy options exclude `freestyle`
  (parity with AUTO_EXCLUDED_STRATEGIES); under an explicit pin the pinned legal value is reported.
✓ affordances-derivation.test.ts — grade-illegal options are excluded, matching isGradeLegal.
✓ runtime-affordances-coverage.test.ts — the ledger's required affordance rows per consumer
  (agent/RPC/web) are covered by the derivation and the RPC session schema; deferred rows are not forced.
✓ runtime-affordances-coverage.test.ts — `active-review-set` and `turn-mode` rows are present as
  deferred/tripwired entries, not as built affordances.
✓ No client (web/, rpc/, TUI) re-derives availability/legality locally; legality has one owner.
✓ No xstate, no persisted machine, no new runtime-state table.
```

### Verification Approach

```
- Inner: unit tests (oracle: derivation against fixtures) — affordances() vs hand-specified legal/
  default/AUTO/grade expectations over ResolvedBrunchAgentState fixtures.
- Inner: drift/coverage test (oracle: ledger-vs-reality) — required-subset coverage like
  graph-observed-shapes; fails if a required row loses its derivation or RPC field.
- Middle: only if a transport shape is actually adopted in this card (default: not adopted).
```

### Cross-cutting obligations

```
- Affordances are pure derivations over shared tables; runtime truth stays append-only.
- No client-side legality reimplementation; single owner for availability/default rules.
- Preserve D66-L freestyle AUTO-exclusion in the available-under-AUTO set.
- Keep src/renderers/ for durable LLM/session text only; affordances are structured data, not renderers.
```

### Expected touched paths (tentative)

```pseudo
src/projections/session/
├── affordances.ts                       +   # affordances(resolvedState): legal options + default-on-switch
├── affordances.test.ts                  +
├── runtime-policy.ts                    ?   # may export shared legality/default helpers if lifted here
└── runtime-state.ts                     ?   # if RuntimeStateProjection gains a required affordance row

src/.pi/agents/
└── state.ts                             ?   # consume shared derivation instead of forked legality logic
                                             # (only if it reduces duplication; keep behavior identical)

src/session/
├── README.md                            ~   # owns the closed affordance coverage ledger
└── runtime-affordances-coverage.test.ts +   # drift guard for required-vs-deferred rows per consumer

src/rpc/methods/session.ts               ?   # only if a required affordance row must surface now
```

### Promotion checklist

- [x] Already a full scope card.
- Build note: if enumerating the ledger reveals that a *required* (not deferred) row depends on
  product state that does not exist, stop and route back through `ln-plan` — the frontier shape shifted.
