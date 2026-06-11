# Agent gap affordances: gaps-mode kill, elicitation read tool, capture-reflection writeback

Frontier: elicitation-driver
Status:   active
Mode:     chain
Created:  2026-06-11

Posture: proving (inherited from `elicitation-driver`)

Demo block 1 of the lower line (`ln/fe-852-below-the-line`). Three cards, no
inter-card finding dependencies. Cards 2–3 establish the agent's elicitation
register as **dedicated tools, distinct from the graph register** — the same
separation the 2026-06-11 grill confirmed for reads applies to writes: gaps
are not graph plane (no graph nodes/edges), so they do not ride `read_graph`
or `mutateGraph`.

Overlap check: `renderer-golden-coverage--render-stage-chain.md` touches
`src/renderers/**` only — disjoint write paths.

---

## Card 1 — kill the `read_graph` topology `gaps` mode

Status: next

### Objective

`read_graph` no longer offers a `gaps` mode; the canonical meaning of "gaps"
in the agent surface is exclusively the elicitation register, and the
deliberate `hasEdge`/`lacksEdge` `GraphFilter` API survives untouched for
future query-power-up work.

### Light-card cold-start reads

```
- memory/SPEC.md  — D75-L (gaps = node-kind obligation register), D39-L (sealed profile)
- memory/PLAN.md  — frontier: elicitation-driver §Scope additions (2026-06-11 grill)
- src/.pi/extensions/graph/index.ts — the gaps mode branch (~L96, L128-161)
- src/app/brunch-tui.ts — getGraphGaps adapter (~L286)
```

### Acceptance Criteria

```
✓ read_graph schema/description no longer mentions a gaps mode; gaps-mode params (absentEdgeCategory etc.) are gone
✓ brunch-tui getGraphGaps adapter and any chrome surface consuming it are removed
✓ GraphFilter hasEdge/lacksEdge and their queryGraph tests remain (deliberate API, kept)
✓ no remaining reference to "gaps" in the graph-tool register (grep-clean in src/.pi/extensions/graph + brunch-tui)
```

### Verification Approach

```
- Inner: extensions/graph tool tests updated (mode rejection / schema); npm run verify
```

### Cross-cutting obligations

- Pure deletion; no behavior added. Keep the query API — only the agent/TUI
  exposure of `lacksEdge` retires.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/graph/
├── index.ts              ~
└── *.test.ts             ~
src/app/brunch-tui.ts     ~
src/app/brunch-tui.test.ts ~?
```

---

## Card 2 — `read_elicitation_gaps` pull tool

Status: next

### Objective

The agent can pull the full ranked elicitation agenda for the selected spec
(not just the top-1 question surfaced in the prompt) through a dedicated
`read_elicitation_gaps` tool over `getElicitationGaps` +
`sortElicitationGapsForAsking`.

### Light-card cold-start reads

```
- memory/SPEC.md  — D65-L (driver), D75-L (gap shape), D39-L (sealed profile — this is a product tool, not BRUNCH_DEV-gated)
- memory/PLAN.md  — frontier: elicitation-driver §Scope additions
- src/graph/elicitation-driver.ts — ranking comparator + eligibility (the tool must reuse, not reimplement)
- src/.pi/extensions/graph/index.ts — registration pattern to mirror
```

### Acceptance Criteria

```
✓ new extension registers read_elicitation_gaps; output is the ranked agenda (eligible gaps in sortElicitationGapsForAsking order) plus disposition/answered state for the rest when requested
✓ ranking comes from the canonical comparator — one ranking implementation, no duplicate sort logic
✓ scoped to the selected spec; empty register yields an honest empty result, not an error
✓ Tier-1 faux turn proves the tool is callable and returns seeded-fixture gaps verbatim
```

### Verification Approach

```
- Inner: tool unit tests over seeded in-memory gaps (ranking order, eligibility filtering, empty case)
- Middle: Tier-1 faux-harness turn (tool registered in product profile; payload includes the tool; call round-trips)
```

### Cross-cutting obligations

- Elicitation register stays a distinct tool surface from `read_graph`
  (grill decision); narrow gap reads must not advance the global watermark
  (D76-L — per-entity/read-only semantics, same as narrow `getNodes`).

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/elicitation/
├── index.ts              +
└── index.test.ts         +
src/.pi/extensions/README.md ~?  (register the new extension dir)
src/.pi/index.ts (or extension bundle wiring) ~
```

---

## Card 3 — gap writeback affordance, mechanism only (full card)

Status: next

### Target Behavior

A dedicated `update_elicitation_gaps` tool lets a session spawn gaps and set
dispositions through the existing `CommandExecutor.createElicitationGap` /
`setElicitationGapDisposition` methods on the one `{specId, lsn}` clock —
proven by scripted turns only.

**Deliberately out of scope (2026-06-11 user decision):** capture-reflection
*prompting* — when and how the live agent decides to reflect an answer into
gap writes. Capture prompting completeness is unvalidated and owned by the
`generalized-capture` frontier (demo block 3); designing reflection guidance
now would guess at that architecture. This card ships the affordance;
block 3 ships the behavior.

### Micro-decision (resolved at scope time — confirm before build)

**Dedicated tool over `mutateGraph` grammar extension.** Rationale: gaps are
deliberately *not* graph plane (frontier obligation: "keep the substrate flat,
no graph plane"); `mutateGraph` is the canonical **authored-graph** grammar
(nodes/edges, role-named endpoints). Folding gap ops into it would conflate
the registers the read side just separated (cards 1–2) and widen the
mutation grammar for a non-graph store. The dedicated tool mirrors the
read/write pair: `read_elicitation_gaps` / `update_elicitation_gaps`.

### Full-card cold-start reads

```
- memory/SPEC.md  — D16-L/A4-L (one clock), D20-L/D4-L (command boundary), D65-L, D75-L
- memory/PLAN.md  — frontier: elicitation-driver (acceptance: writeback row; gap-disposition ledger obligation)
- src/graph/command-executor.ts — createElicitationGap / setElicitationGapDisposition (existing, zero non-test callers)
- src/graph/schema/elicitation-gaps.ts — gap + disposition shape
- memory/cards/elicitation-driver--agent-gap-affordances.md — this file (cards 1–2 context)
```

### Boundary Crossings

```
→ agent tool call (update_elicitation_gaps, src/.pi/extensions/elicitation/)
→ CommandExecutor gap methods (validation, one clock, change log)
→ elicitation_gaps store → next-turn driver ranking reflects the change
```

### Risks and Assumptions

```
- RISK: tool grammar invites the agent to spawn duplicate/low-value gaps
  → MITIGATION: lean on existing executor validation (presence-duplicate rejection observed in createElicitationGap); a minimal factual tool description only — behavioral guidance deferred to generalized-capture; quality is outer-loop fitness, not a merge gate
- RISK: disposition vocabulary in the tool drifts from schema enum
  → MITIGATION: derive tool schema literals from src/graph/schema/elicitation-gaps.ts exports, not re-declared strings
- ASSUMPTION: the existing executor methods already cover the demo's spawn/close needs (no new executor surface required)
    → IMPACT IF FALSE: card grows an executor change; promotion of the slice scope, SPEC touch on the command boundary
    → VALIDATE: first red test writes through the existing methods; any missing capability surfaces immediately
```

### Posture check (proving)

Scores on two axes: **proof of life** — first non-test callers for the
executor gap methods, proving the spawn→rank→close mechanics end-to-end under
scripted drive; **uncertainty** — retires the writeback surface micro-decision
(dedicated tool vs grammar extension). The frontier's writeback acceptance row
flips to **affordance-complete**; behavior-complete waits on
`generalized-capture`'s reflection prompting.

### Acceptance Criteria

```
✓ tool spawn op — creates a gap via CommandExecutor; appears in read_elicitation_gaps ranked agenda next read
✓ tool disposition op — answered/scope-judged gap leaves the eligible agenda; change-log row written on the one clock
✓ rejection path — structurally illegal input surfaces executor diagnostics verbatim; no partial writes
✓ no second clock — gap writes interleave with graph writes under monotonic {specId, lsn} (assert ordering in one test)
✓ loop proof (scripted) — faux-scripted sequence: ask (top gap) → scripted tool calls set disposition + spawn follow-up → next selection moves to the new top gap; no live-model reflection behavior is claimed
✓ no reflection prompt guidance added — composed-prompt goldens unchanged (behavioral guidance lands with generalized-capture)
```

### Verification Approach

```
- Inner: tool op unit tests over in-memory executor (spawn/disposition/rejection/clock ordering)
- Middle: faux-harness scripted reflection turn proving the loop assertion above; existing driver ranking tests stay green
- Outer: manual BRUNCH_DEV walkthrough of reflection quality (tracked, not gated)
```

### Cross-cutting obligations

- D4-L/D20-L: all writes through `CommandExecutor`; no direct SQLite access.
- D16-L/A4-L: one `{specId, lsn}` clock; no second mutation clock.
- Frontier ledger obligation: spawn-on-reflection + close-on-answered is the
  **elicitation-writeback gap-disposition ledger** named in the demo cut.
- D39-L: product tool registration, sealed profile unchanged.

### Expected touched paths (tentative)

```
src/.pi/extensions/elicitation/
├── index.ts              ~   (adds update_elicitation_gaps beside the read tool)
└── index.test.ts         ~
src/graph/schema/elicitation-gaps.ts ~?  (export disposition literals if not already)
src/dev/tier-2-harness.test.ts ~?  (loop proof, if Tier-2 chosen over Tier-1)
```

### Traceability

Flips the frontier's deferred writeback acceptance row to
**affordance-complete**; the behavior half (reflection prompting + the
gap-disposition ledger as live conduct) transfers to `generalized-capture`.
No SPEC change expected (existing decisions cover the boundary). If the build
forces new executor surface, stop and reconcile before continuing.
