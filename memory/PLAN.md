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

**Execute-mode substrate (KA lane, merged 2026-07-06/08).** `src/executor/` is a pure run-lifecycle core over injected `ExecutionPorts` (D111-L, D112-L, I58-L), exposed as executor-only `execute_*` tools, with a web-facing `execute.*` read surface. KA-conversation residue (FE-1107 close-or-narrow, executor-card GC, demo session, post-KA plan pass) lives in the KA stream's carved walkthrough sub-list.

**Alpha release lane — shipped.** Brunch ships as `@hashintel/brunch@1.0.0-alpha.x` from the `next` trunk. `alpha-release-readiness` (FE-1159) closed 2026-07-09 with `1.0.0-alpha.0` live on npm under dist-tag `alpha`; its original D113-L–D115-L model/auth policy was superseded by the materialized D123-L Pi-native surface. Subsequent alphas: `npm run release` from `next`.

**Exchange-ask cutover (D116-L/D125-L).** A one-shot **ask** tool is the only interactive structured-exchange terminal; surviving offers declare ask continuations in details. Headless discovery is now materialized through the live ask registry + handle-gated `session.openAsks`; the transcript-backed pending projection remains compatibility-only until the legacy `present_question` read path retires.

**Merge waves (2026-07-08/09) + plan consolidation.** The braided ship-gate stack, alpha-readiness PR, component-DX PR, ask cutover, KA executor lanes (#286–#304), and the FE-1169 chrome batch (#305, 2026-07-09) are all merged to `next`. The 2026-07-08 `ln-plan` hygiene pass batched straggling outer-loop residue into `walkthrough-evidence-batch` (FE-1167), pruned non-frontier Horizon rows, and folded `blank-carrier-sweep` into the FE-1163 ledger. No open PRs remain from these lanes.

**Capture-sweep reliability lane (grilled 2026-07-08).** A trace of the capture-sweep mechanism surfaced that the watermark advance is optimistic (`sweptAt` asserts intent, not completion) and that agent-action provenance — product-wired vs event-nudged vs freely chosen — is illegible during walkthroughs. Settled as D117-L (include-list stays, fail-closed), A40-L (`turn_end` as a future capture-conditional upgrade, not now), and the "Sweep ingestion reliability" blind spot. The plan-level answer is one new frontier, `mechanism-trace`: a post-hoc carrier-classified transcript trace as the spine, with the sweep-debt tripwire riding it as a scenario-scoped outer-loop oracle. The D117-L constant-anchoring hardening is a direct fix outside that frontier.

**Alpha walkthrough lane (2026-07-09/10).** Post-PR-305 outer-loop walkthroughs (TESTING_PLAN.md concern groups; findings in TESTING_FINDINGS.md) ran A and C, then a same-day induct → grill → spec pass settled D118-L (spec posture persistence, including the validated reference-only relates-to-spec shape), D119-L (unified `/continue` + continue/wait lexicon), and the D99-L digest-conduct clarification. The 2026-07-10 FE-1180 review/witness pass reopened `walkthrough-remediation-1`: required rows WR1–WR8 were built, but Execute labels diverged from their provider directives and several security/conduct/debug claims lacked discriminating evidence. D120-L/I62-L now settle the Execute workflows. FE-1180 closed by explicit WR18 promotion of remaining failures/unknowns into `walkthrough-remediation-2` / FE-1187. FE-1187 now owns the reshaped auth/model-policy, ask/recovery, debug/prompt, conduct, Execute, and both-theme evidence before later walkthrough beats depend on those surfaces.

**Petri execution lane (2026-07-12/13).** FE-1190's live stream merged (#322, 2026-07-13) after two Bugbot findings closed with deterministic oracles (fail-closed journal appends; terminal-lagging snapshot backfill from replay truth). The admitted Petri sequence is now live: `executor-slice-attempt-lifecycle` (FE-1192, picked up 2026-07-13 — shape settled at pickup: attempt facts first, constant retry bound, agent step only) → `petri-slice-isolation-fan-in` → `petri-epic-integration` → `petri-durable-parallel-authority`.

**Host-landing admission (2026-07-14).** An `ln-review` pass over the landing path proved host promotion structurally broken across both modes: a run's result is inherently multi-commit (one integration commit per slice), but `execute_host_promotion_apply` diffs only `promotionCommitSha^..promotionCommitSha` and patches it onto the host — a clean integrated run lands nothing, or only incidental final-commit artifacts. The FE-1199 `empty_dir`/non-git residue was the narrow symptom. A four-design `ln-design` pass (minimal squash / strategy planner / `main` prior-art port / pull-based) settled a synthesis: `host-landing` (FE-1201, definition below) replaces patch apply with mode-aware ref/tree landing behind a `GitHostLandPort`, a durable `runBaseSha`, mode-derived substrate, and `/brunch:land` confirm-gated acceptance.

**Topology and evidence discipline.** Directory `TOPOLOGY.md` files under `src/**` own current topology state. `memory/SPEC.md` owns the thin product contract and live decision/invariant index; long-form SPEC history is archived in `docs/archive/SPEC_HISTORY.md`. `memory/PLAN.md` owns only rolling frontier state. Scratch probe artifacts under `.fixtures/scratch/` are not durable evidence until reviewed and promoted to `.fixtures/runs/`.

**Consequential-fact discovery evaluation lane (2026-07-10 oracle design).** Prompt/context quality will be approached in two stages rather than by building a generic eval framework. The proving tracer `consequential-fact-discovery-tracer` uses a bounded Tier-2 real-boot Petri-net scenario to validate the hidden-fact-ledger × transcript-attribution × graph-readback oracle. D125-L has closed the live ask discovery prerequisite. Full autonomous agent-as-user campaigns now remain promotion-gated on a useful tracer report; at least one novel/non-inferable scenario must pass before the portfolio supports prompt/context-quality claims.

**Quarantine → re-qualification (2026-07-13; Group 2 closed 2026-07-14).** The LN-stream frontier list was conditionally demoted (quarantined) and same-day re-qualified into thematic groups: **Group 1 · walkthrough closure** (the active block — FE-1187 absorbs FE-1167, the promoted design rows, and the slim sweep-debt tripwire), **Group 2 · platform debt** (now closed by FE-1196), **Group 3 · agent layer**, **Group 4 · cleanups**, the **KA stream** (Kostandin — executor/orchestrator/Execute mode; untouched by the quarantine and now also owning `planning-process-model`), and **Later** (instrumentation experiments). Ordering: Group 1 completes its auth reversal first; Groups 2–3 then interleave opportunistically, respecting per-item dependencies. Same-day groundwork: the owned-deferral discipline landed in `ln-scope`/`ln-build`/`ln-sync` + `docs/praxis/manual-testing.md` §Findings ledger discipline (guarded by `check:skills`); and FE-1187's spec-first entry direction settled — reverse D113-L–D115-L toward the full Pi provider/model range (Pi-native `/login` and `/model`, soft recommended default via Pi default-model settings, model recommendations as docs, no-auth turn gate re-keyed to "no resolvable auth").

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

### deterministic-orientation — ◐ active

- **Goal:** users choose how to operate at every settle-point, deterministically — no model volition, no mode ping-pong. The mechanism (settled 2026-07-03): product-owned `ctx.ui.select` dialogs record `brunch.session_orientation` entries that feed kick composition. Entry boot rides the Brunch orientation extension's `session_start(startup)` handler because Pi binds extension UI before emitting that event; mid-session junctures use Pi events/commands (`session_start` for post-switch `new`/`resume`, `session_tree`, detectable abort settle, mode switch, `/consult`) where the UI exists. No-UI print/json modes synthesize no orientation entry and follow the default kick path. Mid-session discretionary consults stay ordinary exchange tuples; `/consult` forces the dialog. Two modes only (`specify` / Specify and `execute` / Execute, D98-L); concentric authority becomes a code contract; generative flows are menu-routed to the existing `propose`/`project`/`elicit`/`ingest` skills.
- **Members:**
  - `session-entry-orientation` — ✓ built + merged (#289, 2026-07-08); its remaining LN outer evidence now rides FE-1187.
  - `execute-entry-readiness` — ✓ built + merged (#290, 2026-07-08); its remaining Execute evidence + the two deferred orientation-choice questions live in the KA stream's carved sub-list.
  - `walkthrough-remediation-2` (FE-1187, definition below) — the arc's remaining/closing member since 2026-07-13, when it absorbed `walkthrough-evidence-batch` (FE-1167): one witnessed e2e run per generative flow, menu→conduct routing evidence; the thin/rich Execute beats carve to the KA sub-list but remain part of the arc's done-definition.
- **Done-definition:** dialog fires on every named UI-capable juncture in TUI and RPC modes (extension-UI sub-protocol relay confirmed); escape/timeout resolves to the inert `dismissed` — entry recorded, no kick, so the menu is never a wall and esc always means "wait for me" (2026-07-06 revision, supersedes the earlier escape→`continue` mapping); no-UI modes leave no orientation trace; orientation entries are excluded from capture sweep (process state, not spec material) and readable by kick assembly; concentricity holds as an executable contract (executor tool + skill grants ⊇ elicitor's, write-execution tooling stays executor-only); **one witnessed e2e run per generative flow — intent, design, oracle, frontier-level plan — each entered through a deterministic juncture** (the ship gate's "all flows proven" obligation lives here); topology homes for `src/.pi/extensions/` and `src/agents/runtime/` reconciled.
- **Anchors:** D98-L (two modes, 1:1 mode↔agent), D37-L (offer-owns-response grammar — the dialog lives on the product side of it), D40-L (authority matrix), D74-L (capability-readiness), D101-L/D102-L (session seed facts); `src/agents/references/readiness-bands.md` §Agent Use (the Proceed/Negotiate/Ask postures both foreground roles share).

## Sequencing

### Active — Group 1 · walkthrough closure

Close the entire first batch of walkthrough-related findings: remediation, the owed evidence, and the design back-catalog that the old (now fixed) findings-capture protocol left stranded. The auth reversal has landed; Group 3 is pickup-ready while FE-1187 continues its closure sweep.

- `walkthrough-remediation-2` ([FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure)) — **absorbs `walkthrough-evidence-batch` (FE-1167; close its Linear issue as merged at pickup)**. Entry: the settled D113-L–D115-L reversal, spec-first via `ln-spec`; then the punch-list rows, the absorbed LN evidence beats (Execute beats carve to the KA sub-list), the folded design rows `exchange-visual-design` + `generative-flow-synthesis-shape`, and the slim `sweep-debt-tripwire` row. Closing member of arc `deterministic-orientation`. Definition below.
- `cli-mode-entry` — direct-mode CLI subcommands (`brunch specify [spec-id]` / `brunch execute <spec-id>`, reserving `develop`); admitted 2026-07-13, stacked on FE-1187's auth-reversal branch. Definition below.
- **Alpha walkthrough lane** — the post-publish outer-loop audit over the merged surface (`TESTING_PLAN.md` concern groups; findings in `TESTING_FINDINGS.md`). Runs A, C, and WR18 are the source evidence; run D waits on FE-1187's reshaped surfaces. Not a frontier itself.

### Recently Completed

- 2026-07-14 `FE-1196 platform debt` — **✓ closed and outer-witnessed**: spec posture, workspace DB identity, headless ask discovery, reconciliation derivation, native compaction continuity, and active-branch session correctness are materialized; `web-driver-streaming` was evaluated and retired, and transcript-ledger rendering moved to FE-1187. Full closeout: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md#2026-07-14-sync-archive-ln-sync-fe-1196-platform-debt-closeout).
- 2026-07-14 `petri-execution-parity` (FE-1195) — completed the old-`main` live-parity closure and final review hardening: timestamped firing wire with calendar-valid TypeBox boundary checks, structural pass/fail branches with strict list/detail failed-slice evidence, stale serial-state retirement at parallel admission, journal-idempotent restart-stable terminal authority, rejection of every post-terminal fact, causality-gated Petrinaut replay/export, staging-aligned SDCPN parsing that retains legitimate full roots, and a view-only projection with mechanically pruned isolated places, preserved connected IDs/arcs, contextual labels, locale-independent ordering, and collision-free compact/legacy fallback bands. Durable terminal evidence wins over later abandonment metadata; raw executor topology/markings and SSE firing order remain unchanged. Full per-slice attempt identity remains the current projection; standardized subnet grouping/folding should be revisited above roughly 12 slices without claiming color-fold parity. Manual Rust fixture comparison remains pre-PR outer evidence.
- 2026-07-13 `petrinaut-live-run-stream` (FE-1190) — merged #322 to `next`; live-from-start observation, reconnect equivalence, fail-closed journal appends, and terminal-lagging-snapshot backfill landed. FE-1183 closed with it.
- 2026-07-10 `walkthrough-remediation-1` (FE-1180) — closed by explicit promotion: deterministic repairs landed and all remaining failures/unknowns moved to FE-1187.

Older completion history: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md).

### Next — Group 3 · agent layer

- `develop-mode` — third operational mode `develop` / `engineer` agent, **built flag-gated** (create the mode; enable only behind a flag). **Authority model settled 2026-07-13: not a contract-breaker** — `develop` sits at the same concentric visibility/authority tier as `execute`; `engineer` is simply not constrained by the executor's workflow (no `execute_*` lifecycle obligations), and is initially just a Brunch-aware coding assistant. Entry remains a SPEC revision (D98-L "two modes only", the D40-L matrix row at the execute tier, per-mode kick/consult-suppression axis), but no authority-model redesign is needed. Cost read revised: mechanical ≈ a day + prompt/conduct work. The `develop` CLI subcommand name is already reserved by `cli-mode-entry`.
- `subagent-skill-access` — **admitted 2026-07-13**: extend the subagents extension so subagents can access named skills; the user has local changes to integrate — inventory them at pickup. Prerequisite for `reviewer-agent-mode`. Definition below.
- `reviewer-agent-mode` — reshaped 2026-07-13: the D29-L advisory reviewer is a **subagent**, not a primary agent/mode. Narrow write authority to `reconciliation_need` stands (I16-L); A16-L trigger/scope questions resolve at pickup. Depends on `subagent-skill-access` for skill-carried review conduct.
- `review-commentary-widening` — reshaped 2026-07-13 to the TUI-realistic version: afford `#`-mentioning of review items and attribute comments via mention (req 18 reference-code seam), instead of a widened structured payload + bespoke collection UI. Re-expresses over the D116-L declared-ask/answer payload; needs a SPEC decision at pickup.

### Cleanups — Group 4

- `legacy-question-read-path-retirement` — rides the Group 1 stack as a cleanup slice (together with the D117-L sweep-anchoring one-liner in `sweep-watermark.ts`); no standalone Linear issue or branch. Definition below.
- `named-inline-extension-identity` — Pi-native P1: adopt Pi's native named-inline-extension type for useful source provenance; small independent hardening, direct housekeeping or a tiny tooling slice.
- `web-driver-streaming-residue` — from the retired evaluation (2026-07-13): (a) **conditional** `agent_settled`-ordering relay assertion (`agent_end` precedes `agent_settled`; consumer stays busy until settled) as one row/test in the existing relay battery — trigger: a web consumer starts gating idle-only actions on full-run settlement (closure oracle: `docs/planning/pi-native-integration-opportunities.md` §P0); (b) doc refreshes for `ln-sync`: `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` answering matrix is stale post-D125-L (discovery mode-complete; answering landed with ceilings), and `src/rpc/TOPOLOGY.md`'s streaming ledger needs an ○ row for the conditional assertion.
- `test-tmpdir-hygiene` — vitest `mkdtemp` fixtures are never cleaned up: ~249k `brunch-*` directories had accumulated in the darwin tmpdir by 2026-07-14 and filled the disk mid-gate (found during FE-1201). Add a global teardown or route fixtures through a repo-local scratch root (the `git-slice-integration-port.test.ts` `tmp/` pattern). Tiny tooling slice; re-entry trigger: next disk-pressure incident or the next test-infra touch.

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
- `mechanism-trace` — **demoted to Later 2026-07-13**; the slim `sweep-debt-tripwire` row was extracted into FE-1187 (Group 1). The full carrier-classified trace (`wiring`/`nudge`/`conduct`) + static wiring inventory re-enter when instrumentation is prioritized. Definition below.
- `consequential-fact-discovery-tracer` — **Later (2026-07-13)**: bounded Tier-2 real-provider tracer for the consequential-fact discovery oracle. Re-entry: after Group 1 closes and the ask/prompt surface stabilizes. D125-L has closed the ask-discovery prerequisite; a useful tracer report is the remaining campaign gate. Definition below.
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`. Relation: Later `mechanism-trace` is the transcript-native sibling (carrier classification, no event plane); if both land they may join on a shared trace vocabulary. Absorbs Pi-native P5 (provider/cache observability — latency, cache behavior, whole-run spans), spike-led.
- `multi-session-daemon-architecture` — unscheduled architecture note: if Brunch ever needs attachable live-session hosting beyond the current TUI-owned sidecar, prefer an optional local session-host layer that owns live foreground session topology only, not graph/transcript/executor truth. Design: `docs/design/MULTI_SESSION_DAEMON_ARCHITECTURE.md`; thin decision candidate: `docs/design/SESSION_HOST_DECISION_CANDIDATE.md`.
- `petri-epic-integration` — epics become integration gates, not just identity labels: an epic-complete transition gated on member slices, with epic-level verification/fan-in in the compiled topology (`epicId` identity already flows through subnets and emitted facts). Behind `petri-slice-isolation-fan-in`; shape via `ln-grill`/`ln-scope` at pickup.
- `petri-durable-parallel-authority` — the repeatedly deferred authority flip (SPEC §Future Direction): durable marking/journal authority for concurrently firing side effects once `run.json`'s single-status ladder cannot represent in-flight parallelism. Final member of the admitted Petri sequence. Promote only when `petri-slice-isolation-fan-in` evidence shows serial authority is the binding constraint — do not pull it forward for old-`main` Petrinaut parity.

### Retired / Never

- `coherence-first-class` — retired as an independent frontier; future coherence work should be driven only by a concrete triggering frontier that needs it.
- `flue-pattern-adoption` + `framework-direction-stubs` — removed from Horizon 2026-07-08: both are postures/directions, not work items, and both already live in `memory/SPEC.md` §Future Direction ("Adoption patterns from Flue"; "Framework alignment & deferred subsystems"). Re-enter only via a concrete triggering frontier.
- `geolog-and-petri-execution` — split 2026-07-08: Petri moved into FE-1183 `petri-interpreter-port`, closed 2026-07-13 (#320 replay/export closure, #322 live stream); geolog can re-enter only when it has its own triggering seam instead of sharing a vague exploratory bucket.
- `fixture-vs-real-audit` — dropped 2026-07-08 (action-or-drop call): its operative content graduated into `ln-review`'s contract-lens catalog (the opaque-companion lens carries the untested-against-real angle); run `ln-induct` on fresh evidence rather than keeping a standing audit bucket.
- `roving-suite-flake` — dropped 2026-07-08 (action-or-drop call), re-opened and closed by same-day `ln-diagnose`: repeated full-suite runs reproduced the `git-host-promotion-port` timeout while isolation stayed green; phase timestamps showed no `git apply` hang, only cumulative spawned-git slowdown under default Vitest worker load, with the real-TUI harness showing the same scheduling sensitivity. Fix: `npm test` caps Vitest at 4 workers and the promotion real-git fixture removes clone/pull/config churn while preserving the real patch/apply witness. Oracle: default `npm test -- --reporter=dot` passed after the cap (228 files passed / 1 skipped, 1561 tests passed / 3 skipped, ~53s).
- `blank-carrier-sweep` — folded 2026-07-08 into the FE-1163 ledger as row 13 (`exchanges-blank-carriers`); no longer a standalone Horizon item.

## Frontier Definitions

<!-- component-dx (FE-1115) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08 hygiene pass);
     frontier closed as done for DX. Durable truth: src/dev/TOPOLOGY.md §Component Preview Harness,
     src/.pi/components/TOPOLOGY.md. UX component work opens fresh frontiers in the chrome batch. -->

<!-- exchange-ask-refinement (FE-1164) archived to docs/archive/PLAN_HISTORY.md (2026-07-10 ln-sync); durable truth: D116-L/D125-L, exchange topology homes, runtime-mount and supersession probes. -->

<!-- exchange-rendering (FE-1123) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: D104-L, D108-L, exchange-family-completeness.test.ts, src/exchanges/TOPOLOGY.md. -->

<!-- exchange-answering-chrome (FE-1138) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-06 ln-sync);
     durable truth: docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md (mechanism + coverage matrix + pi-bump
     re-verification checklist), src/.pi/components/TOPOLOGY.md + src/.pi/extensions/exchanges/TOPOLOGY.md,
     the session.submitExchangeResponse ctx.ui.*-independence contract test, and the component direct/harness
     test families. Deferred post-gate residue: per-item review commentary (see Horizon `review-commentary-widening`). -->


<!-- exchange-capture-contract (FE-1135) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-03 ln-sync);
     durable truth: I57-L, the five governing invariants in the ingest/elicit/map conduct homes (pinned by
     src/probes/__tests__/exchange-capture-contract-proof.test.ts), sweep-window exclusions in
     sweep-watermark.test.ts, and the canonical formatMutateGraphResult approval receipt in
     session.submitExchangeResponse. Consumed sweep ledger deleted. -->

<!-- present-digest (FE-1136) full definition archived to docs/archive/PLAN_HISTORY.md (2026-07-06 ln-sync);
     durable truth: D110-L, D106-L echo, I57-L digest chain witness (present-digest-supersession-proof.test.ts
     + 2026-07-06 live walkthrough beat), retired DIGEST_CUSTOM_TYPES, topology homes named in D110-L.
     Consumed scope card memory/cards/present-digest--exchange-kind.md deleted. -->


<!-- main-editor-chrome (FE-1169) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-09 sync, merged #305);
     durable truth: D22-L/D35-L chrome projections, D104-L revision, src/.pi/components/TOPOLOGY.md,
     src/.pi/extensions/chrome/TOPOLOGY.md, src/.pi/extensions/exchanges/TOPOLOGY.md, src/dev/TOPOLOGY.md.
     Outer manual beats ride the alpha walkthrough lane (TESTING_PLAN.md Concern 7). -->

<!-- walkthrough-remediation-1 (FE-1180) archived to docs/archive/PLAN_HISTORY.md (2026-07-10 ln-sync); WR18 residue lives in walkthrough-remediation-2 / FE-1187. -->

### legacy-question-read-path-retirement

- **Name:** Retire legacy `present_question` read paths and fixtures
- **Linear:** none — Group 4 cleanup; rides the Group 1 stack, no standalone issue/branch (re-qualified 2026-07-13)
- **Status:** cleanup slice on the FE-1187 / `cli-mode-entry` stack, paired with the D117-L sweep-anchoring one-liner
- **Kind:** earned deletion / vocabulary convergence
- **Certainty:** earned — D116-L's ask write path is settled; this frontier removes only persisted-read compatibility branches and stale fixtures.
- **Deletes / retires:** `present_question` branches in pending-exchange scan and recovery skip; `src/.pi/README.md`'s legacy-vocabulary section; old-tuple fixtures in session/RPC/editor/probe tests after checking committed `.fixtures/runs/` for required historical evidence.
- **Keeps:** the pending-exchange scan as the `session.pendingExchange` compatibility projection; current ask/request-detail transcript semantics. Note (2026-07-13): `headless-ask-discovery` moved the *driver* discovery seam off the scan (live registry + `session.openAsks`), so the scan is no longer kept for driver discovery — it is retained here because it still serves this frontier's own legacy `present_question` pending reconstruction. Fully retiring the scan is now this frontier's work (it owns the `present_question` read-path removal), not `headless-ask-discovery`'s.
- **Traceability:** D116-L, D125-L; 2026-07-09 `ln-induct` finding 4 over PR #304. The write-path half already landed on #305.

### walkthrough-remediation-2

- **Name:** Walkthrough chapter closure — remediation, evidence, and design follow-through (absorbs FE-1167)
- **Linear:** [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure); close [FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation) as merged at pickup.
- **Branches:** `ln/fe-1187-walkthrough-remediation-2` (interim tie-off: auth/model reversal + first remediation cluster) → `ln/fe-1187-walkthrough-remediation-3` (stacked continuation for the remaining rows).
- **Kind:** coverage-shaped closure batch: WR18-promoted remediation rows + absorbed LN evidence beats + folded design rows + the tripwire row.
- **Certainty:** proving.
- **Classification:** evidence-gated.
- **Entry:** **landed 2026-07-13** — D123-L exposes Pi's full provider/model surface, deletes the allowlist and standalone `brunch login`, sets a soft recommended default, and re-keys I59-L to resolvable provider auth. The no-auth J1 warning and no-carrier walkthrough proof are recorded in `TESTING_FINDINGS.md` R3. This satisfies the entry gate for Groups 2–3 once the branch stack lands on `next`.
- **Progress:** closed Shift+Tab/mode-cycle conflict, provider/model restrictions, startup warning/login path, duplicated origination payloads, Pi-documentation prompt leakage, no-model guidance/no-carrier proof, active `request_*` lexicon drift, self-describing cancellation, standalone-cancel guidance, `/introspect` legibility, and the sweep-debt JSONL tripwire. The deterministic `remediation-3` tranche is commits `5ff21bf2`, `d6f5683a`, `9d7cb2eb`, `1a41592`, `78840e8f`, and `1852a7d4`. Repeated-offer, design/oracle fan-in, compact tool rendering, exchange markdown, review-set cards, and nested-Escape help already have production contracts plus inner oracles; no ceremonial implementation was added. Live prepared scope: [`memory/cards/walkthrough-batch-2--seed-variants.md`](cards/walkthrough-batch-2--seed-variants.md) Card 3, absorbed from FE-1124.
- **Current execution pointer (2026-07-14 walkthrough pause):** Session B beats 1–3 promoted R5–R13 and the [`consolidated outer checkpoint`](cards/walkthrough-remediation-2--consolidated-outer-checkpoint.md) remains paused. R5 is closed by commit `daba4cda` plus live transient-notification evidence; R7 by `b882d70f` plus live controls-only continuation evidence; R11 by `1343a7c4`, composed-prompt/carrier oracles, and authenticated live confidentiality/disclosure evidence. Unresolved routes remain: R6 four-state result visuals, R8 digest confirmation/carrier, R9 questionnaire vs sequential asks, and R10 large/mixed-settlement review shape through `ln-design`/`ln-spec`; R12 through `ln-diagnose`; R13 through `ln-disambiguate`/`ln-spec`. Resume the checkpoint only after these promoted routes are dispositioned.
- **Remaining findings inventory:** R6/R8/R9/R10/R12/R13 as routed above; remaining consolidated LN outer evidence; O7/O8/O9 live D120-L Execute workflows (KA-coordinated).
- **Streams:** rows O7/O8/O9 witness KA-stream (Execute / D120-L) surfaces — coordinate with the KA stream before building them; all other rows are LN.
- **Absorbs (2026-07-13, from FE-1167):** the LN evidence beats — orientation-menu generative beats (propose/project) with menu→conduct routing evidence via session JSONL; FE-1124 Card 3 review variants ([`memory/cards/walkthrough-batch-2--seed-variants.md`](cards/walkthrough-batch-2--seed-variants.md)) + seed worklist; FE-1164 residue (declared continuations driven live, capture sweep after ask answers, resume re-render of persisted ask results, web sidecar during an open ask, both-theme gallery re-check). Execute beats + KA residue carve to the KA sub-list (§KA stream). Full original definition: `docs/archive/PLAN_HISTORY.md`.
- **Folded design rows (2026-07-13/14, promoted findings):** `exchange-visual-design` — the WR9–WR12 cluster (compact tool rendering, `/introspect` legibility, review-set/ask visual revamp, markdown/node-id polish) plus border distinctness and nested-ask chrome (findings A6/A9/A10), now also owning Pi-native P2 `transcript-ledger-rendering` (durable user-choice ledger entries visible in the transcript without entering model context; folded by user ruling 2026-07-14); `generative-flow-synthesis-shape` — design-it-twice + recommendation/synthesis conduct over existing `present_candidates`/review-set seams (finding C3).
- **Tripwire row (2026-07-13, extracted from Later `mechanism-trace`):** `sweep-debt-tripwire` — scenario-scoped assertion that on expected-capture scenarios the conversational tail preceding a watermark shows capture evidence (`mutate_graph`/scratchpad conduct), and on deliberately-ignored-material scenarios it does not fire; the graph-writes-after-answers witness (A40-L detection half). ~a day; no `before_agent_start` advance change.
- **Dependencies:** owns all WR18 residue promoted out of FE-1180; closes arc `deterministic-orientation` (jointly with the KA-carved Execute beats). The auth reversal has landed in the FE-1187 stack; Group 2 is closed and Group 3 is independently pickup-ready. `cli-mode-entry` stacks on the auth-reversal branch; `legacy-question-read-path-retirement` + the D117-L one-liner ride the same stack as cleanup slices.
- **Traceability:** WR18 closure record in `TESTING_FINDINGS.md`; evidence at `testing/walkthroughs/2026-07-10/WR18-manual.md`; D113-L–D115-L reversal/disambiguation; D119-L, D120-L/I62-L, D99-L conduct; TESTING_PLAN concerns 1/3/4/6/7.

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

<!-- walkthrough-evidence-batch (FE-1167) merged into walkthrough-remediation-2 (FE-1187) on 2026-07-13 (re-qualification pass); close FE-1167 in Linear as merged at pickup. Full definition (five residue groups, workbench commands) archived to docs/archive/PLAN_HISTORY.md. LN beats absorbed by FE-1187; Execute/KA beats carved to the KA sub-list (see §KA stream). Arc deterministic-orientation now closes via FE-1187. -->

### consequential-fact-discovery-tracer

- **Name:** Consequential-fact discovery — bounded Tier-2 oracle tracer
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`; start after FE-1187 stabilizes the ask/prompt surface)
- **Kind:** structural verification tracer — establishes a new prompt/context-quality probe and report seam over existing Tier-2, transcript, graph-readback, and fixture contracts.
- **Status:** Later (2026-07-13); not started. Re-entry: after Group 1 closes and the ask/prompt surface stabilizes.
- **Certainty:** proving.
- **Objective:** Prove that consequential-fact discovery is measurable without a generic eval framework: drive a bounded Petri-net editor elicitation through the real Brunch/Pi boot path with a real Brunch provider and controlled user responses; compare four human-authored private invariants against transcript attribution and final graph truth; emit a portable, reviewable JSONL-backed report from `.fixtures/scratch/`.
- **Why now / unlocks:** The R&D tasks suggest elicitation depth is valuable only when consequential facts become inspectable truth, but Brunch has no discriminating regression oracle for that claim. D125-L has already supplied live ask discovery/answering; this tracer must now validate the hidden-fact oracle before corpus/framework breadth. A useful report unlocks one novel/non-inferable scenario and can justify planning the full autonomous agent-as-user campaign.
- **Lights up:** the bounded Tier-2 real-provider path from public brief + private hidden-fact ledger → controlled ask/answer trajectory → warranted durable graph facts → machine-checkable fitness report.
- **Stabilizes:** A5-L's oracle/artifact shape and SPEC §Verification Design's boundary between structural gates and behavioral fitness; it does not claim A5-L fully validated.
- **Acceptance:**
  - The probe-local scenario declares the public Petri-net brief, four private invariants (bipartite arcs, no dangling arcs, no duplicate pair, directionality), reveal/confirmation policy, required graph predicates, forbidden rivals, and a turn budget; private facts never enter Brunch context before a legitimate reveal.
  - The base scenario and one controlled metamorphic variant each run three times through Tier-2 real boot with a real provider. Controlled user responses may use existing product-supported harness/broker seams, but the probe must not create a new product transport or make transcript pending-state scanning canonical.
  - Each report records exact model/prompt/resource stamps and separately reports discovery, warranted basis before commitment, forbidden overclaims, turns-to-discovery, timeout/unavailable/partial outcomes, and cross-run variance. A fact passes only when durable graph truth and prior transcript warrant agree; correct silent inference alone does not pass.
  - Source `session.jsonl`, report JSON, and graph readback are portable and written under `.fixtures/scratch/<probe-id>/<run-id>/`; promotion to `.fixtures/runs/` is manual after review.
  - The tracer ends with an explicit usefulness verdict. If useful, route through `ln-plan` for one novel/non-inferable scenario (review-diff class or freshly mined real-project case); do not generalize a corpus, actor framework, or full campaign in this frontier. If not useful, record why and stop.
- **Verification:** inner — scenario/report schema and transcript-attribution summarizer tests, including private-fact non-leak and every outcome classification; middle — hidden-fact ledger × transcript attribution × graph-readback differential, negative-space rivals, three-run variance, and one metamorphic pair; outer — sampled human adjudication of unmatched semantic graph representations and the final usefulness verdict. See `memory/SPEC.md` §Verification Design.
- **Cross-cutting obligations:** keep briefs as probe inputs rather than canonical artifacts; preserve sealed-profile/Tier-2 real-boot semantics; start in `.fixtures/scratch/`; deterministic checks dominate semantic judging; one named intervention changes per comparative campaign.
- **Traceability:** requirement 24; A5-L; D39-L; D99-L; `memory/SPEC.md` §Verification Design; `src/dev/TOPOLOGY.md`; `docs/architecture/probes-and-transcripts.md`.

### mechanism-trace

- **Name:** Mechanism-provenance trace — carrier-classified transcript timeline + sweep-debt tripwire
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`; no stack dependency)
- **Status:** demoted to Later 2026-07-13; the slim `sweep-debt-tripwire` row was extracted into FE-1187 (Group 1) and carries the detection half of the sweep-reliability blind spot. The full trace + static wiring inventory re-enter via re-qualification when instrumentation is prioritized
- **Kind:** structural — a new dev/observability projection seam over the transcript substrate. Dev/eval artifact, never product truth (same discipline as Horizon `agent-tracing`: no event-spine backdoor).
- **Certainty:** proving — whether a carrier-classified timeline actually makes provenance legible during a walkthrough (and whether the tripwire fires cleanly without false positives) is the open question; the classification substrate itself is well-understood.
- **Why now / unlocks:** the 2026-07-08 capture-sweep grill established that during manual walkthroughs the user cannot tell whether an agent action was product-forced, event-nudged, or freely chosen — and that sweep ingestion has no conduct-level oracle (SPEC blind spot "Sweep ingestion reliability", A40-L). The trace is the instrument; the tripwire is its first paying customer. FE-1187's absorbed walkthrough beats become materially cheaper to interpret with it.
- **Objective (three parts, grilled 2026-07-08 — Q1–Q7 record in the grill session):**
  1. **Mechanism trace (the spine):** a post-hoc projection over a session JSONL that renders an interleaved timeline of entries classified by carrier — `wiring` (ledger-only product appends: `brunch.capture_sweep_watermark`, `brunch.own_mutation`, orientation entries — the `PreparedLedgerEntry` class), `nudge` (provider-visible product injections — the `PreparedMessageEntry` class, e.g. `worldUpdate`), `conduct` (agent tool calls / toolResults). Consumable as an extended `.brunch/debug/` mirror or a standalone read command; post-hoc first (Q7), no live surface.
  2. **Static wiring inventory:** a short canonical document enumerating every deterministic product append site and visible nudge, so the trace's carrier classes are auditable against code rather than folklore. Home: co-located topology or `docs/design/`, decided at scope time.
  3. **Sweep-debt tripwire (derived assertion, Q1/Q3/Q5):** over the trace, assert per scenario — on expected-capture scenarios the conversational tail preceding a watermark shows capture evidence (`mutate_graph`/scratchpad conduct); on deliberately-ignored-material scenarios it does not fire. Outer-loop oracle first; a runtime nudge only if walkthroughs show actual stranding. No change to the `before_agent_start` advance (Q2 — `turn_end` stays a future upgrade under A40-L).
- **Annotations:** Lights up: provenance legibility over any session transcript (the walkthrough instrument). Stabilizes: the three-carrier classification as the canonical provenance vocabulary. Retires (partially): the "Sweep ingestion reliability" blind spot's *detection* half — A40-L's capture-conditional advance stays open.
- **Explicitly out:** capture-conditional watermark advance / `turn_end` rewiring (A40-L, future); live in-session trace surface (Q7 — post-hoc first); the D117-L constant-anchoring hardening (direct fix, not frontier work); Pi lifecycle-event span tracing (Horizon `agent-tracing` — that frontier is event-plane instrumentation; this one is transcript-native classification; they may later join).
- **Convergence:** `walkthrough-remediation-2` (FE-1187) absorbed the "capture sweep after ask answers" beat; it is the tripwire's first live scenario. Refresh pressure on `src/probes/capture-quality-loop.ts` (last promoted run 2026-06-08) can ride this frontier's tripwire scenarios rather than a separate pass.
- **Traceability:** A40-L, D117-L, D80-L (capture as conduct), D81-L (commitment gradient), I57-L (accepted-terminal read rules), SPEC blind spot "Sweep ingestion reliability (optimistic watermark)"; `src/projections/session/sweep-watermark.ts`, `src/session/prepare-next-turn.ts` (`PreparedLedgerEntry`/`PreparedMessageEntry`), `src/.pi/extensions/dev-mode/introspection/`.

<!-- alpha-release-readiness (FE-1159) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-09 sync,
     1.0.0-alpha.0 published under dist-tag alpha); durable truth: D113-L/D114-L/D115-L, I59-L,
     check:release-pack, src/app/TOPOLOGY.md. -->

<!-- session-entry-orientation (FE-1134) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #289);
     durable truth: D109-L, src/.pi/extensions/TOPOLOGY.md, src/session/TOPOLOGY.md.
     Outer walkthrough evidence rides walkthrough-evidence-batch (FE-1167). -->

<!-- execute-entry-readiness (FE-1137) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #290);
     durable truth: D40-L concentric matrix (agent-runtime-authority-matrix.test.ts), D109-L esc-inert revision,
     readiness-bands.md §Agent Use. Outer evidence + the two deferred orientation-choice questions ride FE-1167. -->

<!-- walkthrough-fixes (FE-1122) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #286);
     findings ledger TESTING_FINDINGS.md; walkthrough continuation rides FE-1167. -->

<!-- orchestrator-tool-port (FE-1107) definition archived to docs/archive/PLAN_HISTORY.md (2026-07-08, merged #298);
     mechanism delivered by the KA executor lane (D111-L/D112-L/I58-L; src/executor/TOPOLOGY.md).
     KA-conversation residue (card GC, close-or-narrow, demo session, post-KA plan pass) rides FE-1167. -->

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


### petri-interpreter-port

- **Name:** Execute-mode Petri interpreter port — subnet-preserving scheduler/runtime
- **Linear:** [FE-1183](https://linear.app/hash/issue/FE-1183/port-petri-interpreter-to-alpha-orchestrator)
- **Branch:** interpreter landed through PR #311; plan alignment through #319; final replay/export closure on `ka/fe-1183-petrinaut-replay-export` (PR #320)
- **Kind:** structural / executor run substrate
- **Status:** implementation complete; PR #320 is the final FE-1183 observer-only closure. It adds validated SDCPN v1 projection plus finite artifact-backed replay/SSE/launcher surfaces. Live-from-start streaming and durable parallel side-effect authority are separate frontier decisions.
- **Certainty:** proving.
- **Why now / unlocks:** D112-L shaped `RunScheduler.ready()` as a set-returning seam so the Petri scheduler could replace the flat status ladder without reshaping callers. FE-1183 materialized that executor runtime structure; later questions such as durable parallel side-effect authority and semantic/review lanes can now be scoped over a real net instead of another round of status-enum surgery.
- **Objective:** Port the `main` Petri substrate (interpreter, transition contracts, firing-policy seam, structured transition events) into `src/executor/` as an internal runtime that drives today's step handlers. Compile the current execute lifecycle into **explicit subnets**, not a flat list of ready steps: at minimum a run-control subnet plus per-slice subnets keyed by stable slice ids, with subnet/lane identity preserved in the compiled topology even if the first tracer still fires serially. The first landing must preserve current product truth — existing lifecycle step functions remain the only side-effecting boundaries; `run.json` stays loop state for observers/recovery; `execute_petri_export` remains a projection/export surface, not a second runtime.
- **Acceptance sketch:**
  - (1) A Petri runtime under `src/executor/` can drive the current lifecycle end-to-end through injected step handlers, and `drive()` can be backed by either the existing linear scheduler or the new Petri scheduler without changing callers.
  - (2) The compiler emits explicit subnet metadata/ids for run-control and slice-control groups rather than flattening directly to `ReadyStep`s; current topology may remain serial, but the grouping is structural from day one.
  - (3) The first compiled net reproduces today's lifecycle ordering exactly (`created` → `worktree_created` → `worktree_populated` → `source_policy_selected` → `source_copied` → `reports_initialized` → slice loop → `run_completed` → `petri_exported` → `promotion_prepared`) and halts in the same places the current steps hold status unchanged.
  - (4) Structured transition events are emitted as Brunch-owned executor runtime facts rather than inferred later from `run.json` diffs.
  - (5) Naming and read surfaces stay honest: the existing `petrinaut/net.json` export/read path is clearly treated as a raw projection of run state, not confused with the interpreter's internal runtime representation.
  - (6) Non-goals for the first tracer: graph compilation, semantic/oracle/review lanes, durable marking persistence, Petrinaut live sync, and any geolog coupling.
- **First tracer:** compile a serial net for the current executor lifecycle using today's step functions as transition actions, preserving subnet ids and transition contracts now while explicitly deferring parallel firing and marking persistence. The tracer should prove the topology split (`compileExecutorTopology(...) -> blueprint`, `wireExecutorHandlers(...) -> runtime net`) before any attempt to outgrow the current lifecycle.
- **Current execution pointer:** the alpha-orchestrator tracer, compiled export, raw runtime-event journal, replay read model, export-honesty hardening, and first durable-marking seam are landed on [`ka/fe-1183-petri-interpreter-port`](https://github.com/hashintel/brunch/pull/311) via [`src/executor/orchestrate-topology.ts`](../src/executor/orchestrate-topology.ts), [`src/executor/orchestrate.ts`](../src/executor/orchestrate.ts), [`src/executor/petri-runtime.ts`](../src/executor/petri-runtime.ts), [`src/executor/petri-terminal.ts`](../src/executor/petri-terminal.ts), [`src/executor/petri-events.ts`](../src/executor/petri-events.ts), [`src/executor/petri-marking.ts`](../src/executor/petri-marking.ts), [`src/executor/petri.ts`](../src/executor/petri.ts), [`src/executor/petri-replay-eligibility.ts`](../src/executor/petri-replay-eligibility.ts), and [`src/executor/petri-replay.ts`](../src/executor/petri-replay.ts), plus the executor/RPC/web tests: explicit run/slice subnet compilation, explicit place/arc + `initialMarking` export, duplicate slice-id rejection, `petriScheduler` lifecycle parity, executor-owned transition events, preserved epic identity in compiled subnets/transitions and emitted `transition_fired` facts, graph-derived slice provenance (`definition`, `verification`, `derived_from`) preserved through scheduler projection into slice subnets/export and surfaced as `derivedFrom` on emitted slice transition facts, shared transition readiness/terminal classification helpers, a materialized serial runtime (`currentMarking`, enabled transitions, ready steps) plus bound transition executors that dispatch through the existing lifecycle step handlers, persisted `petrinaut/events.jsonl` tails through `execute.run`, a persisted `petrinaut/marking.json` snapshot for current marking / fired-count / terminal summary with replay fallback when absent or unreadable, a persisted claim-set inside that marking snapshot so read surfaces can distinguish "currently reserved by Petri" from lifecycle facts already reflected in `run.json` and a restarted drive can honor the same claimed firing order when provenance still matches, including through the default linear execute loop, while refusing corrupted overclaimed claim-sets that do not co-fire from the live marking, stripping impossible or uncheckable claim sets from read projections, rejecting provenance-matching snapshots whose persisted `currentMarking`, `firedTransitionCount`, or terminal summary contradict replay-backed or lifecycle-checkable truth, rejecting malformed terminal payload pairings at both the persisted-snapshot and live-update boundaries, and now stripping replay terminal summaries too when the raw journal reports contradictory or under-specified terminal tails instead of trusting the last one, a derived `petriProjection` surfaced through `execute.run` and now through live `execute.run` product updates/cache patches with explicit replay-reason clears when later snapshot-backed updates supersede replay hints plus boundary validation that rejects malformed projection payloads instead of desynchronizing cached source/replay metadata, and epic-aware `petriReadySteps` / `petriBlockedSteps` surfaced through executor/RPC/web read paths with active slice identity preserved on in-flight slice steps rather than collapsing to anonymous `slice_execute` / `agent_result` / `test_result` / `slice_complete` labels. Durable parallel side effects remain deferred because `run.json` is still the only lifecycle authority.
- **Traceability:** D111-L (executor lifecycle ownership in `src/executor/`), D112-L (set-returning scheduler seam now materialized by the Petri runtime), `memory/SPEC.md` §Future Direction "Plan execution & Petri-net compatibility", and the proven prior-art substrate on `main` (`src/orchestrator/src/petri-net.ts`, `docs/next/architecture/plan-graph-petri-orchestration.md` — especially the slice-net/subnet model).
- **Review-clean reconciliation (`5ae01c98`):** [`src/executor/petri-runtime-plan.ts`](../src/executor/petri-runtime-plan.ts) now owns one populated-plan fallback set for `drive()` and observer reads, preventing read-side ready/blocked hints from diverging from driver semantics when metadata omits `populatedPlanPath`. Runtime materialization now fails closed: duplicate slice ids or otherwise invalid topology halt `drive()` with `petri_input_unreadable` and emit `net_halted` instead of rejecting the tool call. Focused regressions cover both seams; the full `npm run verify` gate passed.
- **Post-review correctness closure:** explicit populated plans are authoritative; duplicate, dangling, self-referential, and cyclic topology plus unreplayable lifecycle history fail closed at every drive status; persisted claims require matching marking and firing count; nonterminal exhaustion is `net_deadlocked`; empty journals cannot project replay state; unreadable runtime updates clear cached ready/blocked hints.

### petrinaut-live-run-stream

- **Name:** Petrinaut live run stream — pre-execution definition through terminal replay
- **Linear:** [FE-1190](https://linear.app/hash/issue/FE-1190/petrinaut-live-run-stream)
- **Branch:** `ka/fe-1190-petrinaut-live-run-stream` ([PR #322](https://github.com/hashintel/brunch/pull/322), off `next`)
- **Kind:** structural observer transport over the executor event journal.
- **Certainty:** proving.
- **Lights up:** a Petrinaut connection established before the first executor transition, with late-join replay equivalent to the observed live sequence.
- **Objective:** materialize the immutable SDCPN definition and empty event journal before execution, attach a run-scoped stream before the initial marking/first transition, and deliver validated definition → initial state → firings → terminal frames without changing `run.json` lifecycle authority.
- **Acceptance sketch:** production lifecycle test connects before the first transition; reconnect receives the same ordered timeline; terminal closes the stream; malformed artifacts fail closed; configured-origin CORS remains enforced; stream observers cannot mutate or claim execution.
- **Depends on:** FE-1183 / PR #320 finite replay contract. Explicitly excludes durable parallel side-effect authority.
- **Traceability:** D111-L, D112-L, I58-L; `src/executor/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`.
- **Status:** ✓ merged (#322, 2026-07-13); FE-1190 closed. Durable truth: SPEC §Future Direction "Plan execution & Petri-net compatibility" (journal-ordered completion, fail-closed appends, terminal-lagging-snapshot backfill), `src/executor/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`. Definition retained while the Petri sequence builds on its contracts; archive at next `ln-sync`.


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

group-1 (Active — walkthrough closure):
  walkthrough-remediation-2 (FE-1187, absorbs FE-1167 — close FE-1167 as merged)
    entry: settled D113-L–D115-L reversal (ln-spec first; folds Pi-native P4)
    rows: WR18 punch list + absorbed LN evidence beats + exchange-visual-design
          + generative-flow-synthesis-shape + sweep-debt-tripwire
    -[stack]-> cli-mode-entry (reserves `develop` subcommand)
    -[stack]-> cleanup slices: legacy-question-read-path-retirement + D117-L one-liner
    cross_stream: O7/O8/O9 + carved Execute beats — coordinate with KA
    closes_arc: deterministic-orientation (jointly with KA-carved beats)
    status: auth reversal landed; Group 2 closed; Group 3 pickup-ready

# FE-1196 Group 2 closed 2026-07-14; durable state is in SPEC/topology and
# docs/archive/PLAN_HISTORY.md. Conditional web-driver residue remains in group-4.

group-3 (Next — agent layer):
  develop-mode (flag-gated; execute-tier authority, no contract break)
  subagent-skill-access -[hard]-> reviewer-agent-mode (subagent reshape)
  review-commentary-widening (mention-based reshape)

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
