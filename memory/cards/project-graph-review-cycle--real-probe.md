# Project-graph review-cycle real probe

Frontier: project-graph-review-cycle
Status:   done
Mode:     single
Created:  2026-06-06

## Orientation

- Containing seam: FE-809 `project-graph-review-cycle`; product approval wiring is landed, and the remaining risk is whether the real agent strategy emits a reviewable `present_review_set` that can be approved through public RPC.
- Relevant frontier item: `project-graph-review-cycle` on branch `ln/fe-809-project-graph-review-cycle`.
- Volatile state: reuse the clean explicit-basis fixture `.fixtures/seeds/bilal-port-variants/macro-view-grounded-intent.json`; do not mutate `.fixtures/workbenches/bilal-curation`.
- Main open risk: a synthetic probe could accidentally prove only the adapter/RPC path, not the real `project-graph` agent proposal path.

Posture: proving (inherited from `project-graph-review-cycle`).

## Card 1 — Real project-graph review-cycle probe

Status: done
Weight: light

Completed: 2026-06-06 — added `src/probes/project-graph-review-cycle-proof.ts`, fixed the commitment-grade active-tool policy so `project-graph` can call `present_review_set` / `request_review`, and persisted successful evidence at `.fixtures/runs/project-graph-review-cycle/2026-06-06-project-graph-review-cycle/`. The real run recorded two non-reviewable `structural_illegal` dry-run attempts before one successful reviewable `present_review_set`; public RPC approval then committed 2 explicit nodes and 4 explicit edges at selected-spec LSN 4.

### Objective

Add and run a reusable probe that proves a real `project-graph` agent turn can produce a dry-run-valid review set, expose it as a pending review exchange, approve it through `session.submitExchangeResponse`, and read back the explicit-basis graph commit.

### Acceptance Criteria

```pseudo tree
project-graph review-cycle proof
├── reusable probe script
│   ├── ✓ seeds a temp workspace from `.fixtures/seeds/bilal-port-variants/macro-view-grounded-intent.json`
│   ├── ✓ switches the selected session to `agentStrategy: "project-graph"`
│   ├── ✓ prompts the real agent to read graph context and produce one successful reviewable review set
│   ├── ✓ approves the pending review through public Brunch RPC, not by calling `acceptReviewSet` directly
│   └── ✓ writes `session.jsonl`, `transcript.md`, `report.json`, and `graph-snapshot.json` under `.fixtures/runs/project-graph-review-cycle/<run-id>/`
├── report oracle
│   ├── ✓ records whether `present_review_set` and `request_review` transcript results were observed
│   ├── ✓ records approve result status, LSN, created node/edge counts, and explicit-basis readback
│   ├── ✓ flags friction when no pending review exchange appears, approval fails, or graph truth is unchanged
│   └── ✓ fails success unless the graph LSN advances for the selected spec through review approval
└── frontier reconciliation
    ├── ✓ `memory/PLAN.md` marks FE-809 complete if the real probe succeeds
    └── ✓ residual agent/prompt drift becomes a narrow follow-up if the probe fails for non-harness reasons
```

### Verification Approach

- Inner: probe unit tests for transcript parsing, report summarization, and artifact path/report writing.
- Middle: targeted probe command with the real agent runtime.
- Gate: `npm run verify` if implementation changes source/tests beyond generated run artifacts.

### Cross-cutting obligations

- No direct SQLite graph writes.
- No direct `CommandExecutor.acceptReviewSet` call from the probe; approval must go through public RPC so the proof covers transcript recovery and response wiring.
- Preserve projected-code graph references at the review-payload boundary.
- Keep generated evidence in `.fixtures/runs/project-graph-review-cycle/`; do not use or mutate `.fixtures/workbenches/bilal-curation`.

### Assumption dependency

None — the probe is the proof for the remaining FE-809 assumption.

### Expected touched paths (tentative)

```pseudo tree
src/probes/
├── project-graph-review-cycle-proof.ts       +
└── project-graph-review-cycle-proof.test.ts  +

src/.pi/
├── agents/
│   ├── state.ts                              ~
│   └── state.test.ts                         ~
└── __tests__/
    └── prompting.test.ts                     ~

.fixtures/runs/project-graph-review-cycle/
└── <run-id>/                                 +
    ├── session.jsonl
    ├── transcript.md
    ├── report.json
    └── graph-snapshot.json

memory/
├── PLAN.md                                   ~
└── cards/project-graph-review-cycle--real-probe.md  ~
```

### Promotion checklist

- [ ] Changes a requirement
- [ ] Creates, retires, or invalidates an assumption
- [ ] Depends on an unvalidated high-impact assumption
- [ ] Makes or reverses a non-trivial design decision
- [ ] Establishes a new seam-level invariant
- [ ] Changes a frontier-level cross-cutting obligation or verification architecture layer
- [ ] Crosses more than two major implementation seams rather than observing them through the probe
- [ ] First touch in an unfamiliar seam
- [ ] Cannot name the containing seam or rationale
