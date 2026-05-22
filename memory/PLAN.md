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

1. `pi-ui-extension-patterns` — Continue FE-744 for the POC-critical offer-first custom UI loop: transcript-native structured offer → input-replacing custom response UI → persisted structured response → elicitation-exchange projection.

### Next

1. `graph-data-plane` — M4 remains structurally next after the offer-first UI seam is proven; do not return to it until FE-744 has a credible elicitation input loop for POC sessions.
2. `agent-graph-integration` — M5. Graph tools and observer extraction through pi extension seams; all writes via the shared command layer.

### Parallel / Low-conflict

- `brief-library-curation` — Author and review briefs #4–#7 plus the adversarial second tier; can proceed independently once `walking-skeleton` exists. Briefs are text, no code dependency.
- `fixture-strategy-evolution` — Iterate `fixture-strategy.md` (property invariants, brief expectations) as fixtures are captured. Doc-only.

### Horizon

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
- **Status:** done (bootstrap slice landed on `next` as commit `b104fc40`; coordinator/runbook and TUI boot/chrome slices landed on the frontier branch; manual M0 smoke + store-only runbook oracle passed)
- **Objective:** Prove the wrapping model works at all: a `brunch` binary launches a pi-backed TUI session through the `WorkspaceSessionCoordinator`, scopes durable state to `.brunch/`, hardcodes Brunch's prompt and curated toolset, and mounts the persistent TUI chrome and spec-selector gate.
- **Why now / unlocks:** First architectural proof of D1-L (depend on `pi-coding-agent`) and D2-L (opinionated product, not pi shell). Unlocks every subsequent milestone. Also doubles as the Phase-3 infra bootstrap (package.json, tsconfig, oxlint/oxfmt, vitest).
- **Acceptance:** `brunch` launches a TUI session in a project directory; `.brunch/` is created; boot routes through a `WorkspaceSessionCoordinator` that returns `ready | select_spec | needs_human`; the spec-selector is presented before any agent loop runs when no bound spec is ready; the selected spec is written as the session's `brunch.session_binding`; `/new` creates another session bound to the same spec rather than mutating the current session's spec; the chrome region displays cwd / spec / phase / chat-mode at all times; `npm run verify` is green.
- **Verification:** Inner — `npm run fix` / `npm run verify` plus coordinator state/unit tests. Middle — M0 runbook oracle: manual TUI smoke against a scratch project paired with artifact/query postconditions for `.brunch/`, `brunch.session_binding`, same-spec `/new`, and chrome/workspace state (SPEC §Runbook Oracle Design). Outer — defer; first replay-regression fixture lands in M1.
- **Cross-cutting obligations:** Preserve the `cwd → spec → session` hierarchy, one-spec-per-session binding, and persistent chrome region as durable product surfaces, not temporary bootstrapping hacks. Do not let TUI, RPC, or fixture code create/open Pi sessions or write `brunch.session_binding` directly; route boot, spec selection, and `/new` through the workspace-session seam.
- **Traceability:** R1, R2, R3, R4, R19 / D1-L, D2-L, D6-L, D11-L, D21-L / I8-L, I13-L / A1-L, A10-L
- **Design docs:** [prd.md §M0](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §3](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)
- **Current execution pointer:** complete; proceed to `mode-shell-and-fixture-driver`.

### mode-shell-and-fixture-driver

- **Name:** Mode shell (print + rpc) and first fixture driver
- **Linear:** [FE-735](https://linear.app/hash/issue/FE-735/mode-shell-and-fixture-driver-m1) (sub-issue of FE-702)
- **Branch:** `ln/fe-735-mode-shell-fixture-driver` (stacked on `ln/fe-729-walking-skeleton`)
- **Kind:** structural
- **Status:** done
- **Objective:** Add `--mode print` and `--mode rpc` transport dispatchers over the same Brunch host and named RPC method-family handlers; land the agent-as-user JSON-RPC stdio driver; prove transcript projection of elicitation exchanges; and capture the first replay-regression fixtures for at least briefs #1–#3. For M1, print mode is a snapshot renderer/proof-of-life, not a single-turn agent run.
- **Why now / unlocks:** Proves D5-L (JSON-RPC primary) and unlocks the fixture-driven feedback loop. Without this milestone, every downstream milestone has only manual TUI evidence.
- **Acceptance:** `brunch --mode print` and `brunch --mode rpc` boot from the same host setup; the first `session.*` / `workspace.*` RPC handlers are named product methods rather than a generic read gateway; an agent-as-user driver completes at least one brief end-to-end over stdio by responding to elicitation prompts; captured JSONL can be projected into prompt/response elicitation exchanges; a `.jsonl` + `.meta.json` bundle is written under `.brunch-fixtures/`; the first three curated briefs are captured.
- **Verification:** Inner — verify gate plus projection-handler unit tests for elicitation exchange ranges. Middle — deterministic first captured run, stdio RPC handler contract tests, replay-regression fixture(s) asserting transcript reproduction/projection parity, and `./runbooks/verify-m1.sh` for store/projection/manual-smoke evidence (SPEC §Oracle Strategy by Loop Tier). Outer — the three-layer fixture model is established in skeleton form here; property and adversarial layers come online as later milestones supply graph/coherence substrates; brief quality and golden-capture representativeness remain explicit human review prompts in the runbook.
- **Cross-cutting obligations:** Keep transport mode distinct from agent modes/lenses; do not make print mode select or imply an agent strategy in M1. Keep the captured-run format forward-compatible with later `.graph.json` and `.coherence.json` artefacts; establish exchange projection over Pi JSONL without creating canonical chat/turn tables; keep read/subscription architecture thin — named RPC method families and projection handlers over canonical stores, not a generic read-model platform; this frontier establishes the first layer of the canonical replay/property/adversarial fixture architecture rather than a one-off harness.
- **Traceability:** R4, R5, R11, R16, R17, R20 / D5-L, D12-L, D13-L, D18-L, D19-L / I3-L, I10-L, I13-L / A1-L, A5-L
- **Design docs:** [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)
- **Current execution pointer:** complete after M1 review fixes; proceed to `jsonl-session-viability`.

### jsonl-session-viability

- **Name:** JSONL session viability proof
- **Linear:** [FE-736](https://linear.app/hash/issue/FE-736/jsonl-session-viability-proof)
- **Branch:** `ln/fe-736-jsonl-session-viability` (stacked on `ln/fe-735-mode-shell-fixture-driver`)
- **Kind:** structural
- **Status:** done
- **Objective:** Prove whether pi `SessionManager` JSONL in `.brunch/sessions/` is rich enough to carry raw assistant/user payloads, Brunch session binding (`brunch.session_binding`), structured elicitation prompt/response entries when needed, other custom entries (`brunch.lens_switch`, `brunch.side_task_result`, `worldUpdate`, `brunch.mention`, `brunch.mention_staleness_hint`), and session-scoped continuity metadata (`lastSeenLsn`, interest sets, compaction anchors) through reload.
- **Why now / unlocks:** Validated the JSONL-first transcript strategy and pinned D6-L for Brunch-supported linear sessions. If JSONL had been insufficient, M2 would have produced a sharply scoped fallback proposal that all later milestones could plan against.
- **Acceptance:** Round-trip reload of a captured linear session preserves raw payloads byte-equivalent (modulo timestamps); session binding and structured elicitation entries survive; elicitation exchanges can be re-projected after reload; all named Brunch custom entries survive, including side-task-result delivery entries when present; continuity metadata survives. Defensive branch-shape tests document Pi substrate behavior, but branch-aware Brunch sessions are not product-supported per D24-L. If core linear-session viability fails, the failure is sharply documented and a fallback path is proposed (project richer substrate / mirror JSONL into richer records / propose pi upstream change).
- **Verification:** Inner — verify gate plus synthetic JSONL projection tests. Middle — JSONL round-trip/property tests for raw payloads, `brunch.session_binding`, structured elicitation entries, defensive branch-shape projection behavior, coordinator-created `/new` sessions, and M1 fixture replay parity. Outer — fixture replay parity across the transcript-first run bundle; no new human review was required because brief content and scripted user notes did not change.
- **Cross-cutting obligations:** This frontier is the transcript-side proof for the shared event substrate that later carries structured elicitation entries, session binding, lens switches, side-task results, mentions, and `worldUpdate` without inventing a parallel channel or canonical chat/turn store. JSONL viability must validate sessions created through the `WorkspaceSessionCoordinator`, including the first-entry binding and `/new` same-spec behavior.
- **Traceability:** R7, R8, R16, R17, R19 / D6-L, D11-L, D12-L, D13-L, D18-L, D24-L / I3-L, I8-L, I10-L, I19-L
- **Design docs:** archived [jsonl-session-viability-note](file:///Users/lunelson/Code/hashintel/brunch-next/archive/archive/docs/architecture/jsonl-session-viability-note.md)
- **Current execution pointer:** complete; proceed to `web-shell`.

### web-shell

- **Name:** Web shell over the same host (M3)
- **Linear:** [FE-737](https://linear.app/hash/issue/FE-737/web-shell-over-the-same-host-m3)
- **Branch:** `ln/fe-737-web-shell`
- **Kind:** structural
- **Status:** done
- **Objective:** `brunch --mode web` serves a native Brunch React app (TanStack Router + Query) over one WebSocket-backed JSON-RPC client; no second backend API, REST read model, or browser-owned product runtime is invented; `pi-web-ui` is not used. The web surface is initially a read-only visual dashboard/client attachment over explicit spec/session resources, so a TUI can remain the interactive writer while the browser renders richer projections.
- **Why now / unlocks:** Proves D10-L. Unlocks parallel UI work and visualises graph + coherence state. Sequenced after M2 so the transcript substrate is pinned before clients depend on it.
- **Acceptance:** Web client connects via one persistent WebSocket RPC client, lists specs and workspace state through `session.*` / `workspace.*` projection handlers, can attach read-only views to explicit spec/session resources, renders a transcript and the persistent chrome region, and does not treat the WebSocket connection or `.brunch/state.json` default as the durable Brunch session. Structured elicitation prompts/responses plus freeform user input remain deferred until a write-lease or equivalent concurrency policy is designed.
- **Verification:** Inner gate plus WebSocket/handler contract tests. Middle — manual browser smoke paired with projection/query postconditions for `session.*` / `workspace.*`, linear transcript-policy guards, transcript rendering state, and structured elicitation round-trip. Outer — at least one fixture replays into the web renderer; qualitative UX remains manual checklist.
- **Cross-cutting obligations:** Preserve the single command/event substrate: the browser is a thin remote head over the same elicitation/transcript/session machinery, not a second data plane, REST-backed read client, generic read gateway, or custom interaction contract. Treat WebSocket connections as ephemeral client attachments, not Brunch sessions; session-consuming RPC methods should target explicit spec/session resources or a deliberate attachment handshake. Carry D24-L linear transcript policy forward before adding another session-consuming surface: block Brunch-controlled `/tree`/`/fork`/`/clone` branch flows where Pi hooks permit, and make transcript readers fail fast on non-linear JSONL rather than adapting it. If/when `brunch.establishment_offer` entries are present, browser chrome should project the latest offer as ambient orientation rather than inventing a browser-only strategy menu.
- **Traceability:** R4, R8, R11, R12, R16, R17 / D5-L, D10-L, D12-L, D13-L, D19-L, D24-L, D33-L / I19-L, I21-L
- **Design docs:** [prd.md §M3, §Frontend Architecture](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)
- **Current execution pointer:** complete. M3 tied off with shared JSON-RPC protocol helpers/dispatch semantics, `ws`-backed `/rpc` transport, persistent browser RPC client with protocol-failure hardening, canonical built asset serving with traversal-safe asset resolution, stable React runtime, explicit read-only session projection by durable session id through a canonical Brunch session-envelope reader with strict self-description validation, explicit transcript custom-entry classifiers, and read-only browser transcript rendering of assistant/user rows plus transcript-native prompt display rows from typed `{ sessionId, specId }` targets. Automated verification and direct HTTP/WebSocket projection postconditions pass. Accepted outer-loop deferral: qualitative browser-open smoke remains environment-blocked because `agent-browser` cannot create its socket directory under the current macOS sandbox (`Operation not permitted`); this does not block M3 tie-off because static HTML serving, absence of HTTP product reads, explicit `{ sessionId, specId }` WebSocket RPC reads, transcript-display text including custom prompt rows, and exchange projection were rechecked directly against the host.

### graph-data-plane

- **Name:** Graph data plane (intent-first, workspace-graph-ready) (M4)
- **Linear:** [FE-741](https://linear.app/hash/issue/FE-741/graph-data-plane-intent-first-workspace-graph-ready-m4)
- **Branch:** `ln/fe-741-graph-data-plane` (stacked on `ln/fe-737-web-shell`)
- **Kind:** structural
- **Status:** active
- **Objective:** Stand up SQLite-backed graph persistence; durable intent-plane nodes and edges; a single global LSN per commit; the change log; the reconciliation-need substrate; named homes for coherence state (verdicts and violations) — all forward-compatible with oracle, design, and plan planes.
- **Why now / unlocks:** Pins I1-L, I6-L. Unlocks all agent ↔ graph work (M5+) and lets oracle / design / plan planes be added later without re-foundation.
- **Acceptance:** Graph CRUD + change-log replay tests pass through the `CommandExecutor` public mutation boundary; command results already include success, `needs_human`, `policy_blocked`, `version_conflict`, and `structural_illegal` shapes even if pre-M6 policy classification is minimal; reconciliation-need substrate accepts inserts/updates/resolutions with LSN invariants enforced; oracle-plane stub tables exist (Check, Validation Method, Evidence, Obligation) even if unused; the persistence layer proves the one-transaction protocol that couples authority/result classification, version checks, structural validation, LSN allocation, change-log append, and any coherence updates.
- **Verification:** Inner gate plus command/result schema/type tests. Middle — property/model-based tests on LSN monotonicity, graph replay, reconciliation invariants, framing matrix, and `CommandExecutor` transaction/result behavior; architectural no-bypass tests. Outer — fixture property invariants on reconciliation-substrate begin running.
- **Cross-cutting obligations:** Establish the Drizzle + `better-sqlite3` persistence shape, `CommandExecutor` result contract, and no-bypass transaction rule as shared infrastructure for later direct-agent, observer-job, side-task, migration, and UI-attributed writes.
- **Traceability:** R7, R9, R13 / D3-L, D4-L, D6-L, D8-L, D9-L, D16-L, D20-L / I1-L, I6-L, I7-L, I11-L / A3-L, A4-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §Graph clock, §Reconciliation-need substrate, §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)
- **Current execution pointer:** start by scoping the narrow `CommandExecutor` result contract and one-transaction LSN/change-log skeleton before widening CRUD or coherence homes.

### agent-graph-integration

- **Name:** Agent ↔ graph integration through the shared command layer (M5)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Brunch installs graph tools through pi's extension seams; agent graph operations, observer-extraction writes, reviewer-attributed advisory writes, generative-lens batch acceptances, and the transcript-native establishment/intent-hint surfaces all route exclusively through the Brunch-owned command layer and shared event substrate; web, TUI, and agent all observe the same changes.
- **Acceptance:** Agent can create / update / link intent-plane nodes via Brunch tools that call the `CommandExecutor`; elicitor turns emit `brunch.establishment_offer` and `brunch.elicitor_intent_hint` entries with the lens/routing metadata needed by downstream consumers; generative-lens proposals carry explicit grounding-bundle coverage plus `epistemic_status`, and only dry-run-valid proposals surface as reviewable review sets; an observer job can process a projected elicitation exchange and either write high-confidence graph changes or surface low-confidence suggestions/reconciliation work through the same executor; a reviewer job can process an accepted review set and surface advisory `reconciliation_need` findings (only) via the same executor; the `acceptReviewSet` command commits a generative-lens batch atomically as one LSN and one change-log entry; the initial POC reviewer trigger/scope policy is recorded in implementation docs/tests rather than left implicit; an architectural test or lint rule prevents direct DB access, caller-side authority bypass outside the command layer, and reviewer-attributed writes to anything other than `reconciliation_need`; the same change observed across TUI and (if M3 lands) web client; if the registry lands here, side-task-attributed writes follow the same command-executor path.
- **Verification:** Inner — verify gate plus graph-tool/observer/reviewer command shape tests, proposal-entry schema validation (`brunch.review_set_proposal` must declare `epistemic_status` and grounding coverage), establishment-offer / elicitor-intent-hint schema validation (must declare `lens`), and projection-helper tests for latest-offer lookup. Middle — `CommandExecutor` contract tests including `acceptReviewSet` discriminants and the rule that only dry-run-valid proposals become reviewable review sets, direct-DB no-bypass checks, observer-job idempotence/restart tests keyed by exchange range, reviewer-job restart/idempotence tests keyed by batch-acceptance entry id, reviewer-write-target architectural boundary test (rejects non-`reconciliation_need` targets), `acceptReviewSet` batch-atomicity property tests (one LSN / one change-log entry; partial-batch impossible under mid-batch validation failure), `supersedes`-chain acyclicity property tests, lens-routing correctness property tests, differential test comparing dry-run validation at proposal time vs real-run validation at acceptance, and cross-surface projection checks. Outer — kernel-card-output coverage assertions begin landing per brief; first generative-lens fixture (e.g. `propose-scenarios-with-tradeoffs`) replays through review cycle + acceptance; A14-L proposal structural-legality rate captured in fixture metadata as POC-phase fitness (not merge gate); 1–2 known-bad coherence-problem briefs exercise reviewer precision; side-task / observer / reviewer-attributed writes remain indistinguishable from other writes at the command-layer boundary except for attribution and reviewer's narrow target.
- **Cross-cutting obligations:** Preserve the single-authority mutation rule for primary-agent, observer, reviewer, side-task, and batch-acceptance flows by making the `CommandExecutor` the only mutation entry; observer and reviewer jobs are durable operational queue entries keyed to transcript anchors, not a revived chat/turn store or privileged write path for background work; reviewer is advisory and writes only to `reconciliation_need`; lens metadata on elicitor-emitted entries routes observer vs reviewer consumption; establishment offers remain orientation artifacts for chrome/web surfaces rather than a default exhaustive lens picker.
- **Traceability:** R10, R13, R17, R21, R22, R23 / D4-L, D13-L, D15-L, D18-L, D20-L, D25-L, D26-L, D27-L, D28-L, D29-L, D30-L, D32-L / I2-L, I11-L, I14-L, I15-L, I16-L, I17-L, I18-L, I20-L / A3-L, A11-L, A13-L, A14-L, A16-L
- **Design docs:** [prd.md §M5, §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md)

### authority-model

- **Name:** Authority model and gated tools (M6)
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Fill in the policy matrix behind the existing `CommandExecutor` result seam: three-tier policy (autonomous / requires-confirmation / human-only) implemented end-to-end; headless modes fail or delegate cleanly with structured `needs_human`; attribution + optimistic concurrency shared across all callers.
- **Acceptance:** Adversarial briefs requesting human-gated actions in print/RPC produce structured `needs_human` through the command result contract; an authority test matrix passes across all four modes; M6 does not introduce a second policy service or caller-side authority gate.
- **Verification:** Inner gate plus policy classifier/result-shape unit tests. Middle — authority matrix contract tests across TUI/web/print/RPC through the existing `CommandExecutor` result seam. Outer — adversarial fixture for structured `needs_human` regression.
- **Traceability:** R5, R6, R12 / D4-L, D20-L
- **Design docs:** [prd.md §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### turn-boundary-reconciliation

- **Name:** Detection, relevance, turn-boundary reconciliation (M7)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Graph-revision tracking; session interest sets; `worldUpdate` synthesised by `prepareNextTurn`; mention-ledger staleness hints; side-task-result and reviewer-finding drain at the same boundary; session/spec binding transitions — and any lens switches present by then — recompute interest set before next agent turn.
- **Acceptance:** Cross-session paired-brief fixture exercises `worldUpdate` filtering; mention-staleness hints synthesise when an entity changed since last snapshot; succeeded side-task results are delivered only at the next turn boundary; reviewer findings from earlier batch acceptances arrive as advisory `reconciliation_need` items at the same boundary, never mid-turn; session/spec binding transitions and any emitted `brunch.lens_switch` entries recompute interest sets.
- **Verification:** Inner gate plus mention-ledger/session-interest unit tests. Middle — generated LSN/change traces and property tests for I4-L, I5-L, I9-L, I12-L, I16-L; subscription/update ordering checks for turn-boundary messages including reviewer findings. Outer — paired-brief adversarial capture passes, including side-task delivery and reviewer-finding delivery when those subsystems are active.
- **Cross-cutting obligations:** This frontier is the rendezvous point for Brunch's shared next-turn event semantics: `worldUpdate`, side-task results, reviewer findings, lens changes, session/spec binding state, and mention staleness must coexist without inventing a second event plane.
- **Traceability:** R11, R13, R14, R18, R21 / D6-L, D11-L, D14-L, D15-L, D17-L, D29-L / I1-L, I4-L, I5-L, I9-L, I12-L, I16-L / A4-L, A9-L, A11-L, A16-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §5 Graph-entity mentions](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### coherence-first-class

- **Name:** Coherence as a first-class graph property (M8)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Structural legality enforced synchronously; semantic coherence stored as explicit product state; UI and agent read the same coherence verdict; before-images available where needed.
- **Acceptance:** "Contradictory requirements" adversarial brief produces an `incoherent` verdict with a backing open reconciliation need; coherence verdict surfaces in the TUI chrome and in `graph.*` reads.
- **Verification:** Inner gate plus structural validator tests. Middle — coherence-emission property tests proving backing reconciliation needs and projection/query visibility. Outer — adversarial fixture for contradictory requirements plus manual UI checklist for visible coherence verdict.
- **Cross-cutting obligations:** Coherence verdicts must remain visible through the same transcript/graph authority model that side tasks, elicitation exchanges, observer jobs, and reconciliation needs already use; this frontier must not hide coherence behind a private subsystem.
- **Traceability:** R12, R14 / D8-L / I6-L
- **Design docs:** [pi-seam-extensions.md §Reconciliation-need substrate](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### compaction-and-conflict-widening

- **Name:** Compaction-aware continuity and conflict widening (M9)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Compaction preserves graph and coherence anchors; interest sets can widen beyond direct reads when needed; conflict signaling remains intelligible at long horizons.
- **Acceptance:** Long-horizon adversarial brief (50+ turns) replays through compaction with `lastSeenLsn`, interest set, and session binding preserved; spec/session changes across compaction boundaries do not desync; active spec and any in-flight side-task, observer-job, reviewer-job, or lens bookkeeping remain intelligible after compaction; the latest `brunch.establishment_offer` entry remains reconstructable across compaction so ambient-affordance chrome continues to render the current offer.
- **Verification:** Inner gate plus continuity-metadata unit tests. Middle — compaction round-trip/property tests for `lastSeenLsn`, interest set, session binding, graph/coherence anchors, active side-task/observer/reviewer bookkeeping, and latest-establishment-offer reconstruction. Outer — long-horizon fixture passes, including continuity checks for side-task, interest-set, and establishment-offer state when present.
- **Cross-cutting obligations:** Preserve the coherence anchors, session binding, session continuity metadata, and side-task/observer/spec state that earlier milestones attached to the shared transcript/event substrate; preserve lens state only if a lens subsystem has landed by then.
- **Traceability:** R15 / D6-L, D15-L / I12-L
- **Design docs:** [prd.md §Continuity, Divergence, and Coherence](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### brief-library-curation

- **Name:** Curate the fixture brief library
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Author and review briefs #4–#7 plus the adversarial second tier per fixture-strategy. Outputs are JSON briefs and one or two reviewer notes.
- **Acceptance:** Briefs #1–#7 present in `.brunch-fixtures/briefs/`; adversarial briefs present with documented targets; expectations for brief #7 satisfied per fixture-strategy.
- **Verification:** Doc review against fixture-strategy expectations; schema/checker validation for brief JSON once available; spot-replay if the relevant harness milestone has landed.
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
- **Verification:** PR review on the doc plus cross-check that new/changed fixture assertions map to SPEC invariants or acknowledged blind spots; downstream fixture runs catch regressions.
- **Cross-cutting obligations:** Treat fixture strategy as canonical verification architecture that must stay in sync with SPEC/PLAN, not as optional commentary.
- **Traceability:** A5-L
- **Design docs:** [fixture-strategy.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/fixture-strategy.md)

### pi-ui-extension-patterns

- **Name:** Prove Pi extension patterns for Brunch UI affordances
- **Linear:** [FE-744](https://linear.app/hash/issue/FE-744/pi-ui-extension-patterns)
- **Branch:** `ln/fe-744-pi-ui-extension-patterns` (off `ln/fe-737-web-shell`, parallel to `ln/fe-741-graph-data-plane`)
- **Kind:** structural (spike-flavored)
- **Status:** in-progress (command-containment, dynamic chrome, workspace-switcher startup flow, in-session switch command, pty startup oracle, and evidence-memo reconciliation have landed; current missing seam is the offer-first custom UI loop)
- **Objective:** Demonstrate the Pi extension seams Brunch needs before M5/M6/M7 depend on them: product-named commands routed through Brunch handlers; effect blocking for unsupported branch/session flows; dynamic Brunch-owned chrome through one wrapper; Brunch-owned startup/session selection; and, now active, an offer-first interaction loop where a system/assistant-originated structured custom entry acts as the assistant turn, renders as transcript-visible state, replaces the default input surface with single-choice / multi-choice / optional-freeform custom UI, and persists the user's structured response as session truth.
- **Acceptance:** `docs/architecture/pi-ui-extension-patterns.md` catalogs the evidence with verdicts (`proven` / `feasible-with-cost` / `requires-pi-change` / `not-feasible`), distinguishes strict command suppression from lifecycle effect blocking, records the minimum upstream Pi command/keybinding policy ask, and captures the RPC degradation profile for chrome/custom UI. Brunch code exposes a product-named extension entrypoint plus wrappers for chrome, branch policy, session-boundary binding, and `/brunch-workspace`; the workspace switcher supports explicit continue/open-session/new-session/new-spec/cancel decisions without UI-owned session mutation; TUI startup runs a Brunch-owned pre-Pi gate before `InteractiveMode` so prior transcript rendering is opt-in rather than implicit; creating a new session lands in a binding-only session for the selected spec; chrome receives the activated session id instead of fabricating `unbound`; the startup no-resume pty oracle proves stale transcript text is absent before explicit activation. The remaining active acceptance is an offer-first custom UI proof: a transcript-native unresolved offer can replace ambient free input, collect single-choice / multi-choice / optional-freeform answers, persist a linked structured response entry, project as an elicitation exchange, and expose an RPC/fixture-controllable semantic response path even though TUI `ctx.ui.custom()` itself is not RPC-controllable.
- **Verification:** Inner — verify gate plus unit tests for any extension wrappers added; coordinator inventory/activation tests for switch decisions; source/contract tests that switcher UI returns decisions rather than mutating sessions. Middle — runbook oracles per affordance category (manual checklist + executable postcondition checker on chrome state, JSONL custom entries emitted, or command-result discriminants); contract tests for any new Brunch handler shape introduced (slash command router, modal request/response, picker selection); pty/ANSI-stripped startup oracle proving no prior transcript appears before an explicit resume/open decision. Outer — manual TUI walkthrough validating visual quality, full-screen startup feel, interaction feel, and controllability cost between scripted-driver and manual paths.
- **Cross-cutting obligations:** Preserve the linear-transcript invariant (`I19-L`) — affordance prototypes must not introduce branch creation, mid-turn state mutations outside the command layer, or a parallel chat/turn store. Preserve the workspace hierarchy and startup invariant (`R19` / `I22-L`): `.brunch/state.json` is default acceleration, not implicit resume; no prior transcript or agent loop may run before an explicit workspace-switch decision. Workspace switcher UI must remain pure decision rendering; `WorkspaceSessionCoordinator` owns inventory, activation, state writes, session creation/opening, and binding. Multi-choice affordances must integrate with the existing capture-aware offer envelope (`pi-seam-extensions.md §4`) and the structured elicitation-entry shape. Slash commands and action buttons must route writes through the `CommandExecutor`. Any new custom-entry kinds must declare `lens` per `I18-L` if elicitor-emitted. Establishment-offer affordances must stay orientation-first and user-invoked when expanded, rather than turning the full offer tree into a default next-action menu. TUI chrome/status affordances should call Brunch product wrappers rather than raw Pi `ctx.ui.*` primitives, and RPC fixtures should assert only chrome events that Pi actually emits (`setStatus`, string-array `setWidget`, `setTitle`, notifications).
- **Why now / unlocks:** Lens/review-set/reviewer UX in M5 and authority gating in M6 both assume Brunch can render rich interactive affordances over Pi without forking it. Proving the affordance set early de-risks those frontiers and lets the agent-as-user-driver extension question (controllability vs cost trade flagged in `ln-oracles` pass) be answered with evidence rather than estimation. Can run in parallel with `graph-data-plane` because TUI seams are independent of graph persistence.
- **Traceability:** R4, R14, R16, R17, R19, R20, R21 / D2-L, D11-L, D12-L, D13-L, D17-L, D19-L, D21-L, D22-L, D24-L, D25-L, D26-L, D27-L, D29-L, D32-L, D33-L, D34-L, D35-L, D36-L, D37-L / I10-L, I13-L, I18-L, I19-L, I22-L, I23-L / A10-L, A14-L, A17-L, A18-L
- **Design docs:** [pi-seam-extensions.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md), [pi-ui-extension-patterns.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-ui-extension-patterns.md), [pi-ui-extension-patterns-provisional-plan.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-ui-extension-patterns-provisional-plan.md), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md).
- **Current execution pointer:** Scope the offer-first custom UI loop. Use Pi's `question.ts` / `questionnaire.ts` examples and TUI editor-replacement docs as the implementation reference; prove transcript-native offer display, input replacement, response persistence, elicitation-exchange projection, and RPC/fixture semantic controllability before returning to `graph-data-plane`.

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

- 2026-05-22 `web-shell` — Done: M3 now serves the native React web shell over one persistent WebSocket RPC client, blocks/adjudicates branchy transcript shapes for session-consuming reads, serves only static HTTP assets (no REST product reads), projects explicit durable sessions through a canonical Brunch session-envelope reader, renders assistant/user/prompt transcript rows, and keeps browser state as a read-only client attachment rather than a durable session. Verified: `npm run verify` after each slice plus direct host/WebSocket smoke for static HTML, missing REST product reads, explicit `{ sessionId, specId }` projections, transcript display, and exchange projection. Accepted deferral: qualitative browser-open smoke remains environment-blocked by the current macOS sandbox.
- 2026-05-21 `jsonl-session-viability` — Done: Pi JSONL reload preserves coordinator-created binding-only sessions, first assistant/user flushes without duplicate prefixes, `/new` same-spec bindings, raw user/assistant payloads, representative Brunch custom entries, context-participating custom messages, continuity/compaction metadata, structured elicitation entries, defensive active-branch projection behavior, and M1 bundle-local replay parity for briefs #1–#3. Verified: `npm run verify` after each slice. Watch: M2 validates JSONL as sufficient for Brunch-supported linear sessions on current POC terms; branch-aware Brunch sessions are intentionally unsupported per D24-L, and later side-task, mention, and continuity frontiers still own their final payload semantics.
- 2026-05-21 `mode-shell-and-fixture-driver` — Done: print and RPC transport modes boot through the Brunch host; named `workspace.snapshot` and `session.elicitationExchanges` handlers project coordinator-selected session state; fixture capture copies the same selected Pi JSONL session projected by RPC; brief metadata is Brunch-owned and marks graph/coherence artifacts deferred; briefs #1–#3 have scripted deterministic replay bundles under `.brunch-fixtures/<brief-id>/scripted-001/`. Verified: `npm run verify`, RPC/print parity smoke, exchange projection tests, fixture replay/projection parity tests, `./runbooks/verify-m1.sh`, and human inspection that briefs/captures/product-shaped outputs are good on their current terms. Watch: M2 used these captured transcripts as JSONL reload evidence without turning them into a parallel chat/turn store; later elicitation work must revisit the encoded interaction logic, expectations, and knowledge-flow assumptions rather than treating the scripted M1 exchange shape as final product behavior.

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
   │      │      ├── web-shell  (M3, can run parallel after M2)
   │      │      │
   │      │      └── pi-ui-extension-patterns  (parallel after M2; informs M5/M6/M7)
   │      │
   │      └── brief-library-curation   (parallel after M0)
   │
   └── fixture-strategy-evolution     (continuous, doc-only)

(flue-pattern-adoption, framework-direction-stubs, geolog-and-petri-execution
 are horizon items; not on the active dependency spine.)
```
