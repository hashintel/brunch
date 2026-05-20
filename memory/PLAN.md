<!-- PLAN.md — single source of truth for WHAT'S NEXT.
     Created by ln-plan · Read by all skills · Updated by ln-build, ln-sync, and ln-spike.
     Authority: active frontier, near-horizon ordering, and dependencies that still matter.

     Frontier item = canonical plan/Linear/branch unit.
     Slice = scoped execution unit from ln-scope/ln-build, often inside one frontier.

     Keep this file light. Archive older completed work to docs/archive/PLAN_HISTORY.md.
     Edit Sequencing for ordering/status churn; keep Frontier Definitions relatively stable.

     Anchored on SPEC.md and the three POC architecture docs. -->

# Plan

## Context

Brunch-next is starting from a deliberately razed slate on the `next` branch (tag `next-baseline`). Implementation, planning memory, and pre-POC docs have been archived under `archive/`. The new line is a thin layer over `pi-coding-agent` whose milestone ladder M0–M9 (from `prd.md`) is the planning spine. M0 (walking skeleton) is the first frontier to land — it also doubles as the Phase-3 infra bootstrap. Fixture capture starts at M1 and grows with every later milestone.

## Sequencing

### Active

1. `walking-skeleton` — not-started — Phase-3 bootstrap (package.json, tsconfig, oxlint/oxfmt, vitest) plus a `brunch` binary that boots a pi-backed TUI session against `.brunch/`. Includes mounting the persistent TUI chrome (cwd / spec / phase / chat-mode) and the spec-selector gate.

### Next

1. `mode-shell-and-fixture-driver` — Adds `--mode print` and `--mode rpc`, lands the first agent-as-user fixture-capture run end-to-end, seeds the first three briefs from BEHAVIORAL_KERNELS.md.
2. `jsonl-session-viability` — Proves whether pi JSONL sessions can hold raw payloads + Brunch custom turn entries (including `brunch.offer`, `brunch.spec_switch`, `worldUpdate`) faithfully across reload.

### Parallel / Low-conflict

- `brief-library-curation` — Author and review briefs #4–#7 plus the adversarial second tier; can proceed independently once `walking-skeleton` exists. Briefs are text, no code dependency.
- `fixture-strategy-evolution` — Iterate `fixture-strategy.md` (property invariants, brief expectations) as fixtures are captured. Doc-only.

### Horizon

- `web-shell` — M3. Browser as remote head over the same host, TanStack Router + Query, WebSocket RPC.
- `graph-data-plane` — M4. SQLite-backed graph persistence; intent-plane nodes/edges; graph clock; change log; coherence-state homes.
- `agent-graph-integration` — M5. Graph tools through pi extension seams; all writes via the shared command layer.
- `authority-model` — M6. Three-tier policy (autonomous / requires-confirmation / human-only) end-to-end across modes.
- `turn-boundary-reconciliation` — M7. Graph-revision tracking, session interest sets, `worldUpdate` injection, and the mention-staleness hint synthesiser.
- `coherence-first-class` — M8. Synchronous structural legality + stored semantic coherence verdicts visible to UI and agent.
- `compaction-and-conflict-widening` — M9. Compaction preserves graph + coherence anchors; interest sets can widen; conflict signals remain intelligible at long horizons.
- `flue-pattern-adoption` — Sandbox abstraction (SessionEnv/SandboxApi style), remote-deploy shape, MCP adapter. Post-POC.
- `oracle-design-plan-graphs` — Lift oracle / design / plan planes from stub status to durable persistence + commands. Post-POC.
- `framework-direction-stubs` — Lightweight structural stubs for Context layer, capability tiers, candidate artefacts. Discretionary; only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — Datalog-shaped intent store and petri-net plan execution. Exploratory; parallel to Brunch proper.

## Frontier Definitions

### walking-skeleton

- **Name:** Walking skeleton — `brunch` binary + TUI over pi
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Prove the wrapping model works at all: a `brunch` binary launches a pi-backed TUI session, scopes durable state to `.brunch/`, hardcodes Brunch's prompt and curated toolset, and mounts the persistent TUI chrome and spec-selector gate.
- **Why now / unlocks:** First architectural proof of D1-L (depend on `pi-coding-agent`) and D2-L (opinionated product, not pi shell). Unlocks every subsequent milestone. Also doubles as the Phase-3 infra bootstrap (package.json, tsconfig, oxlint/oxfmt, vitest).
- **Acceptance:** `brunch` launches a TUI session in a project directory; `.brunch/` is created; the spec-selector is presented before any agent loop runs; the chrome region displays cwd / spec / phase / chat-mode at all times; `npm run verify` is green.
- **Verification:** Inner — `npm run fix` / `npm run verify`. Middle — manual TUI smoke against a scratch project. Outer — defer; first replay-regression fixture lands in M1.
- **Traceability:** R1, R2, R3, R4, R19 / D1-L, D2-L, D6-L, D11-L / I8-L / A1-L, A10-L
- **Design docs:** [prd.md §M0](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §3](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)
- **Current execution pointer:** scope first with `ln-scope` — first slice is likely "minimal binary boot + `.brunch/` resolution", then "spec selector + chrome".

### mode-shell-and-fixture-driver

- **Name:** Mode shell (print + rpc) and first fixture driver
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Add `--mode print` and `--mode rpc` dispatchers over the same Brunch host; land the agent-as-user JSON-RPC stdio driver and capture the first replay-regression fixtures for at least briefs #1–#3.
- **Why now / unlocks:** Proves D5-L (JSON-RPC primary) and unlocks the fixture-driven feedback loop. Without this milestone, every downstream milestone has only manual TUI evidence.
- **Acceptance:** `brunch --mode print` and `brunch --mode rpc` boot from the same host setup; an agent-as-user driver completes at least one brief end-to-end over stdio and writes a `.jsonl` + `.meta.json` bundle under `.brunch-fixtures/`; the first three briefs from BEHAVIORAL_KERNELS.md are captured.
- **Verification:** Inner — verify gate. Middle — replay one captured fixture and assert byte-equivalence (modulo timestamps). Outer — at least the starter property invariants from fixture-strategy run on every capture.
- **Traceability:** R4, R5, R11, R20 / D5-L / I3-L, I10-L / A1-L, A5-L
- **Design docs:** [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)

### jsonl-session-viability

- **Name:** JSONL session viability proof
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Prove whether pi `SessionManager` JSONL in `.brunch/sessions/` is rich enough to carry raw assistant/user payloads, Brunch custom turn entries (`brunch.offer`, `brunch.offer_response`, `brunch.spec_switch`, `brunch.lens_switch`, `worldUpdate`, `brunch.mention`, `brunch.mention_staleness_hint`), and session-scoped continuity metadata (`lastSeenLsn`, interest sets, compaction anchors) through reload.
- **Why now / unlocks:** Validates A2-L and pins D6-L. If JSONL is insufficient, M2 produces a sharply scoped fallback proposal that all later milestones can plan against.
- **Acceptance:** Round-trip reload of a captured session preserves raw payloads byte-equivalent (modulo timestamps); all named Brunch custom entries survive; continuity metadata survives. If any of these fail, the failure is sharply documented and a fallback path is proposed (project richer substrate / mirror JSONL into richer records / propose pi upstream change).
- **Verification:** Inner — verify gate. Middle — JSONL round-trip property tests. Outer — fixture replay parity.
- **Traceability:** R7, R8 / D6-L / I3-L / A2-L
- **Design docs:** archived [jsonl-session-viability-note](file:///Users/lunelson/Code/hashintel/brunch-next/archive/archive/docs/architecture/jsonl-session-viability-note.md)

### web-shell

- **Name:** Web shell over the same host (M3)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** `brunch --mode web` serves a native Brunch React app (TanStack Router + Query) over one WebSocket-backed JSON-RPC client; no second backend API is invented; `pi-web-ui` is not used.
- **Why now / unlocks:** Proves D10-L. Unlocks parallel UI work and visualises graph + coherence state. Sequenced after M2 so the transcript substrate is pinned before clients depend on it.
- **Acceptance:** Web client connects via WebSocket RPC, lists specs from `SpecRegistry`, renders a transcript and the persistent chrome region, and round-trips offers + freeform user input through the same envelope as TUI.
- **Verification:** Inner gate; middle — manual browser smoke; outer — at least one fixture replays identically into the web renderer.
- **Traceability:** R4, R11, R12 / D5-L, D10-L
- **Design docs:** [prd.md §M3, §Frontend Architecture](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### graph-data-plane

- **Name:** Graph data plane (intent-first, workspace-graph-ready) (M4)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Stand up SQLite-backed graph persistence; durable intent-plane nodes and edges; a single global LSN per commit; the change log; the reconciliation-need substrate; named homes for coherence state (verdicts and violations) — all forward-compatible with oracle, design, and plan planes.
- **Why now / unlocks:** Pins I1-L, I6-L. Unlocks all agent ↔ graph work (M5+) and lets oracle / design / plan planes be added later without re-foundation.
- **Acceptance:** Graph CRUD + change-log replay tests pass; reconciliation-need substrate accepts inserts/updates/resolutions with LSN invariants enforced; oracle-plane stub tables exist (Check, Validation Method, Evidence, Obligation) even if unused.
- **Verification:** Inner gate; middle — property tests on LSN monotonicity and replay; outer — fixture property invariants on reconciliation-substrate begin running.
- **Traceability:** R7, R9, R13 / D3-L, D4-L, D6-L, D8-L, D9-L / I1-L, I6-L, I7-L / A3-L, A4-L
- **Design docs:** [pi-seam-extensions.md §Graph clock, §Reconciliation-need substrate, §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### agent-graph-integration

- **Name:** Agent ↔ graph integration through the shared command layer (M5)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Brunch installs graph tools through pi's extension seams; agent graph operations route exclusively through the Brunch-owned command layer; web, TUI, and agent all observe the same changes.
- **Acceptance:** Agent can create / update / link intent-plane nodes via Brunch tools; an architectural test or lint rule prevents direct DB access from outside the command layer; the same change observed across TUI and (if M3 lands) web client.
- **Verification:** Inner gate; middle — command-layer contract tests; outer — kernel-card-output coverage assertions begin landing per brief.
- **Traceability:** R10, R13 / D4-L / I2-L / A3-L
- **Design docs:** [prd.md §M5, §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### authority-model

- **Name:** Authority model and gated tools (M6)
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Three-tier policy (autonomous / requires-confirmation / human-only) implemented end-to-end; headless modes fail or delegate cleanly with structured `needs_human`; attribution + optimistic concurrency shared across all callers.
- **Acceptance:** Adversarial briefs requesting human-gated actions in print/RPC produce structured `needs_human`; an authority test matrix passes across all four modes.
- **Verification:** Inner gate; middle — authority test matrix; outer — adversarial fixture for `needs_human` regression.
- **Traceability:** R5, R6, R12 / D4-L
- **Design docs:** [prd.md §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### turn-boundary-reconciliation

- **Name:** Detection, relevance, turn-boundary reconciliation (M7)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Graph-revision tracking; session interest sets; `worldUpdate` synthesised by `prepareNextTurn`; mention-ledger staleness hints; lens/spec switches recompute interest set before next agent turn.
- **Acceptance:** Cross-session paired-brief fixture exercises `worldUpdate` filtering; mention-staleness hints synthesise when an entity changed since last snapshot; `brunch.spec_switch` and `brunch.lens_switch` recompute interest sets.
- **Verification:** Inner gate; middle — property tests for I4-L, I5-L, I9-L; outer — paired-brief adversarial capture passes.
- **Traceability:** R11, R13, R14, R18 / D6-L, D11-L, D14-L / I1-L, I4-L, I5-L, I9-L / A4-L, A9-L
- **Design docs:** [pi-seam-extensions.md §5 Graph-entity mentions](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### coherence-first-class

- **Name:** Coherence as a first-class graph property (M8)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Structural legality enforced synchronously; semantic coherence stored as explicit product state; UI and agent read the same coherence verdict; before-images available where needed.
- **Acceptance:** "Contradictory requirements" adversarial brief produces an `incoherent` verdict with a backing open reconciliation need; coherence verdict surfaces in the TUI chrome and in `graph.*` reads.
- **Verification:** Inner gate; middle — coherence-emission property tests; outer — adversarial fixture for contradictory requirements.
- **Traceability:** R12, R14 / D8-L / I6-L
- **Design docs:** [pi-seam-extensions.md §Reconciliation-need substrate](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### compaction-and-conflict-widening

- **Name:** Compaction-aware continuity and conflict widening (M9)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Compaction preserves graph and coherence anchors; interest sets can widen beyond direct reads when needed; conflict signaling remains intelligible at long horizons.
- **Acceptance:** Long-horizon adversarial brief (50+ turns) replays through compaction with `lastSeenLsn` and interest set preserved; lens/spec switches across compaction boundaries do not desync.
- **Verification:** Inner gate; middle — compaction round-trip tests; outer — long-horizon fixture passes.
- **Traceability:** R15 / D6-L
- **Design docs:** [prd.md §Continuity, Divergence, and Coherence](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### brief-library-curation

- **Name:** Curate the fixture brief library
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Author and review briefs #4–#7 plus the adversarial second tier per fixture-strategy. Outputs are YAML briefs and one or two reviewer notes.
- **Acceptance:** Briefs #1–#7 present in `.brunch-fixtures/briefs/`; adversarial briefs present with documented targets; expectations for brief #7 satisfied per fixture-strategy.
- **Verification:** Doc review; spot-replay if the relevant harness milestone has landed.
- **Traceability:** R20 / A5-L
- **Design docs:** [fixture-strategy.md §Brief library](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)

### fixture-strategy-evolution

- **Name:** Evolve fixture strategy as captures land
- **Linear:** unassigned
- **Kind:** hardening
- **Status:** not-started
- **Objective:** Iterate `fixture-strategy.md` — property invariants, brief expectations, harness CLI shape — as real fixtures expose gaps.
- **Acceptance:** Each milestone landing adds at least one new fixture-strategy entry (invariant, brief expectation, or harness note) or explicitly records "no change needed."
- **Verification:** PR review on the doc; downstream fixture runs catch regressions.
- **Traceability:** A5-L
- **Design docs:** [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)

### flue-pattern-adoption

- **Name:** Adopt selected Flue patterns post-POC
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon
- **Objective:** Bring sandbox abstraction (SessionEnv/SandboxApi style), remote-deployment shape, MCP adapter style, and per-run event-stream style into Brunch via Brunch-side adapters over pi. Not part of POC.
- **Acceptance:** Defer until POC success criteria are met; revisit then.
- **Verification:** Defer.
- **Traceability:** Future Direction Register §Adoption patterns from Flue
- **Design docs:** [pi-seam-extensions.md §Flue framework evaluation](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### oracle-design-plan-graphs

- **Name:** Lift oracle / design / plan planes from stub to durable
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon
- **Objective:** Promote oracle-plane stub to first-class persistence + commands; bring design and plan graphs online behind the same command layer.
- **Acceptance:** Defer until POC success criteria are met.
- **Verification:** Defer.
- **Traceability:** R9, R13
- **Design docs:** [pi-seam-extensions.md §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### framework-direction-stubs

- **Name:** Lightweight stubs for Context layer, capability tiers, candidate artefacts
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Add minimal structural stubs (named namespaces, empty tables, or typed placeholders) for the deferred subsystems where a stub is cheaper than leaving a hole.
- **Acceptance:** Discretionary; only land when downstream pressure makes a stub cheaper than a hole.
- **Verification:** Defer.
- **Traceability:** Future Direction Register §Framework alignment & deferred subsystems
- **Design docs:** [pi-seam-extensions.md §Framework alignment & deferred subsystems](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### geolog-and-petri-execution

- **Name:** Geolog (TA1.2) and petri-net plan execution
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon
- **Objective:** Exploratory — Datalog-shaped intent store (Geolog) and petri-net-compiled plan execution. Parallel to Brunch proper; surface here so dependents know it is acknowledged.
- **Acceptance:** Defer; tracked elsewhere.
- **Verification:** Defer.
- **Traceability:** Future Direction Register §Framework alignment & deferred subsystems

## Recently Completed

- 2026-05-20 `pre-poc-archive-and-reseed` — Done: razed pre-POC implementation, archived legacy docs and planning memory under `archive/`, tagged `next-baseline`, reseeded `memory/SPEC.md` and `memory/PLAN.md` from the three canonical POC architecture docs. Verified: `git log --oneline` shows three clean buckets; `archive/` contains all prior material. Watch: Phase 3 infra bootstrap is folded into `walking-skeleton`, not a separate frontier.

Older history: `archive/docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
walking-skeleton
   │
   ├── mode-shell-and-fixture-driver
   │      │
   │      ├── jsonl-session-viability
   │      │      │
   │      │      ├── graph-data-plane
   │      │      │      │
   │      │      │      ├── agent-graph-integration
   │      │      │      │      │
   │      │      │      │      ├── authority-model
   │      │      │      │      │
   │      │      │      │      └── turn-boundary-reconciliation
   │      │      │      │             │
   │      │      │      │             └── coherence-first-class
   │      │      │      │                    │
   │      │      │      │                    └── compaction-and-conflict-widening
   │      │      │      │
   │      │      │      └── (oracle-design-plan-graphs — horizon)
   │      │      │
   │      │      └── web-shell  (M3, can run parallel after M2)
   │      │
   │      └── brief-library-curation   (parallel after M0)
   │
   └── fixture-strategy-evolution     (continuous, doc-only)

(flue-pattern-adoption, framework-direction-stubs, geolog-and-petri-execution
 are horizon items; not on the active dependency spine.)
```
