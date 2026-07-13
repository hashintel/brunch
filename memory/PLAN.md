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

**Ship gate (2026-07-03 grill) — nearly closed.** The shippable cut: working e2e flows and throughlines, clean simple invariants, complete contracts — minimal and pragmatic within those constraints, enhancements deferred. Four of the five gate frontiers are done and merged; all remaining gate evidence rides `walkthrough-evidence-batch` (FE-1167), the closing member of arc `deterministic-orientation`. The grill's settled calls live as decisions: two operational modes only (D98-L), concentric authority as a code contract (D40-L), generative flows offered at deterministic junctures (D109-L). Standing obligation while the gate is open: gate frontiers chart their decision flows (all paths and endpoints) at `ln-scope` time.

**Execute-mode substrate (KA lane, merged 2026-07-06/08).** `src/executor/` is a pure run-lifecycle core over injected `ExecutionPorts` (D111-L, D112-L, I58-L), exposed as executor-only `execute_*` tools, with a web-facing `execute.*` read surface. KA-conversation residue (FE-1107 close-or-narrow, executor-card GC, demo session, post-KA plan pass) rides FE-1167.

**Alpha release lane — shipped.** Brunch ships as `@hashintel/brunch@1.0.0-alpha.x` from the `next` trunk. `alpha-release-readiness` (FE-1159) closed 2026-07-09 with `1.0.0-alpha.0` live on npm under dist-tag `alpha` (D113-L allowlist, D114-L login, D115-L no-auth gate, `check:release-pack`). Subsequent alphas: `npm run release` from `next`.

**Exchange-ask cutover (D116-L, merged 2026-07-08).** A one-shot **ask** tool is now the only interactive structured-exchange terminal; `present_question` and the registered `request_response` collector are retired; offer presents declare their ask continuation in details. "Pending exchange" dissolved as a concept; headless RPC discovery of open asks is deferred (A39-L → Horizon `headless-ask-discovery`). Unwitnessed outer-loop residue rides `walkthrough-evidence-batch`.

**Merge waves (2026-07-08/09) + plan consolidation.** The braided ship-gate stack, alpha-readiness PR, component-DX PR, ask cutover, KA executor lanes (#286–#304), and the FE-1169 chrome batch (#305, 2026-07-09) are all merged to `next`. The 2026-07-08 `ln-plan` hygiene pass batched straggling outer-loop residue into `walkthrough-evidence-batch` (FE-1167), pruned non-frontier Horizon rows, and folded `blank-carrier-sweep` into the FE-1163 ledger. No open PRs remain from these lanes.

**Capture-sweep reliability lane (grilled 2026-07-08).** A trace of the capture-sweep mechanism surfaced that the watermark advance is optimistic (`sweptAt` asserts intent, not completion) and that agent-action provenance — product-wired vs event-nudged vs freely chosen — is illegible during walkthroughs. Settled as D117-L (include-list stays, fail-closed), A40-L (`turn_end` as a future capture-conditional upgrade, not now), and the "Sweep ingestion reliability" blind spot. The plan-level answer is one new frontier, `mechanism-trace`: a post-hoc carrier-classified transcript trace as the spine, with the sweep-debt tripwire riding it as a scenario-scoped outer-loop oracle. The D117-L constant-anchoring hardening is a direct fix outside that frontier.

**Alpha walkthrough lane (2026-07-09/10).** Post-PR-305 outer-loop walkthroughs (TESTING_PLAN.md concern groups; findings in TESTING_FINDINGS.md) ran A and C, then a same-day induct → grill → spec pass settled D118-L (spec posture persistence), D119-L (unified `/continue` + continue/wait lexicon), the D99-L digest-conduct clarification, and A41-L. The 2026-07-10 FE-1180 review/witness pass reopened `walkthrough-remediation-1`: required rows WR1–WR8 were built, but Execute labels diverged from their provider directives and several security/conduct/debug claims lacked discriminating evidence. D120-L/I62-L now settle the Execute workflows. FE-1180 closed by explicit WR18 promotion of remaining failures/unknowns into `walkthrough-remediation-2` / FE-1187. FE-1187 now owns the reshaped auth/model-policy, ask/recovery, debug/prompt, conduct, Execute, and both-theme evidence before later walkthrough beats depend on those surfaces.

**Petri execution lane (2026-07-12/13).** FE-1190's live stream merged (#322, 2026-07-13) after two Bugbot findings closed with deterministic oracles (fail-closed journal appends; terminal-lagging snapshot backfill from replay truth). FE-1192's attempt lifecycle then merged (#324, 2026-07-13). The remaining old-`main` parity work is consolidated into one frontier and PR: `petri-execution-parity` (isolated slice execution/fan-in, bounded durable parallel slice authority, then epic integration). The authority trigger fired during FE-1195 and is absorbed under D123-L rather than remaining a separate frontier.

**Topology and evidence discipline.** Directory `TOPOLOGY.md` files under `src/**` own current topology state. `memory/SPEC.md` owns the thin product contract and live decision/invariant index; long-form SPEC history is archived in `docs/archive/SPEC_HISTORY.md`. `memory/PLAN.md` owns only rolling frontier state. Scratch probe artifacts under `.fixtures/scratch/` are not durable evidence until reviewed and promoted to `.fixtures/runs/`.

**Consequential-fact discovery evaluation lane (2026-07-10 oracle design).** Prompt/context quality will be approached in two stages rather than by building a generic eval framework. The proving tracer `consequential-fact-discovery-tracer` uses a bounded Tier-2 real-boot Petri-net scenario to validate the hidden-fact-ledger × transcript-attribution × graph-readback oracle. Full autonomous agent-as-user campaigns remain promotion-gated on both a useful tracer report and Horizon `headless-ask-discovery`; at least one novel/non-inferable scenario must pass before the portfolio supports prompt/context-quality claims.

**Quarantine → re-qualification (2026-07-13).** The LN-stream frontier list was conditionally demoted (quarantined) and same-day re-qualified into thematic groups: **Group 1 · walkthrough closure** (the active block — FE-1187 absorbs FE-1167, the promoted design rows, and the slim sweep-debt tripwire), **Group 2 · platform debt** (API/data-model/transport items whose non-implementation compounds), **Group 3 · agent layer**, **Group 4 · cleanups**, the **KA stream** (Kostandin — executor/orchestrator/Execute mode; untouched by the quarantine and now also owning `planning-process-model`), and **Later** (instrumentation experiments). Ordering: Group 1 completes its auth reversal first; Groups 2–3 then interleave opportunistically, respecting per-item dependencies. Same-day groundwork: the owned-deferral discipline landed in `ln-scope`/`ln-build`/`ln-sync` + `docs/praxis/manual-testing.md` §Findings ledger discipline (guarded by `check:skills`); and FE-1187's spec-first entry direction settled — reverse D113-L–D115-L toward the full Pi provider/model range (Pi-native `/login` and `/model`, soft recommended default via Pi default-model settings, model recommendations as docs, no-auth turn gate re-keyed to "no resolvable auth").

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
  - `session-entry-orientation` — ✓ built + merged (#289, 2026-07-08); its outer walkthrough evidence rides `walkthrough-evidence-batch` (FE-1167).
  - `execute-entry-readiness` — ✓ built + merged (#290, 2026-07-08); its outer walkthrough evidence + the two deferred orientation-choice questions ride `walkthrough-evidence-batch` (FE-1167).
  - `walkthrough-remediation-2` (FE-1187, definition below) — the arc's remaining/closing member since 2026-07-13, when it absorbed `walkthrough-evidence-batch` (FE-1167): one witnessed e2e run per generative flow, menu→conduct routing evidence; the thin/rich Execute beats carve to the KA sub-list but remain part of the arc's done-definition.
- **Done-definition:** dialog fires on every named UI-capable juncture in TUI and RPC modes (extension-UI sub-protocol relay confirmed); escape/timeout resolves to the inert `dismissed` — entry recorded, no kick, so the menu is never a wall and esc always means "wait for me" (2026-07-06 revision, supersedes the earlier escape→`continue` mapping); no-UI modes leave no orientation trace; orientation entries are excluded from capture sweep (process state, not spec material) and readable by kick assembly; concentricity holds as an executable contract (executor tool + skill grants ⊇ elicitor's, write-execution tooling stays executor-only); **one witnessed e2e run per generative flow — intent, design, oracle, frontier-level plan — each entered through a deterministic juncture** (the ship gate's "all flows proven" obligation lives here); topology homes for `src/.pi/extensions/` and `src/agents/runtime/` reconciled.
- **Anchors:** D98-L (two modes, 1:1 mode↔agent), D37-L (offer-owns-response grammar — the dialog lives on the product side of it), D40-L (authority matrix), D74-L (capability-readiness), D101-L/D102-L (session seed facts); `src/agents/references/readiness-bands.md` §Agent Use (the Proceed/Negotiate/Ask postures both foreground roles share).

## Sequencing

### Active — Group 1 · walkthrough closure

Close the entire first batch of walkthrough-related findings: remediation, the owed evidence, and the design back-catalog that the old (now fixed) findings-capture protocol left stranded. Group 1 completes its auth reversal before Groups 2–3 open.

- `walkthrough-remediation-2` ([FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure)) — **absorbs `walkthrough-evidence-batch` (FE-1167; close its Linear issue as merged at pickup)**. Entry: the settled D113-L–D115-L reversal, spec-first via `ln-spec`; then the punch-list rows, the absorbed LN evidence beats (Execute beats carve to the KA sub-list), the folded design rows `exchange-visual-design` + `generative-flow-synthesis-shape`, and the slim `sweep-debt-tripwire` row. Closing member of arc `deterministic-orientation`. Definition below.
- `cli-mode-entry` — direct-mode CLI subcommands (`brunch specify [spec-id]` / `brunch execute <spec-id>`, reserving `develop`); admitted 2026-07-13, stacked on FE-1187's auth-reversal branch. Definition below.
- **Alpha walkthrough lane** — the post-publish outer-loop audit over the merged surface (`TESTING_PLAN.md` concern groups; findings in `TESTING_FINDINGS.md`). Runs A, C, and WR18 are the source evidence; run D waits on FE-1187's reshaped surfaces. Not a frontier itself.

### Recently Completed

- 2026-07-13 `executor-slice-attempt-lifecycle` (FE-1192) — merged #324 to `next`; failed agent and verify-runner attempts are durable non-marking facts with bounded in-run retry, per-stage counters, and HITL reset. Petrinaut-visible attempt topology moves into `petri-execution-parity`, where concurrent slice subnets make it load-bearing.
- 2026-07-13 `petrinaut-live-run-stream` (FE-1190) — merged #322 to `next`; live-from-start Petrinaut observation with frozen run plan, journal-ordered completion, reconnect equivalence, fail-closed journal appends, and terminal-lagging-snapshot backfill (both Bugbot findings closed with deterministic oracles). FE-1183 (`petri-interpreter-port`) closed with it — #320 merged the finite replay/export surface.
- 2026-07-10 `walkthrough-remediation-1` (FE-1180) — **✓ closed by explicit promotion, not false pass**. WR1–WR8 and WR13–WR17 built; WR18 evidence is recorded in `TESTING_FINDINGS.md`; every remaining failure/unknown moved to `walkthrough-remediation-2` / FE-1187; the exhausted ledger and stale handoff were deleted.
- 2026-07-10 `main-editor-chrome` execute-card follow-up (#313) — structured, status-first renderers landed for `execute_orchestrate`, `execute_plan_check`, `execute_snapshot`, and `execute_status`; literal snapshots plus lifecycle negative-space tests preserve D111-L/D112-L/I58-L. The scope card was exhausted and deleted; the normal-width manual readability beat remains outer evidence, not unfinished implementation.

Older completion history: [`docs/archive/PLAN_HISTORY.md`](../docs/archive/PLAN_HISTORY.md).

### Next — Group 2 · platform debt (API / data-model / transport)

Debt that compounds while unimplemented. Opens after Group 1's auth reversal lands; items interleave with Group 3 opportunistically, respecting per-item dependencies. **Entry input:** [`docs/planning/pi-native-integration-opportunities.md`](../docs/planning/pi-native-integration-opportunities.md) (2026-07-13 synthesis over the Pi `0.80.6` upgrade) — its package dispositions are folded into the entries below and into FE-1187 (P4) and Later `agent-tracing` (P5); retire the synthesis doc once all packages are merged into canonical homes.

- `spec-posture` — persisted spec-row posture (D118-L, A41-L) + deterministic establishment flow; a necessary part of the orientation flow. Outer oracle: run D's populated-cwd/brownfield beats. Definition below.
- `headless-ask-discovery` — **restore full RPC functionality**: discovery of open `ask` calls (streamed session events or a pending-interactive-call read method) replacing `session.pendingExchange` transcript scanning (the A39-L follow-up to D116-L); headless asks resolve `unavailable` until this lands. Broker (`awaitAnswer`/`session.submitExchangeResponse`) unchanged by design. Verification: middle-loop deterministic public-RPC contract + tiny interaction-state model proving discover/answer/cancel/resume behavior, stale/closed-call distinction, idempotent durable effects, no transcript parsing. The full agent-as-user campaign still requires this plus a useful `consequential-fact-discovery-tracer` report (Later) — do not plan past that horizon.
- `compaction-and-conflict-widening` — reshaped 2026-07-13 (Pi-native P3): a **custom compaction definition** — what to keep, what to drop — over the D76-L/D77-L/D78-L boundary pipeline and the req-15 continuity-anchor contract. Key gap: Brunch enables Pi auto-compaction and has an externalized anchor-preservation contract, but never registers the `session_before_compact` hook that materializes it; Pi `0.80.6` provides corrected token accounting, split-turn summaries, and public compaction-preparation/summary APIs as the supported basis. Design first, then vertical implementation.
- `session-branching` — **unblock**: the branch-aware continuity/staleness/coherence design pass (A37-L) that lifts the linear-only guards (I10-L, I13-L, I19-L). Definition below.
- `web-driver-streaming` — entry is an **evaluation, not a build**: is the built topology-A relay battery sufficient for the remaining consumer/UI and non-freeform answer legs, or is a different transport needed? Absorbs the P0 settlement-semantics residual (fold the conditional transport-visibility/relay assertion here rather than a new frontier). Verdict routes back through `ln-plan`.
- `transcript-ledger-rendering` — Pi-native P2: a bounded product tracer making durable user choices (ledger entries) visible in the transcript without entering model context. Not a generic renderer program; may fold into FE-1187's `exchange-visual-design` row at scope time if the seam coincides.
- `reconciliation-derivation` — derived `edge_revalidation` staleness surfacing (the first reconciliation signal a user gets without the agent authoring one); first tracer is the read-only derived query. Definition below.

### Next — Group 3 · agent layer

- `develop-mode` — third operational mode `develop` / `engineer` agent, **built flag-gated** (create the mode; enable only behind a flag). **Authority model settled 2026-07-13: not a contract-breaker** — `develop` sits at the same concentric visibility/authority tier as `execute`; `engineer` is simply not constrained by the executor's workflow (no `execute_*` lifecycle obligations), and is initially just a Brunch-aware coding assistant. Entry remains a SPEC revision (D98-L "two modes only", the D40-L matrix row at the execute tier, per-mode kick/consult-suppression axis), but no authority-model redesign is needed. Cost read revised: mechanical ≈ a day + prompt/conduct work. The `develop` CLI subcommand name is already reserved by `cli-mode-entry`.
- `subagent-skill-access` — **admitted 2026-07-13**: extend the subagents extension so subagents can access named skills; the user has local changes to integrate — inventory them at pickup. Prerequisite for `reviewer-agent-mode`. Definition below.
- `reviewer-agent-mode` — reshaped 2026-07-13: the D29-L advisory reviewer is a **subagent**, not a primary agent/mode. Narrow write authority to `reconciliation_need` stands (I16-L); A16-L trigger/scope questions resolve at pickup. Depends on `subagent-skill-access` for skill-carried review conduct.
- `review-commentary-widening` — reshaped 2026-07-13 to the TUI-realistic version: afford `#`-mentioning of review items and attribute comments via mention (req 18 reference-code seam), instead of a widened structured payload + bespoke collection UI. Re-expresses over the D116-L declared-ask/answer payload; needs a SPEC decision at pickup.

### Cleanups — Group 4

- `legacy-question-read-path-retirement` — rides the Group 1 stack as a cleanup slice (together with the D117-L sweep-anchoring one-liner in `sweep-watermark.ts`); no standalone Linear issue or branch. Definition below.
- `named-inline-extension-identity` — Pi-native P1: adopt Pi's native named-inline-extension type for useful source provenance; small independent hardening, direct housekeeping or a tiny tooling slice.

### KA stream (Kostandin — executor / orchestrator / Execute mode)

Everything executor/orchestrator-shaped or Execute-mode-owned belongs to Kostandin's stream and is **outside the LN quarantine**. Cross-stream touchpoints: FE-1187 rows O7/O8/O9 (live D120-L Execute workflows) — coordinate before building those rows.

- **Carved from FE-1167 (2026-07-13):** the Execute-mode evidence sub-list — Execute entry beats on thin vs rich seeds (assessment honesty: Ask on thin, Proceed on rich), the two deferred orientation-choice questions (`continue`/`proceed` semantics; sticky-posture candidate — D98-L-sensitive, route through `ln-grill`/`ln-spec` if evidence says revisit), and the FE-1107/KA residue (close-or-narrow, demo/walkthrough session via `TESTING_PLAN.md`, post-KA plan pass). Full context in the archived FE-1167 definition (`docs/archive/PLAN_HISTORY.md`).
- `planning-process-model` — **moved to the KA stream 2026-07-13**: plan-plane semantics (plan-as-projection, epistemic horizon, the `scope`-node question) sit with executor/orchestration concerns (D103-L; D98-L executor may own execution/scope concerns). Definition below.
- `petri-execution-parity` — admitted 2026-07-13 after FE-1192 merged: one frontier/PR for isolated per-slice execution and explicit fan-in, followed by epic-level integration and verification gates, under unchanged serial `run.json` authority. Definition below.
- `executor-run-environment` (FE-1166 follow-up) — the substrate/verify policy is merged; the real-run failure remains prepared in [`memory/cards/executor-run-environment--actionable-slice-request.md`](cards/executor-run-environment--actionable-slice-request.md). Before build, a KA-stream `ln-plan` decision must settle whether this remains FE-1166 work or becomes a fresh frontier/branch; do not let the prepared card bypass the tracker/branch boundary.
- **Standing obligations:** `probes-and-transcripts-evolution` and `topology-readmes-and-boundaries` ride the frontier that triggers them; they are not standalone cleanup buckets.

### Later

Instrumentation experiments and far-horizon items. Each re-enters only via re-qualification with a named trigger.
- `mechanism-trace` — **demoted to Later 2026-07-13**; the slim `sweep-debt-tripwire` row was extracted into FE-1187 (Group 1). The full carrier-classified trace (`wiring`/`nudge`/`conduct`) + static wiring inventory re-enter when instrumentation is prioritized. Definition below.
- `consequential-fact-discovery-tracer` — **Later (2026-07-13)**: bounded Tier-2 real-provider tracer for the consequential-fact discovery oracle. Re-entry: after Group 1 closes and the ask/prompt surface stabilizes. Full campaign additionally gated on `headless-ask-discovery` (Group 2) + a useful tracer report. Definition below.
- `agent-tracing` — passive trace instrumentation over Pi lifecycle events for debugging plus conduct/quality evaluation: NDJSON emitter extension (introspection-tap discipline), subagent span joining via SDK `session.subscribe`, and a mechanical-trace × semantic-JSONL join for deterministic conduct checks and judged passes. Entry move is an `ln-spike` (dev-gated `nikiforovall/pi-otel` import: do span trees beat `.brunch/debug/` + JSONL projections?) before any port of `JoshMock/the-agency` observability as the in-product base. Traces are dev/eval artifacts, never product truth (no event-spine backdoor). Design: `docs/design/AGENT_TRACING.md`; sibling idea note `docs/design/RLM_INVESTIGATION_PATTERN.md`. Relation: Later `mechanism-trace` is the transcript-native sibling (carrier classification, no event plane); if both land they may join on a shared trace vocabulary. Absorbs Pi-native P5 (provider/cache observability — latency, cache behavior, whole-run spans), spike-led.
- `multi-session-daemon-architecture` — unscheduled architecture note: if Brunch ever needs attachable live-session hosting beyond the current TUI-owned sidecar, prefer an optional local session-host layer that owns live foreground session topology only, not graph/transcript/executor truth. Design: `docs/design/MULTI_SESSION_DAEMON_ARCHITECTURE.md`; thin decision candidate: `docs/design/SESSION_HOST_DECISION_CANDIDATE.md`.

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

<!-- exchange-ask-refinement (FE-1164) archived to docs/archive/PLAN_HISTORY.md (2026-07-10 ln-sync); durable truth: D116-L, A39-L, exchange topology homes, runtime-mount and supersession probes. -->

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
- **Keeps:** the pending-exchange scan itself as the interim projection until `headless-ask-discovery` (A39-L); current ask/request-detail transcript semantics.
- **Traceability:** D116-L, A39-L; 2026-07-09 `ln-induct` finding 4 over PR #304. The write-path half already landed on #305.

### walkthrough-remediation-2

- **Name:** Walkthrough chapter closure — remediation, evidence, and design follow-through (absorbs FE-1167)
- **Linear:** [FE-1187](https://linear.app/hash/issue/FE-1187/walkthrough-remediation-sweep-2-wr18-follow-up-closure); close [FE-1167](https://linear.app/hash/issue/FE-1167/walkthrough-evidence-batch-outer-loop-checks-for-merged-orientation) as merged at pickup.
- **Branches:** `ln/fe-1187-walkthrough-remediation-2` (interim tie-off: auth/model reversal + first remediation cluster) → `ln/fe-1187-walkthrough-remediation-3` (stacked continuation for the remaining rows).
- **Kind:** coverage-shaped closure batch: WR18-promoted remediation rows + absorbed LN evidence beats + folded design rows + the tripwire row.
- **Certainty:** proving.
- **Classification:** evidence-gated.
- **Entry:** **landed 2026-07-13** — D123-L exposes Pi's full provider/model surface, deletes the allowlist and standalone `brunch login`, sets a soft recommended default, and re-keys I59-L to resolvable provider auth. The no-auth J1 warning and no-carrier walkthrough proof are recorded in `TESTING_FINDINGS.md` R3. This satisfies the entry gate for Groups 2–3 once the branch stack lands on `next`.
- **Progress:** closed Shift+Tab/mode-cycle conflict, provider/model restrictions, startup warning/login path, duplicated origination payloads, Pi-documentation prompt leakage, no-model guidance/no-carrier proof, and active `request_*` lexicon drift. Live scope: [`memory/cards/walkthrough-remediation-2--cancelled-exchange-legibility.md`](cards/walkthrough-remediation-2--cancelled-exchange-legibility.md).
- **Remaining findings inventory:** cancelled-exchange legibility + standalone-cancel guidance; repeated offer content in present→ask continuation (digest/offer pretext must not repeat inside the ask); extraction breadth after a thin first pass; O7/O8/O9 live D120-L Execute workflows; O10 both-theme component/live-TUI checks; folded design rows and the sweep-debt tripwire.
- **Streams:** rows O7/O8/O9 witness KA-stream (Execute / D120-L) surfaces — coordinate with the KA stream before building them; all other rows are LN.
- **Absorbs (2026-07-13, from FE-1167):** the LN evidence beats — orientation-menu generative beats (propose/project) with menu→conduct routing evidence via session JSONL; FE-1124 Card 3 review variants ([`memory/cards/walkthrough-batch-2--seed-variants.md`](cards/walkthrough-batch-2--seed-variants.md)) + seed worklist; FE-1164 residue (declared continuations driven live, capture sweep after ask answers, resume re-render of persisted ask results, web sidecar during an open ask, both-theme gallery re-check). Execute beats + KA residue carve to the KA sub-list (§KA stream). Full original definition: `docs/archive/PLAN_HISTORY.md`.
- **Folded design rows (2026-07-13, promoted findings):** `exchange-visual-design` — the WR9–WR12 cluster (compact tool rendering, `/introspect` legibility, review-set/ask visual revamp, markdown/node-id polish) plus border distinctness and nested-ask chrome (findings A6/A9/A10); `generative-flow-synthesis-shape` — design-it-twice + recommendation/synthesis conduct over existing `present_candidates`/review-set seams (finding C3).
- **Tripwire row (2026-07-13, extracted from Later `mechanism-trace`):** `sweep-debt-tripwire` — scenario-scoped assertion that on expected-capture scenarios the conversational tail preceding a watermark shows capture evidence (`mutate_graph`/scratchpad conduct), and on deliberately-ignored-material scenarios it does not fire; the graph-writes-after-answers witness (A40-L detection half). ~a day; no `before_agent_start` advance change.
- **Dependencies:** owns all WR18 residue promoted out of FE-1180; closes arc `deterministic-orientation` (jointly with the KA-carved Execute beats). The auth reversal has landed in the FE-1187 stack; Groups 2–3 become independently pickup-ready when that stack reaches `next`. `cli-mode-entry` stacks on the auth-reversal branch; `legacy-question-read-path-retirement` + the D117-L one-liner ride the same stack as cleanup slices.
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

### spec-posture

- **Name:** Spec posture persistence + deterministic establishment
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`; low conflict with remediation rows except the workspace-dialog seam — coordinate if parallel)
- **Status:** re-qualified 2026-07-13 into Group 2 (platform debt); start after Group 1's auth reversal lands so run D witnesses the corrected surface
- **Kind:** structural — new spec-row field(s) + a new establishment step in the spec creation/resume flow.
- **Certainty:** proving — whether deterministic posture questions feel like orientation or like peppering (the 0.x failure mode) is the open question; the schema change itself is small.
- **Objective:** materialize D118-L: `origin: greenfield|brownfield` on the spec row, confirmed-not-defaulted `spec.kind` (D89-L), and a relates-to-spec reference (A41-L — includes the root-spec-as-plain-reference bet and the `function`-vs-`story` third-term call). Establishment is a product-owned ask/confirm step at spec creation/resume (D109-L juncture family / workspace-dialog seam), branching on workspace-populated vs bare per the TESTING_PLAN Concern 2 matrix; readers: kick assembly, capture conduct (brownfield facts enter as advisory, D99-L), orientation-question skipping. Keep the question sequence minimal — skip anything inferable.
- **Verification:** schema + establishment-flow tests inner-loop; run D (populated cwd, brownfield confirm) and run B's orientation beats are the outer oracle; the Concern 2 matrix is the behavioral contract.
- **Traceability:** D118-L, A41-L, D89-L, D99-L, D102-L (amended), D109-L; `docs/design/SPEC_INITIATIVE_MODEL.md` (deferred spec-relationship model — do not pull it forward).

<!-- walkthrough-evidence-batch (FE-1167) merged into walkthrough-remediation-2 (FE-1187) on 2026-07-13 (re-qualification pass); close FE-1167 in Linear as merged at pickup. Full definition (five residue groups, workbench commands) archived to docs/archive/PLAN_HISTORY.md. LN beats absorbed by FE-1187; Execute/KA beats carved to the KA sub-list (see §KA stream). Arc deterministic-orientation now closes via FE-1187. -->

### consequential-fact-discovery-tracer

- **Name:** Consequential-fact discovery — bounded Tier-2 oracle tracer
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup (off `next`; start after FE-1187 stabilizes the ask/prompt surface)
- **Kind:** structural verification tracer — establishes a new prompt/context-quality probe and report seam over existing Tier-2, transcript, graph-readback, and fixture contracts.
- **Status:** Later (2026-07-13); not started. Re-entry: after Group 1 closes and the ask/prompt surface stabilizes.
- **Certainty:** proving.
- **Objective:** Prove that consequential-fact discovery is measurable without a generic eval framework: drive a bounded Petri-net editor elicitation through the real Brunch/Pi boot path with a real Brunch provider and controlled user responses; compare four human-authored private invariants against transcript attribution and final graph truth; emit a portable, reviewable JSONL-backed report from `.fixtures/scratch/`.
- **Why now / unlocks:** The R&D tasks suggest elicitation depth is valuable only when consequential facts become inspectable truth, but Brunch has no discriminating regression oracle for that claim. This tracer validates the oracle before corpus/framework breadth. A useful report unlocks one novel/non-inferable scenario; only that evidence plus A39-L can justify planning the full autonomous agent-as-user campaign.
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
- **Why now / unlocks:** the 2026-07-08 capture-sweep grill established that during manual walkthroughs the user cannot tell whether an agent action was product-forced, event-nudged, or freely chosen — and that sweep ingestion has no conduct-level oracle (SPEC blind spot "Sweep ingestion reliability", A40-L). The trace is the instrument; the tripwire is its first paying customer. FE-1167's walkthrough beats become materially cheaper to interpret with it.
- **Objective (three parts, grilled 2026-07-08 — Q1–Q7 record in the grill session):**
  1. **Mechanism trace (the spine):** a post-hoc projection over a session JSONL that renders an interleaved timeline of entries classified by carrier — `wiring` (ledger-only product appends: `brunch.capture_sweep_watermark`, `brunch.own_mutation`, orientation entries — the `PreparedLedgerEntry` class), `nudge` (provider-visible product injections — the `PreparedMessageEntry` class, e.g. `worldUpdate`), `conduct` (agent tool calls / toolResults). Consumable as an extended `.brunch/debug/` mirror or a standalone read command; post-hoc first (Q7), no live surface.
  2. **Static wiring inventory:** a short canonical document enumerating every deterministic product append site and visible nudge, so the trace's carrier classes are auditable against code rather than folklore. Home: co-located topology or `docs/design/`, decided at scope time.
  3. **Sweep-debt tripwire (derived assertion, Q1/Q3/Q5):** over the trace, assert per scenario — on expected-capture scenarios the conversational tail preceding a watermark shows capture evidence (`mutate_graph`/scratchpad conduct); on deliberately-ignored-material scenarios it does not fire. Outer-loop oracle first; a runtime nudge only if walkthroughs show actual stranding. No change to the `before_agent_start` advance (Q2 — `turn_end` stays a future upgrade under A40-L).
- **Annotations:** Lights up: provenance legibility over any session transcript (the walkthrough instrument). Stabilizes: the three-carrier classification as the canonical provenance vocabulary. Retires (partially): the "Sweep ingestion reliability" blind spot's *detection* half — A40-L's capture-conditional advance stays open.
- **Explicitly out:** capture-conditional watermark advance / `turn_end` rewiring (A40-L, future); live in-session trace surface (Q7 — post-hoc first); the D117-L constant-anchoring hardening (direct fix, not frontier work); Pi lifecycle-event span tracing (Horizon `agent-tracing` — that frontier is event-plane instrumentation; this one is transcript-native classification; they may later join).
- **Convergence:** `walkthrough-evidence-batch` (FE-1167) — group 5's "capture sweep after ask answers" beat is the tripwire's first live scenario; prefer having the trace available before or during that batch. Refresh pressure on `src/probes/capture-quality-loop.ts` (last promoted run 2026-06-08) can ride this frontier's tripwire scenarios rather than a separate pass.
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

- **Name:** Planning-process model — plan-as-projection, epistemic horizon, and the `scope`-node question
- **Linear:** unassigned
- **Branch:** `ln/fe-xxx-plan-plane-redesign` (plan-plane groundwork already landed here: `slice` removal + D103-L + CueLoop liftout)
- **Kind:** structural / plan-plane semantics
- **Stream:** KA (Kostandin) — moved 2026-07-13: plan-plane semantics sit with executor/orchestration concerns.
- **Status:** proving candidate opened by D103-L; **demoted to Horizon 2026-07-03 (grill)** — exploratory bet-proving, behind the ship gate. The orientation menus' "project a plan" option routes to the existing `project`/`map-plans` seam at frontier-level depth and does not depend on or advance this frontier. Mostly SPEC/skill work at first, low code-conflict.
- **Certainty:** proving.
- **Lights up:** plan generation as *projection* from committed graph truth (milestone/frontier) — a `project` (D100-L) plan-plane path, first exercised as a read-only plan projection, optionally exported to an external format (CueLoop, `docs/design/CUELOOP_PATTERN_LIFTOUT.md`) as design pressure.
- **Stabilizes:** the plan-plane boundary set by D103-L (plane stops at `frontier`) — by proving what *is* projectable there, and by locating whether a durable accountability node below `frontier` (candidate `scope`) is needed or stays process-only (`ln-scope`/`ln-build` scope cards).
- **Objective:** Turn the D103-L future-direction bet into evidence: model how Brunch's plan plane handles (1) projection from intent/oracle/design down to milestones/frontiers, (2) the epistemic horizon (fog-of-war) and non-structural sequential dependency that bite at scoping, and (3) the trade-offs (extend horizon vs gain parallelism) as design-style decision flows. Fire the cheapest tracer — plan-as-projection — before deciding whether horizon/decision-flow state or a `scope` node earns durable representation.
- **Acceptance:**
  - A plan projection is derived from committed graph truth (milestone/frontier plus their intent/oracle/design anchors) and rendered thinly, reusing the `project` (D100-L) seam rather than a new graph-write path or exchange schema family.
  - The projection is demonstrably *projection*, not free generation: it starts from accepted upstream anchors and never commits plan-plane graph truth itself (I51-L discipline).
  - An external-format export (e.g. CueLoop) is proven as an optional downstream rendering of that projection, or explicitly rejected with a recorded reason — used only as design pressure, not as product architecture.
  - The `scope`-node question is resolved with evidence: either a durable below-`frontier` accountability node is specified (routing back to `ln-spec`) or it is confirmed process-only. Until then the epistemic-horizon/decision-flow model stays behind the fog (D103-L future direction), not built.
- **Traceability:** D103-L (plane stops at frontier; opens this model), D100-L (`project` seam), D56-L / D94-L (kind set + REQ/AC boundary), D87-L (`unknown` = horizon on the intent plane), D99-L (advisory/settled); relates to `orchestrator-tool-port` (D98-L executor may own execution/scope concerns). SPEC §Future Direction "Planning persistence evolution".


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
- **Status:** ✓ merged (#324, 2026-07-13) — `attempt_failed` journal facts (non-marking; replay/export skip them) for agent and verify-runner failures, bounded in-run retry with per-stage `run.json` attempt counters (success clears; HITL retry resets), Petrinaut frame contract unchanged. Petri-native attempt topology moved to `petri-execution-parity`, where concurrent subnets make Petrinaut-visible attempts earn their place.
- **Why now / unlocks:** today a failed slice step halts the whole drive, recovery exists only as the run-scoped HITL `execute_replan_*` family, and a failed attempt is invisible in the compiled net (the transition simply never fires). Attempt identity is the prerequisite for everything downstream in this sequence: isolation/fan-in needs per-attempt workspaces, and epic integration needs to represent partial failure without abandoning the run.
- **Objective:** make slice execution attempts first-class executor facts — attempt identity and verdict on agent/verify steps, bounded in-run retry expressed as topology (attempt-scoped places/transitions or attempt provenance) rather than driver special-cases, and honest journal/stream representation of failed attempts. `run.json` remains lifecycle authority; `execute_replan_*` remains the escalation path when attempts exhaust.
- **Lights up:** an in-run attempt loop (failed agent/verify attempt → bounded retry) visible in the journal and the Petrinaut stream.
- **Stabilizes:** attempt identity as the vocabulary `petri-slice-isolation-fan-in` and `petri-epic-integration` build on.
- **Acceptance sketch (validate at pickup — the 2026-07-11 session settled only the ordering):** a slice whose first attempt fails can retry in-run within a declared bound without abandoning the run; attempts carry stable identity through executor facts (journal, reports, read surfaces); exhausted attempts land in the existing halted/replan flow; serial lifecycle ordering, journal-truth ordering (hints never outrun durable append), and I58-L side-effect honesty are preserved.
- **Traceability:** D111-L, D112-L, I58-L; SPEC §Future Direction "Plan execution & Petri-net compatibility"; `src/executor/TOPOLOGY.md`; the run-scoped recovery family (PR #303 stack).

### petri-execution-parity

- **Name:** Petri execution parity — isolated slice fan-in and epic integration
- **Linear:** [FE-1195](https://linear.app/hash/issue/FE-1195/petri-execution-parity-isolated-slice-fan-in-and-epic-integration)
- **Branch:** `ka/fe-1195-petri-execution-parity` (off `next`; FE-1192 is merged)
- **Kind:** structural — per-slice side-effect isolation, explicit integration, and epic lifecycle semantics.
- **Certainty:** proving.
- **Depends on:** FE-1192's merged attempt identity and bounded-retry facts; FE-1190's frozen-definition live stream; FE-1166's run-environment substrate policy.
- **Objective:** close old-`main` Petri execution parity in one branch through ordered slices. Execute each slice in one stable per-slice workspace, keep retry artifacts attempt-distinct, and fan successful commits into the run workspace through an explicit conflict-reporting integration transition. Promote durable journal/marking claims to authority for concurrently firing isolated slice effects while `run.json` remains run-summary and serial run-control authority. Then make epics integration gates rather than identity labels: member completion enables epic-level fan-in/verification and an explicit epic-complete transition in the compiled topology.
- **Lights up:** dependency-independent slices executing concurrently in isolated substrates, converging through explicit fan-in, and completing only through owning epic gates.
- **Stabilizes:** attempt-visible slice subnet topology, the isolation/fan-in seam, epic lifecycle vocabulary, and `frontierFiringPolicy` as a load-bearing co-firable selection policy.
- **Acceptance sketch:** independent slices run without cross-contamination; integration conflicts fail closed into the existing halted/replan outcome; the frozen Petrinaut definition and stream show attempt, slice integration, epic verification, and epic completion honestly; an epic cannot complete before every member slice succeeds and its epic-level verification passes; serial `run.json` ordering and I58-L side-effect honesty survive.
- **Inherited from FE-1192 (2026-07-13):** decide and implement Petrinaut-visible attempt topology (static self-loop transitions / retry-budget places) now that concurrent subnets make attempts load-bearing; extract the mirrored failure-path counter pattern from `agent-result.ts`/`test-result.ts` with the `attempts`-field presence as `drive()`'s retry discriminant; settle `DriveContext.onNetEvent` by making it a real live-hint consumer or deleting it and correcting the topology claim.
- **Authority trigger (2026-07-13):** stable per-slice workspaces, attempt-distinct artifacts, real-git conflict-preflight fan-in, explicit `slice_integrate` lifecycle facts, shared attempt-counter helpers, and removal of `DriveContext.onNetEvent` are implemented. Their oracle proved Slice 1's co-firable starts cannot become overlapping effects while serial `run.json` permits one active slice. The user promoted durable parallel authority into this same frontier/PR; D123-L owns the bounded authority split.
- **Materialized authority (2026-07-13):** D123-L now applies to same-process co-firable slice batches: claims and current marking persist before dispatch, isolated effects overlap, per-slice outcomes remain durable and failure-isolated, restart halts claimed unfinished work, and fan-in stays serialized. `run.json` remains summary + serial run-control authority. Epic verification/completion is still unimplemented and must be re-scoped from the stale fourth card.
- **Current execution pointer:** [`memory/cards/petri-execution-parity--slice-epic-integration.md`](cards/petri-execution-parity--slice-epic-integration.md) — topology, isolated fan-in, and durable parallel authority are done; epic verification/completion is stale pending re-scope.
- **Explicitly out:** split-process delivery; semantic/review lanes beyond epic verification; geolog coupling. Durable parallel slice authority is now in scope under D123-L because this frontier proved serial authority is the binding constraint.
- **Traceability:** D112-L (set-returning scheduler + `frontierFiringPolicy`), D123-L (bounded durable parallel slice authority), FE-1166 substrate/verify policy, `docs/praxis/worktree-agents.md`, `src/executor/TOPOLOGY.md`.


### subagent-skill-access

- **Name:** Subagent named-skill access (subagents extension)
- **Linear:** unassigned (create at pickup, FE team / brunch project)
- **Branch:** tbd at pickup
- **Kind:** bounded feature — extend the subagents extension so spawned subagents can be granted access to named skills from the code-owned manifest.
- **Certainty:** proving.
- **Status:** admitted 2026-07-13 (Group 3, agent layer). The user has local changes to integrate — inventory them at pickup before scoping.
- **Why now / unlocks:** prerequisite for `reviewer-agent-mode` as a skill-carried subagent; generalizes background-agent capability sharing without reviving retired runtime axes.
- **Traceability:** D90-L (AgentManifest shape), D95-L/registry (code-owned skill manifest), D40-L (subagent grants must stay within the spawning role's authority envelope).

### reconciliation-derivation

- **Name:** Derive `edge_revalidation` reconciliation needs from LSN comparison; keep the table for judgment-shaped kinds
- **Linear:** unassigned (create on pickup)
- **Branch:** tbd
- **Kind:** structural — changes how one reconciliation-need kind originates (derived query vs persisted row) and adds a clearing watermark to the edge schema.
- **Status:** Horizon; inventoried 2026-07-02 (doctor-pass session), not started. This is the "concrete triggering frontier" pattern the retired `coherence-first-class` entry demands — reconciliation work now has a specific mechanism and trigger, not a generic coherence bucket.
- **Certainty:** proving (the derivation is computable today, but whether derived needs are *better product* than persisted ones — noise level, clearing UX — is unproven).
- **Premise (validated by inventory):** for every edge category, `EDGE_CATEGORY_METADATA` (`src/graph/policy/category-policy.ts`, D51-L) already declares the downstream endpoint (`affected`) and `impactKind` (`none`/`advisory`/`cascade`), and nodes/edges carry `updated_at_lsn` — so "upstream updated later than downstream last acknowledged" is directly computable. `src/graph/projection/direction.ts` already derives upstream/downstream from this metadata for three projection consumers.
- **Three corrections that bound the scope:**
  1. Only `edge_revalidation` is LSN-derivable. `possible_relation` / `possible_duplicate` target node pairs with **no edge** (nothing to compare); `semantic_conflict` is a judgment, not staleness. The `reconciliation_need` table **stays** for those three (A8-L one-substrate assumption holds); only `edge_revalidation` flips from persisted row to derived view.
  2. Nothing auto-generates needs today — every row is agent-authored via `create_reconciliation_need`. The `direction.ts` docstring describes an intended "log downstream impacts on edit" flow that was never built. This frontier **adds the missing generator** (as a derived read, cheaper than a write-side trigger), it does not replace a live one — lower risk than "replace the table" suggests.
  3. Clearing needs a **per-edge acknowledged-LSN watermark** (new schema field). A per-node watermark is ambiguous when a node has multiple upstreams with differing categories/policies. Review/clear = bump the edge watermark; a fuller downstream update advances `updated_at_lsn` too.
- **Retires:** the open question "can reconciliation_needs be replaced by LSN/changelog?" (answer: partially — one kind); the never-implemented intent in the `direction.ts` docstring becomes real or gets rewritten.
- **Lights up:** automatic staleness surfacing — the first reconciliation signal a user gets without the agent choosing to author one.
- **Depends on:** D8-L (needs substrate + spec-local LSN), D51-L (closed edge categories + per-category policy), I16-L (reviewer writes target only the need substrate — a derived view must not break this), A8-L (one substrate absorbs all impasse kinds).
- **Convergence:** `walkthrough-evidence-batch` (FE-1167) fixture prep — the planned `contradictory` seed variant exercises `semantic_conflict` (the table-backed kind), and an `advisory-pending`/staleness variant would give the derived `edge_revalidation` view a repeatable test state. `src/projections/graph/reconciliation-needs.ts` is still an intentional stub — do not build that projection before this frontier decides derived-vs-persisted shape.
- **First tracer candidate:** a read-only derived `edge_revalidation` query (projection over `updated_at_lsn` + category metadata, no schema change, no watermark yet) surfaced alongside the persisted needs — proves signal quality and noise level before committing to the watermark schema and any retirement of persisted `edge_revalidation` rows.

### session-branching

- **Name:** Session branching support (branch-aware continuity/coherence)
- **Linear:** unassigned
- **Branch:** tbd
- **Kind:** structural / transcript + continuity seam
- **Status:** horizon; direction approved (D24-L reversal), design not yet started.
- **Certainty:** proving.
- **Objective:** Design and implement branch-aware transcript continuity, staleness, and coherence so Brunch supports session branching, lifting the current linear-only guards (I10-L, I13-L, I19-L) once branch-aware semantics exist.
- **Depends on:** turn-boundary continuity choreography (D76-L, D77-L, D78-L) and the coherence model.
- **Traceability:** D24-L; A37-L; req 8; I10-L, I13-L, I19-L.

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
    -[gates]-> groups 2–3 (open after the auth reversal lands; then interleave)

group-2 (Next — platform debt):
  spec-posture | headless-ask-discovery | compaction-and-conflict-widening (P3)
  | session-branching | web-driver-streaming (evaluation; absorbs P0 residual)
  | reconciliation-derivation | transcript-ledger-rendering (P2)
  entry_input: docs/planning/pi-native-integration-opportunities.md (retire after merge)

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
    status: active 2026-07-13 on ka/fe-1195-petri-execution-parity
    depends_on: merged FE-1192 attempt identity + FE-1190 live stream
    owns: D123-L bounded durable parallel slice authority
    excludes: split-process delivery and generic event-spine authority
  executor-run-environment (FE-1166 follow-up)
    status: prepared; tracker/branch disposition required before build
    live_card: memory/cards/executor-run-environment--actionable-slice-request.md

later: mechanism-trace (tripwire extracted to FE-1187) |
  consequential-fact-discovery-tracer | agent-tracing (absorbs P5)

rules:
  candidates never commit graph truth (I51-L)
  topology files own current subtree state
  scratch evidence is not durable until promoted to .fixtures/runs/
  arcs close only after topology reconciliation and residue discharge
  deferred/design-question findings must name an owner (docs/praxis/manual-testing.md §Findings ledger discipline)
```
