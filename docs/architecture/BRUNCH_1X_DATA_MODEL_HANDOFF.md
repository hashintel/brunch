# Brunch 1.x data-model handoff

This note is a colleague-facing map to the current Brunch 1.x contracts. It is
not a new source of truth: the linked SPEC decisions and co-located topology
files remain authoritative.

## Current canon

- **Planning and execution vocabulary.** Durable plan truth uses `milestone`,
  `frontier`, and `scope`. A scope is the reviewed execution handoff owned by
  one frontier; runtime `slice` units are derived by the executor and are not
  graph kinds. See [D126-L](../../memory/SPEC.md) and the
  [graph](../../src/graph/TOPOLOGY.md) and
  [executor](../../src/executor/TOPOLOGY.md) topology homes.
- **Provenance and commitment are separate dimensions.** Every graph node and
  edge has `basis: explicit | implicit`, describing how directly the item was
  stated or approved, independently of `settlement: advisory | settled`, which
  describes whether it is source-derived signal awaiting harmonization or
  accepted current truth. See [D63-L and D99-L](../../memory/SPEC.md) and the
  [graph schema posture](../../src/graph/TOPOLOGY.md).
- **Readiness and asking are derived/session-local.** Brunch stores neither a
  readiness grade nor a spec-global elicitation-gap table. Capability readiness
  is judged just in time from relevant graph facts; the non-authoritative asking
  agenda is an active-session-branch scratchpad. See
  [D45-L, D65-L, D74-L, and D101-L](../../memory/SPEC.md), plus the
  [database](../../src/db/TOPOLOGY.md) and
  [session](../../src/session/TOPOLOGY.md) topology homes.
- **Current session truth follows Pi's active branch.** Product-semantic reads
  use the active root-to-leaf branch of the Pi JSONL session. Append-order or
  all-history reads are only for explicitly named diagnostic/history surfaces.
  See [D24-L and I19-L](../../memory/SPEC.md) and the
  [session topology](../../src/session/TOPOLOGY.md). Persistent Specify conduct
  is carried by `brunch.elicitation_style`; one-shot execution-oriented intent
  is carried separately by `brunch.process_move`. The retired mixed carrier is
  not a current or compatibility path.
- **Mutation, clock, and audit have one authority.** Graph/spec writes pass
  through `CommandExecutor`. Each selected-spec commit allocates that spec's LSN
  and appends its spec-local change-log entry; bare LSNs are not comparable
  across specs. See [D20-L](../../memory/SPEC.md) and the
  [graph clock and audit posture](../../src/graph/TOPOLOGY.md).
- **Assurance vocabulary is narrowed without rewriting stored history.**
  `vv_obligation` remains readable as legacy/reserved vocabulary, but agents do
  not project or create new instances. Concrete criteria, methods, and checks
  carry current assurance work. See [D131-L](../../memory/SPEC.md) and the
  [graph topology](../../src/graph/TOPOLOGY.md).

## Directional, not current

- **`thesis` remains the stored kind.** Explain it to colleagues as the
  product/specification pitch or concept — the “what, who, why, and for whom”
  grounding bet. Do not rename it now. The earlier `thesis → claim` proposal in
  the [ontology review protocol](../design/ONTOLOGY_REVIEW_PROTOCOL.md) is
  historical provenance and is explicitly superseded there; current vocabulary
  remains governed by [D56-L](../../memory/SPEC.md).
- **`term` may eventually move to workspace scope.** That possible lift is
  directional vocabulary only. Current code and graph contracts remain
  spec-local, and new work must not couple itself to a workspace-level term
  store or projection without a future decision.

## Reconciliation YAGNI trigger

Persisted, judgment-shaped reconciliation needs are current: the store contains
`possible_relation`, `possible_duplicate`, and `semantic_conflict`; derived
edge revalidation is not persisted. See [D8-L and A8-L](../../memory/SPEC.md)
and the [graph reconciliation posture](../../src/graph/TOPOLOGY.md).

That current substrate does not justify expansion. Add no reconciliation kind,
consumer, or orchestration dependency without fresh evidence. The re-entry
trigger is the first KA-owned consumer or orchestration task that actually needs
the table. At that point, first reconsider whether the need can be derived or
whether the persisted substrate should be narrowed/removed; only then consider
expanding it.

Historical ontology material may explain why a shape was considered, but it is
provenance rather than authority. In particular, the
[ontology review protocol](../design/ONTOLOGY_REVIEW_PROTOCOL.md) must not be
used to promote its superseded `thesis` rename or stale baseline as current
canon.
