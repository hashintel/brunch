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

Brunch-next is proceeding on the razed `next` line (tag `next-baseline`) as a thin product layer over `pi-coding-agent`. M0–M3 proved the basic host, JSONL transcript viability, probe/RPC substrate, and read-only web shell; detailed completed frontier definitions now live in `docs/archive/PLAN_HISTORY.md`. The remaining FE-744 work is Pi-wrapping closeout, not public-RPC substrate doubt: raw Pi RPC editor fallback, public Brunch JSON-RPC assistant-first structured-exchange permutation parity, web real-time observation of RPC-originated structured-exchange updates, private Brunch prompt-pack topology, and the Zod-authored structured-exchange details schema layer have landed. FE-744's visual chrome closeout has landed; strict command containment remains recorded as an A18-L residual Pi API risk requiring a Pi command/keybinding policy seam rather than more Brunch wrapper work. After FE-744, `sealed-pi-profile-runtime-state` must make the embedded Pi harness product-safe. In concrete terms, the sealed-profile/runtime-state frontier prevents ambient user/project `.pi/` settings or resources from shaping Brunch behavior, and persists the active operational mode, role preset/runtime bundle, strategy, and lens in the linear transcript so prompt/tool posture can be reconstructed at turn boundaries. The M4 graph data plane remains structurally next after those harness/control-plane risks are scoped.

### POC assumption pressure

The POC should maximize assumption falsification rather than merely implement milestone labels. Treat the table below as the live consequence map from SPEC assumptions to frontier pressure; when scoping a frontier, prefer the thinnest slice that can validate or falsify its assigned assumptions. Retired/validated assumptions A10-L and A23-L are now carried by the SPEC decision/invariant residues for chrome, structured exchange, and public RPC parity; FE-744's remaining residue is the still-open A18-L containment limitation, not missing chrome work.

| Assumption | Pressure / what could falsify it | Plan consequence |
| --- | --- | --- |
| A1-L Pi substrate seams | A needed host/session/RPC/extension seam cannot be expressed without forking Pi. | Mostly exercised by M0-M3; FE-744 and `sealed-pi-profile-runtime-state` close the remaining UI/profile seams before graph-agent work depends on them. |
| A3-L command layer sufficiency | Agent, UI, reviewer, or capture writes need shortcuts around one `CommandExecutor`. | `graph-data-plane`, `agent-graph-integration`, and `authority-model` must prove one command boundary for every write path. |
| A4-L global LSN adequacy | Replay, staleness, or reconciliation ordering needs per-entity/vector clocks. | `graph-data-plane` establishes one-LSN-per-transaction; `turn-boundary-reconciliation` tries to break it with cross-session traces. |
| A5-L probe/transcript driver quality | Agent-as-user probes fail to catch regressions or cannot produce reviewable transcript evidence for realistic Brunch seams. | FE-744 has proved a deterministic public-RPC structured-exchange permutation driver; future brief-based or generative golden runs must pass through the `.fixtures/runs/<probe-id>/<run-id>/` probe/transcript artifact path. |
| A6-L unified `graph.*` namespace | Intent/oracle/design/plan semantics become confusing or unsafe under one umbrella. | `graph-data-plane` and `agent-graph-integration` should start unified but watch for namespace pressure. |
| A7-L `framing_as` modality | Product framings need relation policies that base kinds cannot express. | M4 schema plus targeted probe scenarios exercise framing; promote only if probe evidence demands it. |
| A8-L reconciliation substrate | Gaps, contradictions, process debt, and conflicts need separate substrates immediately. | `graph-data-plane` builds the shared substrate; `coherence-first-class` and known-bad briefs test subtype pressure. |
| A9-L mention ledger granularity | Session-scoped snapshots miss necessary staleness or create noisy hints. | Defer until `turn-boundary-reconciliation`, after graph ids/LSNs exist. |
| A11-L next-turn delivery | Side-task/reviewer results require mid-turn delivery or another event plane. | Keep deferred until M5/M7 side-task/reviewer paths exist; test at turn-boundary rendezvous. |
| A13-L deferred observer/auditor queue | Async audit/backfill needs canonical chat/turn tables or privileged writes. | Not load-bearing after D18-L; defer until a backstop queue is actually introduced. |
| A14-L review-set structural legality | LLMs cannot produce dry-run-valid entity/edge drafts reliably enough. | M5 must measure structural-legality rate and retry/fallback behavior before depending on proposal-heavy UX. |
| A15-L establishment hints | Offers are not reconstructable or useful from transcript entries alone. | M5 establishment-offer probe runs and FE-744 chrome affordances exercise this. |
| A16-L reviewer trigger/scope | Reviewer findings are too slow, noisy, or incomplete under deferred policy. | Do not overbuild early; first accepted review-set probe runs should make reviewer policy empirical. |
| A17-L elicitation temperament preference | Users do not need persistent interrogative/proposal preference. | Outer-loop adoption signal only; do not block POC. |
| A18-L command containment | Hiding suggestions + lifecycle blocking leaves unsafe Pi built-ins reachable. | FE-744 product-shell evidence must name any Pi upstream seam before M5/M6 authority work relies on it. |
| A19-L sealed Pi profile | Ambient `.pi` settings/resources still shape Brunch product behavior. | `sealed-pi-profile-runtime-state` is a gate before graph tools and authority-sensitive agent work. |
| A20-L Drizzle 1.0 beta | Beta blocks migrations, SQLite fidelity, or TypeBox derivation. | `graph-data-plane` starts with a version/schema spike before broad imports. |
| A21-L bounded coherence | Contradiction/gap verdicts cannot represent useful coherence without broader judgment. | Keep implementation late (M8), but design known-bad probe scenarios earlier so the rubric is falsifiable. |
| A22-L synchronous elicitor capture | Elicitor over-captures, misses obvious facts, or cannot use preface to resolve uncertainty. | `agent-graph-integration` needs targeted capture probe runs before async observer backstops are reconsidered. |


## Sequencing

### Active

1. `pi-ui-extension-patterns` — FE-744 Pi-wrapping proof is closing: raw Pi RPC editor fallback, public Brunch JSON-RPC structured-exchange permutation parity, web real-time observation of RPC-originated structured-exchange updates, private prompt-pack topology, structured-exchange schema layer, and branded/themed chrome recovery have landed. Remaining work is PR/branch tie-off plus carrying A18-L strict command-containment risk forward to the sealed-profile/runtime-state or upstream-Pi seam, not more FE-744 implementation.

### Next

1. `sealed-pi-profile-runtime-state` — Seal Brunch's embedded Pi profile and transcript-backed runtime-bundle state before future agent-loop work depends on ambient-safe settings, prompt composition, or tool gating.
2. `graph-data-plane` — M4 remains structurally next after FE-744 chrome closeout and the sealed-profile/runtime-state follow-up are scoped; the public-RPC elicitation input loop is no longer the blocker.
3. `agent-graph-integration` — M5. Graph tools, synchronous elicitor capture, review-set acceptance, and reviewer advisory writes through pi extension seams; all writes via the shared command layer.

### Parallel / Low-conflict

- `probes-and-transcripts-evolution` — Harden the probe/transcript artifact path as new seams need evidence: report schemas, transcript renderers, targeted probe scenarios, and optional brief inputs that feed normal `.fixtures/runs/<probe-id>/<run-id>/` runs. Doc/test-heavy, but assumption-critical.
- `subagents-for-proposal-diversity` — Optional enhancement to candidate-proposal generation (D44-L). Lands when `agent-and-graph-integration` (M5) is far enough along that batch-proposal flow exists and would benefit from parallel data-gathering; never a blocker.

### Horizon

- `authority-model` — M6. Three-tier policy (autonomous / requires-confirmation / human-only) end-to-end across modes.
- `turn-boundary-reconciliation` — M7. Graph-revision tracking, session interest sets, `worldUpdate` injection, and the mention-staleness hint synthesiser.
- `coherence-first-class` — M8. Clarify the product meaning of coherence, then implement synchronous structural legality plus stored semantic coherence verdicts visible to UI and agent.
- `compaction-and-conflict-widening` — M9. Compaction preserves graph + coherence anchors; interest sets can widen; conflict signals remain intelligible at long horizons.
- `flue-pattern-adoption` — Sandbox abstraction (SessionEnv/SandboxApi style), remote-deploy shape, MCP adapter. Post-POC.
- `oracle-design-plan-graphs` — Lift oracle / design / plan planes from stub status to durable persistence + commands. Post-POC.
- `framework-direction-stubs` — Lightweight structural stubs for Context layer, capability tiers, candidate artefacts. Discretionary; only when downstream pressure makes a stub cheaper than a hole.
- `geolog-and-petri-execution` — Datalog-shaped intent store and petri-net plan execution. Exploratory; parallel to Brunch proper.

## Frontier Definitions

### sealed-pi-profile-runtime-state

- **Name:** Sealed Pi profile and transcript-backed runtime state
- **Linear:** unassigned
- **Kind:** structural hardening
- **Status:** not-started
- **Objective:** Turn the discussion-locked Brunch Pi Profile and runtime-bundle model into code/tests by porting the useful `.pi/` probe extensions into explicit Brunch-owned product modules under `src/tui-client/.pi/extensions/*` plus aggregate `src/tui-client/pi-extension-shell.ts`: Brunch-owned programmatic settings/resource/tool/prompt/keybinding policy isolates product behavior from ambient user/project `.pi/`; operational mode / role preset / strategy / lens state is appended to Pi JSONL as Brunch custom entries and reconstructed at turn boundaries.
- **Why now / unlocks:** FE-744 proved multiple Pi extension seams and exposed the exact weak point: ambient resource discovery is mostly disabled, but `SettingsManager.create(cwd, agentDir)` can still leak behavior-shaping settings, and future `elicit` vs `execute` work needs prompt/tool posture to be stateful without hidden extension memory. This frontier de-risks M5/M6/M7 before graph tools, capture/reviewer jobs, and authority gating depend on the embedded harness.
- **Acceptance:** A `BrunchPiProfile` (or equivalent module boundary) owns settings policy, resource-loader options, extension factories, keybinding/command policy, tool policy, and prompt policy; tests prove ambient context files/extensions/skills/prompt templates/themes do not load while explicit Brunch-owned extension-discovered resources can load intentionally through Pi `resources_discover`; settings that affect product behavior are overridden/sealed or documented as a Pi upstream seam; runtime extension factories now load explicitly from `src/tui-client/pi-extension-shell.ts` / `src/tui-client/.pi/extensions/*` and reusable TUI components under `src/tui-client/.pi/components/*`, with no root project-local Pi discovery path as product runtime. Full selected-state transcript entries under `brunch.agent_runtime_state` can be appended by Brunch helpers and replayed to reconstruct active operational mode, role preset/runtime bundle, strategy, and lens; turn prep composes prompt packs from base Brunch prompt + operational mode + role preset + strategy + lens + spec readiness grade + elicitation posture + current graph/coherence/world state + pending structured-interaction rules; `elicit` suppresses execute/dangerous tools such as raw `bash`/`write` unless explicitly allowed by the active bundle.
- **Verification:** Inner — profile/runtimestate unit tests, prompt-composition snapshot tests, and tool-policy contract tests. Middle — ambient `.pi/` fixture/audit tests proving disabled discovery and sealed settings; explicit Brunch resource-injection test proving extension factories may inject Brunch-owned skills/prompts despite ambient `noSkills`/`noPromptTemplates`; JSONL reload/projection tests for runtime init/switch entries; before-agent-start/tool-call policy tests for `elicit`. Outer — manual TUI/RPC smoke that active role/lens/strategy changes are inspectable in transcript and reflected in prompt/tool posture rather than hidden UI state.
- **Cross-cutting obligations:** Do not expose Pi's generic extension/skill/prompt/theme configuration to Brunch users; do not make Pi skills the primary authority for core operational prompts; keep raw Pi RPC behind Brunch adapters; keep runtime state linear-transcript-backed and compatible with compaction/session-boundary lifecycle hooks (`session_start`, `resources_discover`, `before_agent_start`, `context`, `tool_call`, `session_before_switch`, `session_before_compact`, `session_shutdown`).
- **Traceability:** R25, R26 / D2-L, D23-L, D39-L, D40-L / I24-L, I25-L / A19-L
- **Design docs:** [pi-seam-extensions.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md), [pi-ui-extension-patterns.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-ui-extension-patterns.md)
- **Current execution pointer:** the first profile-resource slice has landed a `src/brunch-pi-profile.ts` boundary used by TUI launch, preserving `noContextFiles`/`noExtensions`/`noPromptTemplates`/`noSkills`/`noThemes`, explicit Brunch extension factories, quiet startup, and offline default in one Brunch-owned seam. Next scope the settings policy seal: audit behavior-shaping `SettingsManager` reads (shell path/prefix, compaction/retry, image handling, keybindings if exposed), override what can be safely sealed, and record a Pi upstream seam for any remaining leakage. Follow-up slices should add any best-effort lifecycle-generated session display names over Pi `session_info` and tighten prompt/tool policy around transcript-backed runtime bundles.

### graph-data-plane

- **Name:** Graph data plane (intent-first, workspace-graph-ready) (M4)
- **Linear:** [FE-741](https://linear.app/hash/issue/FE-741/graph-data-plane-intent-first-workspace-graph-ready-m4)
- **Branch:** `ln/fe-741-graph-data-plane` (stacked on `ln/fe-737-web-shell`)
- **Kind:** structural
- **Status:** next / unblocked by FE-744 chrome recovery; paused until the sealed-profile/runtime-state follow-up is scoped
- **Objective:** Stand up SQLite-backed graph persistence; durable intent-plane nodes and edges; a single global LSN per commit; the change log; the reconciliation-need substrate; named homes for coherence state (verdicts and violations) — all forward-compatible with oracle, design, and plan planes.
- **Why now / unlocks:** Pins I1-L, I6-L. Unlocks all agent ↔ graph work (M5+) and lets oracle / design / plan planes be added later without re-foundation.
- **Acceptance:** Graph CRUD + change-log replay tests pass through the `CommandExecutor` public mutation boundary; command results already include success, `needs_human`, `policy_blocked`, `version_conflict`, and `structural_illegal` shapes even if pre-M6 policy classification is minimal; reconciliation-need substrate accepts inserts/updates/resolutions with LSN invariants enforced; oracle-plane stub tables exist (Check, Validation Method, Evidence, Obligation) even if unused; the persistence layer proves the one-transaction protocol that couples authority/result classification, version checks, structural validation, LSN allocation, change-log append, and any coherence updates.
- **Verification:** Inner gate plus command/result schema/type tests. Middle — property/model-based tests on LSN monotonicity, graph replay, reconciliation invariants, framing matrix, and `CommandExecutor` transaction/result behavior; architectural no-bypass tests. Outer — fixture property invariants on reconciliation-substrate begin running.
- **Cross-cutting obligations:** Establish the Drizzle + `better-sqlite3` persistence shape, `CommandExecutor` result contract, and no-bypass transaction rule as shared infrastructure for later direct-agent, elicitor-capture, deferred observer/auditor, side-task, migration, and UI-attributed writes. Derive row/insert/update runtime schemas from Drizzle table definitions via TypeBox (`drizzle-orm/typebox` if A20-L resolves to the Drizzle 1.0 beta line; standalone `drizzle-typebox` + `drizzle-orm/typebox-legacy` otherwise) — do not hand-author parallel row schemas. Land the I26-L grep-based architectural test alongside the first Drizzle import so the single-schema-vocabulary boundary stays enforced.
- **Traceability:** R7, R9, R13 / D3-L, D4-L, D6-L, D8-L, D9-L, D16-L, D20-L, D41-L / I1-L, I6-L, I7-L, I11-L, I26-L / A3-L, A4-L, A20-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [pi-seam-extensions.md §Graph clock, §Reconciliation-need substrate, §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)
- **Current execution pointer:** start by scoping the narrow `CommandExecutor` result contract and one-transaction LSN/change-log skeleton before widening CRUD or coherence homes. Pair the first slice with an A20-L spike (Drizzle 1.0 beta + `drizzle-orm/typebox` + `better-sqlite3` + Pi `registerTool` round-trip) so the version pin and schema-derivation path are settled before later slices import them broadly. Keep M4 thin enough to falsify A3-L/A4-L/A6-L/A8-L/A20-L before widening CRUD or coherence homes.

### agent-graph-integration

- **Name:** Agent ↔ graph integration through the shared command layer (M5)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Brunch installs graph tools through pi's extension seams; agent graph operations, elicitor post-exchange capture writes, reviewer-attributed advisory writes, review-set batch acceptances, spec readiness grade/posture updates, and the transcript-native establishment/intent-hint surfaces all route exclusively through the Brunch-owned command layer and shared event substrate; web, TUI, and agent all observe the same changes.
- **Acceptance:**

  ```text
  acceptance:
  ├── command-routing through CommandExecutor
  │   ├── agent CRUD on intent-plane nodes (create / update / link via Brunch tools)
  │   ├── elicitor capture (post-exchange, synchronous)
  │   ├── reviewer writes (target restricted to `reconciliation_need`)
  │   └── acceptReviewSet commits batch atomically (one LSN, one change-log entry)
  ├── exchange entries (custom)
  │   ├── brunch.establishment_offer       [must carry: lens/routing metadata]
  │   └── brunch.elicitor_intent_hint      [must carry: lens/routing metadata]
  ├── capture rules (post-exchange, synchronous)
  │   ├── high-confidence extractive facts → commit
  │   ├── readiness updates                → commit
  │   └── low-confidence implications      → stay in structured-exchange preface/question material
  ├── proposal rules
  │   ├── carry explicit support/grounding coverage
  │   ├── carry epistemic_status
  │   └── only dry-run-valid proposals surface as reviewable review sets
  ├── reviewer policy
  │   ├── advisory only (writes only `reconciliation_need`)
  │   └── initial POC reviewer trigger/scope policy recorded in implementation docs/tests (not implicit)
  ├── architectural invariants (lint or test)
  │   ├── no direct DB access
  │   ├── no caller-side authority bypass outside command layer
  │   └── reviewer cannot write anything other than `reconciliation_need`
  ├── cross-surface observability
  │   └── same change observed across TUI and web client
  └── async substrate (conditional)
      └── if observer/auditor queues land → backstops only, not primary capture freshness path
  ```
- **Implementation layout:** Put the Pi-facing adapter in one explicit product extension directory, `src/tui-client/.pi/extensions/graph/`, imported by `src/tui-client/pi-extension-shell.ts` as `registerBrunchGraph` rather than discovered dynamically. Use `graph/index.ts` only to register Pi tools, message renderers, and event hooks. Keep tool definitions in `graph/tools/*` (`read-graph`, `create-intent-node`, `update-intent-node`, `link-intent-nodes`, `accept-review-set`), boundary schemas in `graph/schemas/*` (`tool-inputs`, `tool-results`, `custom-entries`), transcript helpers in `graph/transcript/*` (`entries`, `projections`, `renderers`), synchronous capture in `graph/capture/post-exchange-capture.ts`, reviewer target enforcement in `graph/reviewer/reviewer-writes.ts`, and the Pi→CommandExecutor translation seam in `graph/command-adapter.ts`. The extension directory must not own SQLite/Drizzle persistence, LSN allocation, structural graph validators, reviewer-agent implementation, or capture model/prompt machinery; those are Brunch product/core modules passed into the extension through explicit shell options such as `{ graph: { commandExecutor, capturePostExchange?, reviewerWrites? } }`.
- **Verification:** Inner — verify gate plus graph-tool/capture/reviewer command shape tests, proposal-entry schema validation (`brunch.review_set_proposal` must declare `epistemic_status` and support/grounding coverage), establishment-offer / elicitor-intent-hint schema validation (must declare `lens`), structured-exchange `preface` contract tests, and projection-helper tests for latest-offer lookup. Middle — `CommandExecutor` contract tests including `acceptReviewSet` discriminants and the rule that only dry-run-valid proposals become reviewable review sets, direct-DB no-bypass checks, extension-layout/import-boundary tests proving `src/tui-client/.pi/extensions/graph/**` reaches graph mutation only through `command-adapter.ts` and never imports Drizzle/SQLite directly, post-exchange capture fixtures distinguishing committed facts from preface-only implications, reviewer-job restart/idempotence tests keyed by batch-acceptance entry id, reviewer-write-target architectural boundary test (rejects non-`reconciliation_need` targets), `acceptReviewSet` batch-atomicity property tests (one LSN / one change-log entry; partial-batch impossible under mid-batch validation failure), `supersedes`-chain acyclicity property tests, lens-routing correctness property tests, differential test comparing dry-run validation at proposal time vs real-run validation at acceptance, and cross-surface projection checks. Outer — kernel-card-output coverage assertions begin landing through targeted probe runs; first batch-proposal probe (e.g. `propose-scenarios-with-tradeoffs`) replays through review cycle + acceptance; A14-L proposal structural-legality rate captured in probe metadata as POC-phase fitness (not merge gate); 1–2 known-bad coherence-problem probe scenarios exercise reviewer precision; side-task / elicitor-capture / reviewer-attributed writes remain indistinguishable from other writes at the command-layer boundary except for attribution and reviewer's narrow target.
- **Cross-cutting obligations:** Preserve the single-authority mutation rule for primary-agent, elicitor-capture, reviewer, side-task, and batch-acceptance flows by making the `CommandExecutor` the only mutation entry; deferred observer/auditor jobs, if introduced, are operational backstops keyed to transcript anchors, not a revived chat/turn store or privileged primary extraction path; reviewer is advisory and writes only to `reconciliation_need`; lens metadata on elicitor-emitted entries routes capture/reviewer/future-auditor consumption; establishment offers remain orientation artifacts for chrome/web surfaces rather than a default exhaustive lens picker.
- **Traceability:** R10, R13, R17, R21, R22, R23 / D4-L, D13-L, D15-L, D18-L, D20-L, D25-L, D26-L, D27-L, D28-L, D29-L, D30-L, D32-L, D45-L, D46-L, D47-L, D50-L / I2-L, I11-L, I14-L, I15-L, I16-L, I17-L, I18-L, I20-L, I30-L, I31-L, I33-L / A3-L, A11-L, A13-L, A14-L, A16-L, A22-L
- **Design docs:** [prd.md §M5, §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md), [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md)
- **Current execution pointer:** before implementation, run oracle/scoping pressure on A14-L and A22-L: define the smallest replay/probe set that can reveal over-capture, missed obvious facts, dry-run-invalid review-set drafts, whether plain-prose `preface` is sufficient for low-confidence implications, and how any `capture_*` ANALYSIS entries will be compared against committed graph mutations.

### subagents-for-proposal-diversity

- **Name:** Subagents for candidate-proposal diversity (optional enhancement)
- **Linear:** unassigned
- **Kind:** optional enhancement
- **Status:** deferred (lands when `agent-and-graph-integration` is far enough along to benefit; never a blocker for M0–M9)
- **Objective:** Register a single `subagent` Pi tool per D44-L so the main agent can (a) fan out blocking data-gathering calls (scout / researcher / graph-reader) in parallel to ground proposals, then (b) fan out parallel `proposer` invocations to generate diverse candidate variants — the subagent realization of `ln-design`'s "design it twice" pattern and `ln-oracles`'s parallel-fan-out — and finally compose `brunch.review_set_proposal` entries from those variants via the D31-L meta-rubric. Subagent results return as tool content; no `CommandExecutor` access; no Brunch RPC access; isolated `pi --no-session --no-skills --no-extensions` subprocesses inheriting Brunch Pi Profile sealing.
- **Acceptance:** `subagent` tool registered with `{ agent, task }` and `{ tasks: [] }` parameters; starter agents scout/researcher/graph-reader/proposer land as markdown files with TypeBox-validated frontmatter under `src/tui-client/.pi/extensions/subagents/agents/`; proposer is system-prompt-only (no tools) and produces exactly one variant per invocation; argv shape per spawned subprocess includes `--no-session --no-skills --no-extensions` plus an explicit per-agent tool allowlist / model / system-prompt path; concurrency cap honored from [src/tui-client/.pi/extensions/subagents/config.json](file:///Users/lunelson/Code/hashintel/brunch-next/src/tui-client/.pi/extensions/subagents/config.json); subagents have no inherited conversation context so the task string must carry everything; result text returns as tool result content with no transcript side-effects; at least one batch-proposal probe exercises a `tasks: []` parallel `proposer` fan-out (≥ 2 variants) feeding a single `brunch.review_set_proposal` composed by the main agent via the D31-L meta-rubric.
- **Verification:** Inner — `subagent` tool argv-shape tests; TypeBox schema validation of agent frontmatter and `config.json`; per-starter-agent tool-allowlist conformance (proposer must have an empty tool set). Middle — isolation audit (no ambient `.pi/` resources reachable; parent `CommandExecutor` / Brunch RPC handlers absent from subprocess environment); subprocess streaming / abort propagation tests; parallel-fan-out independence test (two `proposer` invocations with distinct framings produce structurally distinct outputs). Outer — proposal-generation probe invokes scout/researcher/graph-reader to ground, then parallel `proposer` variants, and surfaces the composed review-set proposal with grounding-bundle coverage and `epistemic_status` consistent with the gathered evidence; meta-rubric application visible in the comparison rendering.
- **Cross-cutting obligations:** Preserve the single-authority mutation rule (`CommandExecutor` only — subagents never bypass it) and the sealed Pi Profile (no ambient `.pi/` leakage through the subprocess boundary). Cross-extension agent registration (Amos's `globalThis.__pi_subagents` bridge) is deferred because it conflicts with profile sealing; the POC registry is Brunch-owned only. Worker-style write-capable subagents are deferred until an execute operational mode exists.
- **Traceability:** R20 / D2-L, D26-L, D27-L, D30-L, D31-L, D39-L, D41-L, D44-L / I2-L, I11-L, I24-L, I29-L
- **Design docs:** [pi-seam-extensions.md §1 Async side-chain sub-agents](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md#1-async-side-chain-sub-agents), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md)

### authority-model

- **Name:** Authority model and gated tools (M6)
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Fill in the policy matrix behind the existing `CommandExecutor` result seam: three-tier policy (autonomous / requires-confirmation / human-only) implemented end-to-end; headless modes fail or delegate cleanly with structured `needs_human`; attribution + optimistic concurrency shared across all callers.
- **Acceptance:** Adversarial briefs requesting human-gated actions in print/RPC produce structured `needs_human` through the command result contract; an authority test matrix passes across all four modes; M6 does not introduce a second policy service or caller-side authority gate.
- **Verification:** Inner gate plus policy classifier/result-shape unit tests. Middle — authority matrix contract tests across TUI/web/print/RPC through the existing `CommandExecutor` result seam. Outer — adversarial probe for structured `needs_human` regression.
- **Traceability:** R5, R6, R12 / D4-L, D20-L
- **Design docs:** [prd.md §Authority Model](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### turn-boundary-reconciliation

- **Name:** Detection, relevance, turn-boundary reconciliation (M7)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Graph-revision tracking; session interest sets; `worldUpdate` synthesised by `prepareNextTurn`; mention-ledger staleness hints; side-task-result and reviewer-finding drain at the same boundary; session/spec binding transitions — and any lens switches present by then — recompute interest set before next agent turn.
- **Acceptance:** Cross-session paired probe exercises `worldUpdate` filtering; mention-staleness hints synthesise when an entity changed since last snapshot; succeeded side-task results are delivered only at the next turn boundary; reviewer findings from earlier batch acceptances arrive as advisory `reconciliation_need` items at the same boundary, never mid-turn; session/spec binding transitions and any emitted `brunch.lens_switch` entries recompute interest sets.
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
- **Verification:** Inner gate plus structural validator tests. Middle — coherence-emission property tests proving backing reconciliation needs and projection/query visibility. Outer — adversarial probe for contradictory requirements plus manual UI checklist for visible coherence verdict.
- **Cross-cutting obligations:** Coherence verdicts must remain visible through the same transcript/graph authority model that side tasks, elicitation exchanges, deferred audit/reviewer jobs, and reconciliation needs already use; this frontier must not hide coherence behind a private subsystem.
- **Traceability:** R12, R14 / D8-L / I6-L
- **Design docs:** [pi-seam-extensions.md §Reconciliation-need substrate](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md)

### compaction-and-conflict-widening

- **Name:** Compaction-aware continuity and conflict widening (M9)
- **Linear:** unassigned
- **Kind:** structural
- **Status:** not-started
- **Objective:** Compaction preserves graph, coherence, and continuity anchors per D43-L; interest sets can widen beyond direct reads when needed; conflict signaling remains intelligible at long horizons.
- **Acceptance:** Long-horizon adversarial brief (50+ turns) replays through compaction with `lastSeenLsn`, interest set, and session binding preserved; spec/session changes across compaction boundaries do not desync; the auto-compaction extension renders the configured preserved-anchor set byte-stable so active spec, in-flight side-task / deferred-auditor-job / reviewer-job bookkeeping, latest `brunch.agent_runtime_state`, latest `brunch.establishment_offer`, latest `brunch.lens_switch`, unresolved staleness hints, and active review-set leaves remain intelligible after compaction; ambient-affordance chrome continues to render the current offer; auto-compaction failure falls through to Pi default compaction rather than dropping anchors silently.
- **Verification:** Inner gate plus continuity-metadata unit tests and TypeBox schema validation of [src/tui-client/.pi/extensions/auto-compaction-anchors.json](file:///Users/lunelson/Code/hashintel/brunch-next/src/tui-client/.pi/extensions/auto-compaction-anchors.json). Middle — compaction round-trip/property tests for `lastSeenLsn`, interest set, session binding, graph/coherence anchors, active side-task/deferred-auditor/reviewer bookkeeping, latest-establishment-offer/lens/runtime-state reconstruction; deterministic anchor-rendering tests (same branch + same config → same header bytes); fallback-to-Pi-default behavior under simulated auth failure, empty LLM output, and thrown error. Outer — long-horizon probe passes, including continuity checks for side-task, interest-set, runtime-state, and establishment-offer state when present.
- **Cross-cutting obligations:** Preserve the coherence anchors, session binding, session continuity metadata, and side-task/deferred-auditor/spec state that earlier milestones attached to the shared transcript/event substrate; preserve lens state only if a lens subsystem has landed by then. The auto-compaction extension is the canonical owner of `session_before_compact`; product code paths that touch compaction must compose with it rather than register a parallel hook.
- **Traceability:** R15 / D6-L, D15-L, D43-L / I12-L, I28-L
- **Design docs:** [prd.md §Continuity, Divergence, and Coherence](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/prd.md)

### probes-and-transcripts-evolution

- **Name:** Evolve probe/transcript strategy as captures land
- **Linear:** unassigned
- **Kind:** hardening
- **Status:** not-started
- **Objective:** Keep the current probe/transcript substrate honest as new seams need evidence: report envelopes, Brunch-semantic transcript rendering, artifact layout, targeted probe scenarios, optional brief inputs, agent-as-user evaluator shape (mission/intention, evaluation focus, max-turn budget, blocker/friction report), and per-assumption fitness notes as real probe runs expose gaps.
- **Acceptance:** Each assumption-heavy frontier either lands a transcript-backed probe run under `.fixtures/runs/<probe-id>/<run-id>/`, extends the probe/report/transcript contract, or explicitly records "no probe change needed" for the assumptions it touched. Optional brief-shaped inputs may be added only as inputs to concrete probe runs, not as a standalone library obligation.
- **Verification:** PR review on the doc plus cross-check that new/changed probe assertions map to SPEC assumptions/invariants or acknowledged blind spots; downstream probe runs catch regressions and surface assumption fitness rather than only pass/fail.
- **Cross-cutting obligations:** Treat probe/transcript strategy as canonical verification architecture that must stay in sync with SPEC/PLAN, not as optional commentary. If an assumption is not being tested by its assigned frontier, PLAN should say whether it is deferred, accepted as risk, or needs a spike/oracle pass.
- **Traceability:** A5-L
- **Design docs:** [probes-and-transcripts.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/probes-and-transcripts.md)

### pi-ui-extension-patterns

- **Name:** Prove Pi extension patterns for Brunch UI affordances
- **Linear:** [FE-744](https://linear.app/hash/issue/FE-744/pi-ui-extension-patterns)
- **Branch:** `ln/fe-744-pi-ui-extension-patterns` (off `ln/fe-737-web-shell`, parallel to `ln/fe-741-graph-data-plane`)
- **Kind:** structural (spike-flavored)
- **Status:** implementation-complete / tie-off (command-containment, dynamic chrome semantics, hierarchical spec/session picker startup + in-session flow, RPC/headless initial-selection contract, pty startup oracle, centered branded overlay reuse, evidence-memo reconciliation, structured-exchange schema/builder, TUI/editor adapters, live Pi RPC editor fallback, response-side projection, option-selection comments, structured-exchange editor fallback, raw Pi RPC structured-exchange evaluator proof, discoverable structured-exchange extension source at `src/tui-client/.pi/extensions/structured-exchange/index.ts`, public Brunch RPC structured-exchange tuple parity through the current deterministic permutation set, parity hardening for distinct exchange ids, terminal non-answered statuses, option content/rationale, no repeated deterministic prompts, committed `.fixtures` public-RPC parity probe artifacts, web real-time observation of RPC-originated structured-exchange transcript updates, private code-composed Brunch prompt-pack topology under `src/tui-client/.pi/context/`, the Zod-authored structured-exchange schema layer under `src/tui-client/.pi/extensions/structured-exchange/schemas/`, shared Brunch identity primitives, branded persistent chrome, and Brunch-host branded startup pty evidence have landed. Strict built-in command suppression remains an A18-L Pi API residue.)
- **Objective:** Demonstrate the Pi extension seams and Brunch product RPC seams needed before M5/M6/M7 depend on them: product-named commands routed through Brunch handlers; effect blocking for unsupported branch/session flows; dynamic Brunch-owned chrome through one wrapper; Brunch-owned startup/session selection; structured elicitation where system/assistant-originated questions use Pi transcript truth and TUI/RPC adapters; and, now active, a public Brunch JSON-RPC structured-exchange loop where an agent-as-user discovers methods, activates workspace/spec/session, starts/resumes assistant-first elicitation, answers pending structured exchanges through Brunch methods, and leaves transcript/projection evidence for current exchange permutations comparable to a TUI session.
- **Acceptance:** `docs/architecture/pi-ui-extension-patterns.md` catalogs the evidence with verdicts (`proven` / `feasible-with-cost` / `requires-pi-change` / `not-feasible`), distinguishes strict command suppression from lifecycle effect blocking, records the minimum upstream Pi command/keybinding policy ask, and captures the RPC degradation profile for chrome/custom UI. Brunch code exposes a product-named extension entrypoint plus wrappers for chrome, command policy, session lifecycle binding, and `/brunch`; the centered spec/session picker supports an optional continue-last fast path plus hierarchical create-spec/resume-spec/create-session/resume-session decisions without UI-owned session mutation and is shared by startup plus in-session adapters; TUI startup runs a Brunch-owned pre-Pi gate before `InteractiveMode` so prior transcript rendering is opt-in rather than implicit; creating a new session lands in a binding-only session for the selected spec; chrome receives the activated session id instead of fabricating `unbound`; the startup no-resume pty oracle proves stale transcript text is absent before explicit activation. Public RPC structured-exchange parity is now covered: `rpc.discover` describes the supported Brunch JSON-RPC surface with method descriptions, param/result schemas, and examples; `workspace.selectionState` / `workspace.activate` let the driver enter a new workspace→spec→session without invoking TUI picker code; `session.startElicitation`, `session.pendingExchange`, and `elicitation.respond` expose an assistant-first pending-exchange lifecycle over Brunch methods, not raw Pi commands; the deterministic agent-as-user driver answers the current structured-exchange permutations through Brunch JSON-RPC only and reports blockers/frictions; the resulting Pi JSONL plus `session.transcriptDisplay` and `session.elicitationExchanges` projections preserve prompt/question/option content/rationale/answer/comment/mode/status artifacts at TUI-comparable quality. Web clients now receive real-time product update notifications for RPC-originated structured-exchange mutations and refetch canonical projection handlers rather than reading from a parallel view store. Branded/themed chrome has been recovered through shared identity primitives, persistent chrome wrapper updates, and a Brunch-host branded startup pty oracle; persistent activated chrome has only qualitative manual-polish debt remaining.
- **Verification:** Inner — verify gate plus unit tests for any extension wrappers added; coordinator inventory/activation tests for switch decisions; source/contract tests that switcher UI returns decisions rather than mutating sessions; schema tests for structured question result details and JSON-editor request/response parsing. Middle — probe oracles per affordance category (manual checklist + executable postcondition checker on chrome state, JSONL tool results/custom entries emitted, or command-result discriminants); contract tests for Brunch handler shapes (`rpc.discover`, picker selection, elicitation start/pending/respond relay, transcript projections); pty/ANSI-stripped startup oracle proving no prior transcript appears before an explicit resume/open decision; raw Pi RPC probe demonstrating `ctx.ui.editor` JSON fallback round-trips through the documented extension UI protocol as supporting evidence only; scripted TUI demo covering all supported structured-exchange permutations; deterministic public Brunch RPC agent-as-user parity probe where the evaluator has a mission/intention, critical UX or feature-evaluation focus, permutation-bounded turn budget, and blocker/friction report; parity oracle over the saved Pi JSONL plus transcript/exchange projections, including no repeated deterministic prompts; web real-time update smoke proving browser state changes when selected session/exchange state changes via RPC-originated structured-exchange mutations; TUI-originated observation remains covered only if it reuses the same product invalidation path. Outer — manual TUI walkthrough validating visual quality, full-screen startup feel, interaction feel, and controllability cost between scripted-driver and manual paths.
- **Cross-cutting obligations:** Preserve the linear-transcript invariant (`I19-L`) — affordance prototypes must not introduce branch creation, mid-turn state mutations outside the command layer, or a parallel chat/turn store. Preserve the workspace hierarchy and startup invariant (`R19` / `I22-L`): the workspace is the cwd, not a user-created selectable object; `.brunch/state.json` is default acceleration, not implicit resume; no prior transcript or agent loop may run before an explicit spec/session activation decision. Spec/session picker UI must remain pure decision rendering; `WorkspaceSessionCoordinator` owns inventory, activation, state writes, session creation/opening, and binding. RPC/headless startup must expose structured initial-selection state/results, not invoke the TUI picker. Structured-exchange affordances must use Pi transcript truth first: `toolResult.details` may be the canonical structured response payload, including optional user `comment` fields for option-selection exchanges, while assistant tool-call args are positional/causal context. Slash commands and action buttons must route writes through the `CommandExecutor`; the JSON-editor RPC fallback is an adapter over Pi's supported extension UI protocol, not a new public Pi command family and not a bypass around Brunch's product RPC surface. Public agent-as-user probes must speak Brunch JSON-RPC (`rpc.discover`, `workspace.*`, `session.*`, `elicitation.*`) and may delegate to Pi RPC only behind Brunch adapters. Any new custom-entry kinds must declare `lens` per `I18-L` if elicitor-emitted. Establishment-offer affordances must stay orientation-first and user-invoked when expanded, rather than turning the full offer tree into a default next-action menu. TUI chrome/status affordances should call Brunch product wrappers rather than raw Pi `ctx.ui.*` primitives; the chrome wrapper must not publish its own `brunch.chrome` status key, and RPC fixtures should assert only chrome events that Pi actually emits for the current wrapper (diagnostic string-array `setWidget`, `setTitle`, notifications, and any future explicit status adapter rather than TUI-only header/footer).
- **Why now / unlocks:** Lens/review-set/reviewer UX in M5 and authority gating in M6 both assume Brunch can render rich interactive affordances over Pi without forking it. Proving the affordance set early de-risks those frontiers and lets the agent-as-user-driver extension question (controllability vs cost trade flagged in `ln-oracles` pass) be answered with evidence rather than estimation. Can run in parallel with `graph-data-plane` because TUI seams are independent of graph persistence.
- **Traceability:** R4, R14, R16, R17, R19, R20, R21, R24, R27, R28 / D2-L, D5-L, D11-L, D12-L, D13-L, D17-L, D19-L, D21-L, D22-L, D24-L, D25-L, D26-L, D27-L, D29-L, D32-L, D33-L, D34-L, D35-L, D36-L, D37-L, D38-L, D39-L, D40-L, D41-L, D48-L, D49-L, D50-L / I10-L, I13-L, I18-L, I19-L, I22-L, I23-L, I24-L, I25-L, I26-L, I32-L, I33-L / A14-L, A17-L, A18-L, A19-L
- **Design docs:** [pi-seam-extensions.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-seam-extensions.md), [pi-ui-extension-patterns.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/architecture/pi-ui-extension-patterns.md), [ELICITATION_LENSES.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/ELICITATION_LENSES.md), [REVIEW_SETS.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/REVIEW_SETS.md).
- **Current execution pointer:** FE-744 has landed the public-RPC structured-exchange parity spine and its hardening: `rpc.discover` lists the current Brunch methods; activated sessions can start/resume deterministic `present_*` pending exchanges; `elicitation.respond` appends matching `request_answer`, `request_choice`, or `request_choices` toolResult evidence; `session.pendingExchange`, `session.elicitationExchanges`, and `session.transcriptDisplay` project tuple-shaped Pi JSONL; `src/probes/public-rpc-parity-proof.ts` drives the deterministic permutation set through public Brunch JSON-RPC only; and the committed run under `.fixtures/runs/public-rpc-parity/2026-05-29-public-rpc-parity/` carries `session.jsonl`, rendered `transcript.md`, and `report.json`. The structured-exchange UI extension has been remodeled into sequential `present_*` / `request_*` tools under `src/tui-client/.pi/extensions/structured-exchange/`: `present_question`, `present_options`, `request_answer`, `request_choice`, and `request_choices` are registered; review/candidate tools remain named stubs and intentionally unregistered, while future `capture_*` tools are specified as transcript-native ANALYSIS toolResults. The Zod-authored schema layer under `src/tui-client/.pi/extensions/structured-exchange/schemas/` now captures the target present/request/capture details contract (`schema` + `v`, `exchange_id`, `tool_meta`, `comment`/`message`, candidate rubrics/graph refs, and minimal no-graph capture details) with parse and JSON Schema export tests; runtime tools and projections still use the existing tuple details model until a later migration slice deliberately rewires them to those exports. Pi can auto-discover the extension when launched from `src/tui-client` for `/reload`-based iteration, while production imports it explicitly through `src/tui-client/pi-extension-shell.ts`; keep tests under `src/tui-client/.pi/__tests__/`, not in auto-discovered `.pi/extensions` or `.pi/components` resource directories. The Brunch extension shell is explicit again, and Brunch product prompting now has a private prompt-pack/context topology at `src/tui-client/.pi/context/`; do not expose these packs through Pi `resources_discover`/`promptPaths`. Next build: scope `sealed-pi-profile-runtime-state`; do not return to `graph-data-plane` until the sealed-profile/runtime-state follow-up is scoped. A18-L strict command-containment is accepted as a residual Pi API risk unless that follow-up explicitly routes a narrow upstream/API ask. Run a separate `ln-design` pass before expanding capture-analysis payloads, shared transcript component subparts, or the runtime migration from tuple details to the new Zod exports.

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
- 2026-05-21 `jsonl-session-viability` — Done: Pi JSONL reload preserves coordinator-created binding-only sessions, first assistant/user flushes without duplicate prefixes, `/new` same-spec bindings, raw user/assistant payloads, representative Brunch custom entries, context-participating custom messages, continuity/compaction metadata, structured elicitation entries, defensive active-branch projection behavior, and M1 bundle-local replay parity for the now-retired scripted brief captures. Verified at the time with `npm run verify` after each slice; scripted captures were later deleted when tuple-shaped structured-exchange probes superseded the lightweight prompt/response fixture shape. Watch: M2 validates JSONL as sufficient for Brunch-supported linear sessions on current POC terms; branch-aware Brunch sessions are intentionally unsupported per D24-L, and later side-task, mention, and continuity frontiers still own their final payload semantics.
- 2026-05-21 `mode-shell-and-fixture-driver` — Done: print and RPC transport modes boot through the Brunch host; named `workspace.snapshot` and `session.elicitationExchanges` handlers project coordinator-selected session state; the first capture path copied the same selected Pi JSONL session projected by RPC and produced scripted brief captures. Those M1 artifacts and their milestone probe script are now retired: FE-744 tuple-shaped public-RPC probe artifacts are the current probe/transcript evidence. Historical verification included `npm run verify`, RPC/print parity smoke, exchange projection tests, fixture replay/projection parity tests, and human inspection.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
nodes:
  pi-ui-extension-patterns          [in-progress]
  sealed-pi-profile-runtime-state   [not-started]
  graph-data-plane                  [paused]
  agent-graph-integration           [not-started]
  subagents-for-proposal-diversity  [deferred]
  authority-model                   [not-started]
  turn-boundary-reconciliation      [not-started]
  coherence-first-class             [not-started]
  compaction-and-conflict-widening  [not-started]
  probes-and-transcripts-evolution  [continuous, parallel]

edges:
  pi-ui-extension-patterns         -[hard]->         sealed-pi-profile-runtime-state
  sealed-pi-profile-runtime-state  -[hard]->         graph-data-plane
  graph-data-plane                 -[hard]->         agent-graph-integration
  agent-graph-integration          -[hard]->         authority-model
  agent-graph-integration          -[hard]->         turn-boundary-reconciliation
  agent-graph-integration          -[optional]->     subagents-for-proposal-diversity
  turn-boundary-reconciliation     -[hard]->         coherence-first-class
  coherence-first-class            -[hard]->         compaction-and-conflict-widening
  graph-data-plane                 -[on promotion]-> oracle-design-plan-graphs

groups:
  unconnected:
    flue-pattern-adoption
    oracle-design-plan-graphs
    framework-direction-stubs
    geolog-and-petri-execution

notes:
  - probes-and-transcripts-evolution runs in parallel across all frontiers; not a spine edge.
  - unconnected items are horizon work; surfaced for acknowledgment, not active dependency.
  - the m5 -> subagents edge is `optional` — subagents is never a blocker for the spine.
```
