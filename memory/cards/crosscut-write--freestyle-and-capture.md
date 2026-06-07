# Freestyle strategy + generalized capture (Seam 2 WRITE)

Frontier: n/a (cross-cut Seam 2; D66-L) | tracker/branch = the active cross-cut push
Status:   active
Mode:     chain
Created:  2026-06-07

## Orientation

- **Containing seam:** the elicitor WRITE surface — `graph/CommandExecutor` as the
  single graph-truth mutation boundary, reached today only from the structured-exchange
  path. `CROSS_CUT_PLAN.md` Seam 2's one open ● row is *auto-capture (synchronous,
  labeled-text)*, tied to D66-L generalized capture; Seam 3a's `freestyle` row and Seam 3b's
  generalized-capture row are the same D66-L slice. Seam 1 (READ) is complete.
- **Relevant frontier item:** none in `memory/PLAN.md` — D66-L is a cross-cut slice, not a
  vertical PLAN frontier. It advances the "Capture to graph truth" delivery black-triangle.
  Cards live under `memory/cards/` with the `crosscut-write--` prefix (mirroring the now-deleted
  `crosscut-read--*` / `crosscut-render--*` cards). No new Linear issue/branch unless the user says so.
- **Volatile state:** the labeled-text capture tracer already exists and is validated
  (`src/graph/capture/structured-response.ts`, A22-L / `capture-response-to-graph-proof`): it
  parses `Goal:/Context:/Constraint:/Criterion:` lines from a structured-exchange answer and
  commits intent nodes via `commitGraph({basis: explicit})`. It runs **only** inside
  `session.submitExchangeResponse`. `session.submitMessage` is **reserved, not implemented**
  (D49-L; `src/rpc/README.md` §Reserved future names) — building it is the proving core of Card 1.
  The strategy axis has 4 values; AUTO returns *all* grade-legal strategies as the manifest
  (`src/.pi/agents/state.ts` `buildAxisManifest`).
- **Main open risk:** capture quality beyond directly-labeled facts (A22-L fitness evidence) —
  free user prose is messier than a structured answer. The slice deliberately keeps the same
  high-confidence extractive bar and leaves richer LLM capture as fitness evidence, not a
  blocking acceptance criterion.

Posture: **proving** (inherited from D66-L / cross-cut Seam 2 — Fill=`proving` on all three rows).
Card 2 is largely an earned axis-addition but introduces one genuinely new invariant
(AUTO-never-selects-freestyle, R16), so it stays in the proving frame.

Frontier-level cross-cutting obligations both cards carry:

- **D40-L:** `freestyle` adds **no** tool authority and is **not** a new `op_mode`;
  `elicit` tool policy is unchanged. Posture switches stay a user/system authority — the
  agent never emits one; freestyle is a user pin.
- **D16-L / A4-L:** every capture mutation allocates exactly one `{specId, lsn}` through the
  bound spec's `graph_clock`; bare LSNs stay non-comparable across specs.
- **D63-L:** captured directly-stated facts are `basis: explicit`; low-confidence implications
  never become graph truth (they stay in preface / `capture_*` analysis, D47-L/D50-L).
- **D52-L:** `graph/` owns capture/mutation semantics; `rpc/` adapts the boundary and publishes
  invalidation; neither imports `db/`.
- **R16:** offer-first stays a property of the *structured* strategies; AUTO must never select
  `freestyle`.

---

## Card 1 — Generalized capture on the ordinary-message path

Status: done
Weight: full

### Target Behavior

An ordinary (non-exchange) user message submitted over public RPC is recorded as session
transcript truth and runs synchronous post-exchange capture, committing directly-stated
high-confidence facts to the bound spec's graph through `CommandExecutor.commitGraph({basis: explicit})`.

### Boundary Crossings

```pseudo
→ session.submitMessage JSON-RPC params (ordinary user text; explicit-interruption flag)
→ pending-exchange guard (must not silently answer a pending request_* exchange)
→ session transcript append (the session-exchange unit, which already spans plain user text — D49-L)
→ generalized free-text capture (graph/capture)
→ CommandExecutor.commitGraph({basis: explicit}) on the binding's specId
→ graph invalidation publish {specId, lsn}
→ ExchangeResponse-style capture outcome back to the client
```

### Risks and Assumptions

```
- RISK: submitMessage silently answers / clobbers a pending structured exchange.
    → MITIGATION: when an exchange is pending, reject ordinary text unless the payload
      carries an explicit interruption flag; interruptions are transcript-visible, never an
      implicit answer (D49-L contract; src/rpc/README.md).
- RISK: free user prose yields lower-quality capture than a structured answer, polluting graph truth.
    → MITIGATION: keep the same high-confidence extractive bar as the labeled-text tracer
      (directly-labeled / directly-stated facts only); low-confidence implications stay out of
      graph truth (D47-L/D50-L). Broader LLM capture quality is fitness evidence, not acceptance.
- RISK: a second capture/commit code path diverges from the structured-response tracer.
    → MITIGATION: one capture core owns extraction + commit; both call sites (exchange-response
      and ordinary-message) reuse it, differing only in the capture source prefix.
- ASSUMPTION: the existing labeled-text extraction is a sufficient POC vehicle for ordinary-message capture.
    → IMPACT IF FALSE: freestyle would grow graph truth too weakly to be useful; richer
      extraction (LLM-shaped) would need its own slice.
    → VALIDATE: a probe submits ordinary text with labeled facts and asserts explicit-basis
      nodes appear in the bound spec's graph_truth overview; capture quality beyond labels is
      recorded as fitness evidence under A22-L.
    → [→ memory/SPEC.md §Assumptions A22-L]
```

### Posture check

Proving slice scoring on two axes:

- **Proof of life:** lights up an entirely new end-to-end path — ordinary user message →
  transcript → graph truth — that no current method provides (`submitMessage` is reserved).
- **Uncertainty:** retires the load-bearing half of A22-L — that synchronous capture works on
  *free* user text, not only structured answers. The tracer breaks if that assumption is wrong.

It deliberately does not build interruption-driven agent re-planning, on-demand vs per-turn
capture policy, or richer-than-labeled extraction — those are adjacent, not required to prove the path.

### Acceptance Criteria

```pseudo tree
generalized ordinary-message capture
├── submitMessage method
│   ├── ✓ rpc.discover lists session.submitMessage with its param/result schema
│   ├── ✓ an ordinary message with no pending exchange appends user text to the transcript
│   ├── ✓ a message while an exchange is pending is rejected unless flagged an explicit interruption
│   └── ✓ an explicit interruption is recorded transcript-visibly and does NOT answer the pending exchange
├── capture wiring
│   ├── ✓ directly-labeled facts in the message commit intent nodes via commitGraph({basis: explicit})
│   ├── ✓ captured nodes target the transcript binding's specId and advance only that spec's LSN
│   ├── ✓ a message with no high-confidence facts returns no_capture and writes no graph rows
│   └── ✓ a structurally-illegal capture returns structural_illegal and writes no graph rows
├── shared core
│   └── ✓ the exchange-response path and the message path use one capture core (distinct source prefix only)
└── invalidation
    └── ✓ a successful capture publishes the established graph invalidation payload {specId, lsn}
```

### Verification Approach

```
- Inner: graph/capture unit tests — free-text extraction + commit, no_capture, structural_illegal, source-prefix.
- Inner: rpc handler/discovery tests — submitMessage schema, pending-exchange guard, interruption visibility.
- Middle: probe — submit ordinary labeled text, assert explicit-basis nodes in the bound spec's graph_truth overview and sibling-spec LSN stability.
```

### Cross-cutting obligations

```
- Reuse CommandExecutor; introduce no direct DB writes and no second mutation/validation engine.
- Capture is graph-native; do not add a generic records API.
- submitMessage must never implicitly answer a pending structured exchange (D49-L).
- Keep capture commits basis: explicit; never write low-confidence implications as graph truth (D63-L, D47-L).
```

### Expected touched paths (tentative)

```pseudo tree
src/graph/capture/
├── structured-response.ts        ~   (extract shared capture core)
├── structured-response.test.ts   ~
├── message.ts                    +?  (ordinary-message capture entry; or generalize in place)
└── message.test.ts               +?
src/rpc/methods/session.ts        ~   (submitMessage handler + discovery + schema)
src/rpc/handlers.test.ts          ~
src/rpc/README.md                 ~   (promote submitMessage from reserved to real)
src/probes/                       +?  (ordinary-message capture proof)
memory/SPEC.md                    ?   (A22-L fitness note; D49-L submitMessage now implemented)
```

### Completion note

- 2026-06-07 — Landed. `session.submitMessage` is now a public RPC write method that appends ordinary user text, rejects pending structured exchanges unless `interruption: true`, records explicit interruptions transcript-visibly without silently answering the exchange, and reuses a shared explicit-text capture core with `session.submitExchangeResponse`. Verification and canonical reconciliation pending after Card 2.

---

## Card 2 — `freestyle` strategy axis (pin-only, AUTO-excluded)

Status: done
Weight: full

### Target Behavior

`freestyle` is a selectable elicitor strategy that a user can pin but AUTO never selects, and
which adds no tool authority while keeping structured-exchange tools available.

### Boundary Crossings

```pseudo
→ AgentStrategyId type + AGENT_STRATEGY_IDS (session/runtime-state.ts)
→ strategy legality / min-grade + AUTO-exclusion (.pi/agents/state.ts)
→ prompt-resource manifest (<available_strategies>, D58-L compose)
→ session.runtimeState RPC strategy schema (rpc/methods/session.ts)
→ strategy prompt resource (.pi/skills/strategies/freestyle.md)
```

### Risks and Assumptions

```
- RISK: AUTO begins selecting freestyle, silently abandoning the offer-first thesis (R16).
    → MITIGATION: freestyle is excluded from the AUTO manifest list but still resolves when
      explicitly pinned; a test asserts AUTO never advertises freestyle while a pin does.
- RISK: freestyle is mistaken for an op_mode / authority change.
    → MITIGATION: it touches only the strategy axis; op_mode tool policy (D40-L) and the
      authority schema (operationalMode literal) are unchanged — proven by an unchanged policy test.
- ASSUMPTION: the existing pin/AUTO manifest builder can express a pin-only value with a small,
  local change rather than a new selection model.
    → IMPACT IF FALSE: AUTO-exclusion needs a broader manifest refactor — promote to its own slice.
    → VALIDATE: implement the exclusion in buildAxisManifest (or a sibling) with a dedicated test.
    → [→ memory/SPEC.md §Decisions D66-L, R16]
```

### Posture check

Earned-flavored closure carried under proving framing:

- **Closes** the D66-L open framing by **canonicalizing** `freestyle` as the fifth strategy value
  across type, IDs, RPC schema, and prompt resource.
- **Locks in** one new invariant — AUTO-never-selects-freestyle — as the R16 completion test.
- Materializes the settled D66-L decision into topology (`strategies/freestyle.md`, state tables).

It depends on Card 1's capture path for product coherence (freestyle's only truth-growth route),
but not on Card 1's *implementation findings* — the axis addition is mechanical and order-independent;
both land on the same branch per D66-L ("one slice").

### Acceptance Criteria

```pseudo tree
freestyle strategy axis
├── type + ids
│   ├── ✓ AgentStrategyId includes 'freestyle' and AGENT_STRATEGY_IDS lists it
│   └── ✓ session.runtimeState strategy schema accepts 'freestyle'
├── AUTO exclusion (R16)
│   ├── ✓ AUTO strategy manifest does NOT advertise freestyle
│   └── ✓ a pinned freestyle resolves to the freestyle resource and is legal at its grade
├── authority unchanged (D40-L)
│   └── ✓ elicit tool-policy projection is identical with strategy=freestyle vs another strategy
└── resource
    └── ✓ src/.pi/skills/strategies/freestyle.md exists and is readable under the active tool policy
```

### Verification Approach

```
- Inner: runtime-state + state.ts tests — id membership, grade legality, AUTO-exclusion, pinned resolution.
- Inner: compose manifest test — <available_strategies> omits freestyle under AUTO, includes it when pinned.
- Inner: tool-policy projection test — strategy=freestyle leaves elicit authority unchanged.
```

### Cross-cutting obligations

```
- Add no tool authority and no op_mode (D40-L); freestyle is interaction-style only.
- Keep AUTO offer-first (R16): user pin is the only entry to freestyle.
- Resource location stays code-owned in .pi/agents/state.ts (D39-L sealing); no filesystem discovery.
```

### Expected touched paths (tentative)

```pseudo tree
src/session/runtime-state.ts         ~   (AgentStrategyId + AGENT_STRATEGY_IDS)
src/session/runtime-state.test.ts    ~
src/.pi/agents/state.ts              ~   (STRATEGY_MIN_GRADE, STRATEGY_RESOURCES, AUTO-exclusion)
src/.pi/agents/state.test.ts         ~
src/.pi/agents/compose.ts            ?   (only if AUTO-exclusion lands at the compose layer)
src/.pi/agents/compose.test.ts       ~
src/rpc/methods/session.ts           ~   (RuntimeStateResultSchema strategy union)
src/rpc/handlers.test.ts             ~
src/.pi/skills/strategies/freestyle.md   +
src/.pi/skills/strategies/README.md      ~   (strategy table row)
memory/SPEC.md                       ?   (D66-L: freestyle/capture landed; glossary unchanged)
```

### Completion note

- 2026-06-07 — Landed. `freestyle` is now a real strategy value across runtime state, RPC projection, agent manifests, and prompt resources. AUTO omits it, explicit pins resolve it, and `elicit` tool authority remains unchanged.

---

## Traceability

- **SPEC:** D66-L (the slice), D49-L (`session.submitMessage` contract), D18-L (synchronous
  post-exchange capture), D26-L (single-exchange capture mechanism), D63-L (basis), D47-L/D50-L
  (low-confidence stays out of truth), D25-L/D58-L (strategy axis + manifest), D40-L (authority
  unchanged), R16 (offer-first). Assumptions: A22-L (capture quality — fitness evidence).
- **Cross-cut:** closes `CROSS_CUT_PLAN.md` Seam 2 *auto-capture* ●, Seam 3a *freestyle* ●,
  Seam 3b *generalized capture* ● — the single D66-L slice.
- **Canonical reconciliation:** on build, note in `memory/SPEC.md` that `session.submitMessage`
  is implemented (D49-L) and that D66-L freestyle + generalized capture have landed; add the
  A22-L free-text fitness note. No new decision/invariant is expected beyond AUTO-never-selects-freestyle.
```
