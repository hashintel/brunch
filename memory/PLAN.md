<!-- PLAN.md — single source of truth for WHAT'S NEXT.
     Created by ln-plan · Read by all skills · Updated by ln-build, ln-sync, and ln-spike.
     Authority: active frontier, near-horizon ordering, and dependencies that still matter.

     Frontier item = canonical plan/Linear/branch unit.
     Slice = scoped execution unit from ln-scope/ln-build, often inside one frontier.

     Keep this file light. Archive older completed work to docs/archive/PLAN_HISTORY.md.
     Edit Sequencing for ordering/status churn; keep Frontier Definitions relatively stable.
     Do not spread retired work history across handoff files, refactor plans, or ad hoc status notes. -->

# Plan

## Context

Brunch-next has delivered the original composition spine: the host, sealed Pi profile, transcript substrate, SQLite graph plane, public RPC, TUI/web observer shape, generalized capture, review-set commitment path, and public-entry ship gate all have evidence. Capability work routes through the code-owned first-level skill manifest and activity-named skill homes (the strategy/lens/method runtime trees are retired, D98-L).

**Ship gate (2026-07-03 grill) — nearly closed.** The shippable cut: working e2e flows and throughlines, clean simple invariants, complete contracts — minimal and pragmatic within those constraints, enhancements deferred. Four of the five gate frontiers are done and merged; all remaining gate evidence rides `walkthrough-remediation-2` (FE-1187), which absorbed FE-1167 and is the closing member of arc `deterministic-orientation`. The grill's settled calls live as decisions: two operational modes only (D98-L), concentric authority as a code contract (D40-L), generative flows offered at deterministic junctures (D109-L). Standing obligation while the gate is open: gate frontiers chart their decision flows (all paths and endpoints) at `ln-scope` time.

**Current closure lane.** FE-1187 is the sole remaining ship-gate frontier. The digest-questionnaire carrier and atomic local/RPC review settlement are built; next is compact proposition-first review presentation, including the reassigned `transcript-ledger-rendering` work so durable user choices and their visual treatment land together. The consolidated outer checkpoint remains paused until R6/R8–R10/R12/R13 have owned dispositions. Execute evidence O7–O9 belongs to the KA stream; FE-1187 coordinates but does not own it.

**Parallel lanes.** Group 3 agent-layer work is pickup-ready. `interactive-tui-driver` is an independent tooling tracer that can run in a separate worktree: it will settle one canonical agent-driven TUI testing workflow without entering product runtime. `graph-assurance-conduct` is a separate earned-posture closure frontier for the D131-L prompt/skill semantic sweep; FE-1187 retains only the concern-grouped review renderer. The KA stream owns executor/orchestrator/Execute-mode work and the live Petri sequence from FE-1192 attempts through isolation/fan-in, epic integration, and durable parallel authority. Far-horizon instrumentation and consequential-fact evaluation remain trigger-gated under Later.

**Current seams.** Brunch ships on the `1.0.0-alpha.x` line. One-shot `ask` is the only interactive structured-exchange terminal; D125-L's live ask registry provides headless discovery/answering, while the transcript-backed pending projection remains a compatibility surface for live offer tools after the legacy `present_question` pending branch retired. Sweep classification remains fail-closed and compile-time anchored to the exchange-schema terminal names (D117-L), while the larger capture-conditional watermark question remains A40-L.

**Host-landing admission (2026-07-14).** An `ln-review` pass over the landing path proved host promotion structurally broken across both modes: a run's result is inherently multi-commit (one integration commit per slice), but `execute_host_promotion_apply` diffs only `promotionCommitSha^..promotionCommitSha` and patches it onto the host — a clean integrated run lands nothing, or only incidental final-commit artifacts. The FE-1199 `empty_dir`/non-git residue was the narrow symptom. A four-design `ln-design` pass (minimal squash / strategy planner / `main` prior-art port / pull-based) settled a synthesis: `host-landing` (FE-1201, definition below) replaces patch apply with mode-aware ref/tree landing behind a `GitHostLandPort`, a durable `runBaseSha`, mode-derived substrate, and `/brunch:land` confirm-gated acceptance.

**Topology and evidence discipline.** Co-located `src/**/TOPOLOGY.md` files own current topology; SPEC owns product contract and seam decisions; PLAN owns only rolling frontier state. Scratch probe artifacts are not durable evidence until promoted to `.fixtures/runs/`. Older completion history lives only in [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md).

**Standalone web — arc collapsed into one branch (2026-07-14).** Interactive web is a priority product surface, not a read-only TUI sidecar. D127-L/D128-L settle one cwd-scoped combined host with a target-addressed inventory of sealed in-process Pi sessions, one driver/many observers per session, JSONL-derived hydration plus live-event overlay, and shared semantic presentation projections with separate TUI/React renderers. The one-target tracer landed and was accepted (retiring A43-L), and the production-host two-session differential validated concurrent isolation (retiring A42-L). By user decision the former three-frontier `standalone-web` arc is now carried by the single frontier `standalone-web-session-host` (FE-1200) as a slice sequence on `ln/fe-1200-web-session`: tracer (done) → concurrency (done) → presentation-coverage sweep (next; retires I65-L breadth). Design authority: [`docs/design/WEB_UI_ARCHITECTURE.md`](../docs/design/WEB_UI_ARCHITECTURE.md).

## Initiatives

<!-- Initiative (arc) = a multi-frontier architectural through-line. This is NOT a tracker/branch
     altitude — frontiers stay flat (one Linear issue + branch each) per AGENTS.md. The arc index is
     a legibility + completability layer only: it names the through-line so "was this captured
     thoroughly?" is a lookup, not a reconstruction from scattered SPEC decisions.
     Created/updated by ln-plan; closed and reconciled by ln-sync. Keep each arc thin (goals,
     members, done-definition, anchors). An arc closes only when its done-definition holds —
     including reconciliation of co-located topology files and discharge of any standing-obligation
     residue scoped to it. Arc completion is the trigger for residue that no future frontier touches. -->

### Closed arcs

- **elicitor-capability-spine** — ✓ done. `capture` / `generate` / `project` built over the capability spine without reviving retired runtime axes. Anchors: D95-L, D96-L, D100-L; I51-L.
- **exchange-presentation** — ✓ done 2026-07-06 (`exchange-rendering` + `exchange-answering-chrome`). Durable truth: D104-L/D108-L, `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`, exchange topology homes. Deferred, not owed: per-item review commentary (Horizon). Full closure record: `docs/archive/PLAN_HISTORY.md`.
- **capture-ingest-throughline** — ✓ done 2026-07-06 (`exchange-capture-contract` + `present-digest`). Durable truth: I57-L, D110-L, ingest/map conduct homes. Full closure record: `docs/archive/PLAN_HISTORY.md`.

<!-- standalone-web arc dissolved 2026-07-14 (user decision): the through-line is now carried by
     the single frontier standalone-web-session-host (FE-1200) as a tracer→concurrency→presentation
     slice sequence on one branch. A single-frontier effort does not warrant an arc index; the arc
     done-definition now lives in that frontier's definition below. -->

### deterministic-orientation — ◐ active

- **Goal:** users choose how to operate at every settle-point, deterministically — no model volition, no mode ping-pong. The mechanism (settled 2026-07-03): product-owned `ctx.ui.select` dialogs record `brunch.session_orientation` entries that feed kick composition. Entry boot rides the Brunch orientation extension's `session_start(startup)` handler because Pi binds extension UI before emitting that event; mid-session junctures use Pi events/commands (`session_start` for post-switch `new`/`resume`, `session_tree`, detectable abort settle, mode switch, `/consult`) where the UI exists. No-UI print/json modes synthesize no orientation entry and follow the default kick path. Mid-session discretionary consults stay ordinary exchange tuples; `/consult` forces the dialog. Two modes only (`specify` / Specify and `execute` / Execute, D98-L); concentric authority becomes a code contract; generative flows are menu-routed to the existing `propose`/`project`/`elicit`/`ingest` skills.
- **Members:**
  - `session-entry-orientation` — ✓ built + merged (#289, 2026-07-08); its remaining LN outer evidence now rides FE-1187.
  - `execute-entry-readiness` — ✓ built + merged (#290, 2026-07-08); its remaining Execute evidence + the two deferred orientation-choice questions live in the KA stream's carved sub-list.
  - `walkthrough-remediation-2` (FE-1187, definition below) — the arc's remaining/closing member since 2026-07-13, when it absorbed `walkthrough-evidence-batch` (FE-1167): one witnessed e2e run per generative flow, menu→conduct routing evidence; the thin/rich Execute beats carve to the KA sub-list but remain part of the arc's done-definition.
- **Done-definition:** dialog fires on every named UI-capable juncture in TUI and RPC modes (extension-UI sub-protocol relay confirmed); escape/timeout resolves to the inert `dismissed` — entry recorded, no kick, so the menu is never a wall and esc always means "wait for me" (2026-07-06 revision, supersedes the earlier escape→`continue` mapping); no-UI modes leave no orientation trace; orientation entries are excluded from capture sweep (process state, not spec material) and readable by kick assembly; concentricity holds as an executable contract (executor tool + skill grants ⊇ elicitor's, write-execution tooling stays executor-only); **one witnessed e2e run per generative flow — intent, design, oracle, frontier-level plan — each entered through a deterministic juncture** (the ship gate's "all flows proven" obligation lives here); topology homes for `src/.pi/extensions/` and `src/agents/runtime/` reconciled.
- **Anchors:** D98-L (two modes, 1:1 mode↔agent), D37-L (offer-owns-response grammar — the dialog lives on the product side of it), D40-L (authority matrix), D74-L (capability-readiness), D101-L/D102-L (session seed facts); `src/agents/references/readiness-bands.md` §Agent Use (the Proceed/Negotiate/Ask postures both foreground roles share).

## Sequencing

### Active — standalone web arc (FE-1200)

Build the whole standalone-web through-line on `ln/fe-1200-web-session` as a slice sequence (arc collapsed 2026-07-14). Tracer and concurrent-session isolation are done; one slice remains:

- `standalone-web-session-host` (FE-1200) — **presentation-coverage sweep next** (retires I65-L breadth). Next move: `ln-scope` the code-enumerated sweep ledger under `memory/cards/`.

### Active — Group 1 · walkthrough closure

Close the entire first batch of walkthrough-related findings: remediation, the owed evidence, and the design back-catalog that the old (now fixed) findings-capture protocol left stranded. The auth reversal has landed; Group 3 is pickup-ready while FE-1187 continues its closure sweep.

- `walkthrough-remediation-2` ([FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure)) — remaining ship-gate closure: compact review presentation; `exchange-visual-design` together with the reassigned `transcript-ledger-rendering`; R6/R12/R13 routes; then provider/human evidence and the paused outer checkpoint. Execute O7–O9 stay KA-owned. Closing member of arc `deterministic-orientation`. Definition below.
- `cli-mode-entry` — direct-mode CLI subcommands (`brunch specify [spec-id]` / `brunch execute <spec-id>`, reserving `develop`); admitted 2026-07-13, stacked on FE-1187's auth-reversal branch. Definition below.
- **Alpha walkthrough lane** — the post-publish outer-loop audit over the merged surface (`TESTING_PLAN.md` concern groups; findings in `TESTING_FINDINGS.md`). Runs A, C, and WR18 are the source evidence; run D waits on FE-1187's reshaped surfaces. Not a frontier itself.

### Recently Completed

<!-- FE-1200 tracer slice (accepted 2026-07-14) is not a completed frontier: FE-1200 is reopened as
     the standalone-web arc carrier and is Active above. The tracer's done state lives as slice 1 in
     the frontier definition below. -->

- 2026-07-14 `FE-1196 platform debt` — **✓ closed and outer-witnessed**: spec posture, workspace DB identity, headless ask discovery, reconciliation derivation, native compaction continuity, and active-branch session correctness are materialized; `web-driver-streaming` was evaluated and retired, and transcript-ledger rendering moved to FE-1187. Full closeout: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md#2026-07-14-sync-archive-ln-sync-fe-1196-platform-debt-closeout).
- 2026-07-14 `petri-execution-parity` (FE-1195) — completed the old-`main` live-parity closure and final review hardening: timestamped firing wire with calendar-valid TypeBox boundary checks, structural pass/fail branches with strict list/detail failed-slice evidence, stale serial-state retirement at parallel admission, journal-idempotent restart-stable terminal authority, rejection of every post-terminal fact, causality-gated Petrinaut replay/export, staging-aligned SDCPN parsing that retains legitimate full roots, and a view-only projection with mechanically pruned isolated places, preserved connected IDs/arcs, contextual labels, locale-independent ordering, and collision-free compact/legacy fallback bands. Durable terminal evidence wins over later abandonment metadata; raw executor topology/markings and SSE firing order remain unchanged. Full per-slice attempt identity remains the current projection; standardized subnet grouping/folding should be revisited above roughly 12 slices without claiming color-fold parity. Manual Rust fixture comparison remains pre-PR outer evidence.
- 2026-07-13 `petrinaut-live-run-stream` (FE-1190) — merged #322 to `next`; live-from-start observation, reconnect equivalence, fail-closed journal appends, and terminal-lagging-snapshot backfill landed. FE-1183 closed with it.

Older completion history (incl. FE-1180 walkthrough-remediation-1): [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md).

### Next — Group 3 · agent layer

- `develop-mode` — third operational mode `develop` / `engineer` agent, **built flag-gated** (create the mode; enable only behind a flag). **Authority model settled 2026-07-13: not a contract-breaker** — `develop` sits at the same concentric visibility/authority tier as `execute`; `engineer` is simply not constrained by the executor's workflow (no `execute_*` lifecycle obligations), and is initially just a Brunch-aware coding assistant. Entry remains a SPEC revision (D98-L "two modes only", the D40-L matrix row at the execute tier, per-mode kick/consult-suppression axis), but no authority-model redesign is needed. Cost read revised: mechanical ≈ a day + prompt/conduct work. The `develop` CLI subcommand name is already reserved by `cli-mode-entry`.
- `subagent-skill-access` — **admitted 2026-07-13**: extend the subagents extension so subagents can access named skills; the user has local changes to integrate — inventory them at pickup. Prerequisite for `reviewer-agent-mode`. Definition below.
- `reviewer-agent-mode` — reshaped 2026-07-13: the D29-L advisory reviewer is a **subagent**, not a primary agent/mode. Narrow write authority to `reconciliation_need` stands (I16-L); A16-L trigger/scope questions resolve at pickup. Depends on `subagent-skill-access` for skill-carried review conduct.
- `review-commentary-widening` — reshaped 2026-07-13 to the TUI-realistic version: afford `#`-mentioning of review items and attribute comments via mention (req 18 reference-code seam), instead of a widened structured payload + bespoke collection UI. Re-expresses over the D116-L declared-ask/answer payload; needs a SPEC decision at pickup.

### Parallel / Low-conflict

- `interactive-tui-driver` — not started; separate-worktree tooling tracer comparing the proven in-repo Expect/xterm driver with `pi-interactive-shell` over `zigpty`, then locking one canonical agent workflow and fallback order. Definition below.
- `graph-assurance-conduct` — not started; separate D131-L closure frontier canonicalizing capture/map/project/propose/review semantics without a database migration. May proceed after the D131-L documentation commit; FE-1187 owns the renderer, not this prompt/skill sweep. Definition below.

### Cleanups — Group 4

- `named-inline-extension-identity` — Pi-native P1: adopt Pi's native named-inline-extension type for useful source provenance; small independent hardening, direct housekeeping or a tiny tooling slice.
- `web-driver-streaming-residue` — from the retired evaluation (2026-07-13): the `agent_settled`-ordering trigger has fired and that assertion is promoted into `standalone-web-session-host`; remaining `ln-sync` residue is documentation only: `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` answering matrix is stale post-D125-L (discovery mode-complete; answering landed with ceilings), and `src/rpc/TOPOLOGY.md`'s streaming ledger should point to the promoted assertion rather than retain a conditional ○ row.
- `test-tmpdir-hygiene` — vitest `mkdtemp` fixtures are never cleaned up: ~249k `brunch-*` directories had accumulated in the darwin tmpdir by 2026-07-14 and filled the disk mid-gate (found during FE-1201). Add a global teardown or route fixtures through a repo-local scratch root (the `git-slice-integration-port.slow.test.ts` `tmp/` pattern). Tiny tooling slice; re-entry trigger: next disk-pressure incident or the next test-infra touch.

### KA stream (Kostandin — executor / orchestrator / Execute mode)

Everything executor/orchestrator-shaped or Execute-mode-owned belongs to Kostandin's stream and is **outside the LN quarantine**. Cross-stream touchpoints: FE-1187 rows O7/O8/O9 (live D120-L Execute workflows) — coordinate before building those rows.

- **Carved from FE-1167 (2026-07-13):** the Execute-mode evidence sub-list — Execute entry beats on thin vs rich seeds (assessment honesty: Ask on thin, Proceed on rich), the two deferred orientation-choice questions (`continue`/`proceed` semantics; sticky-posture candidate — D98-L-sensitive, route through `ln-grill`/`ln-spec` if evidence says revisit), and the FE-1107/KA residue (close-or-narrow, demo/walkthrough session via `TESTING_PLAN.md`, post-KA plan pass). Full context in the archived FE-1167 definition (`docs/archive/PLAN_HISTORY.md`).
- `planning-process-model` — **moved to the KA stream 2026-07-13; reshaped by D126-L**: the durable scope handoff is settled, so this item now owns only plan projection and epistemic-horizon questions beyond committed scopes. Definition below.
- `petri-execution-parity` ([FE-1195](https://linear.app/hash/issue/FE-1195/complete-petri-execution-parity)) — ✓ built + review-hardened 2026-07-14; the local structural gate passed for timestamped firing compatibility, structural verification verdict/failure identity, journal-idempotent terminal replay, collision-free locale-independent viewer layout, strict staging definition parity, and the tightened `execute.run` replay contract without changing raw executor topology, marking authority, or firing order. FE-1195 still owns the external Rust fixture/Petrinaut loader comparison, timed after PR #329 restacks.
- `executor-plan-synthesis` ([FE-1197](https://linear.app/hash/issue/FE-1197/build-execution-plans-from-committed-scopes)) — LLM-backed scope-informed Execution Planner: bounded planning projection over committed scopes plus decisions/constraints, typed candidate/admitted plan with a plan-owned execution contract, deterministic validation with bounded repair, run creation consuming admitted plan truth only, witnessed end-to-end through PR #325 execution. Stacked on `petri-execution-parity` (PR #325). Absorbs the `executor-run-environment` (FE-1166) live remainder. Definition below.
- `executor-runtime-fixes` ([FE-1199](https://linear.app/hash/issue/FE-1199/executor-and-pi-integration-fixes)) — umbrella branch `ka/fe-1199-fixes` stacked on FE-1197 for small independent executor/Pi integration fixes; no separate frontier definition by design. Landed: plan-synthesis abort propagation, persisted-contract validation at run creation, author-owned recipes (npm built-in and greenfield default removed), tool activity labels, HTML-export foregrounds. Open (2026-07-14 live-witness residue): `execute_replan_retry_current_step` after `slice_integration_conflict` wedges the journal (`petri_input_unreadable`); one-off `petri_marking_persist_failed`; integration-worktree contamination by untracked source/`result.json`; worker brief names a result path outside the file-tool boundary. The `empty_dir` host-promotion residue transferred to `host-landing` (FE-1201) 2026-07-14 — the review proved it the narrow symptom of the cross-mode final-commit-only landing defect.
- `host-landing` ([FE-1201](https://linear.app/hash/issue/FE-1201/mode-aware-host-landing-of-promoted-runs)) — **admitted 2026-07-14** from the `ln-design` synthesis: mode-aware landing of promoted runs replaces patch-apply host promotion; branch `ka/fe-1201-host-landing` stacked on `ka/fe-1199-fixes`. Tracer + full cutover landed same day: durable `runBaseSha`, mode-aware `GitHostLandPort` landing, inspection-informed `/brunch:land` confirmation, patch-path deletion, mode-derived substrate, `GitRunPromotionPort` rename. Branch-complete pending the live walkthrough beat (SPEC reconciled 2026-07-15). Unblocks FE-1197 oracle 9's conforming-promotion witness. Definition below.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Later

Instrumentation experiments and far-horizon items. Each re-enters only via re-qualification with a named trigger.
- `mechanism-trace` — **Later**: post-hoc `wiring` / `nudge` / `conduct` transcript timeline plus static wiring inventory. Re-enter when instrumentation is prioritized; FE-1187 already owns the extracted sweep-debt tripwire. Archived snapshot: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md#2026-07-14-rolling-frontier-reduction).
- `consequential-fact-discovery-tracer` — **Later**: bounded Tier-2 real-provider hidden-fact-ledger × transcript-attribution × graph-readback tracer. Re-enter after Group 1 closes and the ask/prompt surface stabilizes; D125-L has closed discovery, while a useful report remains the campaign gate. Archived snapshot: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md#2026-07-14-rolling-frontier-reduction).
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`. Relation: Later `mechanism-trace` is the transcript-native sibling (carrier classification, no event plane); if both land they may join on a shared trace vocabulary. Absorbs Pi-native P5 (provider/cache observability — latency, cache behavior, whole-run spans), spike-led.
- `petri-epic-integration` — epics become integration gates, not just identity labels: an epic-complete transition gated on member slices, with epic-level verification/fan-in in the compiled topology (`epicId` identity already flows through subnets and emitted facts). Behind `petri-slice-isolation-fan-in`; shape via `ln-grill`/`ln-scope` at pickup.
- `petri-durable-parallel-authority` — the repeatedly deferred authority flip (SPEC §Future Direction): durable marking/journal authority for concurrently firing side effects once `run.json`'s single-status ladder cannot represent in-flight parallelism. Final member of the admitted Petri sequence. Promote only when `petri-slice-isolation-fan-in` evidence shows serial authority is the binding constraint — do not pull it forward for old-`main` Petrinaut parity.

## Frontier Definitions

<!-- Closed frontier definitions live in docs/archive/PLAN_HISTORY.md. -->

### standalone-web-session-host

- **Name:** Standalone web session host — full arc (tracer + concurrency + presentation coverage)
- **Linear:** [FE-1200](https://linear.app/hash/issue/FE-1200/standalone-web-session-host-tracer-concurrency-and-presentation) — retitled 2026-07-14 as the arc carrier (Frontend / brunch, no parent); already In progress.
- **Branch:** `ln/fe-1200-web-session`, Graphite parent `ln/fe-1187-remediation-3`
- **Kind:** structural — one branch carrying the whole standalone-web through-line as a slice sequence (arc collapsed into this frontier 2026-07-14 by user decision)
- **Certainty:** earned / coverage for the remaining presentation sweep; the tracer and proving concurrency slices are done.
- **Slices (execution order on this branch):**
  1. **tracer** — ✓ done/accepted 2026-07-14. One-target walking skeleton: `--mode web` without `InteractiveMode`, target-addressed `LiveSessionHost` keyed by `(specId, sessionId)`, JSONL-hydrated React session route, several deterministic text turns + one structured `ask`, `agent_settled` settlement/refetch parity, malformed-detail rejection, paired web/TUI JSONL differential. Retired A43-L. Commits `7b20909f`, `752bd873`.
  2. **concurrency** — ✓ done 2026-07-14; retired **A42-L** and stabilized I64-L across two simultaneous targets. One production `runBrunchWeb` host drove two coordinator-created sessions through overlapping graph mutations, distinct live asks/answers, target-local contiguous events, cross-target/driver rivals, isolated failure/recovery, reconnect/fresh presentation, and separate JSONL readback. Shared graph changes crossed sessions only through canonical `worldUpdate` continuity. Oracle: `src/dev/__tests__/standalone-web-session-host.concurrency.test.ts`.
  3. **presentation-coverage** — *coverage sweep, earned*; retires **I65-L** breadth; the tracer's D128-L projection seam is the base. Inventory authority: a `Mode: sweep` scope file under `memory/cards/` derived from the production registered-tool/custom-entry inventories, marked `●` required / `○` explicit `n/a`/deferred. Boundary: all production Brunch transcript result/custom-entry families intentionally visible in the web session; out — internal continuity ledgers, generic Pi parity, graph/dashboard views, terminal-only mechanics. Aggregate DoD: no required row remains `spec`/`new`/`partial`; every required family has one canonical semantic projection owner, React adapter, live/persisted metamorphic, and completeness oracle; every excluded family has an explicit disposition. A row escaping row-sized work promotes to its own PLAN frontier and keeps the ledger open until it lands.
- **Current execution pointer:** next `ln-scope` authors the presentation-coverage `Mode: sweep` ledger under `memory/cards/`.
- **Done-definition (arc, now this frontier's completion test):** standalone web starts without `InteractiveMode`; two sessions stream/ask independently with explicit durable targets and one driver each; every required product-visible presentation row has a shared semantic projection plus React adapter or explicit `n/a`; live views converge to fresh JSONL-derived projections after settlement/reconnect; `src/app`, `src/session`, `src/rpc`, `src/projections`, and `src/web` topology homes reconciled; no read-only-sidecar or singleton-current-session target prose remains.
- **Retires:** A43-L (tracer, done); A42-L (concurrency, done); I65-L breadth (presentation slice, next).
- **Why now / unlocks:** user chose to build the whole standalone-web group on one branch rather than as stacked frontiers; the materialized `LiveSessionHost` seam makes the concurrency proof and the presentation sweep buildable in sequence here.
- **Traceability:** req 4/12/17/31/32; A42-L/A43-L; D5-L/D10-L/D33-L/D39-L/D84-L/D125-L/D127-L/D128-L; I21-L/I32-L/I64-L/I65-L; [`docs/design/WEB_UI_ARCHITECTURE.md`](../docs/design/WEB_UI_ARCHITECTURE.md); SPEC exchange-presentation oracle design.

### walkthrough-remediation-2

- **Name:** Walkthrough chapter closure — remediation, evidence, and design follow-through (absorbs FE-1167)
- **Linear:** [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure); absorbs closed FE-1167.
- **Branches:** `ln/fe-1187-walkthrough-remediation-2` (tied-off first tranche) → `ln/fe-1187-remediation-3` (current continuation).
- **Kind:** coverage-shaped closure batch: WR18-promoted remediation rows + absorbed LN evidence beats + folded design rows + the tripwire row.
- **Certainty:** proving.
- **Classification:** evidence-gated.
- **Built:** D123-L model/auth reversal; deterministic remediation rows; sweep-debt tripwire; digest feedback → bounded questionnaire/confirmation carrier; shared atomic local-TUI/RPC review settlement; discriminating seed variants for propose/project/review routing plus settlement visibility; and the human-selected borderless Impact Ledger with narrow/normal/wide goldens, word-wrap-tolerant render honesty, a naive differential inventory oracle, and a deterministic 17-node/11-edge content-length variant gallery. The exact review payload remains durable and approval produces one receipt-bearing terminal, one LSN, and one change-log entry.
- **Next action:** run the human readability walkthrough across the Impact Ledger content-length variants and audit the separate web graph display without imposing the review-only ordering. Theme-color closure and the remaining R6/R12/R13 routes still gate frontier closure.
- **D131-L renderer boundary:** FE-1187 owns only the review presentation half of D131-L: materialize the selected borderless Impact Ledger, preserve exact term definitions and the readable `obligation` compatibility fallback, and audit the separate web graph display rather than silently imposing review ordering. The cross-cutting prompt/skill semantic sweep is the separate `graph-assurance-conduct` frontier.
- **Visual-design coupling:** `exchange-visual-design` now also owns the FE-1196 reassignment `transcript-ledger-rendering`: durable user-choice ledger entries must become visible in the transcript without entering model context, and should land with the same visual treatment rather than as a separate platform-debt slice.
- **Theme closure gate:** Brunch's owned theme colors must be deliberately locked before this frontier closes — settle the light/dark palette and semantic color-role assignments through the component playground, then reconcile the canonical theme files and affected Brunch surfaces. Exact color choices remain user design input; do not close FE-1187 while this is unresolved.
- **Remaining routes:** R6 four-state result visuals → `ln-design`; R12 no-model behavior → `ln-diagnose`; R13 entry-menu behavior → `ln-disambiguate` then `ln-spec`. O7–O9 are KA-owned D120-L Execute evidence. The [`consolidated outer checkpoint`](cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md) remains paused until these routes and R8–R10 are dispositioned.
- **Live scope files:** the paused [`consolidated outer checkpoint`](cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md).
- **Dependencies:** closes `deterministic-orientation` jointly with KA-carved Execute evidence. `cli-mode-entry` remains stacked after this frontier.
- **Verification (R8–R10):** one normalized 17-node/11-edge semantic fixture; compact text and live/persisted render equivalence; exact local/RPC settlement effects; 3/3 controlled provider runs; one normal-width human walkthrough judging question materiality, proposition cohesion, inspectability, and fatigue. See SPEC §Verification Design.
- **Verification (Impact Ledger render, D131-L):** golden snapshots at narrow/normal/wide widths + word-wrap-tolerant `missingRenderedDetailsLeaves` extension + a naive differential reference extractor (inner/middle, deterministic, no LLM); one human walkthrough cycles a dev-only content-length variant gallery (outer, no `fast-check` — legibility stays human-judged). See SPEC §Verification Design ("FE-1187 Impact Ledger render oracle design").
- **Traceability:** WR18 closure record in `TESTING_FINDINGS.md`; evidence at `testing/walkthroughs/2026-07-10/WR18-manual.md`; D113-L–D115-L reversal/disambiguation; D119-L, D120-L/I62-L, D99-L conduct; TESTING_PLAN concerns 1/3/4/6/7.

### interactive-tui-driver

- **Name:** Canonical interactive TUI driver for agents and human takeover
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup; independent separate worktree/branch off the current stack base
- **Kind:** structural tooling — development feedback-loop control and evidence capture, not product runtime.
- **Certainty:** proving.
- **Status:** not started.
- **Objective:** settle and materialize one canonical way for agents to launch, observe, drive, resize, and stop Brunch TUIs while a human can inspect or take over when the host permits it. Compare the proven in-repo `src/dev/tui-driver.ts` (Expect/FIFO PTY + `@xterm/headless`) with `pi-interactive-shell`'s Pi overlay over `zigpty`; adopt, augment, or retain based on real tracer evidence rather than replacing the working fallback speculatively.
- **Why now / unlocks:** FE-1187's review-set prototype exposed recurring runner confusion: external daemon-backed tools can fail under sandbox socket policy, while the component playground is the canonical visual-review surface but agents lack one obvious interaction path. A settled driver workflow unlocks repeatable component-playground reviews, real Brunch TUI walkthroughs, and future outer-loop evidence without re-deriving the tool choice each session.
- **Lights up:** one end-to-end agent-controlled path through both `npm run dev:components -- tui-lab` and a seeded `npm run dev-cli` session, with terminal-state observation and deterministic teardown.
- **Stabilizes:** `docs/praxis/manual-testing.md`'s TUI-driving priority order and `src/dev/TOPOLOGY.md`'s feedback-loop seam; no agent should guess among cmux, agent-tui, shellwright, and the repo driver after this frontier closes.
- **Acceptance:**
  - The active scope file carries a temporary capability matrix evaluating the existing driver and `pi-interactive-shell` on real PTY fidelity, xterm/VT screen reconstruction, text and named-key input, bracketed/multiline paste, wait/assert, resize, output bounds, cancellation/cleanup, human observation/takeover, sandbox viability, and artifact hygiene. It records measured evidence, not README claims; closure distills the chosen/default/fallback result into the existing manual-testing and dev docs, then deletes the temporary matrix with the exhausted scope file.
  - One tracer drives a stable component-preview entry through launch → screen assertion → variant/input action → resize → clean exit. A second tracer drives a seeded Brunch TUI through launch → visible-state assertion → key/text interaction → cancellation → teardown. Both use the same candidate workflow where capabilities permit.
  - `pi-interactive-shell` is validated against Brunch's Pi `0.80.x` line and the team's actual macOS architecture, including its `zigpty` prebuild. Its current dependency on `zigpty ^0.1.6` is checked against the current `zigpty 0.2.x` API/release line; version lag or platform limits are recorded before adoption.
  - The existing Expect/xterm driver remains the sandbox/headless fallback until the candidate proves equivalent screen interpretation, deterministic input, liveness, and teardown. Direct `zigpty` integration is considered only if the extension cannot meet the project workflow; do not create a second custom PTY stack for optionality.
  - The chosen workflow supports bounded model-visible output and keeps raw PTY logs under gitignored `.fixtures/scratch/`; secrets or pasted credentials never enter committed evidence or automatic model summaries.
  - `docs/praxis/manual-testing.md`, `src/dev/README.md`, and `src/dev/TOPOLOGY.md` name one explicit priority order, installation/health checks, exact commands, fallback trigger, cleanup procedure, and user-takeover behavior. Superseded runner guidance is removed rather than left as competing advice.
  - No PTY package or Pi extension enters Brunch's shipped product runtime dependency surface solely for test tooling. Any project-local package/config addition is dev-scoped and removable.
- **Verification:** inner — existing `tui-driver` protocol/screen/liveness tests remain green plus adapter/config tests for any new project-owned code; middle — scripted component-preview and seeded-Brunch tracer matrix with captured textual viewports, resize/input assertions, exit status, and cleanup; outer — one user-observed Pi overlay session proving watch/takeover/return-to-agent behavior, plus one sandbox run proving the documented fallback when socket-backed tools cannot bind.
- **Cross-cutting obligations:** preserve the manual-testing findings-ledger discipline and scratch-artifact rules; do not make an external extension part of Brunch's product extension bundle; retain the current fallback until the replacement decision is witnessed; document platform ceilings explicitly rather than claiming cross-platform support from upstream marketing.
- **Traceability:** `docs/praxis/manual-testing.md` §Setup / sandbox fallback; `src/dev/TOPOLOGY.md` and `src/dev/tui-driver.ts`; FE-1187 R8–R10 component-playground review pressure. External candidates: [`pi-interactive-shell`](https://github.com/nicobailon/pi-interactive-shell), [`zigpty`](https://github.com/pithings/zigpty).

### graph-assurance-conduct

- **Name:** Canonical graph assurance capture and projection conduct
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup; separate frontier stacked after the commit that records D131-L
- **Kind:** cross-cutting agent-control closure — prompt/resource semantics and their contract checks, not a graph-schema migration or review-renderer feature.
- **Certainty:** earned.
- **Status:** not started.
- **Objective:** materialize D131-L across the Brunch-owned agent control plane so one canonical assurance chain remains: requirements are judged by criteria; criteria and general methods are operationalized by concrete checks; only already-obtained observations deliberately promoted from execution, research, or spikes become evidence that witnesses or falsifies claims. Existing `evidence` and `vv_obligation` rows remain readable through the unchanged schema, while future evidence and new obligations stop being projected.
- **Why now / unlocks:** review-set design exposed a control-plane contradiction: canonical semantics now reject planned evidence and generated obligations, while current map/project/propose/ingest/review resources still invite both. Closing the drift prevents agents from producing semantically obsolete review payloads and lets FE-1187's renderer treat `vv_obligation` strictly as compatibility fallback rather than normal output.
- **Canonicalizes:** D131-L assurance conduct across `src/agents/references/`, the map/project/propose/ingest/review skills, and prompt/skill contract tests.
- **Deletes / retires:** directives that project “evidence plans,” generate `vv_obligation`, use an unexecuted check as proof, or treat routine run output as durable graph evidence.
- **Locks in:** no live agent resource proposes future evidence or a new verification obligation; capture guidance requires an identified prior observation/artifact; criterion/method→check uses `realization`; promoted evidence or declarative criteria/examples use `witness`; historical fixtures and persisted rows remain readable.
- **Acceptance:**
  - `src/agents/references/data-model.md` and `readiness-bands.md` distinguish physical compatibility taxonomy from D131-L conduct. Evidence is capture-only and is not an expected projection deliverable; `vv_obligation` is marked legacy/reserved without deleting its schema entry.
  - Map guidance routes requirements, criteria, methods, checks, promoted evidence, and examples without overlap: checks operationalize criteria/methods, while observations/criteria/examples may witness claims. It offers no ordinary route that creates a new `vv_obligation`.
  - Project/propose guidance produces criteria, methods, checks, fixture/probe commitments, and blind-spot prose—but never speculative evidence nodes or “evidence obligations.” Ingest may capture evidence only when the reviewed source names a concrete observation/artifact already obtained.
  - Review guidance diagnoses missing observation or verification machinery without asking agents to manufacture evidence/obligation nodes. Prompt wording that uses ordinary-language “evidence” or scratchpad “obligation” remains allowed when it does not name the graph kinds.
  - Existing seed fixtures and historical runs containing `evidence`/`vv_obligation` remain unchanged unless a fixture is specifically a live conduct oracle. No schema enum, database migration, compatibility shim, or mass fixture regeneration lands.
  - The frontier audits `latestExpectedBand` and execution snapshots for semantic contradiction, but changes non-database code only when required to stop live agent behavior from violating D131-L. Dedicated automatic evidence promotion remains out of scope; generic reviewed graph mutation is the current manual capture path.
- **Verification:** `npm run check:skills`; prompt/resource composition tests and snapshots; focused tests that reject forbidden future-evidence/obligation guidance while preserving generic “evidence” and scratchpad-obligation language; one controlled project/propose transcript showing criteria/method/check output without speculative E/O nodes; full `npm run verify` before submission.
- **Boundary:** FE-1187 owns the concern-grouped review prototype/production renderer, vocabulary-change signal, and legacy-obligation display fallback. The web graph browser keeps its own ordering unless a concrete consumer requirement independently justifies reuse.
- **Traceability:** D131-L (soft semantics and review groups), D87-L (physical ontology event), D94-L (latest-expected-band model), D99-L (advisory capture), D70-L (artifact promotion); drift inventory captured in the FE-1187 handoff.

### cli-mode-entry

- **Name:** Direct-mode CLI entry — `brunch specify [spec-id]` / `brunch execute <spec-id>`
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** stacked on FE-1187's auth-reversal branch (both reshape the entry surface; shared workspace-dialog seam)
- **Kind:** bounded feature — new CLI entry behavior over existing activation/orientation seams.
- **Certainty:** proving — the seams exist; the open question is suppressing the boot orientation menu while keeping orientation-entry and kick-composition bookkeeping coherent.
- **Objective:** subcommands `specify [spec-id]` (spec optional — default is a new spec, which still requires a title prompt), `execute <spec-id>` (spec required), and a reserved `develop` name. Parse via the existing `parseArgs` router (`src/app/brunch.ts`, where `login` routes today); pre-answer the workspace dialog through the injected decision seam (`chooseSpecSessionActivationDecision` overrides + `findSpec` lookup, decision union `newSpec{title}` / `newSession{specId}`); seed `operationalMode` via `appendBrunchAgentRuntimeInit` plus a synthesized orientation entry. Precedent for menu-less boot: no-UI print/json modes synthesize no orientation entry and follow the default kick path.
- **Distinctions:** `--mode` remains the host-mode axis (`tui`/`print`/`rpc`); operational mode enters only via subcommand. Execute-mode entry semantics stay D98-L-consistent (1:1 mode↔agent) — coordinate the `execute` subcommand's semantics with the KA stream.
- **Verification:** inner — argv→activation-decision mapping, spec-id validation, orientation-suppression + kick-composition regressions; outer — one manual walkthrough per subcommand.
- **Why now / unlocks:** shares FE-1187's entry-friction motivation (alpha users must reach a working session with minimum ceremony); reserves the `develop` name ahead of the Horizon mode. Cost read 2026-07-13: ~2–3 focused days.
- **Traceability:** D98-L, D109-L (juncture family), D101-L/D102-L (seed facts); riskiest seam: boot-menu suppression vs `session-orientation` registrar/kick bookkeeping.

### executor-run-environment

- **Name:** Greenfield executor run substrate and verify policy
- **Linear:** [FE-1166](https://linear.app/hash/issue/FE-1166/greenfield-executor-run-substrate-and-verify-policy)
- **Branch:** original `ka/fe-1166-greenfield-executor-harness` merged in PR #302; follow-up branch disposition pending `ln-plan`.
- **Kind:** structural / executor run environment policy
- **Stream:** KA (Kostandin) — outside the 2026-07-13 LN quarantine.
- **Status:** original frontier delivered; one real-run failure is prepared in `memory/cards/executor-run-environment--actionable-slice-request.md`. Do not build until `ln-plan` decides whether it remains FE-1166 work or becomes a fresh frontier/branch.
- **Objective:** Separate run substrate and verify target from source-copy policy so greenfield fixture runs can use an isolated run directory and product-owned verification profile instead of always starting from a host git worktree and hardcoded `npm run verify`.
- **Traceability:** FE-1114 follow-up live-run evidence; `src/executor/worktree.ts`, `src/executor/test-result.ts`, `src/app/test-runner-port.ts`, `src/.pi/extensions/executor/execute-run-create/index.ts`; follow-up worker-request evidence from run `run-mrbyf8u9` recorded in `memory/cards/executor-run-environment--actionable-slice-request.md`.

<!-- elicitation-gap-guidance (FE-1116) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D99-L, D101-L, D102-L, I52-L, I56-L, closure oracle
     src/graph/__tests__/elicitation-gap-guidance-closure.test.ts, docs/archive/SESSION_LOCAL_ELICITATION_GAPS.md. -->

<!-- executor-run-observer (FE-1141) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #295);
     durable truth: execute.* read projections, run-scoped brunch.updated topics, src/executor/TOPOLOGY.md,
     src/web/TOPOLOGY.md. Follow-on KA work continues on #300/#302/#303. -->

<!-- executor-run-integrity (FE-1154) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #297);
     retained executor card GC completed in the 2026-07-08 sync. -->

### planning-process-model

- **Name:** Planning-process model — plan-as-projection and epistemic horizon beyond the settled scope handoff
- **Linear:** unassigned
- **Branch:** `ln/fe-xxx-plan-plane-redesign` (plan-plane groundwork already landed here: `slice` removal + D103-L + CueLoop liftout)
- **Kind:** structural / plan-plane semantics
- **Stream:** KA (Kostandin) — moved 2026-07-13: plan-plane semantics sit with executor/orchestration concerns.
- **Status:** Horizon candidate, reshaped by D126-L. The durable `scope` question is closed; this frontier now owns only plan projection beyond committed scopes and the remaining epistemic-horizon/decision-flow questions. The orientation menus' "project a plan" option does not depend on or advance it.
- **Certainty:** proving.
- **Lights up:** plan generation as *projection* from committed `{milestone, frontier, scope}` truth through the existing `project` seam, optionally exported to an external format such as CueLoop as design pressure.
- **Stabilizes:** D126-L's durable-scope/runtime-slice boundary while locating whether richer epistemic-horizon or decision-flow state earns representation.
- **Objective:** Model how Brunch projects committed scope packages through fog-of-war and non-structural sequential dependency, and whether extending the planning horizon or gaining parallelism needs additional durable truth. Do not reopen the settled `scope` kind or its execution-handoff contract.
- **Acceptance:**
  - A plan projection is derived from committed graph truth (milestone/frontier/scope plus their intent/oracle/design anchors) and rendered thinly, reusing the `project` (D100-L) seam rather than a new graph-write path or exchange schema family.
  - The projection is demonstrably *projection*, not free generation: it starts from accepted upstream anchors and never commits plan-plane graph truth itself (I51-L discipline).
  - An external-format export (e.g. CueLoop) is proven as an optional downstream rendering of that projection, or explicitly rejected with a recorded reason — used only as design pressure, not as product architecture.
  - Any richer horizon/decision-flow representation is justified by evidence from the settled D126-L scope consumer path; otherwise it remains process-only.
- **Traceability:** D126-L (settled scope handoff), D103-L (durable slice retirement), D100-L (`project` seam), D87-L (`unknown` = horizon on the intent plane), D99-L (advisory/settled); KA owns executor/orchestration consequences. SPEC §Future Direction "Planning persistence evolution".


### executor-slice-attempt-lifecycle

- **Name:** Slice attempt lifecycle — first-class attempts in the executor net
- **Linear:** [FE-1192](https://linear.app/hash/issue/FE-1192/executor-slice-attempt-lifecycle)
- **Branch:** `ka/fe-1192-executor-slice-attempt-lifecycle` (off `next`)
- **Kind:** structural — executor lifecycle + Petri topology semantics (new attempt seam).
- **Certainty:** proving.
- **Shape (settled at pickup 2026-07-13):** attempt facts first — compiled net topology unchanged, attempts are journal facts, drive owns the bounded retry; retry bound is a named constant with a `ceiling:` to plan-declared; first slice covers the agent step only. Petri-native self-loop topology and `test_run_failed` coverage are named follow-ups.
- **Status:** implementation complete 2026-07-13 — `attempt_failed` journal facts (non-marking; replay/export skip them) for agent and verify-runner failures, bounded in-run retry with per-stage `run.json` attempt counters (success clears; HITL retry resets), Petrinaut frame contract unchanged. Petri-native attempt topology **explicitly deferred** to `petri-slice-isolation-fan-in`, where concurrent subnets make Petrinaut-visible attempts earn their place. Review/submit pending.
- **Why now / unlocks:** today a failed slice step halts the whole drive, recovery exists only as the run-scoped HITL `execute_replan_*` family, and a failed attempt is invisible in the compiled net (the transition simply never fires). Attempt identity is the prerequisite for everything downstream in this sequence: isolation/fan-in needs per-attempt workspaces, and epic integration needs to represent partial failure without abandoning the run.
- **Objective:** make slice execution attempts first-class executor facts — attempt identity and verdict on agent/verify steps, bounded in-run retry expressed as topology (attempt-scoped places/transitions or attempt provenance) rather than driver special-cases, and honest journal/stream representation of failed attempts. `run.json` remains lifecycle authority; `execute_replan_*` remains the escalation path when attempts exhaust.
- **Lights up:** an in-run attempt loop (failed agent/verify attempt → bounded retry) visible in the journal and the Petrinaut stream.
- **Stabilizes:** attempt identity as the vocabulary `petri-slice-isolation-fan-in` and `petri-epic-integration` build on.
- **Acceptance sketch (validate at pickup — the 2026-07-11 session settled only the ordering):** a slice whose first attempt fails can retry in-run within a declared bound without abandoning the run; attempts carry stable identity through executor facts (journal, reports, read surfaces); exhausted attempts land in the existing halted/replan flow; serial lifecycle ordering, journal-truth ordering (hints never outrun durable append), and I58-L side-effect honesty are preserved.
- **Traceability:** D111-L, D112-L, I58-L; SPEC §Future Direction "Plan execution & Petri-net compatibility"; `src/executor/TOPOLOGY.md`; the run-scoped recovery family (PR #303 stack).

### petri-slice-isolation-fan-in

- **Name:** Parallel slice isolation and fan-in under serial authority
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (stacks on `executor-slice-attempt-lifecycle`)
- **Kind:** structural — per-slice side-effect isolation + an explicit integration seam.
- **Certainty:** proving.
- **Blocked by:** `executor-slice-attempt-lifecycle` (attempt identity), which itself waits on the #322 merge.
- **Objective:** let independently enabled slice subnets execute with isolated side effects (per-slice/per-attempt workspace isolation over the FE-1166 substrate policy) and fan their outputs back into the run workspace through an explicit integration step that surfaces conflicts — parallelism in side-effect *execution* while `run.json` stays the serial lifecycle authority. Durable parallel authority is explicitly excluded (it is the sequence's final member).
- **Lights up:** two independent slices executing in isolated substrates with an explicit fan-in/integration transition in the compiled topology.
- **Stabilizes:** the isolation/fan-in seam that `petri-durable-parallel-authority` would later govern; `frontierFiringPolicy`'s co-firable selection becomes load-bearing instead of latent.
- **Acceptance sketch (validate at pickup):** independent slices run in isolated workspaces without cross-contamination; integration conflicts fail closed with an honest halted/replan outcome rather than silent clobber; the Petrinaut stream renders concurrent slice subnets truthfully; serial `run.json` ordering survives.
- **Inherited from FE-1192 (2026-07-13):** Petrinaut-visible attempt topology (static self-loop transitions / retry-budget places compiled into the frozen definition) is owned here — the `attempt_failed` journal vocabulary is settled; this frontier decides whether it graduates into the compiled net. Review residue riding along: extract the mirrored failure-path counter pattern out of `agent-result.ts`/`test-result.ts` when touching the attempt seam (the `attempts`-field presence should become the single retry discriminant in `drive()`), and settle `DriveContext.onNetEvent` — zero production consumers today; become its first real consumer for live hints or delete the hook and correct the executor `TOPOLOGY.md` fan-out claim.
- **Traceability:** D112-L (set-returning scheduler + `frontierFiringPolicy`), FE-1166 substrate/verify policy, `docs/praxis/worktree-agents.md`; SPEC §Future Direction (durable parallel authority stays excluded).

### executor-plan-synthesis

- **Name:** Synthesize and validate executor plans from approved scopes
- **Linear:** [FE-1197](https://linear.app/hash/issue/FE-1197/synthesize-and-validate-executor-plans-from-approved-scopes)
- **Branch:** `ka/fe-1197-executor-plan-synthesis` (stacked on `ka/fe-1195-petri-execution-parity`, PR #325)
- **Kind:** structural — a new planning/admission seam between committed scope truth (D126-L) and the frozen-plan Petri pipeline (PR #325).
- **Stream:** KA (Kostandin).
- **Certainty:** proving.
- **Shape (settled at admission — the one-vs-two-frontier question):** one coherent vertical frontier with three slices on one branch. The load-bearing belief — approved scope truth can be lowered through a model-authored, deterministically admitted plan into PR #325 execution such that a run can no longer contradict approved commitments — is falsified only by the combined witness (approved scope → synthesized plan → admitted contract → PR #325 run → conforming promotion). The plan contract (slice A) is proven right only when a synthesized plan flows through it; splitting would stack an unproven contract under a planner branch that must reshape it. Escape hatch: if the branch grows unreviewably broad, re-run `ln-plan` and split at the contract+profile-admission / synthesis+repair boundary, preserving that order.
- **Why now / unlocks:** the witnessed greenfield failure (wrong-stack implementation reaching `promotion_prepared` under a self-selected `npm_test` profile) proved the admission boundary is broken exactly when its two neighbors finished: FE-1173/1175/1179 delivered committed-scope handoff above, FE-1195 delivered execution semantics below; planning is the missing middle. Unlocks: run creation that cannot contradict approved truth; non-trivial decomposition (multiple slices per scope, meaningful epics) that finally exercises PR #325's parallel/fan-in/epic semantics.
- **Ownership model (deterministic boundaries around a non-deterministic core):** elicitation decides commitments (stack, framework, package manager, deployment, quality obligations) and authors argv-only `execute.*` recipes; repository detection reports evidence and never authorizes commands or overrides approved commitments; the planner synthesizes and lowers; deterministic validation judges; bounded repair corrects or rejects with exact findings; the executor enforces only the admitted frozen plan. There is no built-in ecosystem catalogue or ambient/default command provider: the sole production provider is derived from spec-authored recipes, and absent, malformed, or contradictory authored execution intent blocks rather than silently substituting an inferred/default harness.
- **Slices (same issue + branch; scope via `ln-scope`):**
  - **A — planning projection + execution contract:** bounded provenance-preserving planning projection (committed frontier/scope identity, linked requirements + criteria, requirement dependencies, technical-design nodes, relevant decisions/constraints incl. implementation-stack/environment/delivery commitments, verification obligations, greenfield/brownfield mode, detected repository facts) — today the snapshot's `context` block (decisions/constraints/design/oracle) is projected then dropped by the outline; typed candidate/admitted plan contract (plan + source provenance, executable epics with integration boundaries, one-or-more slices per scope, explicit deps/ordering, worker goals + done criteria, epic verification intent, plan-owned execution contract distinguishing requiredCapabilities / detectedCapabilities / resolvedActions); command safety through typed product-owned capability providers and action resolvers (model selects/composes supported intents; deterministic code resolves what may run; unknown capabilities produce actionable blocks, never guessed commands; per-scope/per-epic capability sets for polyglot workspaces); remove or constrain the foreground `verifyProfile` enum (`execute-run-create`'s `default|npm_test` + `executor.md` prose heuristic + `test-runner-port.ts` hardcoded `npm run verify` fallback) so run creation consumes admitted plan truth only.
  - **B — LLM plan synthesis, deterministic validation, bounded repair:** planner behind a sealed app/agent port (`PlannerPort` in `ExecutionPorts`, mirroring `AgentRunnerPort`'s untyped-runtime pattern; implementation over the sealed subagent substrate in `src/app/`; no model SDKs, graph mutation, or unrestricted subprocess in `src/executor/` — `boundaries.test.ts` enforced); synthesizes meaningful epics/slices/dependencies/worker briefs/verification gates; total pure validation (every slice in exactly one epic + one committed scope; scope-obligation coverage; acyclic valid-id deps; ordering compatibility; criteria/verification preservation; design/decision/constraint provenance retention; capability/action compatibility with approved commitments and detected facts; polyglot boundary correctness; PR-#325-executable epic gates; no gate bypass; unsafe command/profile rejection; malformed output fails closed); bounded repair fed exact findings, then revalidate; admit or block with persisted findings/repair history — no silent trivial-plan fallback (an explicit deterministic fallback is admissible only if contract-stated and obligation-preserving).
  - **C — PR #325 composition witness:** one admitted synthesized plan through the frozen topology — overlapping dependency-independent isolated slices, ordered fan-in, planner-driven epic verification, failed slice/epic verification blocking completion/promotion, promoted output conforming to approved implementation/execution commitments; one live Specify → committed scope → synthesized/admitted plan → PR #325 execution → promotion witness recorded with graph/plan/brief/verification/run evidence.
- **Verification:** nine contrastive oracles fixed at admission — (1) greenfield capability derivation from approved truth with contradictory-profile rejection before worker launch; (2) a second materially different elicited capability set resolving a different provider/action set without schema change and without ambient-default leakage; (3) brownfield agreement reusing detected workspace/package-manager/test-runner conventions; (4) brownfield conflict blocking actionably with neither side silently overridden; (5) polyglot/multi-package resolution at the correct scope/epic boundary with explicit shared integration verification; (6) context preservation — a rival implementation that drops an elicited stack commitment or assurance node must fail; (7) invalid model plans (dependency cycles, missing scope coverage, invalid ids, incompatible profile) rejected by the validator, then boundedly repaired or explicitly blocked; (8) PR #325 execution of a valid plan exercising parallel isolation, ordered fan-in, epic gating; (9) the live composition witness. Deterministic tests first; fixture-backed or live witness for composition.
- **Prior art (selective port only — old `main` `src/orchestrator/src/plan-{projection,architect,contract,emitter,reconciliation}.ts`, `project-profile.ts`):** port `checkPlan`'s total/pure producer-agnostic predicate with typed severity findings; the single shared cycle policy between detection and repair; the mechanical-class vs design-class repair split (never auto-rewrite ownership/decomposition); coverage-by-provenance (requirementIds/covered/nonBuildable); typed repair/warning records; loud detection failure. Repudiate: the silent trivial-plan fallback (incl. the vacuous-coverage all-non-buildable empty plan); the absent LLM repair loop; the closed six-ecosystem `ProfileId` catalogue as planning truth; absent-profile → bun defaulting; file-write conflicts as shippable warnings; criteria stringified into prose; discarded `derivedFrom` provenance; dual reconcile/repair transformers.
- **Explicitly out:** external Petrinaut HTTP interop beyond the existing observer/live-stream contract; split-process execution authority; richer browser authoring or side chats; post-execution semantic spec-to-code drift detection; generic human halt/replan/resume UX; reimplementing PR #325 isolation/concurrency/fan-in/attempt-authority/epic-lifecycle semantics (the planner targets them, never re-owns them). The executor/Pi integration follow-up renamed the machine-owned plan artifact to `plan.json` and added the durable `brunch/review/<runId>` promotion ref without changing explicit host-apply acceptance.
- **Slice A landed (2026-07-13, D130-L; author-first correction 2026-07-14):** the plan artifact carries the typed execution contract (planning projection incl. constraint/invariant/decision commitments; recipe-resolved actions; evidence-only detected facts; blocked/conflict findings), `execute_plan_file` rejects absent or malformed authored verification before writing, and `execute_run_create` admits or rejects the frozen contract before any run artifact. The npm built-in/default and test-runner command-specific handling are removed.
- **Slice B landed (2026-07-13):** model-authored `CandidatePlan` (schema with no command surface), fail-closed parse, total pure validation (membership, scope-obligation coverage, provenance retention, shared-cycle-policy dependency checks, capability support/conflict), executor-owned bounded repair loop with findings history and no fallback plan on any path, `PlannerPort` over the sealed planner subagent, and `execute_plan_file` synthesis with explicit labeled planner-unavailable fallback (invalid candidates always block). Commits `ce93d8b2`/`b54c4321`.
- **Slice C fixture witness landed (2026-07-13; model-seam strengthening 2026-07-14):** `plan-synthesis-composition.test.ts` drives an admitted synthesized plan through the frozen topology under `petriScheduler` + `frontierFiringPolicy` — the real sealed `PlannerPort` adapter receives Pi model context and a scripted planner response, then overlapping dependency-independent isolated slices (barrier witness), ordered fan-in, epic integration/verification, promotion preparation, contract-only verify commands on every slice/epic invocation, and the failed-verification gate (oracle 8). This is deterministic model-seam coverage, not the still-open live-provider witness.
- **Spec-commanded recipe (2026-07-14):** the elicitor captures the canonical settled `oracle/vv_method` `Project execution harness` with `execute.setup|build|verify: <command>` lines; a generic extractor turns authored recipe commitments into the sole production recipe provider plus spec-mandated base requirements the planner cannot drop (argv-only, shell operators fail closed as `malformed_recipe`). Workspace detection remains provenance-only. The planner subagent registry omission that blocked the first live witness is fixed.
- **Live walkthrough (2026-07-14, rust-todo-cli workbench):** a five-run arc reached the first fully green pass — synthesized plan (3 epics / 4 slices) → real workers → spec-commanded `cargo test -- --test-threads=1` green at every slice gate → ordered integration → `promotion_prepared` (`run-mrkko0ld`), with every failure fixed in the spec (recipe added, `--test-threads=1`, dependency edges, `.gitignore` requirement) and recompiled. The two planner-loop blocks it exposed are fixed deterministically: verification citations are legal and lowerable from the projection-visible set (scope anchors ∪ V&V commitments), and blank `scopeId` normalizes to no-scope. Runtime defects moved to the executor/Pi integration follow-up.
- **Open acceptance:** oracle 9's tail — the walkthrough stopped at `promotion_prepared` because host promotion carries no source for an `empty_dir` run on a non-git host (the fix is owned by `host-landing`/FE-1201 since 2026-07-14; the conforming-promotion witness stays owned here) — plus a live run through the committed-scope path (the walkthrough spec lowered from bare requirements) and live-capability oracles 1–5 on real elicited specs; requires a model-backed session per `docs/praxis/manual-testing.md`. Re-entry trigger: next live FE-1197 walkthrough. All scope files consumed.
- **Traceability:** D126-L (scope = elicitation-owned committed handoff; executor lowers only committed scopes), D111-L/D112-L/I58-L (executor purity over injected ports), D127-L/D128-L/D129-L (FE-1195 authority + canonical execution model), D103-L (runtime slice stays executor-derived), D98-L (executor owns execution/scope concerns); FE-1166 card residue + run `run-mrbyf8u9`; the 2026-07-13 wrong-stack greenfield run; `src/executor/TOPOLOGY.md`; old-`main` planner modules as named prior art.

### host-landing

- **Name:** Mode-aware host landing of promoted runs
- **Linear:** [FE-1201](https://linear.app/hash/issue/FE-1201/mode-aware-host-landing-of-promoted-runs)
- **Kind:** structural — replaces the host-promotion lifecycle seam and its port/tool surface
- **Certainty:** proving
- **Status:** branch-complete (code) — tracer + full cutover landed 2026-07-14 (`448f0f56` on `ka/fe-1201-host-landing`): durable `runBaseSha` recorded for both substrates, `promotion.ts` promotes against it (clean integrated runs promote; `promotionBaseSha` deleted), slice-integration/promotion commits exclude `.brunch`, and `GitHostLandPort` (`inspect`/`integrate`/`materialize`, adapter `src/app/git-host-land-port.ts`) passes the multi-commit contrastive oracle in both modes. Slice 2 (cutover, four cards, `19c575e4`..`273ca5e8`) landed the same day: `landing.ts` preflight/apply + terminal `landed` lifecycle; `/brunch:land` (preflight → read-only full-range/target/conflict inspection → `ctx.ui.confirm` → apply) as the sole host-mutation path with read-only `execute_land_preflight`; deletion of `host-promotion.ts`, `git-host-promotion-port.ts`, both `execute_host_promotion_*` tools, and `acceptedCommitSha`; mode-derived substrate (tool inputs deleted); `GitLandPort` → `GitRunPromotionPort`. Claims 1–2 witnessed by the contrastive oracle; claim 3's wiring half witnessed by stubbed-ctx command tests. Review hardening landed 2026-07-15 (consumed scope card `host-landing--review-hardening`): failed materialization restores the verified-empty target so retries land; host git failures classify as `failed`, not refusals; landed-lifecycle oracles added (including a fix — re-driving a landed run now reports `runStatus: 'landed'` instead of the journal-frozen `promotion_prepared`); promotion-report field `land` → `promotion`; `/brunch:land` notices carry command copy without the tool label; confirmation now names the complete commit/file range, target classification, and read-only conflict rehearsal. SPEC reconciled 2026-07-15 (`ln-sync`): I58-L/D111-L rewired to the landing seam, `Run promotion`/`Landing (host)` lexicon pins added, ln-design claims 1–2 validated-and-embedded, claim 3 recorded as A42-L. **Open before done:** the live TUI+RPC `/brunch:land` walkthrough beat (FE-1197 oracle 9 tail — re-entry: next live walkthrough; also A42-L's live half).
- **Objective:** Replace patch-apply host promotion with mode-aware landing per the 2026-07-14 `ln-design` synthesis. New `GitHostLandPort` (`src/app/git-host-land-port.ts`): `inspect` (read-only full-range `runBaseSha..reviewSha` commit/file evidence, target classification, merge-tree conflict rehearsal), `integrate` (brownfield: verbatim ff/merge of `brunch/review/<runId>` into a clean attached host branch; conflicts abort back to a pristine host; refuse staged/tracked-dirty, untracked coexist unless colliding), `materialize` (greenfield: tip tree → `git init -b main` + one clean brunch-authored initial commit into a missing or empty target; occupied targets refuse). Materializing into an existing repository is deliberately outside this frontier rather than an implied second mode. `src/executor/landing.ts` replaces `host-promotion.ts` with a pure strategy-selection core plus preflight/apply under run-execution authority. Durable `runBaseSha` recorded at worktree creation; `promotion.ts` promotes against it (clean integrated runs promote; `promotionBaseSha` deleted). `mode` becomes the sole authority; `substrate` is a derived record; the independent tool inputs die. Acceptance moves to a product-owned `/brunch:land` command (preflight → inspect → `ctx.ui.confirm` → apply in one invocation, handler-constructed bindings, drift refusal + git CAS); `execute_host_promotion_*` and `acceptedCommitSha` are deleted. Commit-time hygiene `git add -A -- . ':(exclude).brunch'` on slice-integration and promotion commits. Rename `GitLandPort` → `GitRunPromotionPort` (lexicon: "land" = host landing only).
- **Why now / unlocks:** the 2026-07-14 review proved a clean integrated run can land nothing while passing every test (the fixture had one commit above base — the missing multi-commit contrastive oracle). Unlocks FE-1197 oracle 9's conforming-promotion witness, truthful landing in both modes, and retirement of the agent SHA-echo acceptance channel.
- **Posture annotations:**
  - Lights up: the first true run→host landing path (review ref → host branch merge / materialized repository) in both modes.
  - Stabilizes: the landing seam (`GitHostLandPort` + `landing.ts`) that promotion UX and future remote/PR targets aim from; I58-L's host-mutation clause.
  - Retires: the three `ln-design` load-bearing claims — recorded 2026-07-15: (1) transport-free brownfield landing and (2) `runBaseSha..reviewSha` completeness validated by the contrastive oracle and embedded (D111-L, I58-L, `src/app/TOPOLOGY.md`); (3) Pi-confirm sole acceptance authority is SPEC A42-L, partially validated — its live half rides the walkthrough beat.
- **Acceptance:** a real multi-commit integrated run (≥2 slice-integration commits + optional final promotion commit) lands completely: brownfield host branch ff/merged with every slice's source, no `.brunch/**`, review ref intact, conflict variant leaves the host byte-identical; greenfield missing/empty target becomes a repository on `main` with one clean initial commit of the full tree; the confirmation shows complete range, target, and conflict-rehearsal evidence; host mutation is reachable only through `/brunch:land` confirmation; patch apply, `execute_host_promotion_*`, and the independent substrate input no longer exist.
- **Verification:** inner — the multi-commit contrastive oracle (real git; reddens the old `commitSha^` semantics by construction), read-only inspection/merge-tree tests, and pure strategy-selection unit tests; middle — executor lifecycle suites stay green (I58-L side-effect honesty: metadata unadvanced on refusal/conflict/failure) and command tests prove inspection precedes confirmation; outer — rust-todo-cli walkthrough tail past `promotion_prepared` into a fresh target (FE-1197 oracle 9).
- **Cross-cutting obligations:** discharged 2026-07-15 — I58-L host-mutation wording and D111-L port list amended, `src/executor/TOPOLOGY.md` reconciled at the cutover, ln-design claims recorded (A42-L + embedded claims 1–2), `HANDOFF.md` retired. Follow-up (not this frontier): source-copy one-authority fix — commit copied host source at `source_copied` so slices and the landing range share one baseline (2026-07-14 review finding 4's remainder; also listed in FE-1199's open residue as integration-worktree contamination).
- **Explicitly out:** materialization into an existing repository, squash/graft landing knobs (ceiling-marked), remote/PR targets, durable cross-session acceptance tokens, in-run remediation UX.
- **Traceability:** D111-L/I58-L (ports + explicit acceptance), D112-L (host landing stays outside the driven chain), FE-1197 oracle 9, FE-1199 residue transfer; prior art `main:src/orchestrator/src/promote-run.ts` (`promoteGreenfieldRun`/`landCookBranch`).
- **Design docs:** `HANDOFF.md` (volatile, retire after `ln-sync`); the 2026-07-14 `ln-design` four-design comparison (session record).
- **Current execution pointer:** none — both scope files consumed. Remaining work is the owned outer walkthrough beat and `ln-sync` reconciliation named in Status.

### subagent-skill-access

- **Name:** Subagent named-skill access (subagents extension)
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup
- **Kind:** bounded feature — extend the subagents extension so spawned subagents can be granted access to named skills from the code-owned manifest.
- **Certainty:** proving.
- **Status:** admitted 2026-07-13 (Group 3, agent layer). The user has local changes to integrate — inventory them at pickup before scoping.
- **Why now / unlocks:** prerequisite for `reviewer-agent-mode` as a skill-carried subagent; generalizes background-agent capability sharing without reviving retired runtime axes.
- **Traceability:** D90-L (AgentManifest shape), D95-L/registry (code-owned skill manifest), D40-L (subagent grants must stay within the spawning role's authority envelope).

## Dependencies

```text
streams:
  LN — product/elicitation surfaces
  KA — Kostandin: executor / orchestrator / Execute mode / plan plane

standalone-web (Active; arc collapsed into one frontier/branch 2026-07-14):
  standalone-web-session-host (FE-1200, ln/fe-1200-web-session)
    slice 1 tracer      (✓ done/accepted 2026-07-14; retired A43-L)
    slice 2 concurrency (✓ done 2026-07-14; retired A42-L) -[hard, in-branch]-> slice 3
    slice 3 presentation-coverage sweep (next; retires I65-L breadth)
  frontier done-definition closes: I64-L + I65-L breadth and topology reconciliation
  note: slices land on one branch; no separate Linear issues/branches (user decision)

group-1 (Active — walkthrough closure):
  walkthrough-remediation-2 (FE-1187, absorbs closed FE-1167)
    entry: settled D113-L–D115-L reversal (ln-spec first; folds Pi-native P4)
    rows: WR18 punch list + absorbed LN evidence beats + exchange-visual-design
          + generative-flow-synthesis-shape + sweep-debt-tripwire
    -[stack]-> cli-mode-entry (reserves `develop` subcommand)
    cross_stream: O7/O8/O9 + carved Execute beats — coordinate with KA
    closes_arc: deterministic-orientation (jointly with KA-carved beats)
    status: auth reversal landed; Group 2 closed; Group 3 pickup-ready

# FE-1196 Group 2 closed 2026-07-14; durable state is in SPEC/topology and
# docs/archive/PLAN_HISTORY.md. Conditional web-driver residue remains in group-4.

group-3 (Next — agent layer):
  develop-mode (flag-gated; execute-tier authority, no contract break)
  subagent-skill-access -[hard]-> reviewer-agent-mode (subagent reshape)
  review-commentary-widening (mention-based reshape)

parallel:
  interactive-tui-driver
    status: not started; independent separate-worktree tracer
    lights_up: component playground + seeded Brunch TUI under one agent-control workflow
    decision: pi-interactive-shell candidate | existing tui-driver fallback | direct zigpty only on demonstrated gap
  graph-assurance-conduct
    status: not started; earned closure frontier after D131-L documentation commit
    canonicalizes: capture/map/project/propose/review assurance semantics
    excludes: schema migration | review renderer | automatic evidence-promotion pipeline

group-4 (cleanups): rides group-1 stack | named-inline-extension-identity (P1)

KA stream:
  carved FE-1167 Execute beats + FE-1107 residue
  planning-process-model (moved 2026-07-13)
  # petri-interpreter-port (FE-1183) and petrinaut-live-run-stream (FE-1190) merged;
  # run.json remains lifecycle truth, Petri artifacts remain projection/evidence/resume hints.
  petri-execution-parity (FE-1195)
    status: done on branch 2026-07-13; pending submit/merge
    depends_on: merged FE-1192 attempt identity + FE-1190 live stream
    owns: D127-L bounded durable parallel slice authority
    excludes: split-process delivery and generic event-spine authority
  executor-plan-synthesis (FE-1197)
    status: admitted 2026-07-13 on ka/fe-1197-executor-plan-synthesis
    stacked_on: petri-execution-parity (FE-1195, PR #325 semantics)
    consumes: D126-L committed scopes via FE-1173/1175/1179 lowering + worker briefs
    owns: bounded planning projection; typed candidate/admitted plan contract;
      plan-owned execution contract (capabilities/actions); deterministic
      admission verdict; bounded repair; foreground verifyProfile removal
    folds: executor-run-environment live remainder (FE-1166; card deleted)
    excludes: split-process authority; semantic drift detection; promotion UX;
      re-owning PR #325 execution semantics
  executor-runtime-fixes (FE-1199)
    umbrella branch ka/fe-1199-fixes stacked on FE-1197; empty_dir promotion
    residue transferred to host-landing 2026-07-14
  host-landing (FE-1201)
    status: branch-complete 2026-07-14, review-hardened + SPEC-reconciled 2026-07-15;
      open: live /brunch:land walkthrough beat; stacks on ka/fe-1199-fixes
    owns: GitHostLandPort (inspect/integrate/materialize); durable runBaseSha;
      mode-derived substrate; /brunch:land confirm acceptance; deletion of
      patch-apply host promotion + acceptedCommitSha
    -[unblocks]-> executor-plan-synthesis oracle-9 conforming-promotion witness
    excludes: squash/graft knobs; remote/PR targets; durable acceptance tokens;
      source-copy one-authority fix (named follow-up)

later: mechanism-trace (tripwire extracted to FE-1187) |
  consequential-fact-discovery-tracer | agent-tracing (absorbs P5) |
  petri-epic-integration | petri-durable-parallel-authority

rules:
  candidates never commit graph truth (I51-L)
  topology files own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  arcs close only after topology reconciliation and residue discharge
  deferred/design-question findings must name an owner (docs/praxis/manual-testing.md §Findings ledger discipline)
```
