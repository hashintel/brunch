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

1. `walking-skeleton` — in-progress — FE-729 / `ln/fe-729-walking-skeleton`. Phase-3 bootstrap landed on `next`; remaining slices wire pi seams (real session against `SessionManager.create(cwd, '.brunch/sessions/')`), mount the persistent TUI chrome (cwd / spec / phase / chat-mode), and add the spec-selector gate.

### Next

1. `mode-shell-and-fixture-driver` — Adds `--mode print` and `--mode rpc` over thin named RPC method families, lands the first agent-as-user fixture-capture run end-to-end, seeds the first three briefs from BEHAVIORAL_KERNELS.md.
2. `jsonl-session-viability` — Proves whether pi JSONL sessions can hold raw payloads, Brunch session binding, structured elicitation entries, and continuity metadata faithfully across reload.

### Parallel / Low-conflict

- `brief-library-curation` — Author and review briefs #4–#7 plus the adversarial second tier; can proceed independently once `walking-skeleton` exists. Briefs are text, no code dependency.
- `fixture-strategy-evolution` — Iterate `fixture-strategy.md` (property invariants, brief expectations) as fixtures are captured. Doc-only.

### Horizon

- `web-shell` — M3. Browser as thin remote head over the same host, TanStack Router + Query, one WebSocket RPC client, no REST read model.
- `graph-data-plane` — M4. SQLite-backed graph persistence; intent-plane nodes/edges; graph clock; change log; coherence-state homes.
- `agent-graph-integration` — M5. Graph tools and observer extraction through pi extension seams; all writes via the shared command layer.
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
- **Linear:** [FE-729](https://linear.app/hash/issue/FE-729) (sub-issue of FE-702)
- **Branch:** `ln/fe-729-walking-skeleton` (off `next`)
- **Kind:** structural
- **Status:** in-progress (bootstrap slice landed on `next` as commit `b104fc40`; remaining slices on the frontier branch)
- **Objective:** Prove the wrapping model works at all: a `brunch` binary launches a pi-backed TUI session through the `WorkspaceSessionCoordinator`, scopes durable state to `.brunch/`, hardcodes Brunch's prompt and curated toolset, and mounts the persistent TUI chrome and spec-selector gate.
- **Why now / unlocks:** First architectural proof of D1-L (depend on `pi-coding-agent`) and D2-L (opinionated product, not pi shell). Unlocks every subsequent milestone. Also doubles as the Phase-3 infra bootstrap (package.json, tsconfig, oxlint/oxfmt, vitest).
- **Acceptance:** `brunch` launches a TUI session in a project directory; `.brunch/` is created; boot routes through a `WorkspaceSessionCoordinator` that returns `ready | select_spec | needs_human`; the spec-selector is presented before any agent loop runs when no bound spec is ready; the selected spec is written as the session's `brunch.session_binding`; `/new` creates another session bound to the same spec rather than mutating the current session's spec; the chrome region displays cwd / spec / phase / chat-mode at all times; `npm run verify` is green.
- **Verification:** Inner — `npm run fix` / `npm run verify`. Middle — manual TUI smoke against a scratch project. Outer — defer; first replay-regression fixture lands in M1.
- **Cross-cutting obligations:** Preserve the `cwd → spec → session` hierarchy, one-spec-per-session binding, and persistent chrome region as durable product surfaces, not temporary bootstrapping hacks. Do not let TUI, RPC, or fixture code create/open Pi sessions or write `brunch.session_binding` directly; route boot, spec selection, and `/new` through the workspace-session seam.
- **Traceability:** R1, R2, R3, R4, R19 / D1-L, D2-L, D6-L, D11-L, D21-L / I8-L, I13-L / A1-L, A10-L
- **Design docs:** [prd.md §M0](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §3](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)
- **Current execution pointer:** scope next with `ln-scope` around the remaining walking-skeleton seam: implement the `WorkspaceSessionCoordinator` over real pi `SessionManager.create(cwd, '.brunch/sessions/')`, spec selector gating, `brunch.session_binding`, `/new` preserving the active spec, and persistent chrome.

### mode-shell-and-fixture-driver

- **Name:** Mode shell (print + rpc) and first fixture driver
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Add `--mode print` and `--mode rpc` dispatchers over the same Brunch host and named RPC method-family handlers; land the agent-as-user JSON-RPC stdio driver; prove transcript projection of elicitation exchanges; and capture the first replay-regression fixtures for at least briefs #1–#3.
- **Why now / unlocks:** Proves D5-L (JSON-RPC primary) and unlocks the fixture-driven feedback loop. Without this milestone, every downstream milestone has only manual TUI evidence.
- **Acceptance:** `brunch --mode print` and `brunch --mode rpc` boot from the same host setup; the first `session.*` / `workspace.*` RPC handlers are named product methods rather than a generic read gateway; an agent-as-user driver completes at least one brief end-to-end over stdio by responding to elicitation prompts; captured JSONL can be projected into prompt/response elicitation exchanges; a `.jsonl` + `.meta.json` bundle is written under `.brunch-fixtures/`; the first three briefs from BEHAVIORAL_KERNELS.md are captured.
- **Verification:** Inner — verify gate. Middle — replay-regression fixture(s) assert transcript reproduction or graph equivalence as the golden basis. Outer — the three-layer fixture model is established in skeleton form here: replay regression is live now, while property and adversarial layers are wired to come online as later milestones supply the graph/coherence substrates.
- **Cross-cutting obligations:** Keep the captured-run format forward-compatible with later `.graph.json` and `.coherence.json` artefacts; establish exchange projection over Pi JSONL without creating canonical chat/turn tables; keep read/subscription architecture thin — named RPC method families and projection handlers over canonical stores, not a generic read-model platform; this frontier establishes the first layer of the canonical replay/property/adversarial fixture architecture rather than a one-off harness.
- **Traceability:** R4, R5, R11, R16, R17, R20 / D5-L, D12-L, D13-L, D18-L, D19-L / I3-L, I10-L, I13-L / A1-L, A5-L, A12-L
- **Design docs:** [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)

### jsonl-session-viability

- **Name:** JSONL session viability proof
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Prove whether pi `SessionManager` JSONL in `.brunch/sessions/` is rich enough to carry raw assistant/user payloads, Brunch session binding (`brunch.session_binding`), structured elicitation prompt/response entries when needed, other custom entries (`brunch.lens_switch`, `brunch.side_task_result`, `worldUpdate`, `brunch.mention`, `brunch.mention_staleness_hint`), and session-scoped continuity metadata (`lastSeenLsn`, interest sets, compaction anchors) through reload.
- **Why now / unlocks:** Validates A2-L and pins D6-L. If JSONL is insufficient, M2 produces a sharply scoped fallback proposal that all later milestones can plan against.
- **Acceptance:** Round-trip reload of a captured session preserves raw payloads byte-equivalent (modulo timestamps); session binding and structured elicitation entries survive; elicitation exchanges can be re-projected from the active branch after reload; all named Brunch custom entries survive, including side-task-result delivery entries when present; continuity metadata survives. If any of these fail, the failure is sharply documented and a fallback path is proposed (project richer substrate / mirror JSONL into richer records / propose pi upstream change).
- **Verification:** Inner — verify gate. Middle — JSONL round-trip property tests. Outer — fixture replay parity across the transcript-first run bundle.
- **Cross-cutting obligations:** This frontier is the transcript-side proof for the shared event substrate that later carries structured elicitation entries, session binding, lens switches, side-task results, mentions, and `worldUpdate` without inventing a parallel channel or canonical chat/turn store. JSONL viability must validate sessions created through the `WorkspaceSessionCoordinator`, including the first-entry binding and `/new` same-spec behavior.
- **Traceability:** R7, R8, R16, R17, R19 / D6-L, D11-L, D12-L, D13-L, D18-L / I3-L, I8-L, I10-L / A2-L, A12-L
- **Design docs:** archived [jsonl-session-viability-note](file:///Users/lunelson/Code/hashintel/brunch-next/archive/archive/docs/architecture/jsonl-session-viability-note.md)

### web-shell

- **Name:** Web shell over the same host (M3)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** `brunch --mode web` serves a native Brunch React app (TanStack Router + Query) over one WebSocket-backed JSON-RPC client; no second backend API, REST read model, or browser-owned product runtime is invented; `pi-web-ui` is not used.
- **Why now / unlocks:** Proves D10-L. Unlocks parallel UI work and visualises graph + coherence state. Sequenced after M2 so the transcript substrate is pinned before clients depend on it.
- **Acceptance:** Web client connects via WebSocket RPC, lists specs and workspace state through `session.*` / `workspace.*` projection handlers, renders a transcript and the persistent chrome region, and round-trips structured elicitation prompts/responses plus freeform user input through the same transcript conventions as TUI.
- **Verification:** Inner gate; middle — manual browser smoke; outer — at least one fixture replays identically into the web renderer.
- **Cross-cutting obligations:** Preserve the single command/event substrate: the browser is a thin remote head over the same elicitation/transcript/session machinery, not a second data plane, REST-backed read client, generic read gateway, or custom interaction contract.
- **Traceability:** R4, R11, R12, R16, R17 / D5-L, D10-L, D12-L, D13-L, D19-L
- **Design docs:** [prd.md §M3, §Frontend Architecture](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### graph-data-plane

- **Name:** Graph data plane (intent-first, workspace-graph-ready) (M4)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Stand up SQLite-backed graph persistence; durable intent-plane nodes and edges; a single global LSN per commit; the change log; the reconciliation-need substrate; named homes for coherence state (verdicts and violations) — all forward-compatible with oracle, design, and plan planes.
- **Why now / unlocks:** Pins I1-L, I6-L. Unlocks all agent ↔ graph work (M5+) and lets oracle / design / plan planes be added later without re-foundation.
- **Acceptance:** Graph CRUD + change-log replay tests pass through the `CommandExecutor` public mutation boundary; command results already include success, `needs_human`, `policy_blocked`, `version_conflict`, and `structural_illegal` shapes even if pre-M6 policy classification is minimal; reconciliation-need substrate accepts inserts/updates/resolutions with LSN invariants enforced; oracle-plane stub tables exist (Check, Validation Method, Evidence, Obligation) even if unused; the persistence layer proves the one-transaction protocol that couples authority/result classification, version checks, structural validation, LSN allocation, change-log append, and any coherence updates.
- **Verification:** Inner gate; middle — property tests on LSN monotonicity and replay plus architectural tests that no durable mutation path bypasses the `CommandExecutor` transaction/result boundary. Outer — fixture property invariants on reconciliation-substrate begin running.
- **Cross-cutting obligations:** Establish the Drizzle + `better-sqlite3` persistence shape, `CommandExecutor` result contract, and no-bypass transaction rule as shared infrastructure for later direct-agent, observer-job, side-task, migration, and UI-attributed writes.
- **Traceability:** R7, R9, R13 / D3-L, D4-L, D6-L, D8-L, D9-L, D16-L, D20-L / I1-L, I6-L, I7-L, I11-L / A3-L, A4-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §Graph clock, §Reconciliation-need substrate, §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### agent-graph-integration

- **Name:** Agent ↔ graph integration through the shared command layer (M5)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Brunch installs graph tools through pi's extension seams; agent graph operations and observer-extraction writes route exclusively through the Brunch-owned command layer; web, TUI, and agent all observe the same changes.
- **Acceptance:** Agent can create / update / link intent-plane nodes via Brunch tools that call the `CommandExecutor`; an observer job can process a projected elicitation exchange and either write high-confidence graph changes or surface low-confidence suggestions/reconciliation work through the same executor; an architectural test or lint rule prevents direct DB access or caller-side authority bypass outside the command layer; the same change observed across TUI and (if M3 lands) web client; if the registry lands here, side-task-attributed writes follow the same command-executor path.
- **Verification:** Inner gate; middle — command-executor contract tests plus observer-job idempotence/restart tests. Outer — kernel-card-output coverage assertions begin landing per brief and side-task/observer-attributed writes, if present, remain indistinguishable from other writes at the command-layer boundary except for attribution.
- **Cross-cutting obligations:** Preserve the single-authority mutation rule for primary-agent, observer, and side-task flows by making the `CommandExecutor` the only mutation entry; observer jobs are durable operational queue entries keyed to elicitation exchanges, not a revived chat/turn store or privileged write path for background work.
- **Traceability:** R10, R13, R17 / D4-L, D13-L, D15-L, D18-L, D20-L / I2-L, I11-L, I14-L / A3-L, A11-L, A13-L
- **Design docs:** [prd.md §M5, §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents)

### authority-model

- **Name:** Authority model and gated tools (M6)
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Fill in the policy matrix behind the existing `CommandExecutor` result seam: three-tier policy (autonomous / requires-confirmation / human-only) implemented end-to-end; headless modes fail or delegate cleanly with structured `needs_human`; attribution + optimistic concurrency shared across all callers.
- **Acceptance:** Adversarial briefs requesting human-gated actions in print/RPC produce structured `needs_human` through the command result contract; an authority test matrix passes across all four modes; M6 does not introduce a second policy service or caller-side authority gate.
- **Verification:** Inner gate; middle — authority test matrix; outer — adversarial fixture for `needs_human` regression.
- **Traceability:** R5, R6, R12 / D4-L, D20-L
- **Design docs:** [prd.md §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### turn-boundary-reconciliation

- **Name:** Detection, relevance, turn-boundary reconciliation (M7)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Graph-revision tracking; session interest sets; `worldUpdate` synthesised by `prepareNextTurn`; mention-ledger staleness hints; side-task-result drain at the same boundary; session/spec binding transitions — and any lens switches present by then — recompute interest set before next agent turn.
- **Acceptance:** Cross-session paired-brief fixture exercises `worldUpdate` filtering; mention-staleness hints synthesise when an entity changed since last snapshot; succeeded side-task results are delivered only at the next turn boundary; session/spec binding transitions and any emitted `brunch.lens_switch` entries recompute interest sets.
- **Verification:** Inner gate; middle — property tests for I4-L, I5-L, I9-L, and I12-L. Outer — paired-brief adversarial capture passes, including side-task delivery when the side-task subsystem is active.
- **Cross-cutting obligations:** This frontier is the rendezvous point for Brunch's shared next-turn event semantics: `worldUpdate`, side-task results, lens changes, session/spec binding state, and mention staleness must coexist without inventing a second event plane.
- **Traceability:** R11, R13, R14, R18 / D6-L, D11-L, D14-L, D15-L / I1-L, I4-L, I5-L, I9-L, I12-L / A4-L, A9-L, A11-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §5 Graph-entity mentions](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### coherence-first-class

- **Name:** Coherence as a first-class graph property (M8)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Structural legality enforced synchronously; semantic coherence stored as explicit product state; UI and agent read the same coherence verdict; before-images available where needed.
- **Acceptance:** "Contradictory requirements" adversarial brief produces an `incoherent` verdict with a backing open reconciliation need; coherence verdict surfaces in the TUI chrome and in `graph.*` reads.
- **Verification:** Inner gate; middle — coherence-emission property tests; outer — adversarial fixture for contradictory requirements.
- **Cross-cutting obligations:** Coherence verdicts must remain visible through the same transcript/graph authority model that side tasks, elicitation exchanges, observer jobs, and reconciliation needs already use; this frontier must not hide coherence behind a private subsystem.
- **Traceability:** R12, R14 / D8-L / I6-L
- **Design docs:** [pi-seam-extensions.md §Reconciliation-need substrate](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### compaction-and-conflict-widening

- **Name:** Compaction-aware continuity and conflict widening (M9)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Compaction preserves graph and coherence anchors; interest sets can widen beyond direct reads when needed; conflict signaling remains intelligible at long horizons.
- **Acceptance:** Long-horizon adversarial brief (50+ turns) replays through compaction with `lastSeenLsn`, interest set, and session binding preserved; spec/session changes across compaction boundaries do not desync; active spec and any in-flight side-task, observer-job, or lens bookkeeping remain intelligible after compaction.
- **Verification:** Inner gate; middle — compaction round-trip tests. Outer — long-horizon fixture passes, including continuity checks for side-task and interest-set state when present.
- **Cross-cutting obligations:** Preserve the coherence anchors, session binding, session continuity metadata, and side-task/observer/spec state that earlier milestones attached to the shared transcript/event substrate; preserve lens state only if a lens subsystem has landed by then.
- **Traceability:** R15 / D6-L, D15-L / I12-L
- **Design docs:** [prd.md §Continuity, Divergence, and Coherence](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### brief-library-curation

- **Name:** Curate the fixture brief library
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Author and review briefs #4–#7 plus the adversarial second tier per fixture-strategy. Outputs are YAML briefs and one or two reviewer notes.
- **Acceptance:** Briefs #1–#7 present in `.brunch-fixtures/briefs/`; adversarial briefs present with documented targets; expectations for brief #7 satisfied per fixture-strategy.
- **Verification:** Doc review; spot-replay if the relevant harness milestone has landed.
- **Cross-cutting obligations:** Keep the brief corpus aligned with the canonical replay/property/adversarial fixture model rather than letting it drift into a loose examples folder.
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
- **Cross-cutting obligations:** Treat fixture strategy as canonical verification architecture that must stay in sync with SPEC/PLAN, not as optional commentary.
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
