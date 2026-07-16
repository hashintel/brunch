# KA 1.x data-model handoff

Frontier: walkthrough-remediation-2
Status:   active
Mode:     single
Created:  2026-07-16

## Orientation

- **Containing seam:** colleague-facing architecture guidance at the LN/KA boundary; this note reports current 1.x canon and explicitly labels future vocabulary.
- **Frontier:** `walkthrough-remediation-2` / FE-1187 on `ln/fe-1187-remediation-4`; it is a documentation slice on the existing issue and branch, not a new frontier.
- **Volatile handoff state:** PLAN already enumerates the owed content, but no concise linked note exists and the paused outer checkpoint must not become its substitute.
- **Main risk:** historical ontology/design prose can be mistaken for current canon, especially around durable slices, readiness/gap stores, `thesis`, workspace terms, and reconciliation needs.

**Posture: proving (inherited from `walkthrough-remediation-2`).**

This file is structurally independent from the deterministic TUI/Ask queue: it creates one architecture note and updates only the KA PLAN pointer; it has no production-code, test, theme, prompt, or topology write path.

## Objective

A colleague can distinguish Brunch 1.x’s current data-model contracts from directional vocabulary and knows the exact evidence trigger required before expanding reconciliation persistence.

## Cold-start reads

- `memory/SPEC.md` — D8-L, D16-L, D20-L, D24-L, D45-L, D56-L, D63-L, D65-L, D74-L, D99-L, D101-L, D103-L, D118-L, D126-L, D131-L; A8-L; I19-L, I52-L
- `memory/PLAN.md` — `walkthrough-remediation-2` KA handoff obligation and KA-stream `planning-process-model`
- `HANDOFF.md` — handoff content and same-frontier boundary
- `src/graph/TOPOLOGY.md` — plan-kind vocabulary, CommandExecutor ownership, spec-local clocks/change log, reconciliation posture
- `src/db/TOPOLOGY.md` — current persisted tables and retired readiness/gap storage
- `src/session/TOPOLOGY.md` — active-branch Pi JSONL and session-local scratchpad
- `src/executor/TOPOLOGY.md` — executor-derived runtime slice vocabulary
- `docs/design/ONTOLOGY_REVIEW_PROTOCOL.md` — historical/drift warnings around `thesis`; do not promote its superseded proposals

## Handoff decision flow

```text
colleague encounters a data-model term
├── current canon
│   ├── durable plan packaging → milestone / frontier / scope
│   │   └── runtime execution unit → executor-derived slice
│   ├── graph item provenance → basis (explicit | implicit)
│   ├── graph item commitment → settlement (advisory | settled), orthogonal to basis
│   ├── current session truth → active root-to-leaf Pi JSONL branch
│   ├── mutation/audit → CommandExecutor + spec-local LSN/change log
│   ├── readiness/asking → derived graph-fact judgment + session-local scratchpad
│   └── persisted reconciliation → only current judgment-shaped kinds
├── directional vocabulary
│   ├── thesis → explain as pitch/concept; do not rename now
│   └── term → possible workspace lift; do not couple new work to it now
└── proposed reconciliation expansion
    ├── fresh KA consumer/orchestration need exists → re-enter derivation/removal review first
    └── no fresh evidence → add no kind, consumer, or dependency
```

## Acceptance Criteria

- ✓ `docs/architecture/BRUNCH_1X_DATA_MODEL_HANDOFF.md` — a concise “Current canon” section states `{milestone, frontier, scope}` with executor-derived slices; basis vs settlement; no persisted readiness grade or spec-global elicitation-gap table; active-branch Pi JSONL; CommandExecutor with spec-local LSN/change log; and no new projected `vv_obligation` while legacy rows remain readable.
- ✓ `docs/architecture/BRUNCH_1X_DATA_MODEL_HANDOFF.md` — a separate “Directional, not current” section explains stored `thesis` as pitch/concept without renaming it and possible workspace-level `term` without coupling current code to that future lift.
- ✓ `docs/architecture/BRUNCH_1X_DATA_MODEL_HANDOFF.md` — a “Reconciliation YAGNI trigger” section says persisted judgment-shaped reconciliation needs are current but permits no new kind/consumer/orchestration dependency without fresh evidence; re-entry is the first KA work that needs the table, at which point derivation/removal is reconsidered before expansion.
- ✓ `docs/architecture/BRUNCH_1X_DATA_MODEL_HANDOFF.md` — each current claim links to its canonical SPEC decision or co-located topology home, while historical design material is clearly labeled as provenance rather than authority.
- ✓ `memory/PLAN.md` — the existing KA-stream “1.x data-model handoff owed by FE-1187” row links to the note without changing frontier, branch, ownership, or canonical decisions.
- ✓ `npm run check:markdown-links` — all note and PLAN links resolve.

## Verification Approach

- **Inner:** direct document review against the enumerated acceptance headings and canonical ids.
- **Middle:** `npm run check:markdown-links`; optionally `npm run check` if no unrelated working-tree change makes the broader read-only gate ambiguous.
- **Outer:** not applicable — this slice reports settled architecture and requires no provider, TUI, browser, or human walkthrough evidence.

## Cross-cutting obligations

- Keep current canon and directional vocabulary visually separate; do not turn the note into a new source of truth.
- Do not rename graph kinds, add migrations, widen RPC/tool surfaces, or change KA execution ownership.
- Do not rewrite historical ontology docs; link them only when provenance is useful and retain their drift warnings.
- The note does not close KA-owned O7–O9 or unpause the consolidated outer checkpoint.

## Assumption dependency

`None` — PLAN and the named SPEC/topology homes already settle the note’s content.

## Expected touched paths (tentative)

```text
docs/architecture/BRUNCH_1X_DATA_MODEL_HANDOFF.md          +
memory/PLAN.md                                             ~
```
