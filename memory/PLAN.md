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

The interaction model is mature: four-phase interview, interviewer-autonomous question format, phase-agnostic preface cards with workspace exploration, structured review with per-item commenting, observer knowledge extraction, workflow ownership extraction, distribution hardening, graph view's structured-list peer route, the first relation-first observer capture seam, the multi-chat substrate, side-chat V3.0 hard-impact cascade, and side-chat V3.1 agent-grouped reconciliation resolution all ship as working product.

The next product arc is the **Conversational Workspace Runtime** umbrella (`docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md`) plus a stronger semantic/generative substrate. The umbrella synthesizes MULTI_CHAT, SIDE_CHAT, PATCH_LEDGER, and CONTINUOUS_WORKSPACE_HYBRID into five sub-tracks: workspace shell (Track 1, shipped as `continuous-workspace` / FE-709), inline secondary-chat runtime over the existing chat/turn substrate (`chat-runtime-secondary-chats`), reconciliation runtime absorption (`reconciliation-runtime`), changeset ledger (`changeset-ledger`), and transcript-first chat context provision (`chat-context-provision`). The shell is now the stable host; schema-level `thread` is deferred until chat/turn proves insufficient. Secondary chats are the near-term runtime primitive for side, reconciliation, qa, and strategy conversations. The chat runtime is the critical unblocker for reconciliation absorption; chat context provision can proceed against chat/turn with explicit transcript snapshots and graph-item handles. The changeset ledger runs in parallel. The umbrella supersedes the independent side-chat V4a persistence horizon — persistent side-chat history becomes inline secondary chats in the workspace. The FE-705 branch contributes an integration substrate — a local agent capability CLI and external LLM-as-user probe harness — that should be reconciled into main before graph-review and scenario-options work depends on generated completed-spec fixtures. After that, the highest-coordination work is intent-graph semantics and the semantic changeset ledger; FE-701 should follow soon after the FE-705 reconciliation because the current schema already carries transitional multi-chat / reconciliation placeholders that only become coherent once `changeset` / `change` owns semantic mutation history. Lower-coordination provider, gitignore, and web-research work can proceed in parallel.

The **orchestrator / Petri-net execution substrate** is committed (2026-05-21) to Petri as the forward execution model, justified by parallelism, simulation, and resume value claims. Phases 0–2 are done: the dual-engine PoC (Phase 0, FE-730) validated the substrate and extracted the compiler/interpreter; Phase 1 (FE-738) added two-lane mechanical+semantic subnets, the compiler topology/wiring split, and §7 event vocabulary; Phase 2 (FE-743) added parallel firing policy with greedy token claiming, shared resource pool tokens bounding global concurrency, and worktree-per-slice isolation — the decision gate passed (parallel measurably beats serial on wall clock). Phase-3-prep `petri-declarative-routing` (FE-747) is done: typed Guard predicates on `HandlerDescriptor` plus `enumerateCandidateOutputs` make topology-only enumeration of reachable output places possible (I125-K). Phase 3 (graph compilation) remains blocked on `intent-graph-semantics` (FE-700) for relation-policy gates; Phase 4 (simulation oracle) now has its routing-side structural prerequisite satisfied but still needs Phase 3 for graph-derived gates. The north-star design is `docs/next/architecture/plan-graph-petri-orchestration.md`.

The orchestrator's forward direction is framed as two arcs toward a **full (autonomous) cook orchestrator** — "completed spec → feature built and glued into a real brownfield repo, no manual steps." **Arc 1 (feature delivery)** stacks on FE-843 and ships standalone without the semantic stack. `agent-extension-host` (the dual-mode pi-harness contract) **bases the Arc-1 linear stack** (2026-06-15 decision) — every Arc-1 frontier sits on it — followed by `brunch-detect` (resolve a registry profile id from repo manifest/lockfile evidence at plan time) → `harness-dep-install` (capture the dependency-delta for promotion + classify install/infra failures distinctly from test failures; the install action itself is agent-native) → `app-runtime-probe` (build + boot + exercise the host app — the concrete reachability mechanism) → `integration-oracle` (wire into host + product reachability, via the probe) → `brownfield-promotion` (glue back into the checkout) → `brunch-ship` (one-shot wrapper). A `dogfood-spike` (ln-spike) — run the full chain on one real brunch feature — should precede committing `integration-oracle`, to surface the reachability mechanism, dep-install, orientation depth, and brownfield plan-shape risks cheaply. CLI surface: the real commands are `brunch plan`, `brunch cook`, and `brunch serve` (the one-shot capstone, FE-878). The kitchen-brigade names (prep/recipe/taste/plate) are **phase labels, not commands** — detect runs inside `plan`; probe + oracle (verify) and promotion (plate) run inside `cook`/`serve`. Frontier ids stay descriptive; `serve` chains the phases end-to-end. The settled grounding decision is **cook-time** (planning stays host-blind per D160-K; the cook agent resolves real paths/wiring by reading the worktree), which softens FE-829's `writes` ownership to *advisory in brownfield only* — greenfield keeps it authoritative. Protecting invariant: **brownfield generalization must not change greenfield-mode behavior; shared contracts fork on `plan.mode`** (the 3 reference fixtures + a greenfield smoke must score identically before/after each frontier). **Arc 2 (full orchestrator)** is an autonomy ladder gated behind the parked semantic/Petri-Phase-3/4 substrate: `interactive-recovery` (halt → coherent question answered in a secondary chat, resumes the run) → `intent-conformance-oracle` (independent behavioral-kernel verification, requisite variety) → `adaptive-replan` (architect amends the plan from execution feedback, recompile + resume). Each rung raises the autonomy ceiling and is independently shippable. Non-additive work (refactors/migrations/debugging) is explicitly a separate `transformation-orchestrator` product line, not folded into either arc. The cook-time grounding decision, the D160-K `writes`-advisory amendment, and the greenfield-protecting invariant need recording in SPEC via ln-sync when the first Arc-1 frontier is scoped. **Agent-host coordination:** the pi harness is a dual-mode (`elicit`/`execute`) agent-extension host (`agent-extension-host`) — cook capabilities are `execute`-mode plugins on a shared, mode-neutral core; this contract is the serialization point with the unpublished pi-harness thread (which owns the core), validated against the existing interview as the `elicit` witness. It logically gates only the dispatch-seam frontiers (`integration-oracle`, Arc-2 `interactive-recovery`/`adaptive-replan`), but is sequenced at the **base of the Arc-1 linear stack** (2026-06-15 decision) — so the whole arc lands on it, deliberately serializing the cook stack behind the pi-harness-thread coordination rather than running the seam-independent infra (`brunch-detect`, `harness-dep-install`, `app-runtime-probe`, `brownfield-promotion`) in parallel ahead of it.

The May 2026 intent-spec, multi-chat, changeset-ledger, prompt/context, and agent-mutation design notes are reconciled into one direction. `docs/design/MULTI_CHAT.md` is the substrate document. `docs/design/SIDE_CHAT.md` describes side-chat V1 / V2 / V3.0 / V3.1 / V4 phasing on top of that substrate. `docs/design/PATCH_LEDGER.md` remains historical deeper design pressure for semantic mutation history, but canonical future-facing vocabulary is `changeset` / `change`. The product-layer ontology trajectory is split out as `docs/design/INTENT_GRAPH_SEMANTICS.md` and `docs/design/BEHAVIORAL_KERNELS.md`; broader synthesis lives in `docs/archive/design/INTENT_SPEC_EVOLUTION.md`. FE-705's branch-local strategy/proposal notes add scenario options, graph-review oracle, chat-local strategies, and concern/dependency mapping; those notes should become a canonical design doc when the branch is integrated. Coordination uses a substrate-strangler posture: keep existing frontend REST/SSE contracts stable while route adapters and capability adapters converge on shared server-owned handlers, then cut over UI flows only after parity and changeset-backed authority exist. The dev-layer self-tooling trajectory lives in `docs/design/ln-skills/EVOLUTION.md`.

## Sequencing

### Active

1. `agent-fixture-substrate` — branch-complete off main, reconciling — FE-705 integration substrate for JSONL agent capability CLI and LLM-as-user probes.
2. `chat-runtime-secondary-chats` — FE-716; V1 done — PR #141 merged to main.
3. **Petrinaut integration sub-track** — umbrella **FE-760** (Orchestrator ⇄ Petrinaut). FE-761 (semantics), FE-762 (`net.json` + SDCPN export), FE-763 (event stream), and FE-784 (colour fold) have **landed**. **`petri-sync-server` (FE-764)** is the active piece, reshaped (2026-06-01 meeting) into an **ephemeral cook-hosted SSE live stream** for the Bristol demo — no-colour, replay-on-connect, brunch-initiated session, supersedes the dropped static-bundle idea. Replaces the POC interpreter's visualization role with Petrinaut as canonical surface. **`petrinaut-integration-improvements` (FE-819)** layers field-test-driven hardening on top (2026-06-05 cross-team sync): full-marking firings (Card A, **reversed 2026-06-09 to arc-scoped deltas per A99**), terminal-status fidelity, halt visibility, flag rename — all four cards landed.
4. `spec-to-cook-plan` — **FE-800**; **done — branch-complete off FE-764**, PR #167 pending re-description. Six slices landed: 1 (deterministic projection) + 2 (LLM planning pass) + 3 (deterministic reconciliation) + 4 (CLI wiring) + 5 (warning-model hardening) + 6 (read from spec id — `brunch plan <specId>`, server-side snapshot builder `buildCompletedSpecSnapshot` over `getEntitiesForSpecificationOnActivePath`, plan driver moved into `src/server/plan-runner.ts`, orchestrator `plan-cli.ts` deleted). Bristol-demo front half (`brunch plan <specId>` → `.brunch/cook/plan.yaml` → `brunch cook --petrinaut-stream`) is now operational against any completed spec in the project DB. Two proving spikes done 2026-06-03. Move to **Recently Completed** on PR merge.
5. `cook-harness-fidelity` — make the cook execution harness's per-slice "done" signal trustworthy: the evaluator must *observe, not mutate*, and "done" must come from running verification targets, not an LLM verdict. Opening slice (evaluator read-only) is the documented `cook-codebase-mode` TDD-collapse follow-on; complements `spec-to-cook-plan`'s integration-blind-verification follow-on.
6. `cook-mode-from-spec` — **FE-826**; **branch-complete on `ka/fe-826-cook-mode-from-spec`** (stacked on FE-819). Greenfield/brownfield is now spec-derived plan truth: `brunch plan <specId>` writes `specification.mode` into `plan.yaml` (`Plan.mode`); `brunch cook` reads `plan.mode` to pick the worktree strategy — greenfield → empty worktree (generate from scratch), brownfield → cwd clone + clean-tree gate. Resolver split into `resolveCookPlan` (path-only) + `resolveSandboxPlan` (mode-driven). Cook `dir` arg is now optional (defaults to cwd). Reverses the location-keyed reading of Requirement 50, refines I123-K, adds D164-K. Refinement on `cook-codebase-mode` (done) + `spec-to-cook-plan` (FE-800).
7. `cook-greenfield-single-tree` — **FE-827**; **branch-complete on `ka/fe-827-greenfield-single-tree`** (stacked on FE-826). Cook slice layout is now policy-selected (D165-K): serial greenfield runs one shared accreted tree (verify in place, no `__epic__`); parallel greenfield isolates per-slice + `__epic__` merge (race-safe); brownfield unchanged. Adds greenfield promotion-back (D166-K, I128-K): `--out`/`--force`, completed-gated, commit-on-branch, never silent — serial copy-commits the run tree, parallel commits a whole-plan merge (order-wins, collisions reported). Closes the cook output-promotion gap for greenfield; brownfield promotion stays a follow-on. New seams: `promote-run.ts`, `mergeCompletedSlicesIntoTree`, `promotionSourceDir`. LLM conflict reconciliation → Horizon `parallel-merge-conflict-reconciliation`.
8. `plan-build-architect` — **FE-829**; **active, building on `ka/fe-829-build-architect`** (stacked on FE-827, draft PR #185). Evolves `brunch plan` from a sequencer into a build-architect emitting fixture-quality, cook-executable `plan.yaml` (target shape = the three reference fixtures). Slice 1 (**done** 2026-06-09): self-contained `PlanContract` (`checkPlan` base/emitted profiles + `repairPlan`) + shared `plan-graph` Kahn helper + `Toolchain` descriptor in the emitter — synthesizes the multi-slice-epic integration seam, closing FE-800's integration-blind / "green checks, no artifact" gap (D167-K, I129-K; no LLM, no D160-K change). Slice 2 (**done** 2026-06-09): toolchain-agnostic cook prompts + runner — `ToolchainTestRunner` + toolchain-driven cook task builders + de-hardcoded `test-writer.md`, resolved from `plan.profile` (I130-K). Slice 3 (**done** 2026-06-09): build-architect LLM stage — the planner prompt now carries each slice's acceptance criteria, spec relation hints projected into slice-id space (`projectPlanningContext`), and the three reference fixtures inlined as comment-stripped few-shot exemplars; output schema unchanged (classify/group/order the existing `req-*` slices only). Slice 4A (**done** 2026-06-09): file-ownership contract — `Slice.writes?: string[]` + single-writer-per-file `checkPlan` finding (`file-write-conflict`, design-class warning, never auto-repaired) + the D160-K coordination-file-layout-namespace amendment (I132-K). Slice 4B (**done** 2026-06-09): the architect now AUTHORS the slice set — `architectPlan` (new schema: authored slices + `writes` + `derivedFrom`) → `materializeArchitectedPlan` (deterministic normalize + requirement-provenance coverage sidecar) → `repairPlan` + `checkPlan` (emitted + generalized coverage), with a deterministic projection fallback when authoring throws/parses-malformed/leaves a requirement uncovered (I133-K; supersedes the slice-3 `planExecutionOrdering` enrichment stage on the mainline). Slice 5 (**done** 2026-06-09): eval harness — `evaluatePlanShape` (`plan-eval.ts`), a deterministic outer-loop acceptance oracle (narrow `verdict` gate + graded structural-feature metrics scored against the abstract fixture-design principles, no id/path/count overfit); the 3 reference fixtures are its self-test and were refreshed (`writes` on every slice + the missing integration seam on the `core` / `pipeline` epics of two of them) to score `overall === 1` (I134-K). Post-slice-5 cleanup (**done** 2026-06-09): retired the dormant `planExecutionOrdering` — deleted `plan-llm-planning.ts` (+ test), relocated the surviving `PlanningEnrichment` type into `plan-reconciliation.ts`, consolidated the duplicate `RunModel` onto `plan-architect.ts` (I131-K retired). Opt-in real-LLM eval smoke (**done** 2026-06-09): `plan-emitter.test.ts` env-gated block (`PLANNING_REAL_LLM=1` + `ANTHROPIC_API_KEY`, `it.skip` otherwise) runs the production architect end-to-end on the `brunch-graphs-snapshot.json` fixture and asserts `evaluatePlanShape(plan).verdict === 'accept'` — restoring the opt-in real-LLM coverage lost with `plan-llm-planning.test.ts` at the I134-K gate. **Branch-complete** (slices 1–5 + post-slice-5 cleanup + opt-in smoke). Refinement on `spec-to-cook-plan` (FE-800).
9. `toolchain-profile-expansion` — **FE-843**; **branch-complete on `ka/fe-843-toolchain-profiles`** (stacked on FE-841). Expands the FE-829 toolchain contract so cook builds on more technologies. Card 1 (**done** 2026-06-10): data-driven profile registry — profiles are data literals (path templates + argv template + conventions prose) compiled into the unchanged `Toolchain` interface; added `node-vitest`, `node-test`, `node-jest`, `deno`; registry invariants pinned enumerably. Card 2 (**done** 2026-06-10): live + strict selection — `brunch plan --profile=<id>` (validated via `parseProfileId`), emitter resolves the chain once and stamps the id on both authored and fallback plans, `resolveToolchain` throws `UnknownProfileError` on unknown ids (absent stays lenient for fixtures). Card 3 (**done** 2026-06-10): architect-schema profile enum — chain is flag ≫ `snapshot.profile` ≫ architect-classified-from-spec-prose ≫ `bun`; a hallucinated profile fails schema parse → deterministic fallback (D160-K intact). No harness install verb (the cook agent scaffolds per A98) — assumption pending outer-loop validation (greenfield cook smoke `--profile=node-vitest`). I130-K refinement + agent-install assumption → SPEC at ln-sync tie-off. Deferred follow-ons: fail/infra test-outcome split, brownfield drift-check at cook open, `brunch detect`. Refinement on `plan-build-architect` (FE-829).

### Recently Completed

- `cook-codebase-mode` — brownfield resolver + git-worktree-based sandbox init for `brunch cook <dir>`. Slice 1 consolidated paths under `.brunch/cook/`; slice 2 implemented the resolver + clean-tree gate + parent `git worktree add` + per-slice parent-population (file-copy with `.git` / sibling-slice / `__epic__/` exclusion). Slice 3 refactored per-slice population into a **hybrid mechanism**: tracked content arrives via real `git worktree add` on a slice-level branch (`cook-slice/<runId>/<sliceId>`, sibling namespace to avoid ref-hierarchy collision with the parent `cook/<runId>` branch); untracked/gitignored content (`node_modules/`, `dist/`, etc.) arrives via CoW copy (`cp -c` on macOS APFS, `cp --reflink=auto` on Linux btrfs/xfs/zfs, `cpSync` fallback). Solves the over-copy problem (~90% disk savings on CoW filesystems) while preserving runtime-deps presence so pi-actions can run `npm test`/`bun test` against the slice worktree. Verified by 2026-05-26 outer-loop smoke against a tmpdir git repo + real pi (source-byte-identical isolation, in-place file modification). Two follow-on findings remain.
- `petri-declarative-routing` (FE-747) — `HandlerDescriptor` branching transitions now carry typed `Guard` predicates (`always`, `reportFieldTruthy`); `wireHandlers` consumes them via `evalGuard`; new `enumerateCandidateOutputs(transition)` exposes the topology-derived output-place set per transition. Establishes I125-K. Structural prerequisite for `petri-simulation-oracle` (Phase 4) and any static analysis; FE-700-independent. Halt paths and token transforms remain runtime concerns (separate follow-on slices). Follows FE-745.
- `petri-epic-verification-merge` — `verify-epic` now runs against a freshly-merged `<parentSandboxDir>/__epic__/<epicId>/` built from completed slice worktrees (declaration-order wins on path collisions; conflicts surfaced via `epic-sandbox-merged` event). Unblocks multi-slice `cook` runs. Follows FE-743.
- `petri-parallel-execution` (FE-743) — parallel firing policy, shared resource pool tokens, worktree-per-slice isolation. Decision gate passed: parallel measurably beats serial on wall clock for multi-slice plans. Follows `petri-semantic-lanes` (FE-738).

#### Follow-ons surfaced by the 2026-05-26 cook-codebase-mode smoke

- ~~**pi-actions evaluate-done collapses the TDD workflow**~~ — **resolved by `cook-harness-fidelity` (FE-813)**: Slice 1 (`d2139d8c`) scoped the evaluator to read-only tools so it cannot fix code during evaluation; Slice 2 (`fcba8ab3`) replaced the LLM verdict with executing the verification targets.
- **cook output promotion (follow-on)** — slice 3 creates real slice branches (`cook-slice/<runId>/<sliceId>`) but never commits; `cook/<runId>` HEAD === source HEAD with modifications in untracked subdirs, so there is no promotion path into the user's checkout. To close: commit slice work, `git merge` slice→epic→`cook/<runId>`, then `git merge cook/<runId>` from the working branch. Pairs with worktree/branch GC. Quality-of-life; the run worktree is already inspectable by hand. **Resolved by `brownfield-promotion` (FE-877).**
- ~~**per-slice worktree over-copy + eager seeding (optimization)**~~ — **resolved by `cook-worktree-laziness` (FE-879)**: slice worktrees materialize lazily at fire time (idempotent `ensureSliceWorktree`) instead of all-up-front in `wireHandlers`, and each slice symlinks `node_modules` to the parent's single copy instead of CoW-copying per slice. Closes acceptance (8) "over-copy accepted as a known follow-on optimization" + the sandcastle trigger (b) "native epic-merge over-copy becomes a measurable performance bottleneck."

### Next

**Full cook orchestrator — Arc 1 (feature delivery; stacks on FE-843, ships without the semantic stack):**

1. `agent-extension-host` — **(contract landed — FE-867)** the pi harness as a dual-mode (`elicit`/`execute`) extension host; cook capabilities register as `execute`-mode plugins. **Bases the Arc-1 linear stack** (2026-06-15 decision): the whole arc stacks on it, coordinated with the unpublished pi-harness thread (which owns the core). Logically it only gates the dispatch-seam frontier (`integration-oracle`), so serializing the seam-independent infra (2–5) behind it is a deliberate coupling of Arc 1 to that coordination, not a hard dependency. Sits over the FE-841 core.
2. `brunch-detect` — **(done — FE-871)** resolve a registry profile id from manifest/lockfile evidence at plan time; brownfield-only front of the chain, now wired into the emitter (slice 2). *(seam-independent)*
3. `harness-dep-install` — **(acceptance 1–2 landed except brownfield — FE-872)** dependency-delta capture + install-failure classification (the install *action* is agent-native via `bash` + FE-843 conventions; this owns lockfile capture for promotion + the fail/infra split). Done: classify + infra-aware halt reason + greenfield manifest/lockfile capture pinned. Remaining: brownfield dep-delta capture — **blocked on `brownfield-promotion`** (#7).
4. `dogfood-spike` (ln-spike) — **(done — 2026-06-16)** ran a real brownfield cook (hand-authored 2-slice plan: feature + wiring, `node:http` app) against a throwaway git repo. **Verdict:** chain works end-to-end (CoW worktree, clean-tree gate, per-slice→`__epic__` merge composed the wiring, TDD red/green, working branch untouched); the agent wired the feature reachable and **self-authored a genuine boot-and-probe** integration test (imports the real entry, `listen(0)`, `http.get('/health')`, asserts not-404). Orphan did **not** reproduce — but reachability was **agent-discretion, not enforced** → confirms the *value* of `integration-oracle`/`app-runtime-probe` (independent, unshortcuttable reachability). Two refinements surfaced: the probe should own the boot mechanism (the agent had to invent a `.js→.ts` resolve hook), and dep-install was unexercised (zero-dep app). Bonus: the `Cannot find module` TDD red was handled as a test-red (not infra) — validates FE-872 slice 1 live.
5. `app-runtime-probe` — **(slices 1–2 landed — FE-875, `runProbe` + `buildProbeSpec`)** build + boot + exercise the host app; the concrete reachability mechanism `integration-oracle` depends on (without it, "reachable" collapses back to "a test that imports the module"). Slice 1: boot + HTTP probe + reachable/not-reachable/infra classification + teardown. Slice 2: harness-owned `ProbeSpec` resolution — `buildProbeSpec(ProbeTarget)` allocates a free ephemeral port and assembles ready/feature URLs from boot-argv + *paths*, so a hardcoded port can't collide under parallel cook (the boot test's hand-rolled port dance is now the production primitive it dogfoods). Stays off the dispatch seam: argv + paths are inputs cook-time grounding will supply; the harness owns only the port pick + URL/env assembly (loopback-only; best-effort ephemeral port with an acknowledged TOCTOU window, no retry framework). Remaining: mode-awareness, integration-oracle gating (where the `ProbeTarget` argv/paths come from = `integration-oracle` #6).
6. `integration-oracle` — architect emits generic wiring intent, cook agent resolves real wiring (cook-time grounding), oracle asserts product reachability via `app-runtime-probe` in the FE-738 semantic lane. Promotes FE-800's integration-blind follow-on to a frontier. *(dispatch-seam — depends on `agent-extension-host`; wiring agent = `execute`-mode plugin)*
7. `brownfield-promotion` — commit/merge the cook result into the user's checkout; extends FE-827's greenfield promotion to brownfield.
8. `brunch-ship` — one-shot `brunch serve <specId>` wrapper (prep → recipe → cook → taste → plate), no manual steps. Arc 1 capstone.

**Runtime umbrella + semantic substrate:**

1. `intent-graph-semantics` — highest-coordination semantic substrate after FE-705 reconciliation.
4. `changeset-ledger` — Track 4 of the runtime umbrella; parallel with Track 2; semantic history spine needed before canonical proposal acceptance, direct-edit atomicity, and productized scenario options.
5. `chat-context-provision` — Track 5 of the runtime umbrella recast as transcript-first context; can proceed against chat/turn once secondary-chat entry/anchor shape is settled.
6. `reconciliation-runtime` — Track 3 of the runtime umbrella; after Track 2 + Track 4 provide the secondary-chat surface and durable attribution.
7. `graph-review-scenario-options` — artifact-only critique/probe lane; can advance in parallel with FE-700 if it does not commit canonical graph truth.
8. `productized-scenario-options` — user-facing acceleration surface after FE-700 semantics, FE-701 changesets, and graph-review probes.

### Parallel / Low-conflict

- `first-run-provider-setup` — provider/key UX and runtime seam can progress independently of semantic-stack work.
- `workspace-gitignore-assist` — small workspace hygiene surface with low overlap.
- `productized-web-research` — waits on prompt/context scenario substrate for probe quality, but can remain separate from semantic schema work.

### Horizon

**Full cook orchestrator — Arc 2 (full orchestrator; autonomy ladder, gated behind the semantic/Petri-Phase-3/4 substrate):**

- `interactive-recovery` — keystone safety rung: on rework-budget exhaustion or irreducible oracle ambiguity, synthesize a question into a `qa`/`strategy` secondary chat; the answer resumes the run. Depends on chat runtime (FE-716, done) + run resume (Petri Phase 4) + `changeset-ledger` (FE-701). Do first — makes the orchestrator safe to run unattended before re-plan/intent-verification are perfect.
- `intent-conformance-oracle` — independent behavioral-kernel verification (requisite variety) separate from self-authored tests. Depends on `intent-graph-semantics` (FE-700) + `BEHAVIORAL_KERNELS.md`; reuses the `graph-review` rubric.
- `adaptive-replan` — architect amends the plan from execution feedback; recompile the affected sub-net + resume. Depends on Petri Phase 3 (`petri-graph-compilation`) + Phase 4 (`petri-simulation-oracle`) + FE-738's deferred stale-graph criterion. The latent `architect-generator-loop`; highest cost, last rung.
- `transformation-orchestrator` — separate product line for non-additive work (refactors, migrations, cross-cutting renames, debugging): transformation-shaped intent (transform existing→existing, behavior-preserving, test-guarded), not `requirement → additive slice`. Do not fold into Arc 1/2.

- `petri-graph-compilation` — compile Petri nets from workspace plan-graph + relation policy; depends on `intent-graph-semantics` (FE-700). Extends the existing FE-700 relation-policy registry.
- `petri-simulation-oracle` — reachability analysis, deadlock detection, resume from durable markings. Planning oracle for plan-shape defects. Depends on `petri-graph-compilation`.
- `parallel-merge-conflict-reconciliation` — LLM-assisted reconciliation of real content collisions in the parallel-greenfield whole-plan merge (two slices, same path, different content), replacing deterministic order-wins. Must be gated: LLM proposes → mandatory post-merge whole-plan verify (tests are the oracle) → repair or refuse. Reintroduces non-determinism at the assembly point, so it fights the FE-813 harness-fidelity direction (D161-K) and needs the verify gate to be trustworthy. Depends on `cook-greenfield-single-tree` (FE-827) whole-plan merge + a whole-plan verify step.
- `relation-first-observer-enrichment`
- `architect-generator-loop`
- `server-mini-library-compartmentalization`
- `side-chat-v4b-item-versioning` (depends on `changeset-ledger`)
- `dashboard-summaries`
- `spatial-graph-layout`
- `graph-view-active-path-filter`
- `mcp-adapter`
- `file-based-persistence`
- `typed-fixture-builder-convergence`
- `structured-development-spec-registry`
- `portability-boundaries`

## Frontier Definitions

### orchestrator-poc

- **Name:** Orchestrator POC — dual-engine execution with contract tests + compiler extraction
- **Linear:** FE-730
- **Kind:** structural / experiment
- **Status:** done
- **Objective:** Two interchangeable execution engines (`proc` and `petri`) behind a shared `Orchestrator` seam, driven test-first with fake agents. Takes a plan YAML (epics → slices), dispatches actions inline (registry deferred), runs tests deterministically, writes structured events to `reports.jsonl`. **Phase 0 (closing):** extract `NetCompiler` + `Interpreter` + `FiringPolicy` types from `engine-petri.ts`; define `PetriNet`, `Transition`, `Guard` aligned with the spec doc; implement `compileSliceTddSubnet()` so the TDD inner loop is compiled from a template rather than hand-wired; proc engine calls the same compiler with a serial firing policy; adapter test confirms compiled net for fixture matches expected place/transition count.
- **Why now / unlocks:** The PoC validated that petri earns its complexity (2026-05-21 commitment). Phase 0 extracts the reusable compiler/interpreter substrate so Phases 1–2 can evolve the net template and firing policy independently without another round of topology bugs. Also: retry budget currently leaks outside the net (`ctx.retries` Map) — Phase 0 should move retry state into places.
- **Acceptance:** (1) `brunch cook <fixture-dir> --engine=proc` completes Fixture #1 end-to-end. (2) Same with `--engine=petri`. (3) `reports.jsonl` human-readable. (4) Both engines pass same contract suite. (5) Worktree isolation holds. (6) Mid-run halt produces coherent `OrchestratorResult`. **(Phase 0 addendum):** (7) `NetCompiler`, `Interpreter`, `FiringPolicy` are separate modules. (8) Both engines call `compileSliceTddSubnet()`. (9) Retry state is in-net, not on `ctx.retries`.
- **Verification:** Contract tests (fake agents, both engines identical), adapter tests (per-engine internals, optional in POC), integration fixture run (real pi-agent on Fixture #1). Phase 0: adapter test for compiled net shape.
- **Traceability:** Requirements 46–50; D155-K–D159-K; I121-K–I123-K.
- **Design docs:** `docs/design/orchestrator.md`; `docs/next/architecture/plan-graph-petri-orchestration.md` §4–§6; umbrella H-6476.

### petri-semantic-lanes

- **Name:** Petri semantic lanes — mechanical + semantic two-lane subnet template
- **Linear:** FE-738
- **Kind:** structural
- **Status:** done (criterion 5 deferred → `petri-graph-compilation`)
- **Objective:** Extend the extracted NetCompiler to produce a two-lane subnet template per slice: a mechanical lane (dispatch, artifact production, test execution, verification) and a semantic lane (oracle satisfaction, design exercise, intent establishment, completion claim review). Add the spec §7 structured event vocabulary (`transition_fired`, `oracle_passed`, `graph_revision_stale`, `semantic_review_requested`, `completion_claim_accepted`, `status_projection_suggested`, `net_deadlocked`, …) as the interpreter's durable event model. `TransitionContract` type (spec §6) governs each transition's kind, actor, guard, action binding, and emitted events. Mechanical transitions produce candidate evidence; semantic transitions judge that evidence against graph-derived requirements. `PlanDoneAccepted` is reachable only after both lanes complete.
- **Why now / unlocks:** First frontier where the Petri engine models a distinction the proc engine cannot express topologically: mechanical completion ≠ semantic completion. Unblocks Phase 2 parallel firing (lanes can fire concurrently) and Phase 3 graph compilation (semantic lane structure maps to relation-policy gates). Without this, the engine remains a serial task runner with token-shaped bookkeeping.
- **Acceptance:** (1) ✅ Compiled subnet has distinct mechanical and semantic places/transitions. (2) ✅ `PlanDoneAccepted` is unreachable unless both `VerifyPassed` and `OracleSatisfied` (or equivalent semantic tokens) are present. (3) ✅ Event log records §7 vocabulary events per transition firing. (4) ✅ `TransitionContract` type covers kind, actor, guard, and emits. (5) **Deferred → `petri-graph-compilation`**: stale-graph detection requires `GraphRevisionCurrent` tokens and graph revision semantics from `intent-graph-semantics` (FE-700); the current Plan-from-YAML substrate has no mutable graph revision to detect staleness against. (6) ✅ Existing contract test suite passes. (7) ✅ `compileTopology(plan, policy) → NetBlueprint` is pure (no runtime refs); `wireHandlers(blueprint, input, ctx) → PetriNet` attaches closures. (8) ✅ `createOrchestrator(policy)` factory replaces identical engine classes. (9) ✅ `RunCtx` lives in `types.ts`, not compiler. (10) ✅ Semantic rework budget (`semantic-budget` place) prevents infinite rework loops. (11) ✅ `HandlerDescriptor` discriminated union describes each transition's routing recipe declaratively.
- **Verification:** Contract tests extended with semantic-lane scenarios (happy-path Prototype A, stale-graph Prototype B, missing-oracle Prototype C from spec §10). Adapter test for two-lane net shape via `compileTopology` (pure topology, no runtime bindings needed). Event-log assertions for §7 vocabulary. Semantic rework exhaustion contract test.
- **Traceability:** Requirements 46–50; spec §2 (layer split), §4 (canonical slice-net), §6 (transition contracts), §7 (event model), §8 (failure-mode nets), §10 (prototypes A–C).
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md`; `docs/design/orchestrator.md`; umbrella H-6476.

### petri-graph-compilation

- **Name:** Petri graph compilation — compile nets from plan-graph + relation policy
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon (blocked on `intent-graph-semantics` FE-700) — **premise weakened, partially subsumed by `spec-to-cook-plan` (FE-800); see Reconciliation**
- **Objective:** Compile Petri nets from workspace plan-graph nodes and relation-policy edges rather than from YAML plan fixtures. Relation kinds (`plan.depends_on`, `plan.verified_by_oracle`, `plan.introduces_design`, etc.) compile into topology-level requirements (prerequisite tokens, guard predicates, semantic-lane join conditions). Extends the FE-700 relation-policy registry.
- **Why now / unlocks:** Without graph compilation, the Petri engine only runs hand-authored YAML plans. Graph compilation makes the engine a planning oracle (simulate before executing) and connects execution to the semantic workspace.
- **Reconciliation with `spec-to-cook-plan` (FE-800, 2026-06-03):** This frontier's premise — compile from `plan.depends_on` relation-policy edges — quietly assumed those execution-order edges exist in the graph (to be supplied by FE-700). The FE-800 spikes proved **execution order is not spec truth and FE-700 will not conjure it** (the observer captures only epistemic deps; requirements are pure sinks of `depends_on`). So the ordering this frontier wanted to read must be **synthesized** — exactly what FE-800's LLM planning pass does at the `plan.yaml` layer, after which the existing `net-compiler.ts` (plan.yaml → net) already produces the net. Net effect: FE-800 + the existing compiler cover the graph→executable-net path; this frontier's remaining **distinct** value is the **Phase-4 simulation oracle** (analyze/simulate the net before running) and richer synthesized token/gate payloads, *not* a separate graph→net compiler. Reframe or fold accordingly before scheduling; do not treat as independent of FE-800.
- **Open design constraints (from PR #143 / FE-743 review):**
  - **Declarative output arcs:** Extracted to its own frontier `petri-declarative-routing` (lands ahead of Phase 3; independent of FE-700).
  - **Token state enrichment:** Open question whether more metadata should move from reports into tokens (richer typed token payloads per spec §3). FE-738 added `reworkCount`, FE-743 added pool tokens with `agentPoolSize`, but the boundary between control state (tokens) and substantive handoff state (reports) is a design choice this frontier needs to resolve as the token taxonomy gets richer.
- **Acceptance:** TBD — depends on FE-700 relation-policy shape.
- **Verification:** Compiled-net topology tests against plan-graph fixtures; reachability assertions for relation-policy-derived gates; comparison of compiled vs hand-authored net shapes.
- **Traceability:** Requirements 46–50; spec §5 (relation-policy compilation), §6 (transition contracts).
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md` §5–§6; umbrella H-6476.

### petri-parallel-execution

- **Name:** Petri parallel execution — concurrent firing, resource pools, worktree-per-slice
- **Linear:** FE-743
- **Kind:** structural
- **Status:** done
- **Objective:** Replace the serial `while(true) { transitions.find() }` interpreter with a parallel firing policy that can advance multiple enabled transitions concurrently. Convert per-slice `test-agent`/`code-agent` tokens (already present in PoC at `engine-petri.ts:134-149`) into shared capped resource pools that bound global concurrency. Add worktree-per-slice isolation (one worktree per active slice, not just per run). This is the categorical break where the Petri engine earns its complexity over proc.
- **Why now / unlocks:** Parallelism is the primary value claim for petri over proc (per PR #143's own verdict and the spec doc's working conclusion). Without it, both engines are serial and proc wins on simplicity. If petri doesn't beat proc on wall clock time for multi-slice plans, the investment should pause.
- **Acceptance:** (1) Multi-slice plans execute with real parallelism (multiple transitions firing concurrently). (2) Resource pool tokens limit global concurrency to configured agent capacity. (3) Each active slice has its own worktree. (4) No fan-out starvation, dead-place, or unreached-slice bugs (regressions from PoC bug-fix rounds). (5) Wall-clock improvement measurable on a 3+ slice fixture vs serial execution. (6) Contract test suite still passes for both engines (proc remains serial).
- **Decision gate:** If parallel petri does not beat proc on wall clock for a representative multi-slice fixture, pause further petri investment and revisit the substrate commitment.
- **Verification:** Contract tests with multi-slice concurrency scenarios. Wall-clock benchmark on 3+ slice fixture. Resource-exhaustion test (more slices than agents). Worktree isolation tests per slice.
- **Traceability:** Requirements 46–50; spec §3 (token taxonomy — resource tokens), §4 (canonical slice-net terminal join).
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md`; `docs/design/orchestrator.md`; umbrella H-6476.

### petri-declarative-routing

- **Name:** Petri declarative output arcs — topology-level routing for branching transitions
- **Linear:** FE-747
- **Kind:** structural
- **Status:** done
- **Objective:** Move conditional output routing from `wireHandlers` fire closures into typed `Guard` predicates declared on `HandlerDescriptor`, so a topology-only consumer can enumerate every reachable output place per transition without invoking actions, reports, or the test runner.
- **Why now / unlocks:** First Phase-3 prep step that does not depend on FE-700. Today's `HandlerDescriptor` already names candidate output places (`onTrue`/`onFalse`, `onPass`/`onFail`, `onSatisfied`/`onRejected`) but the guard predicates that select among them live in runtime closures in `net-compiler.ts`. Without declarative guards, formal analyses (reachability, deadlock detection, simulation) can only see input-side structure — which makes `petri-simulation-oracle` (Phase 4) impossible regardless of whether Phase 3 graph compilation lands. Token transforms (`reportId` attach, budget decrement, retry/rework propagation) and budget-exhaustion halts stay in closures and become separate follow-on slices.
- **Acceptance:** (1) `HandlerDescriptor` branches that route conditionally carry typed `Guard` data; initial vocabulary covers `always` and `reportFieldTruthy`; extension shape is documented. (2) `wireHandlers` consumes guards via a pure `evalGuard(guard, report)` helper; conditional routing logic moves out of inline closure code. (3) A pure `enumerateCandidateOutputs(transition: TransitionSkeleton): Set<string>` function returns the topology-derived output place set per transition without instantiating actions/reports/testRunner. (4) Engine contract suite passes unchanged across both engines.
- **Verification:** Existing engine-contract tests (12+ scenarios, both engines) prove runtime equivalence; new adapter tests pin `enumerateCandidateOutputs` and `evalGuard` against the `simplePlan` and `depPlan` fixtures; new tests run with topology-only inputs (no actions, no reports, no test runner).
- **Traceability:** Requirements 46, 47, 48; D156-K (Phase-3-prep refinement of FE-738 HandlerDescriptor design); candidate new invariant on build: "Topology output-place candidates are fully declared in `HandlerDescriptor`; `wireHandlers` introduces no new output places at fire time."
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md` §6 (transition contracts), §10 (prototypes); umbrella H-6476.


### cook-codebase-mode

- **Name:** Cook codebase-mode — brownfield resolver for `brunch cook` against an existing repo
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** done (2026-05-26) — slice 1 (path consolidation) + slice 2 (resolver + git worktree + per-slice population) shipped; outer-loop smoke with real pi confirmed in-place file modification and source-byte-identical isolation. Three follow-on findings tracked in `Recently Completed` rather than re-opening this frontier.
- **Objective:** Implement the SPEC §D50 reserved dual-mode resolver. When `<dir>/.brunch/cook/plan.yaml` exists, `brunch cook <dir>` loads that plan and runs slices against a worktree initialized from the cwd repo (modifying existing code) rather than an empty worktree (generating from scratch). The source branch in `<dir>` remains untouched; agent commits live on a per-run cook branch the user can review or discard. Existing greenfield fixture-mode path stays unchanged.
- **Why now / unlocks:** Today brunch's orchestrator only runs on greenfield fixtures — pi-actions generate code from scratch in fresh worktrees. Real software work is brownfield: agents modify existing code. Without codebase mode, `cook` cannot operate on a user's actual project, so the orchestrator stays a fixture-only substrate even though Petri Phases 0–2 are committed and FE-747 declarative routing has landed. Codebase mode is the smallest step from "orchestrator-as-substrate" to "orchestrator-as-product."
- **Adoption decision (2026-05-26):** **Build native now.** Extend brunch's existing `worktree.ts` + `epic-sandbox-merge.ts` to support codebase mode using direct `git worktree add` calls; keep `pi-actions.ts` `spawnSync('pi', ...)` as-is. Sandcastle adoption is **deferred** — see "Future direction" below.
- **Open design questions (resolve during scope):**
  - **Clean working tree gate:** Refuse to brownfield-run if `<dir>` has uncommitted changes? Likely yes — auto-stash risks losing user work. Brunch-level invariant: "source branch byte-identical before and after."
  - **Branch naming:** Sandbox worktree branches off HEAD as `cook/<runId>`? Or user-controlled via a flag? `cook/<runId>` is the safe default; flag is the escape hatch.
  - **Per-slice worktree mechanism:** `git worktree add <sliceDir> -b cook/<runId>/<sliceId> cook/<runId>` per slice off the run-level branch. `epic-sandbox-merge.ts` file-copy semantics need to either (a) continue working over `git worktree`-populated sliceDir contents and accept the known over-copy, or (b) migrate to a `git merge` of slice branches into an epic branch. Pick (a) for the first slice; (b) is a follow-on optimization.
  - **Pi inside a non-empty worktree:** `pi-actions.ts:runPi` passes `cwd: opts.sandboxDir`. Confirm pi tools (read/write/edit/bash) behave correctly against pre-existing code (almost certainly yes, but worth one smoke test).
- **Future direction — sandcastle adoption (deferred, revisit when project evolution warrants):**
  - **Spike on 2026-05-26 confirmed the hybrid path is technically viable.** `@ai-hero/sandcastle` (v0.5.12) exposes `createWorktree({ branchStrategy: 'merge-to-head' })` decoupled from agent invocation, exports a built-in `pi` agent provider, and supports `noSandbox()` (no Docker requirement). The hybrid v2 path (sandcastle worktree + sandcastle pi provider) would eliminate brunch's `pi-actions.ts spawnSync` boilerplate and retire `epic-sandbox-merge.ts`'s file-copy over-copy problem via git branch-merge.
  - **Why deferred now:** Too many integration issues at this stage — sandcastle is pre-1.0 (v0.5.12), pulls in Effect/effect-platform as runtime deps (~300KB), would require migrating brunch's Petri orchestrator to compose with sandcastle's worktree lifecycle, and locks in sandcastle's branch-naming + close-merge semantics. Premature adoption risks coupling brunch to an evolving upstream API before brunch's own brownfield needs are settled.
  - **Triggering criteria to revisit:** (a) sandcastle ships 1.0 with stable API; OR (b) brunch's native epic-merge over-copy becomes a measurable performance bottleneck; OR (c) brunch needs container-isolation paths (Docker/Vercel) for security or remote-execution reasons; OR (d) Effect-based runtime dependency becomes attractive for unrelated reasons. None of these are true today.
- **Acceptance:** (1) `brunch cook <dir>` with `<dir>/.brunch/cook/plan.yaml` no longer exits with "not yet implemented." (2) Top-level sandbox worktree initialized via `git worktree add` of cwd repo on branch `cook/<runId>`. (3) Per-slice worktrees branch off the run-level branch. (4) Slices execute against pre-populated worktrees; `pi-actions.ts` unchanged — pi-tools operate on existing code. (5) Source branch in `<dir>` is byte-identical before and after a cook run (success or failure). (6) Cook runs leave a discoverable artifact (the `cook/<runId>` branch) for the user to review or discard. (7) Greenfield fixture-mode behavior is unchanged (empty worktree, generate-from-scratch); only the run output path moves from `<cwd>/.cook/runs/` to `<cwd>/.brunch/cook/runs/` per the SPEC §D50 / §A49 consolidation. All affected tests and fixture paths are updated. (8) `epic-sandbox-merge.ts` continues to work — over-copy accepted as a known follow-on optimization, flagged in code comments. **(Optimization later closed by `cook-worktree-laziness` / FE-879.)**
- **Verification:** `brownfield-smoke.integration.test.ts` constructs a seeded git repo in tmpdir at test setup (NOT committed under `fixtures/` — nested `.git/` creates submodule weirdness), authors a `.brunch/cook/plan.yaml` carrying one slice that modifies an existing file, runs engine.run with fake actions, asserts (a) source branch unchanged, (b) modification landed in the slice worktree, (c) parent worktree is on `cook/<runId>`. CLI unit tests pin `resolveCookMode` + clean-tree gate. `worktree.test.ts` + `epic-sandbox-merge.test.ts` pin the codebase-mode seam components. Existing greenfield tests untouched.
- **Traceability:** SPEC §D50 (reserved codebase-mode resolver); §A49 (worktree isolation at `<cwd>/.brunch/cook/runs/<runId>/worktree/`); Requirement 49.
- **Design docs:** SPEC §D50 + §A49; `docs/next/architecture/plan-graph-petri-orchestration.md` (worktree section).

### cook-worktree-laziness

- **Name:** Cook worktree laziness — lazy per-slice provisioning + shared `node_modules` for brownfield cook
- **Linear:** FE-879
- **Kind:** hardening (refinement on `cook-codebase-mode`)
- **Status:** done — branch-complete on `ka/fe-879-lazy-cook-worktrees` (PR #223, stacked on FE-864)
- **Objective:** Stop brownfield cook paying an eager, all-slices startup tax. In codebase mode `wireHandlers` provisioned every slice's git worktree up front (N × `git worktree add` + N recursive `node_modules` CoW copies) before any slice fired — for an 8-slice plan, 9 worktrees and 9 `node_modules` recursions, the copy dominating wall-clock. Make provisioning lazy and the dependency tree shared, without changing what cook produces.
- **What landed:** (1) slice-worktree creation moved out of the eager `wireHandlers` loop into `resolveSliceCwd`, materialized on first fire via idempotent `ensureSliceWorktree` — a run touching 2 of 8 slices pays for 2 worktrees, not 8; rework re-fires are no-ops; synchronous (`execFileSync`) provisioning serializes concurrent fires on the JS thread, so parallel-policy worktree adds never overlap. (2) each slice symlinks `node_modules` to the parent worktree's single copy instead of CoW-copying per slice (`SHAREABLE_TOP_LEVEL_ENTRIES` in `cow-copy.ts`); `walkFiles` already skips symlinks, so the shared tree is never re-walked during dependency seeding, merge, or promotion. Other gitignored dirs (`dist/`) still copy per slice.
- **Acceptance:** (1) ✅ codebase-mode slices provisioned lazily at fire time, not eagerly in `wireHandlers`. (2) ✅ `ensureSliceWorktree` idempotent across reworks. (3) ✅ slice `node_modules` is a symlink to the parent, not a copy; other gitignored content still copies. (4) ✅ correctness-neutral — same worktrees/branches, deps resolve through the symlink; brownfield smoke + engine-contract suites unchanged.
- **Risk:** build caches under `node_modules/` (`.cache`, `.vite`) become shared across parallel slices — acceptable for cook's transient runs; revisit if a toolchain needs per-slice write isolation (documented at the call site).
- **Verification:** `npm run verify` green; new `epic-sandbox-merge.test.ts` cases pin the `node_modules` symlink, per-slice copy of other content, and `ensureSliceWorktree` idempotency; brownfield integration smoke unchanged.
- **Traceability:** closes `cook-codebase-mode` acceptance (8) over-copy optimization + sandcastle trigger (b). Refinement on `cook-codebase-mode`; stacked on `orchestrator-enhancements` (FE-864) — closer to the cook engine it touches, and independent of the brownfield-promotion/serve work above it.

### cook-harness-fidelity

- **Name:** Cook harness fidelity — a trustworthy per-slice completion signal
- **Linear:** unassigned (create on start)
- **Kind:** structural
- **Status:** branch-complete on `ka/fe-813-cook-harness-fidelity` (PR #170) — Slice 1 (evaluator read-only via per-action `toolsForAction`) + Slice 2 (`evaluate-done` gates `done` on executing the verification targets, replacing the LLM verdict; `evaluateVerificationTargets` requires ≥1 target and all-pass) landed + unit-tested 2026-06-04. Slice 3 (`9fb5af12`) hardens the writer prompts now that the test *is* the oracle: ports ln-build discipline into `test-writer`/`code-writer` (orient + match conventions, behavioral tests through the public interface, ban trivially-passing tests, no speculative abstraction), de-hardcodes `code-writer` from TypeScript, and deletes the now-dead `evaluator.md`. The "evaluator observes, never produces; completion reflects real test execution" invariant is now promoted into SPEC as **D161-K + I126-K** (ln-sync 2026-06-04; rides with PR #170's merge). Remaining sibling: the bun→host test-runner decoupling (ProjectProfile/toolchain adapter) **landed in FE-829 slice 2** (`ToolchainTestRunner` + toolchain-driven cook task builders + de-hardcoded `test-writer.md`; I130-K).
- **Objective:** Make the cook execution harness's per-slice "done" signal trustworthy. The evaluator must **observe, not produce**: (a) `evaluate-done` runs `pi` with **read-only** tools so it cannot fix code during evaluation (today `pi-actions.ts` hands every action `read,write,edit,bash`); (b) "done" is decided by **executing** the slice's verification targets — mirroring `verify-epic`'s `execAsync('bun test …')` gate on real pass/fail — instead of an LLM verdict over prose. Establishes the invariant: *the evaluator never mutates the sandbox; completion reflects real test execution.*
- **Why now / unlocks:** The 2026-05-26 brownfield smoke caught `evaluate-done` fixing the file during evaluation and reporting `done:true` on the first call, so write-tests/write-code/run never executed; and "done" is a soft LLM judgment with no requisite variety — it let orphan code pass (2026-06-04). The harness's success signal is untrustworthy across **every** run, so no downstream oracle work (integration oracle, simulation oracle) can be trusted until completion means something. Highest-leverage harness fix.
- **Build order (slices — keep in CARDS/session, do not fragment):** (1) evaluator read-only — per-action tool scoping, `evaluate-done` → `read` [bugfix; the documented `cook-codebase-mode` follow-on]; (2) `evaluate-done` executes the slice's verification targets and gates `done` on real results, not an LLM verdict.
- **Acceptance:** (1) per-action tool scoping; `toolsForAction('evaluate-done') === 'read'`; write-tests/write-code/verify-epic keep write-capable tools. (2) `evaluate-done` reports `done` from executed verification targets, not LLM judgment. (3) brownfield smoke: the TDD loop runs end-to-end (the evaluator no longer short-circuits). (4) engine contract suite green on both engines.
- **Verification:** unit test on a pure `toolsForAction` map; adapter/contract test that `evaluate-done` gates on executed-target results; outer-loop brownfield smoke replaying the 2026-05-26 regression.
- **Depends on:** `orchestrator-poc` (done), `cook-codebase-mode` (done). Complements `spec-to-cook-plan`'s integration-blind-verification follow-on (the emitter emits integration-demanding targets; this frontier makes the harness actually *run* them); upstream of any future integration oracle.
- **Lexicon:** `evaluator` = read-only observer of verification results, distinct from the test-runner / code-writer; ties to `ln-oracles` "requisite variety."
- **Design docs:** `docs/design/orchestrator.md`; SPEC §Verification Design.

### petri-petrinaut-semantics

- **Name:** Petri-net semantic alignment for Petrinaut visualization
- **Linear:** FE-761 (parent: FE-760)
- **Kind:** structural
- **Status:** done
- **Objective:** Refactor the substrate so compiled nets satisfy the Petri-net semantics Petrinaut requires. Two refactors: **(a) sibling transitions for conditional branching** — the four conditional-output transitions per slice (`evaluate`, `run-tests`, `assess-semantic`, `verify-epic`) split into multiple sibling transitions with complementary enabling guards; each transition emits to a fixed output set rather than selecting via `onTrue`/`onFalse`/`onPass`/`onFail`/`onSatisfied`/`onRejected` from FE-747. **(b) start/end pairs for agent dispatch** — every long-running agent-dispatching transition (≈5 per slice) splits into a `dispatch:*` start (instantaneous; parks the token in a new `running:*` place; kicks off the agent task async) and one or more `complete:*:<outcome>` ends (instantaneous; fires when the agent task signals completion). Multi-output fan-out transitions (`complete-slice`, `complete-epic`, passthroughs) stay single — already compliant with "all declared outputs fire" semantics. Token enrichment in the transition kernel is explicitly retained.
- **Why now / unlocks:** Petrinaut requires (1) every transition emits to *all* declared output places (multi-output is fan-out, not selection), and (2) transitions are instantaneous events. Today's FE-747 `HandlerDescriptor` selects between output sets, and the `action`/`run-tests`/`assess-semantic`/`verify-epic` handlers block during fire. Both violate Petri-net semantics. Without this refactor, any blueprint or event stream shipped to Petrinaut is structurally unrenderable. **Blocker for FE-762 and FE-763.**
- **Acceptance:** (1) `ActionDescriptor` / `RunTestsDescriptor` / `AssessSemanticDescriptor` / `VerifyEpicDescriptor` no longer select between output sets; each `TransitionSkeleton` has one fixed output set. (2) Conditional branching expressed as sibling transitions; choice between siblings decided by enabling guards over input markings + token-attached report data, not by output selection. (3) Every long-running transition decomposes into `dispatch:*` + `complete:*:<outcome>` siblings around a `running:*:<sliceId>` place. (4) Engine contract suite (≈120 tests) green — runtime equivalence preserved. (5) `enumerateCandidateOutputs(transition)` returns one set per transition. (6) Halt outcomes decided — proposed: explicit `halted:*:<sliceId>` place (proposal, not cross-team-required).
- **Verification:** Adapter tests pinning refactored topology shape; end-to-end smoke on `fixtures/txt/`; updated `enumerateCandidateOutputs` literal-fixture goldens; halt-as-place tests if that path lands.
- **Open / pending coordination:** Read-arc concurrency semantics — pending Petrinaut team confirmation. Today's pool/budget tokens use consume+return for capacity-bounding; naive read-arc migration would break that.
- **Context:** Cross-team alignment with the Petrinaut team (2026-05-26) committed brunch to producing Petri-net-faithful blueprints and event streams.
- **Traceability:** Spec §6 (transition contracts); refines FE-747 D156-K.

### petri-blueprint-export

- **Name:** Petrinaut-format JSON export of the compiled net
- **Linear:** FE-762 (parent: FE-760)
- **Kind:** structural
- **Status:** done — `net.json` export landed (and the SDCPN transform → `net.sdcpn.json`).
- **Objective:** Serialize the refactored `NetBlueprint` into Petrinaut's expected JSON format and write to `<runDir>/net.json` per cook run. Tokens encoded as `{ id: UUID, ...payload }` per the agreed payload shape: `id` is a per-instance UUID, semantic fields (`sliceId`, `epicId`, `reportId`, `retryCount`, `reworkCount`) live as payload. Discrete-type system follows Petrinaut's H-6519 (uuid/boolean/int) plus any string type the Petrinaut team adds.
- **Why now / unlocks:** First half of what Petrinaut needs from brunch alongside FE-763. The Petrinaut team is waiting on a sample `net.json` for `fixtures/txt/` to begin their work.
- **Acceptance:** (1) `<runDir>/net.json` written at compile time; round-trips through Petrinaut's loader. (2) Token payload shape matches cross-team-agreed shape. (3) `schemaVersion` field for forward-compatibility (proposal, not cross-team-required). (4) Representation of `sliceId`/`epicId` decided. (5) Place naming convention agreed.
- **Verification:** Schema validation against Petrinaut loader; sample `net.json` for `fixtures/txt/` shared async; round-trip equality tests.
- **Open / pending coordination:** Petrinaut JSON schema spec (Petrinaut team); string discrete-type availability (Petrinaut team); place naming convention.
- **Traceability:** H-6518/H-6519.

### petri-event-stream

- **Name:** Petrinaut event stream — initial markings + transition firings
- **Linear:** FE-763 (parent: FE-760)
- **Kind:** structural
- **Status:** done — `petrinaut-events.jsonl` stream landed (initial marking + transition firings + terminal).
- **Objective:** Emit the runtime events Petrinaut needs to visualize a live cook run: (a) initial markings at run start; (b) transition-firing events in the cross-team-agreed shape — `{ transitionName, input: { place: [{ id, ... }] }, output: { place: [{ id, ... }] } }`. Token UUIDs generated at emission; semantic IDs live as payload fields. `runId` namespaces every event.
- **Why now / unlocks:** Second half of the Petrinaut integration alongside FE-762. Decouples visualization from `reports.jsonl`.
- **Acceptance:** (1) Initial markings emitted at run start. (2) Every transition firing emits an event in agreed shape. (3) Token UUID lifecycle decided — persist across consume→emit (proposed) or refresh per emission. (4) `runId` on every event. (5) Halt outcomes emit structured event matching `halted:*` topology decision.
- **Verification:** Event-stream replay tests; coherence checks (every output token in event N reappears as input in some later firing or terminates); fixture capture for `fixtures/txt/` shared with Petrinaut team.
- **Open / pending coordination:** Token UUID lifecycle (persist vs refresh).
- **Context:** Cross-team alignment (2026-05-26) settled v1 as one-way brunch → Petrinaut. Event payload shape was agreed cross-team.

### petri-sync-server

- **Name:** Brunch → Petrinaut live stream — ephemeral SSE server for an executing cook run
- **Linear:** FE-764 (parent: FE-760)
- **Kind:** structural
- **Status:** active — slices 1 + 2 + 3a + 3b + 4 of 5 done (export reducer + identity-fold engine wiring + `--petrinaut-fold` cook CLI flag + in-process stream bus with replay buffer + ephemeral HTTP/SSE server on localhost + `--petrinaut-stream` cook wiring with multi-tier Petrinaut-URL + auto-open). `brunch cook <dir> --petrinaut-stream` now boots an ephemeral SSE server bound to the run, composes `{PETRINAUT_URL}?runId=…&sse=…` (FE-819 Card D: `mode` dropped) and auto-opens (unless `--no-petrinaut-open` or `CI`). Next: slice 5 — brunch web-UI button + endpoint discovery (needs decision on `<runDir>/petrinaut-stream.json` advertisement). Bristol-demo integration path; supersedes the earlier static single-file bundle idea. **Pending (uncommitted, separate worktree `ka/fe-764-petri-sync-server`):** a TDD-complete Private Network Access change adds `Access-Control-Allow-Private-Network: true` to the SSE + CORS-preflight headers (unblocks remote-HTTPS-Petrinaut → loopback `EventSource`; Chrome PNA preflight) — 15/15 file tests green; deferred ("leave it for now"). Non-essential for the public→public ngrok demo path, still needed for direct hosted-page → localhost streaming.
- **Objective:** Stream an executing cook run into Petrinaut's read-only "actual/live" tab over a single SSE connection. The **cook process hosts its own ephemeral HTTP/SSE server** on a free port; it dies with the run and persists nothing. One stream, **replay-on-connect**: `definition` (once) → `initial_state` (once) → every firing-so-far → then live `transition_firing` events → terminal. Payload is the `BrunchExecutionExport` contract — see locked schema below. Brunch mints the session id (**reuse `runId`**) and hands Petrinaut a URL (`{PETRINAUT_URL} + runId + sse`; FE-819 Card D dropped `mode`); **no discovery/list endpoint** — Brunch initiates the session. Two trigger surfaces: (a) a **cook CLI flag** emits/auto-opens the "Open in Petrinaut" URL, and (b) a **brunch web-UI button** (must discover the live run's ephemeral endpoint — open detail).
- **Contract — `BrunchExecutionExport` (locked 2026-06-02):**
  ```ts
  type PlaceId = string;
  type TokenColour = Record<string, number>;
  // Per-place marking — either a count (uncoloured/identity-fold) or a list of
  // coloured token instances (colour-fold). Matches Petrinaut's runtime
  // InitialMarking = number | Record<string, number>[] in @hashintel/petrinaut-core.
  type Marking = Record<PlaceId, number | TokenColour[]>;

  type SdcpnInputArc  = { placeId: PlaceId; weight: number; type: 'standard' | 'inhibitor' };
  type SdcpnOutputArc = { placeId: PlaceId; weight: number };

  type SdcpnPlace = {
    id: PlaceId;
    name: string;
    colorId: string | null;
    dynamicsEnabled: boolean;
    differentialEquationId: string | null;
  };

  type SdcpnTransition = {
    id: string;
    name: string;
    inputArcs: SdcpnInputArc[];
    outputArcs: SdcpnOutputArc[];
    lambdaType: 'predicate' | 'stochastic';
    lambdaCode: string;
    transitionKernelCode: string;
  };

  // Tight subset of SdcpnFile — drops scenarios, differentialEquations,
  // parameters, metrics (Petrinaut's "actual" view doesn't read them).
  type NetDefinition = {
    version: number;
    meta: { generator: string; generatorVersion?: string };
    title: string;
    places: SdcpnPlace[];
    transitions: SdcpnTransition[];
    types: never[];
  };

  type TransitionFiring = {
    transitionId: string;
    input: Marking;
    output: Marking;
    ts: string; // preserved verbatim from PetrinautTransitionFiredEvent.ts
  };

  type BrunchExecutionExport = {
    definition: NetDefinition;
    initialState: Marking;
    transitionFirings: TransitionFiring[];
  };
  ```
- **Why now / unlocks:** Bristol demo. The static bundle was dropped for live streaming (simpler end-to-end; the file is just a full stream replay). FE-761/762/763 + the SDCPN transform have landed, so the net + firing data already exist in memory per run — this frontier adds only the transport + trigger.
- **Demo posture — fold mode selectable per run, identity is the default:** a new `--petrinaut-fold=color|identity` flag on `brunch cook` picks the projection. `identity` is the **default** (inverts FE-784's prior default; demo-pragmatic for Bristol and for any small-N plan where the unfolded per-slice lifecycle reads better); `color` opts back into FE-784's colour fold for larger plans. Mechanism: a sibling `createIdentityFolding(blueprint)` constructor next to `createNetFolding`, both returning the same `NetFolding` interface — `serializeBlueprint` and the event stream stay branch-free, the CLI picks the constructor at the entry point. Lexicon: extends FE-784's `color fold` / `folded net` with `identity fold`.
- **Cook CLI trigger surface (locked 2026-06-02):** four orthogonal knobs.
  - `--petrinaut-stream` — opt-in. Boots the ephemeral SSE server on a free port; presents the Petrinaut URL. Without it, cook continues to write the existing on-disk artifacts (`net.json`, `net.sdcpn.json`, `petrinaut-events.jsonl`) but doesn't host a live stream. Default: off.
  - `--petrinaut-fold=color|identity` — projection mode for **all** Petrinaut artifacts (on-disk + streamed). Default: `identity` (see prior bullet). Independent of `--petrinaut-stream`.
  - `--petrinaut-url=<url>` — full Petrinaut route URL (path included, e.g. `…/brunch`) for composing the "Open in Petrinaut" URL. Only meaningful with `--petrinaut-stream`. (FE-819 Card D renamed this from `--petrinaut-base-url`; the value is now the full route, not a bare base.)
  - `--no-petrinaut-open` — suppress auto-launching the browser; the URL still prints. Implicit when `process.env.CI` is set. Only meaningful with `--petrinaut-stream`.
- **Petrinaut-URL resolution (multi-tier, no fallback default):** CLI `--petrinaut-url` > env `PETRINAUT_URL` (read via brunch's env loader, now **shell-wins** so an inline prefix beats `.env`; `.env` is the practical home) > **hard fail** with `Petrinaut URL required: set PETRINAUT_URL in .env or pass --petrinaut-url=<url>`. No baked-in `http://localhost:3001` fallback — a wrong default silently opens the wrong tab. `.env.example` carries the single line. (FE-819 Card D renamed `--petrinaut-base-url`/`PETRINAUT_BASE_URL` → `--petrinaut-url`/`PETRINAUT_URL` and fixed the env-loader precedence.)
- **Acceptance:** (1) `brunch cook --petrinaut-stream` boots an ephemeral SSE server on a free port; composes the Petrinaut URL = `{PETRINAUT_URL}?runId={runId}&sse={localEndpoint}` (param scheme settled by FE-819 Card D — `sse` + optional `runId`; `mode` dropped; any path/query on `PETRINAUT_URL` preserved) and prints it; auto-opens via `open`/`xdg-open` unless `--no-petrinaut-open` or `CI=true`. (2) A client connecting at any time receives `definition` → `initial_state` → all firings-so-far → live firings → terminal, over one SSE connection. (3) Payload validates against the `BrunchExecutionExport` contract. (4) `--petrinaut-fold=identity` (default) emits the unfolded per-slice net; `--petrinaut-fold=color` reuses `createNetFolding`; both modes flow through the same SSE seam and the same on-disk artifacts. (5) Missing base URL hard-fails before the cook run starts (not mid-run). (6) Killing the cook process ends the stream cleanly; nothing is persisted. (7) Concurrent cook runs on different folders pick distinct free ports without collision. (8) A brunch web-UI button can open the same URL for a live run. (9) Read-only / one-way — no write-back.
- **Scope limits (v1):** Petrinaut's importer + "actual" view are the Petrinaut team's (separate repo). Out: write-back/editing, persistent runs DB / session store, auth, non-localhost transport, colours, discovery endpoint. Graph editing during a live ("actual") run explicitly rejected.
- **Verification:** reducer/export unit tests (SDCPN-minus-scenario + count-reduced markings) with an **arc-scoped delta oracle** (A99 reversal 2026-06-09: firings carry only the transition's consume/produce delta; the oracle asserts each firing equals its event delta, untouched pools/budgets appear in NO firing, and replaying deltas onto `initialState` is non-negative + token-conserving); SSE replay-on-connect integration test (late joiner gets the full timeline); ephemeral-port + process-death lifecycle test; cross-team validation of a real export with the Petrinaut team.
- **Open / pending coordination:** ~~exact URL param names + `mode` value~~ **settled** (FE-819 Card D: `sse` + optional `runId`, `mode` dropped — matches the shipped Petrinaut consumer); how the web-UI button discovers the ephemeral endpoint (e.g. cook advertises `{ sessionId, url, port }` to a known location the SPA reads); whether to emit a `net_completed` terminal (today only `net_halted` / `net_deadlocked`); `meta.generatorVersion` semantics (export-schema vs tool version).
- **Artifacts:** contract `src/orchestrator/src/petrinaut-stream-contract.ts` + `docs/petrinaut-stream-contract.md`; validated sample export from run `904d205d`.
- **Traceability:** §Lexicon `folded net` (export reuse; demo deviates via identity fold); I122-K (tokens are pointers → per-place counts suffice for marking deltas); execution-authority posture (Petrinaut renders; brunch's interpreter runs the net).

### petrinaut-integration-improvements

- **Name:** Orchestrator <> Petrinaut integration improvements
- **Linear:** FE-819 (no parent) · branch `ka/fe-819-orchestrator-petrinaut-integration-improvements` (stacked on FE-815) · PR #176
- **Status:** active — Cards A–D landed (Card A full markings **reversed 2026-06-09 to arc-scoped deltas per A99**, terminal-status fidelity, synthetic run-status places, `--petrinaut-url` rename + launcher URL shape + shell-wins env precedence). Cook CLI help documents all Petrinaut flags + `PETRINAUT_URL`/`PORT` env, with a flag-completeness test guard. Queue in `memory/CARDS.md` complete.
- **Objective:** Field-test-driven hardening of the FE-764 stream seam after the 2026-06-05 cross-team sync and the halted-run field test (`unique` retry exhaustion). Four scoped slices: (A) `TransitionFiring` frames carry **full markings** instead of deltas — contract-semantics fix (see SPEC A99: Petrinaut's frame reader treats `output` as the whole marking; the Petrinaut team's fixture emits full markings; Brunch's deltas render as sparse "one token at a time" frames). **Reversed 2026-06-09 (A99 resolved): the Petrinaut team confirmed firings must be arc-scoped deltas, so Brunch reverted to delta firings (FE-764's original shape) — `output` carries the new tokens to add, and Petrinaut folds each delta onto `initialState`.** (B) terminal-status fidelity — forward `haltReason` onto the wire (`terminal` data payload `{state, reason?}`), prepend a leading `status` frame per connection (the Petrinaut team's "completion event at beginning of stream"; additive — current consumer ignores unknown SSE events), re-emit definition with status-suffixed title at terminal; (C) synthetic `run:completed`/`run:halted` status places + final synthetic firing so halts are structurally visible in today's Petrinaut; (D) rename `--petrinaut-base-url` → `--petrinaut-url` / `PETRINAUT_URL` + launcher-URL shape `{PETRINAUT_URL}?sse=<bound stream URL>&runId=<runId>` (param scheme settled by the shipped Petrinaut consumer — `sse` + optional `runId`, `mode` dropped; URL path like `/brunch` preserved) + shell-wins env precedence fix in `loadLocalEnvFile` (field bug: `.env` clobbered the inline `…/brunch` value, launcher printed `/?runId=…`).
- **Deferred (deliberately not queued):** export/replay subcommand (`brunch petrinaut replay` / export flag) — JSON format now inherits the resolved A99 decision (arc-scoped deltas + a full `initialState`); the Petrinaut team is adding a Petrinaut-side export button in parallel. Single-slice fixture — FE-815 territory. `--petrinaut-linger` rejected at the sync in favor of export/replay.
- **Contract amendments (supersede parts of FE-764's locked notes):** marking semantics — **landed (Card A), then reversed 2026-06-09 (A99 resolved)**: Card A briefly folded engine deltas onto a running cumulative marking so every firing carried the full pre-/post-firing marking, but the Petrinaut team confirmed firings must be **arc-scoped deltas**, so `eventToTransitionFiring` now emits only the consume/produce delta (`reduceMarking(event.input)` / `reduceMarking(event.output)`) — FE-764's original shape; `initialState` is the single full marking and the consumer folds deltas onto it. The cumulative-fold apparatus (`applyMarkingDelta`, marking threading) was deleted; the oracle is again an arc-scoped delta oracle (each firing equals its event delta, untouched places appear in no firing, delta replay is non-negative + token-conserving). Terminal-status fidelity — **landed (Card B)**: the wire sequence now leads every connection with a `status` frame (`running` mid-run; terminal `state` + `reason` for late joiners), the `terminal` frame carries `{state, reason?}` (state from the terminal event kind; reason plumbed through `NetEvent`/`PetrinautTerminalEvent` from the halt token), and a halt re-emits a single title-suffixed definition (`— halted: <reason>`). `status` is additive (unknown SSE events ignored by the current consumer) and terminal still closes the stream. Synthetic run-status places — **landed (Card C)**: every projected definition is augmented with `run:completed`/`run:halted` places plus a `run:finish` transition (`augmentDefinitionWithRunStatus`), and run end fires one synthetic `transition_firing` (`synthesizeRunStatusFiring`) depositing a token into the outcome's status place (deadlocked + halted → `run:halted`, completed → `run:completed`) — as an arc-scoped delta (consumes nothing, produces one status token) after the A99 reversal, so static export and the live bus stay in parity; presentation-only, the engine/contract schema/real net are untouched. Launcher flag + URL shape — **landed (Card D)**: `--petrinaut-base-url`/`PETRINAUT_BASE_URL` renamed to `--petrinaut-url`/`PETRINAUT_URL` (no alias; value is the full route incl. path), `composeLauncherUrl` drops `mode` and emits only `runId` + `sse` (preserving any path/query on the resolved URL), and the `.env` loader now uses shell-wins precedence so an inline `PETRINAUT_URL=…` prefix beats `.env`. Locked error message, `--help`/env docs, and `.env.example` updated to the new names.
- **Open / pending coordination:** A99 **resolved 2026-06-09** (Petrinaut team confirmed arc-scoped deltas; Brunch reverted) — remaining: re-verify on staging that delta rendering doesn't regress the 2026-06-05 "pools/budgets empty mid-run" symptom (confirm Petrinaut folds deltas onto `initialState`); Petrinaut-side `status`-event listener + "halted" UI state; timeline legend fix.
- **Current execution pointer:** all four cards (A marking semantics — full markings, **reversed 2026-06-09 to arc-scoped deltas per A99**; B terminal-status fidelity, C synthetic run-status places, D `--petrinaut-url` rename + launcher URL shape) **done**; `memory/CARDS.md` queue retired. Post-queue hardening from `ln-review` (all five findings closed): stream `Marking` narrowed to count-only (D162-K / I127-K, removed the dead `TokenColour[]` arm); wire-vocabulary dedup (canonical `TerminalEventKind` reused across export/bus; one `statePayload` helper in the stream server); env-loader dedup (single `loadLocalEnvFile` in `src/orchestrator/src/local-env.ts`, consumed by both the cook CLI and `src/server/runtime-config.ts` via re-export); and SPEC §Lexicon gained the FE-819 stream-wire terms (run state, export/status/terminal frame, run-status place, synthetic `run:finish`, Petrinaut URL, launcher URL). Remaining work is outer-loop manual Petrinaut verification on staging (now also confirming the A99 delta reversal doesn't regress pool/budget rendering) + the deferred export/replay subcommand (A99 resolved 2026-06-09). **Card E — semantic-lane-suppression projection — done** (`--petrinaut-lanes=both|mechanical`, default `both`): new `petrinaut-lane-projection.ts` seam (`projectBlueprintLanes` static net + `projectMarking`/`projectFiring` per-frame restriction, gated on mechanical mode), wired through engine (projects the blueprint before fold/serialize; execution keeps the full blueprint), the stream bus, and the static reducer; `--petrinaut-lanes` flag + help/types threaded. Design (`ln-design` 2026-06-08, B-core + A-static + C-tests synthesis) dissolved the rework-loop blocker — restriction conserves because the real engine already consumes `done-spec`. View-only invariant recorded in SPEC §Lexicon `lane projection`. Outer-loop staging Petrinaut verification (smaller graph; slices still complete) pending. Queue retired.

### spec-to-cook-plan

- **Name:** Spec → orchestrator plan emitter — project + plan a `brunch cook` plan.yaml from a completed intent graph
- **Linear:** FE-800 (standalone; not parented under FE-760)
- **Kind:** structural
- **Status:** done — branch-complete off FE-764, PR #167 pending re-description. Six slices landed: 1 (deterministic projection), 2 (LLM planning pass), 3 (deterministic reconciliation — id existence, self-loops, cycle break via Kahn lex-tie-break, non-buildable slice + dep dropping, epic grouping with default-epic fallback, synthesized unit-test verification targets, all transformations surfaced as typed `ReconciliationWarning[]`), 4 (CLI wiring composing the three stages, writes `.brunch/cook/plan.yaml`, surfaces warnings on stderr; emitter falls back to empty enrichment when the LLM throws so a usable orderless plan still emits), 5 (warning-model hardening — single `EmitterWarning` audit stream, synthesis demoted to verbose-only, formatter co-located), 6 (read from spec id — `brunch plan <specId> [--out=<dir>] [--verbose]`, server-side snapshot builder `buildCompletedSpecSnapshot(db, specId)` over `getEntitiesForSpecificationOnActivePath` mapping accepted requirements/criteria + active-path relationships filtered to accepted ids, plan driver moved to `src/server/plan-runner.ts`, orchestrator `plan-cli.ts` deleted). Two proving spikes done 2026-06-03 (see memory `spec-to-cook-plan-spike`); branch stacks on FE-764. Bristol-demo end-to-end path (`brunch plan <specId>` → `brunch cook --petrinaut-stream`) is now operational
- **Objective:** Emit a `brunch cook` plan.yaml from a completed brunch specification's intent graph. Three-stage emitter: **projection** (deterministic) — `requirement` items → slices, `criterion --verifies--> requirement` edges → per-slice verification linkage, stable slice ids; **planning pass** (LLM) — infer the execution-order `depends_on` DAG + epic grouping + non-buildable-constraint detection, since execution order is not spec truth and reads as zero from the graph; **reconciliation** (deterministic) — validate the LLM output for cook (drop/redirect deps onto non-buildable constraints, guarantee acyclicity, synthesize conventional verification targets, flag contradictions). Output is a reviewable artifact, not a silent input.
- **Why now / unlocks:** The missing front-half of the Bristol end-to-end demo (SPEC → generated plan → cook → Petri → Petrinaut). TRACK F execution + Petrinaut visualization are done/active (FE-760 umbrella, FE-764 streaming) and `cook-codebase-mode` runs brownfield, but every cook run still starts from a hand-authored plan.yaml. This is the smallest bridge from "fixture-driven orchestrator" to "brunch spec drives the orchestrator."
- **Spike findings (2026-06-03, against real completed spec 2 "brunch_graphs"):** (1) projection works today; verification linkage fully covered (every requirement has ≥1 verifying criterion). (2) graph-read dependency synthesis yields **zero** — requirements are only sinks of epistemic `depends_on`; **not fixable by FE-700** (it types relations, it doesn't make the observer emit execution order). (3) one `generateObject` call (claude-sonnet-4, ~900/640 tokens) produced a credible acyclic DAG + free non-buildable detection, but dangled deps onto constraints → requires the reconciliation stage. Not blocked by FE-700/FE-701/FE-705; spec 2 is a usable demo input that exists now.
- **Acceptance:** (1) `brunch` emits `<dir>/.brunch/cook/plan.yaml` from a completed specification (all phases confirmed). (2) Projection is deterministic: requirements → slices, verifies edges → verification linkage, stable slice ids. (3) Planning pass produces an acyclic `depends_on` DAG and flags non-buildable constraint-style requirements. (4) Reconciliation guarantees no dangling/cyclic deps and emits cook-valid schema (epics/slices/depends_on/verification). (5) The generated plan round-trips through `loadPlan` and drives a `brunch cook <repo> --petrinaut-stream` run end-to-end against a brownfield fixture. (6) Demo mode: ordering can be authored/overridden deterministically (reviewable) instead of LLM-generated, for a controlled Bristol run.
- **Open / pending decisions:** ordering LLM-by-default vs authored-by-default for the demo; whether the emitter lives server-side (capability contract) or in the orchestrator package; brownfield verification-target convention (criterion prose → runnable test path is synthesized, agent authors the test).
- **Follow-on — integration-blind verification (2026-06-04):** the first brownfield cook of `spatial_graph_layout` produced *orphan* feature modules (+ a Ladle story) that satisfied criteria like AC1 ("toggling the layout switch swaps between list and canvas") **without the feature existing in the running app**. Root cause sits in this emitter: the convention-synthesized `verification.target` is integration-blind, so the agent authored a test that passes in isolation. Productizing brownfield cook ("a cooked feature is real and visible in brunch") needs (a) the emitter to emit *integration-shaped* slices + verification that demands host-wiring — an **integration oracle** (product reachability, enforced in the FE-738 semantic lane; distinct from `petri-simulation-oracle`'s *net* reachability), and (b) run-output **promotion** into the checkout (see the cook-codebase-mode promotion follow-on). Not on the demo critical path — the Bristol path shows execution/visualization, which orphan-but-executed does not break. Revisit when brownfield cook moves from "executes a plan" to "ships a feature."
- **Relationship to `petri-graph-compilation` (Phase 3):** these are NOT independent. This frontier projects graph → `plan.yaml` then reuses the working `net-compiler.ts` (plan.yaml → net); Phase 3 wanted to compile graph → net directly from `plan.depends_on` relation edges. The spikes showed those execution-order edges don't exist and FE-700 won't supply them, so Phase 3's ordering input must itself be synthesized — i.e. FE-800 is the grounded source of what Phase 3 assumed it could read. FE-800 partially **subsumes** Phase 3; Phase 3's residual value is the simulation oracle (Phase 4), not the compile path. Keep the two reconciled.
- **Verification:** projection golden tests (spec fixture → plan.yaml); planning-pass acyclicity/contract tests (mock + opt-in real-provider); reconciliation tests (dangling-dep redirect, cycle break, non-buildable handling); end-to-end integration feeding a generated plan into the existing brownfield-smoke harness.
- **Traceability:** Requirements 46–50; D155-K–D160-K (new D160-K); A97 (validated); resolves SPEC §Constraints non-goal tension via D160-K. Spike memory: `spec-to-cook-plan-spike`.
- **Design docs:** `docs/design/orchestrator.md`; `docs/next/architecture/plan-graph-petri-orchestration.md`; umbrella H-6476.

### plan-build-architect

- **Name:** Build-architect for spec-derived cook plans — `brunch plan` emits fixture-quality, cook-executable plan.yaml
- **Linear:** FE-829 (standalone) · branch `ka/fe-829-build-architect` (stacked on FE-827) · draft PR #185
- **Kind:** structural
- **Status:** active — **slices 1–5 done** (slice 1: executability contract + repair + `Toolchain` descriptor; slice 2: toolchain-agnostic cook prompts + runner; slice 3: build-architect prompt enrichment — `projectPlanningContext` + criteria + fixture exemplars; slice 4A: file-ownership contract — `Slice.writes` + `file-write-conflict` design-class warning + D160-K amendment (I132-K); slice 4B: **the architect now AUTHORS the slice set** — `architectPlan` (new schema: authored slices with `writes` + `derivedFrom`) → `materializeArchitectedPlan` (deterministic normalize: unknown-ref filtering, dep-clean, cycle-break, epic resolution, criteria-into-prose, coverage sidecar) → `repairPlan` + `checkPlan` (emitted + generalized requirement-provenance coverage), with a deterministic projection fallback on authoring throw / parse-fail / uncovered requirement (I133-K); slice 5: **eval harness** — `evaluatePlanShape` (`plan-eval.ts`), a deterministic outer-loop acceptance oracle with a narrow `verdict` gate (emitted-contract errors / file-write-conflict / missing-writes → reject) + a graded structural-feature metric vector scored against the abstract fixture-design principles (no id/path/count overfit); the 3 reference fixtures are its self-test and were refreshed to score `overall === 1` (added `writes` to every slice + the previously-missing integration seam to `layered-todo.core` and `resilient-pipeline.pipeline`) (I134-K); all 2026-06-09). **Slice 4 was split** (oracle 2026-06-09): 4A = deterministic contract half, 4B = LLM authoring. The slice-3 `planExecutionOrdering` enrichment stage is **superseded on the mainline** (I131-K superseded by I133-K) and dormant pending retirement. **Next: retire `planExecutionOrdering` (dormant since 4B); optional opt-in real-LLM eval smoke feeding `evaluatePlanShape`.** SPEC records A100-K (partially-validated), D160-K (amended), D167-K, I129-K, I130-K, I131-K (superseded), I132-K, I133-K, I134-K, Future Direction §Cook plan generation.
- **Objective:** Evolve the `brunch plan` emitter from a sequencer (FE-800) into a build-architect that emits plans matching the hand-authored reference fixtures (`parallel-utils`/`layered-todo`/`resilient-pipeline`) — file-disjoint per-behaviour slices, scaffold slice, join slice owning shared files, epic integration seam — and that provably satisfy a cook-executability contract. Fixtures are read-only references (target shape + few-shot exemplars), never generated into.
- **Why now / unlocks:** FE-800 made `brunch plan` produce a *faithful but un-buildable* projection of the spec's requirement graph — plausible-looking deps that are conceptual references, not build order; no decomposition, no join, no epic seam, so multi-slice epics produce "green checks, no assembled artifact" (the FE-800 integration-blind follow-on). This frontier closes the gap from "emits a plan" to "emits a plan that cooks into a real artifact."
- **Slices:** (1) **executability contract + deterministic repair** — self-contained `PlanContract.check` (acyclic deps over existing ids; ≥1 verification target/slice; slice∈epic; requirement coverage; multi-slice epic carries an `integration-test` seam) + repair loop that auto-fixes the mechanical class (cycle-break, mint target, synthesize epic seam) and surfaces the design class as typed warnings; introduces the shared **`ProjectProfile`/`Toolchain`** descriptor so verification targets are *derived* (no hardcoded `tests/<id>.test.ts`); no LLM, no D160-K change (D167-K / I129-K). (2) **toolchain-agnostic cook prompts + runner** — de-hardcode the `test-writer` prompt and the `test-runner` (`bun test`) to read the same `ProjectProfile`: behaviour described generically, stack supplied by the descriptor (Bun = first profile). This is the PLAN-named, previously-unowned bun→host adapter, coordinated with `cook-harness-fidelity` (FE-813), which already de-hardcoded `code-writer`. (3) **build-architect LLM stage** — feed requirement criteria + relation edges into a schema-constrained call with the reference fixtures inlined as few-shot exemplars; replaces the thin sequencer. (4) **file-ownership / join synthesis** — emit-time file paths + join slices; requires the **D160-K amendment** (coordination file-layout namespace, no host introspection, no test content — cook agent authors tests per A98) + a `Slice.writes` schema field for file-disjointness. (5) **eval harness** — score generated plans on contract-conformance + structural similarity to the reference fixtures.
- **Acceptance (slice 1):** `PlanContract.check` is total/pure; the three reference fixtures pass unmodified; known-bad plans (cycle, unverified slice, uncomposed multi-slice epic) are flagged or auto-repaired; every emitted plan is contract-accepted; every repair surfaces a typed warning; `check(repair(plan))` is accepted.
- **Acceptance (slice 2 — done):** the cook runner runs the toolchain's `testCommand` (not a hardcoded `bun test`); the `test-writer`/epic-verify tasks inject the toolchain's `testConventions` (bun → `bun:test`, brunch → vitest); `test-writer.md` names no framework; `brunch cook` resolves the toolchain from `plan.profile`; full orchestrator suite green (I130-K).
- **Verification:** unit — `plan-contract.test.ts` (per-invariant + idempotence) and `plan-emitter.test.ts` (emitted plans accepted, warnings surfaced); middle — `brunch plan <specId>` against a completed spec asserts contract-acceptance + multi-slice-epic integration seams. Later slices (LLM stage, eval) route through `ln-oracles`.
- **Traceability:** Requirements 46–50; A97, A100-K; D158-K, D160-K (amended in slice 3), D161-K, D167-K; I129-K, I130-K; Future Direction §Cook plan generation. Refinement on `spec-to-cook-plan` (FE-800) — resolves its integration-blind follow-on. Builds on FE-826, FE-827.
- **Design docs:** `docs/design/orchestrator.md`; `docs/design/orchestrator-demo-fixtures.md` (reference fixtures); `docs/next/architecture/plan-graph-petri-orchestration.md`.

### toolchain-profile-expansion

- **Name:** Toolchain profile expansion — more TS runtimes + live/strict profile selection
- **Linear:** FE-843 · branch `ka/fe-843-toolchain-profiles` (stacked on FE-841)
- **Kind:** structural (selection decision + I130-K refinement); cards 1/3 bounded
- **Status:** branch-complete (2026-06-10) — all 3 cards landed (1: data-driven registry + 4 TS profiles; 2: selection live + strict; 3: architect classifies profile from spec prose); card queue retired. SPEC promotion (I130-K refinement + agent-install assumption) rides with ln-sync at PR tie-off. Outer-loop validation outstanding: greenfield cook smoke `--profile=node-vitest` (conventions-prose oracle + A98 install assumption).
- **Objective:** Expand the FE-829 `Toolchain` contract (`project-profile.ts`) so cook builds on more technologies: profiles as data literals compiled into the existing `Toolchain` interface (consumers untouched); profile resolved once at plan time (`--profile` flag ≫ `snapshot.profile` ≫ architect-classified ≫ `bun`), persisted into `plan.yaml`; cook errors on unknown ids (lenient on absent, mirroring the `checkPlan` base/emitted split). The architect's existing schema-constrained call gains an optional profile enum — classification reads projected spec prose only (D160-K intact, no host introspection).
- **Why now / unlocks:** Today both implemented profiles are TypeScript and the selection path is dead (`snapshot.profile` never populated) — every cook run silently resolves to bun, and a typo'd profile id silently defaults rather than erroring. Without live selection, adding profiles changes nothing at runtime; without more profiles, "brunch builds on different technologies" is false in practice.
- **Design (ln-design 2026-06-10):** flat data registry (A) over composed axes (B — deferred until real combo demand; retreat is cheap since the consumer surface never changes); no harness install verb — the cook agent scaffolds + installs per A98 (pressure trigger: first profile where the runner fails for missing install). Deferred follow-ons: fail/infra test-outcome split in `ToolchainTestRunner`, brownfield drift-check at cook open (path-neutral by type), `brunch detect` CLI convenience. Durable end-state for selection: the spec interview captures stack as a structured field (the D164-K `mode` pattern); the chain already reserves that rung.
- **Acceptance:** per cards in `memory/CARDS.md`.
- **Verification:** inner — `project-profile.test.ts` (registry invariants + command shapes), `plan-runner.test.ts` (flag), `plan-emitter.test.ts` (stamping + chain precedence + fallback), `cook-cli.test.ts` (strict/lenient); middle — contract/eval suites unchanged; outer (follow-on, non-gating) — greenfield cook smoke `--profile=node-vitest` as the conventions-prose oracle.
- **Traceability:** Requirements 46–50; A98, D160-K, D164-K (pattern), D167-K; refines I130-K (resolved profile persisted; strict-on-unknown). New assumption on build: agent-side install suffices for node profiles. Refinement on `plan-build-architect` (FE-829).
- **Design docs:** `docs/design/orchestrator.md`; SPEC §Future Direction Cook plan generation.

### agent-extension-host

- **Name:** Agent extension host — dual-mode (`elicit`/`execute`) pi-harness contract
- **Linear:** FE-867 · branch `ka/fe-867-agent-extension-host` (under FE-864) · coordinated with the unpublished pi-harness thread
- **Kind:** structural (shared contract / serialization point)
- **Status:** in-progress (2026-06-15) — slice 1 landed (PR #213): contract-first, zero-runtime-migration. `src/agent-extension-host.ts` defines the mode-neutral core contract (mode / capability / plugin / consumer-witness, metadata-only, no imports, no `execute`-only concept); `src/agent-extension-host.test.ts` proves it against both real consumers — cook (`createPiActions()` action ids) and the interview (`createExplorationTools` + a type-enforced coverage check over `keyof InterviewerTools`) — as the `elicit` witness, without migrating the interview runtime (it keeps the Vercel AI SDK). The contract both this work and the unpublished pi-harness thread target; the pi thread owns the core *runtime* implementation. Deferred to later slices (only when a real driver lands): a runtime host/dispatch, a pi adapter for cook, growing `src/agent-extension-host/` as a private sub-tree.
- **Objective:** Categorize the pi harness as a **dual-mode agent-extension host**: a mode-agnostic **core** (session lifecycle [FE-841 in-process pi], dispatch interface, tool-scoping [FE-813 `toolsForAction`], confinement [FE-853], cwd/env/model policy) + two **modes** — `elicit` (drives specification: interviewer, observer, LLM-as-user probe [FE-705]) and `execute` (drives cook: test-writer, code-writer, evaluate-done, verify-epic, + new wiring / recovery-question / replan agents) — + **shared plugins** (context provision, tool adapters, dispatch-recipe format, model policy). Modes differ only by which plugins they load; capabilities register against the core via a stable plugin/dispatch contract. New cook capabilities are `execute`-mode plugins, never bespoke `pi` calls.
- **Why now / unlocks:** The pi harness is reused across spec elicitation and cook execution; without a shared host the modes duplicate dispatch/confinement/tool-scoping and the cook frontiers hardcode `pi`. This is the serialization point with the unpublished pi-harness thread — targeting the contract, not `pi`, keeps the dispatch-seam frontiers decoupled from that thread's rewrite.
- **Abstracted-enough bar (acceptance):** (1) **mode-neutral core** — the core module carries no `execute`-only concept (no worktree/slice/test-runner/`plan.yaml` types); checkable assertion. (2) **two-consumer proof** — the core is validated against ≥2 real consumers: cook (`execute`) and the **existing interview** as the `elicit` witness; if the interview can't sit on the core, it isn't neutral. (3) **open plugin seam** — capabilities register per mode; `elicit`-mode plugins are explicitly out of scope here and their absence does not break the core. (4) **no gold-plating** — the core is no richer than those two consumers justify; primitives serving neither are dropped (no speculative `elicit` features).
- **Out of scope:** the `elicit`-mode plugin implementations (interview internals, FE-705, the unpublished pi-thread work). This frontier owns the core + contract, validated against the interview as a witness — not the `elicit` roadmap.
- **Verification:** mode-neutrality test (core imports no `execute`-only modules); two-consumer compile/dispatch tests (a cook plugin + an existing-interview plugin both run on the core); plugin-registration contract tests; a "no orphan primitive" review gate.
- **Depends on:** FE-841 (in-process pi core), FE-813 (tool-scoping), FE-853 (confinement); coordinated with the unpublished pi-harness thread (owns the core). Sits over the FE-841 core and **bases the Arc-1 linear stack** (2026-06-15 decision) — the whole cook stack lands on it. Logically gates `integration-oracle`, `interactive-recovery`, `adaptive-replan`; the base placement extends that to a stack-order serialization of all of Arc 1 behind the pi-harness-thread coordination.
- **Traceability:** Requirements 46–50; abstract-dispatch-interface coordination note; orchestrator/harness lexicon.
- **Design docs:** `docs/design/orchestrator.md`; `docs/design/AGENT_MUTATION_SURFACE.md`; `docs/design/SUBSTRATE_STRANGLER_COORDINATION.md`.

### brunch-detect

- **Name:** Brunch toolchain detection — read the project toolchain from the repo
- **Linear:** FE-871 · branch `ka/fe-871-brunch-detect` (stacked on FE-867)
- **Kind:** bounded feature
- **Status:** done (FE-871). Slice 1 — `detectProfile(repoDir)` / `project-detect.ts`: a pure, evidence-first detector mapping manifests/lockfiles to a registry `ProfileId` (bun lockfile → bun; deno config → deno; `package.json` vitest/jest/none → node-vitest/node-jest/node-test). One clear supported signal resolves; ambiguous evidence (both vitest **and** jest declared) and any repo with no JS/TS evidence return a loud `{detected:false, reason}` via one catch-all rather than silently defaulting to bun — the cheap "which lockfile is present" check, not a language-detection engine (no per-stack Python/Go branches; the catch-all message is already actionable). Slice 2 — `detected` is wired into the `plan-emitter` selection chain as the brownfield front (`flag ≫ detected (brownfield) ≫ spec ≫ architect-classified ≫ bun`) via `resolveEmittedProfile`; a loud detection failure throws rather than silently falling to bun (falling through to an explicit spec/architect choice first). Greenfield (or brownfield without a `repoDir`) keeps the unchanged FE-843 chain — the greenfield no-op. `repoDir` threads CLI launch cwd → `runPlan` → `emitPlanFromSnapshot`; an injectable `detect` seam keeps the emitter tests hermetic. Slice 3 — `detectTestDir(repoDir)` co-locates generated tests where the brownfield repo already keeps its own: detection picks the *runner* (profile), this picks the *path*. A profile's default test directory (`tests/{id}.test.ts`) can fall outside a host repo whose vitest `include` is narrowed (e.g. `src/**`), so the chosen path is unrunnable — vitest reports "No test files found" for an explicitly-named file (observed in a real brownfield cook). Rather than parse the runner's executable-TS config, it samples existing `*.test.*`/`*.spec.*` files (zero-dep bounded `fs` walk, skipping `node_modules`/build dirs) and returns the dominant directory; `withTestDir(toolchain, dir)` relocates the targets while preserving the filename convention. Brownfield-only; `null` (no existing tests) keeps the profile default; greenfield never relocates. Slice 4 — monorepo hardening: `detectTestDir` returns the dominant *full* directory (not just the top segment) so a package-rooted include glob still covers the path; `detectProfile` widens runner detection to declared workspace packages (npm/yarn `workspaces`, pnpm `pnpm-workspace.yaml`; literal + single-level `dir/*` globs) **only when the root declares no runner**, scoped to declared workspaces so a stray nested project (docs prototype, example app) can't poison detection — a root runner still wins without scanning, and workspaces collectively declaring both vitest+jest stays loudly ambiguous. Stacked on `agent-extension-host`.
- **Objective:** Resolve a registry `ProfileId` at **plan time** from the repo's manifest/lockfile evidence — the cheap "which lockfile/manifest is present" check, mapping only to ids already in the FE-843 registry. It is **not** a language-detection engine: anything without a single clear supported signal (ambiguous JS runners, or non-JS stacks like Python/Go) returns a loud `{detected:false}` reason via one actionable catch-all, never a guessed profile. Brownfield-only front of the selection chain (`flag ≫ detected ≫ spec ≫ architect ≫ bun`); the resolved id is stamped into `plan.yaml` so `brunch cook` runs the same toolchain. Greenfield never detects (empty worktree). Resolves toolchain **identity** only — real file paths / existing wiring / `writes` reconciliation is cook-time agent grounding, out of scope here.
- **Why now / unlocks:** The "no manual steps" goal requires reading the real toolchain rather than inferring from spec prose or a `--profile` flag — and it must happen at plan time, because the deterministic test runner reads the stamped `plan.profile` with **no agent in the loop** (`cook-cli.ts`, `pi-actions.ts`), so a wrong default runs the wrong test command with no diagnostic. The cook agent's `read`/`bash` cannot substitute. FE-843 built the registry but deferred detection; this closes that gap.
- **Acceptance:** (1) detection maps a real repo to a registry profile id from manifest/lockfile evidence *(slice 1, done)*; (2) brownfield cook/plan resolves toolchain via detection at the front of the FE-843 chain (`--profile` still overrides) *(slice 2)*; (3) greenfield resolution is unchanged (no detection input); (4) ambiguous/unknown repo fails with an actionable message, not a silent default *(slice 1, done)*; (5) the 3 reference fixtures + greenfield smoke score identically before/after.
- **Verification:** detector unit tests *(slice 1, done — per-stack fixtures + loud `{detected:false}`)*; slice 2: resolution-chain precedence tests (detect vs flag vs spec) + greenfield no-op / before-after-identical test; slice 3: `detectTestDir` clustering/skip/null tests + `withTestDir` relocation tests + emitter tests asserting brownfield targets follow the detected dir while greenfield keeps the profile default; slice 4: full-dir/monorepo `detectTestDir` tests + workspace runner-detection tests (npm/yarn/pnpm, root-wins, literal dir, cross-workspace ambiguity).
- **Depends on:** `toolchain-profile-expansion` (FE-843).
- **Traceability:** Requirements 46–50; refines I130-K; greenfield-protecting invariant (new — record in SPEC via ln-sync). **D160-K boundary:** detection is plan-time profile-*id* resolution (an input to authoring), not architect host-introspection — D160-K constrains the architect/authoring stage, not profile resolution, so `brunch-detect` needs no D160-K amendment.
- **Design docs:** `docs/design/orchestrator.md`.

### harness-dep-install

- **Name:** Dependency-delta capture + install-failure classification
- **Linear:** FE-872 · branch `ka/fe-872-dep-install-classification` (stacked on FE-871)
- **Kind:** bounded feature
- **Status:** acceptance 1 done (FE-872) — classify + react. **Slice 1 (classify):** `TestResult` gains a `failureKind?: 'infra' | 'test'` discriminant (`types.ts`); `ToolchainTestRunner.run` classifies a failed run via `classifyTestFailure` (`test-runner.ts`) — **conservative**: only an unambiguous "the runner itself isn't there" signal (spawn `ENOENT`, or a shell `command not found` / `is not recognized`) is `infra`; everything else is `test`, because a missing *module* is ambiguous with a legitimate TDD red and mislabeling a real failure as infra would silently skip it. The `tests-run` net report surfaces an aggregate `failureKind` (infra dominates) so consumers don't rescan `results` (`net-compiler.ts`). **Slice 2 (react):** an exhausted run whose tests never executed now halts with a `toolchain/install failure` reason instead of the misdirecting `retry exhaustion` (`net-compiler.ts`). Deliberately **not** a bespoke re-install net arc — the loop already loops back and the agent re-installs natively via `bash` on its next turn; the harness only needs the honest terminal cause. **Slice 3 (greenfield dep capture):** the manifest + lockfile the agent produced are now pinned as a promotion invariant via `git ls-files` (`promote-run.test.ts`) — `promoteGreenfieldRun`'s blanket copy already lands them; this turns that incidental behavior into an asserted, reproducible-tree guarantee. **Remaining:** brownfield dep-delta capture over the CoW baseline is **blocked on `brownfield-promotion`** (no brownfield promote path exists yet). Reframed: the install *action* is agent-native (cook write-actions carry `bash`; FE-843 `testConventions` already inject per-profile install/scaffold prose per A98), so this is **not** an install verb — it owns only the two things the agent's bash install does not give for free.
- **Objective:** The cook agent already adds + installs deps via its `bash` tool, driven by FE-843's per-profile `testConventions` (A98) — no install verb or abstraction is introduced. This frontier closes the two not-free parts: (a) **dependency-delta capture** — the lockfile/manifest changes the agent produces are captured onto the promotion path (greenfield asserted, not incidental to `promote-run`'s blanket copy; brownfield captures the *delta* over the CoW-copied baseline, not the whole tree); (b) **install/infra-failure classification** — a failure-kind discriminant so a failed `npm install` is distinguishable from a test failure (the FE-843-deferred fail/infra split).
- **Why now / unlocks:** Today `TestResult` is a single `{passed}` boolean (`types.ts`) and `evaluateVerificationTargets` collapses any thrown/failed run to `passed:false` — so a failed install looks identical to a logic bug and sends the code-writer to "fix the code" while the toolchain never installed, burning cook-loop iterations. And without deliberate lockfile capture the promoted tree isn't reproducible. `app-runtime-probe` / `integration-oracle` depend on deps being **present and reproducible in the promoted tree** — i.e. on (a) — not on an install verb.
- **Acceptance:** (1) install/setup failure is a *distinct* outcome from test failure — the runner outcome type carries a failure-kind discriminant (`infra` vs `test`) and the cook loop / run report react accordingly; (2) lockfile / dependency-manifest changes the agent makes are captured on promotion — greenfield asserted (not incidental), brownfield as the delta over the CoW baseline; (3) install stays worktree-scoped, never the user's checkout (assert). *(The install action itself + greenfield scaffold-from-scratch are FE-843/A98 agent-native behavior, not acceptance criteria here.)*
- **Verification:** failure-classification unit tests on the runner outcome (install/infra vs test); lockfile / dep-delta capture tests on the promotion path (greenfield + brownfield-delta); worktree-scoped-install assertion test.
- **Depends on:** `brunch-detect` (profile), `cook-codebase-mode` (worktree). Upstream of `app-runtime-probe`, `integration-oracle`.
- **Traceability:** Requirements 46–50; A98 (cook agent scaffolds + installs — the agent-native install this frontier relies on, not re-builds); absorbs the FE-843-deferred fail/infra test-outcome split.
- **Design docs:** `docs/design/orchestrator.md`.

### app-runtime-probe

- **Name:** App runtime probe — build, boot, and exercise the host app
- **Linear:** FE-875 · branch `ka/fe-875-app-runtime-probe` (stacked on FE-872)
- **Kind:** structural
- **Status:** slice 1 landed (FE-875) — `runProbe(spec, sandboxDir)` / `app-probe.ts` + `ProbeSpec`/`ProbeResult`/`ProbeOutcomeKind` (`types.ts`): boots an app, polls readiness, probes one HTTP feature endpoint, classifies `reachable` (<400) / `not-reachable` (booted but endpoint absent/erroring — the orphan) / `infra` (never booted), and always tears the boot process down (SIGTERM→SIGKILL). The *app-execution* analogue of `test-runner.ts`, with the infra/feature split mirroring FE-872's infra/test. **Design decision:** the boot argv + URLs are `ProbeSpec` **inputs** (cook-time grounding supplies them later), not a per-stack boot engine — the harness owns only the deterministic, read-only *check*; boot mechanics may lean on agent `bash` (honors the boundary below). Tested against real seeded `node:http` apps (reachable / orphan-404 / boot-fail / missing-binary / teardown). **Remaining slices:** mode-awareness (#4 brownfield real host vs greenfield self-composed epic), integration-oracle gating (#3), and where the `ProbeSpec` comes from (architect wiring intent + cook grounding). Prior spike verdict (2026-06-16): boot over the wire is **feasible** (a `node:http` entry on `listen(0)` answered `http.get`), but boot carried per-stack friction (the agent hand-rolled a `.js→.ts` resolve hook); dep-carrying boot still unproven (spike app was zero-dep).
- **Objective:** Provide a harness that builds the host application, boots it, and exercises the cooked feature to confirm it is actually reachable in the running app — not merely unit-test-green. Mechanism beyond the test runner: app-boot + a runtime probe (dev-server boot + HTTP/CDP/Playwright-style check), toolchain-derived from the `ProjectProfile`. Mode-aware: brownfield boots the real host; greenfield boots the self-composed epic.
- **Agent-native action vs harness-owned verification:** the frontier's value is the **independent, deterministic assertion** the cook agent cannot shortcut or self-report — not the boot action (the agent already has `bash` and can start a dev server / curl it). FE-800's orphan problem is precisely that the agent's self-report can't be trusted, so what this frontier owns is a read-only probe result outside the agent's authorship (the same discipline that keeps `evaluate-done` read-only at `pi-actions.ts:70`). The **boot mechanics may lean on agent `bash`** (start dev server, hit an endpoint) rather than a bespoke per-stack boot engine; the deterministic, unshortcuttable *check* of the result is the part the harness must own.
- **Why now / unlocks:** `integration-oracle` asserts "feature reachable in the running app," but verification today only runs the test runner in the worktree. Without an app-boot probe, "reachable" degrades to "a test imports the module" and the orphan problem (FE-800) survives. This is the load-bearing reachability mechanism; `integration-oracle` depends on it. The hidden heavy lift inside Arc 1 — validate the mechanism with `dogfood-spike` before committing.
- **Acceptance:** (1) the probe builds + boots the host app from the worktree using the resolved toolchain; (2) it exercises the cooked feature and returns a structured reachable / not-reachable result; (3) the probe result is the evidence `integration-oracle` gates on; (4) brownfield boots the real host, greenfield boots the self-composed epic; (5) infra failure (build/boot broke) is distinguishable from feature-absent (not reachable).
- **Verification:** probe-harness integration test (seeded app + cooked feature → reachable); orphan-replay test (feature module present but unwired → not-reachable, replaying the `spatial_graph_layout` regression); toolchain-derived boot tests; infra-failure-vs-not-reachable split test.
- **Depends on:** `cook-codebase-mode` (done), `brunch-detect`, `harness-dep-install` (boot needs deps). Upstream of `integration-oracle`. Scoped after `dogfood-spike`.
- **Traceability:** Requirements 46–50; FE-800 integration-blind follow-on; complements FE-813 (real *test* execution) by adding real *app* execution.
- **Design docs:** `docs/design/orchestrator.md`; `docs/praxis/dev-server-logs.md`; `docs/praxis/manual-testing.md`.

### integration-oracle

- **Name:** Integration oracle — host wiring + product reachability
- **Linear:** unassigned (create on start)
- **Kind:** structural
- **Status:** not-started (drafted 2026-06-15) — Arc 1; promotes the FE-800 integration-blind follow-on to a frontier.
- **Objective:** Make a cooked feature real and reachable in the host, not orphaned. Three parts: (a) the architect emits a **generic integration/wiring slice** ("wire feature into host") rather than only FE-829's per-epic integration-*test* seam; (b) **cook-time grounding** — the cook agent resolves the real wiring by reading the worktree (no host introspection at plan time, D160-K intact); (c) an **integration oracle** in the FE-738 semantic lane asserts product reachability **via `app-runtime-probe`** (build + boot + exercise the host app — not merely test-runner-green) — brownfield: feature exists/reachable in the running app; greenfield: the epic self-composes (the `__epic__` merge + integration test). Reachability definition forks on `plan.mode`.
- **Why now / unlocks:** The first brownfield cook produced orphan modules that passed criteria without existing in the running app (FE-800 follow-on, 2026-06-04). Reachability is the external reality check that turns "executes a plan" into "ships a feature." Builds on harness fidelity (FE-813 — the harness actually runs the targets) and FE-829 integration seams. **`dogfood-spike` (2026-06-16) sharpened the framing:** given an `integration-test` target + reachability-demanding criterion prose, the cook agent *did* self-author a genuine boot-and-probe test and wired the feature reachable — the orphan did not reproduce. But nothing **forced** it; reachability was agent-discretion. So this frontier's job is precisely to make reachability **enforced and independent of agent-authored tests**, not to hope the agent stays honest.
- **Agent-native action vs harness-owned verification:** the wiring *action* (part b) is agent-native — the cook agent reads the worktree and edits the wiring itself; the frontier does **not** build a wiring engine. What it owns is part (c): an **oracle the agent cannot author or shortcut**, asserting product reachability via `app-runtime-probe`'s independent result. The orphan problem is unsolvable by self-report, so the oracle's value is its independence (same read-only discipline as `evaluate-done`, `pi-actions.ts:70`), not the doing.
- **Cook-time grounding decision (settled 2026-06-15):** planning stays host-blind; the cook agent grounds against the real repo. This **softens FE-829 slice-4A `writes` single-writer ownership to *advisory in brownfield only*** (agent reconciles paths against the real layout); greenfield keeps `writes` authoritative (parallel race-safety + eval gate depend on it). Needs a **D160-K amendment + a new grounding decision** recorded in SPEC via ln-sync.
- **Acceptance:** (1) architect emits a generic wiring slice for feature epics; (2) cook agent resolves real wiring by reading the worktree; (3) integration oracle gates completion on product reachability, mode-forked (brownfield reachable-in-app / greenfield self-compose); (4) the brownfield orphan-module regression (`spatial_graph_layout`) is caught; (5) greenfield behavior unchanged — 3 reference fixtures + greenfield smoke score identically; (6) `writes` advisory in brownfield, authoritative in greenfield (contract forks on `plan.mode`); (7) the wiring agent is an `execute`-mode plugin on `agent-extension-host`, not a bespoke `pi` call.
- **Verification:** brownfield smoke asserting reachability (feature present in running app), replaying the orphan regression; greenfield self-compose oracle tests; mode-fork contract tests on `writes`/`checkPlan`; semantic-lane oracle adapter tests.
- **Depends on:** `cook-harness-fidelity` (FE-813, done), `plan-build-architect` (FE-829), `brunch-detect`, `harness-dep-install`, `app-runtime-probe` (the reachability mechanism), `agent-extension-host` (wiring agent = `execute`-mode plugin). Upstream of `brownfield-promotion`.
- **Traceability:** Requirements 46–50; D160-K (amendment pending), D161-K, D167-K, A98; FE-800 integration-blind follow-on; greenfield-protecting invariant (new).
- **Design docs:** `docs/design/orchestrator.md`; `docs/next/architecture/plan-graph-petri-orchestration.md` (semantic lane).

### brownfield-promotion

- **Name:** Brownfield output promotion — glue the cook result into the checkout
- **Linear:** unassigned (create on start)
- **Kind:** structural
- **Status:** not-started (drafted 2026-06-15) — Arc 1; promotes the cook-codebase-mode promotion follow-on to a frontier.
- **Objective:** Commit/merge a completed brownfield cook run into the user's checkout. Today slice branches (`cook-slice/<runId>/<sliceId>`) commit but never merge: `cook/<runId>` HEAD === source HEAD with modifications in untracked subdirs, so there is no promotion path. Close it: commit slice work → merge slice→epic→`cook/<runId>` → merge `cook/<runId>` into the working branch (completed-gated, never silent), mirroring FE-827's greenfield `promote-run.ts`. Pairs with worktree/branch GC.
- **Why now / unlocks:** "Glue back to the original code" in the literal git sense. Greenfield promotion landed (FE-827, D166-K); brownfield is the open follow-on. Without it a brownfield cook runs but can't deliver.
- **Acceptance:** (1) completed brownfield run promotes into the working branch via `git merge` (never silent, completed-gated, `--out`/`--force` parity with greenfield); (2) source branch byte-identical until explicit promotion (cook-codebase-mode invariant preserved); (3) collisions reported, not silently overwritten; (4) greenfield promotion path unchanged.
- **Verification:** brownfield promotion integration test (seeded git repo → cook run → promote → assert merge into working branch); source-unchanged-until-promote test; collision-report test.
- **Depends on:** `cook-codebase-mode` (done), `cook-greenfield-single-tree` (FE-827, done), `integration-oracle`.
- **Traceability:** Requirement 49; D166-K (extend to brownfield), A49; cook-codebase-mode promotion follow-on.
- **Design docs:** `docs/design/orchestrator.md`; SPEC §A49.

### brunch-ship

- **Name:** Brunch ship — one-shot autonomous spec→feature wrapper
- **Linear:** unassigned (create on start)
- **Kind:** bounded feature
- **Status:** not-started (drafted 2026-06-15) — Arc 1 capstone.
- **Objective:** A single `brunch serve <specId>` command running prep → recipe → cook → taste → plate end-to-end with no manual steps, reading `plan.mode` (FE-826) to pick greenfield vs brownfield resolution. The plan stays a reviewable artifact but requires no manual authoring/approval in ship mode.
- **Why now / unlocks:** Closes the "no manual steps" goal by composing the Arc 1 frontiers into one autonomous flow.
- **Acceptance:** (1) `brunch serve <specId>` runs the full chain unattended; (2) mode-correct resolution via `plan.mode`; (3) failure surfaces a coherent halt (graceful — full recovery is Arc 2 `interactive-recovery`); (4) greenfield and brownfield both supported.
- **Verification:** end-to-end integration (greenfield fixture + brownfield seeded repo) asserting a promoted artifact; mode-routing tests; halt-surfacing test.
- **Depends on:** `brunch-detect`, `integration-oracle`, `brownfield-promotion`; `cook-mode-from-spec` (FE-826, done).
- **Traceability:** Requirements 46–50.
- **Design docs:** `docs/design/orchestrator.md`.

### interactive-recovery

- **Name:** Interactive recovery — halt into an answerable question that resumes the run
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon (Arc 2 keystone) — gated on run resume.
- **Objective:** When a slice exhausts its rework budget or an oracle rejects on irreducible ambiguity, synthesize a coherent question (what's blocking, options) and land it as a turn in a `qa`/`strategy` secondary chat; the user's answer resumes the run from durable markings. Makes unattended failure graceful (ask, don't orphan or ship-wrong) and fuses the interview and execution substrates into one loop. The asking reuses the existing `elicit`-mode / secondary-chat substrate (FE-716) — not a new Q&A channel; the load-bearing new work is **resume from durable markings** (Petri Phase 4).
- **Why now / unlocks:** The graceful-degradation layer that makes the orchestrator safe to run unattended even before re-plan and intent-verification are perfect. Highest value-per-cost Arc 2 rung; do first.
- **Acceptance:** (1) budget-exhaustion / irreducible-ambiguity halt emits a structured question, not just a halt reason; (2) the question renders in a secondary chat the user can answer; (3) the answer resumes the run from durable markings; (4) a durable record links question→answer→resumed run; (5) the question agent is an `execute`-mode plugin on `agent-extension-host`.
- **Verification:** halt-to-question synthesis tests; secondary-chat rendering/answer tests; resume-from-marking integration test; durable linkage test.
- **Depends on:** `chat-runtime-secondary-chats` (FE-716, done), Petri Phase 4 run resume (`petri-simulation-oracle`), `changeset-ledger` (FE-701) for durable answers, `agent-extension-host` (question agent = `execute`-mode plugin).
- **Traceability:** Requirement 45 (chat surface), Requirements 46–50 (execution); FE-819 halt visibility; D161-K.
- **Design docs:** `docs/design/orchestrator.md`; `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md`.

### intent-conformance-oracle

- **Name:** Intent-conformance oracle — independent behavioral-kernel verification
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon (Arc 2) — gated on FE-700.
- **Objective:** Verify a built feature against intent with requisite variety — independent of the agent's self-authored tests. The spec carries **behavioral kernels** (contrastive input→expected-behavior pairs produced by the interview, never seen by the build agent); a semantic-lane oracle runs them against the built feature. Reachability (integration oracle) + intent (kernel oracle) + real execution (FE-813) together give requisite variety.
- **Why now / unlocks:** "Done" currently means self-authored tests pass — no variety against intent, so an underspecified spec ships wrong work with green checks. Closes the spec-level verification gap.
- **Acceptance:** (1) behavioral kernels are first-class spec material (from FE-700); (2) a kernel oracle runs them against the built feature in the semantic lane, separate from self-authored tests; (3) completion requires kernel conformance + reachability + real test execution; (4) kernel failures surface as actionable findings.
- **Verification:** kernel-oracle adapter tests; end-to-end where self-authored tests pass but a kernel fails (proves independence); reuse of graph-review rubric dimensions.
- **Depends on:** `intent-graph-semantics` (FE-700), `BEHAVIORAL_KERNELS.md`; reuses `graph-review-scenario-options` (FE-702) rubric; complements `integration-oracle`.
- **Traceability:** Requirements 38, 46–50; A77, A78 (semantics); ln-oracles requisite variety.
- **Design docs:** `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/orchestrator.md`.

### adaptive-replan

- **Name:** Adaptive re-plan — amend the plan from execution feedback
- **Linear:** unassigned
- **Kind:** structural
- **Status:** horizon (Arc 2, highest cost) — gated on Petri Phase 3 + Phase 4.
- **Objective:** When execution reveals the plan is wrong (missing dep, absent integration point, wrong scope), re-invoke the architect with execution feedback + world state to amend the plan, recompile the affected sub-net, and resume — instead of retrying the same frozen slice. Requires the plan to be a mutable graph (Phase 3) with durable, resumable markings (Phase 4) and stale-graph detection (FE-738 deferred criterion 5).
- **Why now / unlocks:** Removes the last "plan was right" assumption from autonomy — the orchestrator becomes self-correcting. The latent `architect-generator-loop`. Most structurally expensive (touches the core substrate commitment); last rung.
- **Acceptance:** (1) a re-plan trigger fires on defined execution-feedback conditions; (2) the architect amends the plan (graph-level), not just retries a slice; (3) the affected sub-net recompiles and the run resumes from durable markings; (4) `graph_revision_stale` / `GraphRevisionCurrent` semantics gate stale work; (5) re-plans are recorded as changesets; (6) the replan agent is an `execute`-mode plugin on `agent-extension-host`.
- **Verification:** re-plan trigger tests; sub-net recompile + resume integration test; stale-graph gate tests; changeset linkage of plan amendments.
- **Depends on:** `petri-graph-compilation` (Phase 3), `petri-simulation-oracle` (Phase 4, resume), FE-738 deferred criterion 5, `intent-graph-semantics` (FE-700), `changeset-ledger` (FE-701), `agent-extension-host` (replan agent = `execute`-mode plugin).
- **Traceability:** Requirements 46–50; FE-738 acceptance criterion 5 (deferred); spec §graph-revision.
- **Design docs:** `docs/next/architecture/plan-graph-petri-orchestration.md`; `docs/design/orchestrator.md`.

### petrinaut-colour-fold

- **Name:** Petrinaut export — colour-fold per-slice subnet
- **Linear:** FE-784 (parent: FE-760)
- **Kind:** structural
- **Status:** done — implementation complete on branch (PR #160), pending `gt submit`. **No longer the default Petrinaut export path** — FE-764's `--petrinaut-fold=color|identity` flag makes identity the default; `color` (this frontier) is now opt-in for larger plans.
- **Objective:** Fold the per-slice concrete subnet (`slice:<sid>:*`) N→1 in the Petrinaut export projection, using token colour for slice identity, so the imported net stays legible on Petrinaut's flat (no-hierarchy/grouping) canvas. Faithful-mirror only: runtime (`petri-net.ts` / `net-compiler.ts`) untouched; the fold lives in `petrinaut-export.ts` + `petrinaut-events.ts`. Places strip the `slice:<sid>:` prefix and dedupe; transitions collapse groups with identical folded shape but keep divergent ones (dep-gated `slice-ready`, dep-signalling `return-done`) at concrete ids. net.json gains `tokenTypes` (SliceColour: sliceId/epicId discrete, retry/rework number) + optional place `typeId` (additive, schema 0.1.0→0.2.0). SDCPN stays count-fold (`colorId: null`) until Petrinaut discrete string token types land (H-6518/H-6519).
- **Why now / unlocks:** FE-762/763 emit N duplicated lifecycles onto a flat canvas — illegible at scale and discarding coloured-Petri-net power. Folding is the only graph-simplification lever Petrinaut offers and also dissolves most of the per-slice naming problem (instance identity moves into the token colour, not the node name).
- **Acceptance:** uniform lifecycle places/transitions appear once for a 2-slice plan; divergent dep gates stay distinct; no `slice:` prefix survives in folded ids; folded slice places carry `typeId`; tokens preserve slice colour; SDCPN round-trip still validates; event stream folds concrete→folded consistently with the static export.
- **Verification:** `serializeBlueprint` fold tests (uniform collapse, divergence preservation, arc/place conservation), event-adapter fold tests, SDCPN round-trip, `npm run verify`.
- **Design docs:** follow-up to FE-762/FE-763; Petrinaut docs `libs/@hashintel/petrinaut/docs/{petri-net-extensions,useful-patterns}.md`.
- **Current execution pointer:** fold landed; `NetFolding` extraction landed (`createNetFolding(blueprint)` owns the concrete→folded projection; `serializeBlueprint` and `createPetrinautEventStream` both consume it; the stream takes the folding at construction — temporal-coupling footgun removed; fold primitives are private). Seam-level invariant: static `net.json` export and the live event stream fold identically because both derive from one `NetFolding` (covered by the engine-contract e2e). All planned slices landed on branch: fold projection, `NetFolding` extraction, divergence-bound oracle, SDCPN folded-naming oracle, and colour→`color` naming alignment (brunch-owned identifiers now match Petrinaut's `colorId` wire field; SPEC §Lexicon carries `color fold` / `token color` / `folded net`). Implementation complete; pending `gt submit`. Remaining external dependency (not this frontier): SDCPN colour fidelity awaits Petrinaut discrete string token dimensions (H-6518/H-6519).

### continuous-workspace

- **Name:** Continuous workspace / phase-addressable interview surface (Conversational Workspace Runtime — Track 1)
- **Linear:** FE-709
- **Kind:** structural
- **Status:** done
- **Objective:** Replace per-phase rendering boundaries with a cumulative center pane, realized phase sections, one chat runtime per specification, sidebar section navigation, scroll/focus behavior, and preservation of the single actionable frontier at the current reachable phase.
- **Why now / unlocks:** Workflow read/write ownership is extracted, the multi-chat substrate ships chat containers below the specification, and side-chat V3.0/V3.1 closed the cascade surface. This gives future side-chat persistence, strategy chats, and graph/workspace routes a stable host without introducing a second durable workflow model.
- **Acceptance:** Realized phase sections remain legible, future sections stay unreachable until valid, navigation is focus/scroll state only, and the current phase retains exactly one actionable frontier/recovery/handoff/completion affordance.
- **Verification:** Manual workspace walkthroughs across kickoff-ready, active, review-active, recovery, close-to-next-phase, resume/reload, and future-phase deep-link states; regression tests around route/workflow state where available.
- **Traceability:** A58; D86, D87, D110, D113, D114; I24, I102.
- **Design docs:** `docs/design/CONTINUOUS_WORKSPACE_HYBRID.md`; umbrella synthesis in `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` (Track 1).

### chat-runtime-secondary-chats

- **Name:** Chat runtime — inline secondary chats (Conversational Workspace Runtime — Track 2)
- **Linear:** FE-716
- **Kind:** structural
- **Status:** **V1 done** on `ka/fe-716-chat-runtime-unified-secondary-chats`. Substrate (C0–C9) + unified chat shell (C11–C16) ship together: durable secondary chats over `chat`/`turn` (no `thread` table), per-mode tool gating (Ask/Edit), `#REF-CODE` injection, lightweight reconciliation panel, retired SideChatPopover, layoutable unified chat shell with Compact / Side-docked / Maximize / Full modes (localStorage-persisted, Esc-decrementing, prefers-reduced-motion-honoring spring transitions), kind-chip per collapsible, Jump-to-anchor link per chat, trigger-driven auto-expand. PR submits once #139 lands or per Lu's signal. C7 (agent-run inline) remains deferred until a producer exists; `$` mention symbol, snapshot builder family, item-version-gated refresh, full target-grouped reconciliation UX, QA composer refinements, strategy sub-chat UI, mode-chip + Shift+Tab toggle, suggestions row, per-kind kickoff copy variations, mention autocomplete chip UI, item-anchored badge in structured-list / graph view, and Ladle prototype stay parked per the V1 parking lot in `memory/CARDS.md`. Track 3 (`reconciliation-runtime`) target-grouped UX depends on this shell's spine + collapsible vocabulary.
- **Objective:** Render side, reconciliation, qa, and strategy chats inline as collapsible secondary chats in the workspace using the existing chat/turn substrate. Defer schema-level `thread`; do not add `thread` / `turn.thread_id` unless a later RFC proves chat/turn insufficient. Retire the SideChatPopover as a UI surface only after parity exists over durable secondary chats.
- **V1 narrowing (FE-716 scope):** Frame V1 as "every behavior the current side-chat (V3.1) supports today, surfaced through the elevated unified-workspace shape." Build only what that framing requires: substrate columns on `chat` (`parent_chat_id`, `invoked_in_turn_id`, `pinned_item_id`, `pinned_span_hint`) without enum changes; durable secondary-chat persistence; turn-zero kickoff with server-supplied snapshots; Ask/Edit modes; `#` knowledge-item symbol injection only; lightweight reconciliation-element view (full reconciliation runtime stays Track 3); agent-run inline rendering; SideChatPopover deletion; **layoutable unified chat shell with Compact / Side-docked / Maximize / Full layout modes from `docs/design/UNIFIED_CHAT_UX.md` §4 (no inline-under-turn rendering, no "secondary chat" label, kind chip per collapsible, localStorage-persisted layout state, motion-driven transitions).** Explicitly defer to follow-up frontiers: `$` secondary-chat mention symbol, full reconciliation target-grouped UX, QA composer refinements, strategy sub-chat UI, mention autocomplete chip UI, snapshot builders, item-version-gated refresh, mode chip + Shift+Tab toggle, suggestions row, per-kind kickoff copy variations, item-anchored badge in structured-list / graph view, Ladle prototype. Design brief `docs/design/UNIFIED_CHAT_UX.md` is the canonical reference for the broader ceiling and stays unedited.
- **Why now / unlocks:** Track 1 (workspace shell) ships, providing the stable host. Inline secondary chats are the critical unblocker for reconciliation absorption (Track 3) and give chat-context provision (Track 5) stable initiating anchors without creating a competing strategy/context substrate. Supersedes the prior side-chat V4a persistence horizon — persistent side-chat history becomes durable secondary chats rendered inline.
- **Acceptance:** Secondary chat kinds (`side`, `reconciliation`, `qa`, `strategy`) are representable with chat/turn; each active/resumable chat preserves one open assistant/system-first frontier turn; secondary chats render inline/collapsible in the unified workspace; SideChatPopover retires as cutover; transient staged-patches strip does not become a new source of semantic truth; turn-zero (`turn_kind='kickoff'`) seeds secondary chats with explicit context snapshots (full snapshot lifecycle deferred to Track 5).
- **Verification:** Chat/turn persistence and reload tests, inline secondary-chat rendering tests, one-open-frontier-per-chat tests, manual walkthroughs for side/qa/strategy chat creation/display/collapse, and regression on existing interview flow.
- **Open question (resolve in Card 1 / Card 6):** Agent-run inline rendering — fifth `chat.kind` enum value, system-authored sub-chat reusing an existing kind, or a derived projection over `first_turn_role`. HANDOFF flagged for explicit decision; default posture is to keep the enum at `interview` + `side_chat` and project agent-run from `first_turn_role='system'` unless substrate behavior justifies promotion.
- **Follow-on design notes (from FE-716 ln-review):** three deepening shapes selected post-V1 to land as separate slices.
  - **Anchor projection (Design C)** — drop `chat.anchored_item_ids`; pin is the projection seed; mention parsing + explicit add/remove emit `anchor_op` events on turns; bundle projector returns the current anchor set. Add `turn.anchor_ops` JSON or `turn_kind='anchor_op'`. Aligns with D154 transcript-first posture. Owned by `chat-context-provision` going forward.
  - **Tool-part → patch extractor seam (Design B)** — replace the in-effect if-ladder in `useSecondaryChatStream` with a pure `extractStagedIntents(messages, …) → ToolCallDecision[]` adapter returning explicit `{status: 'stage' | 'skip' | 'defer', reason}` decisions. Hook owns only dispatch dedupe + `patchList.stage` plumbing. Tests run pure. Refactor to per-tool adapter registry when proposal tools cross ~5.
  - **Shell decomposition + provider lifecycle (Design A)** — lift master-chat bootstrap into `MasterChatProvider` at workspace scope (so collapse/expand doesn't reset the latch); add `BackgroundChatBroadcastProvider` at shell scope with Subscribe/Publish split contexts and a small reducer; add `ActiveChatProvider` next to broadcast; delete `onStreamingChange` / `onAssistantTurnArrival` props from `SecondaryChatHost`. Shell becomes a leaf consumer ~80 LOC. Six-step revertable migration path captured in the review thread. **Status (2026-05-19):** Aα landed; Aβ premise under review — C32 Slice 5 (workspace-footer mount target) was retired, so the lifecycle move now needs a different surviving scope. Candidate is `<ChatShellPresenceProvider>` at the spec route, which survives shell unmount/remount. Re-scope before building Aβ.
- **Traceability:** Requirement 45; A49, A94; D86, D87, D110, D114, D138, D153, D154; I111, I116, I120.
- **Design docs:** `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.2 + §5 Track 2; `docs/design/MULTI_CHAT.md`; `docs/design/SIDE_CHAT.md`; `docs/design/SPEC_EVOLUTION_STRATEGIES.md`; design brief `docs/design/UNIFIED_CHAT_UX.md` (to be brought forward verbatim from PR #138 in Card 0; do not edit).

### reconciliation-runtime

- **Name:** Reconciliation runtime — async-by-default with in-stream secondary chat (Conversational Workspace Runtime — Track 3)
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** not-started
- **Objective:** Absorb reconciliation into the unified chat surface as a target-grouped secondary chat with async-by-default classifier scheduling and a "Reconcile Now" user trigger. Retire the standalone PendingReviewSection. Auto-confirmed rows resolve invisibly; only `auto-edit` (one-click apply) and `substantive` (judgment affordances) reach the user.
- **Why now / unlocks:** Tracks 2 (chat runtime) and 4 (changeset ledger) provide the secondary-chat surface and durable attribution. The reconciliation chat replaces the V3.1 Pending review section and the side-chat popover's reconciliation surface with a conversational target-grouped chat inside the workspace.
- **Acceptance:** Reconciliation chat renders target-grouped (topologically sorted upstream-first per PATCH_LEDGER target ordering); async classifier runs in background; auto-confirmed never surfaces; auto-edit has one-click apply; substantive has judgment affordances; "Reconcile Now" trigger in workspace shell; standalone PendingReviewSection retired as cutover.
- **Verification:** Reconciliation chat rendering tests, classifier scheduling tests, target-ordering tests, manual walkthroughs for async classification + Reconcile Now trigger, regression on existing reconciliation flow.
- **Traceability:** Requirement 45; A49, A88, A96; D135, D137, D138, D146, D153; I111, I113, I114, I120.
- **Design docs:** `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.3 + §5 Track 3; `docs/design/MULTI_CHAT.md` §5; `docs/design/PATCH_LEDGER.md` §Target Ordering, §Reconciliation Flow.

### chat-context-provision

- **Name:** Chat context provision — transcript-first snapshots, handles, `#` mention, turn-zero (Conversational Workspace Runtime — Track 5)
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** not-started
- **Objective:** Implement transcript-first context provision for chats: turn-zero inserts explicit context snapshots stored on turns and derived from chat kind/strategy/anchors; `#` mention resolves to item ids, an inserted context snapshot, and an active chat handle; before new assistant turns, stale handles detect newer graph item versions/fingerprints and insert fresh snapshots only for changed subjects. Do not persist a hidden context-spec table by default. TOON or another compact graph serializer may format inserted snapshots/context packs.
- **V1 anchor/handle shape (absorbed from FE-716 ln-review, Design C):** drop `chat.anchored_item_ids`; the chat's pin seeds the projection; `#REF` mention parsing and the anchor-manager's explicit add/remove emit `anchor_op` events on turns (either `turn.anchor_ops` JSON or `turn_kind='anchor_op'` — pick during ln-scope); the bundle projector returns the current anchor set. Handles become per-(chat, item) records that compose from the same transcript pattern when freshness lands.
- **ln-review pickup slices (post FE-716, scoped here):** (1) **mention-snapshot** — persist literal user text separately from resolved `#` context; store context as turn snapshot artifacts, not appended `user_parts`; wire prompt assembly + existing `buildIntentContextSnapshot` / resolver. (2) **transcript-regression** — test that mention/snapshot blocks do not render inside the user message bubble. (3) **anchor-projection** — implement Design C and remove `chat.anchored_item_ids`. FE-716 merge follow-up lands **lineage validation** (`parentChatId` / `invokedInTurnId` same-spec checks) and **legacy `POST …/side-chat` removal**.
- **Why now / unlocks:** Secondary chats and strategy chats need stable, replayable prompt context that survives multi-chat edits without ambient graph rehydration. Transcript-first snapshots let prompt/context engineering remain the authority while preserving replay and audit.
- **Acceptance:** Chat prompts use transcript context first; initial anchors and mentions insert visible/replayable context snapshot artifacts on turns; active chat handles store referenced item ids plus last-snapshotted version/fingerprint and refresh changed graph subjects by inserting new snapshots before the next assistant turn; unchanged handles do not duplicate snapshots; snapshots preserve old versions rather than mutating; context builders can render one-or-more item snapshots, item-neighborhood snapshots, and economic whole-graph snapshots via typed context packs; neighborhood modes cover immediate adjacency, dependencies, dependents/impact, evidence, and reconciliation, with changeset-historical neighborhoods added once the ledger can identify original-capture and last-update surroundings; handles are revocable or expire by explicit transcript event/policy.
- **Verification:** Context snapshot artifact tests; changeset-backed stale-handle refresh tests across changes from another chat; no-refresh tests for unchanged item versions; `#` mention resolution/disambiguation tests; structured JSON assertions plus selected golden renderings for item-list, neighborhood-mode, and economic-graph context builders; historical-neighborhood tests once changesets can identify original capture / last update context; turn-zero prompt assembly tests per chat kind/strategy; and manual walkthroughs for side/qa/strategy chat context. Handle freshness waits on real item versions from `changeset-ledger` rather than temporary fingerprints.
- **Traceability:** Requirement 45; A80, A81, A84, A85, A95; D136, D137, D139, D140, D154; I112, I120.
- **Design docs:** `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` §3.5 + §5 Track 5; `docs/design/SPEC_EVOLUTION_STRATEGIES.md`; prompt/context pack docs.

### agent-fixture-substrate

- **Name:** FE-705 integration — agent capability CLI + LLM-as-user fixture probe
- **Linear:** FE-705
- **Kind:** structural
- **Status:** branch-complete / reconciling
- **Objective:** Integrate the branch-complete local `brunch agent` JSONL capability adapter and external probe runner so agents can drive the real Brunch interview flow through Brunch-owned contracts rather than privileged ORM access.
- **Why now / unlocks:** Prompt/context and graph-review probes need realistic graph/transcript fixtures, but hand-authoring those fixtures is chicken-and-egg. A JSONL capability adapter lets an external LLM-as-user drive the real lifecycle through the same mutation authority future agents must use, pressure-testing tool-call vocabulary, chat readiness, resource identity, fixture curation, and import-boundary discipline. Pi comparison remains FE-635 after this seam has a real Brunch use case to compare against.
- **Acceptance:** Server-owned capability contracts and JSONL protocol/session code are integrated; the probe runner uses only the JSONL client/process boundary; fixture-candidate artifacts preserve scenario briefs, model policy, generated transcripts, and workspace-state inspection without becoming Brunch authority.
- **Verification:** Contract/dispatcher tests, JSONL protocol/session tests, import-boundary tests, fake process tests, opt-in real-provider smoke, and fixture-candidate structure/readiness checks.
- **Traceability:** Requirement 43; A89; D143, D147; I115. Also protects Requirements 40, 41, 42 by making prompt/context and mutation-surface probes executable through a real adapter.
- **Design docs:** `docs/design/AGENT_MUTATION_SURFACE.md`; `docs/design/SUBSTRATE_STRANGLER_COORDINATION.md`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md`; FE-705 branch artifacts until rebased.

### intent-graph-semantics

- **Name:** Intent graph semantics + relation-policy directionality foundation
- **Linear:** FE-700
- **Kind:** structural
- **Status:** not-started
- **Objective:** Refine the ontology and relation policy so the graph can represent invariants, examples/counterexamples, constraint subtypes, narrowed decisions, witness strength, checkability gaps, and operational edge behavior as source/destination material for future generative features.
- **Why now / unlocks:** Candidate generation, behavioral kernels, graph review, scenario-options acceleration, architect proposals, direct-edit cascade, and downstream verification-aware decomposition all need a sharper semantic target than the current exploration/review ontology. This semantic-layer lane is most likely to collide with parallel work, so it should land before broad observer enrichment or canonical candidate-bundle acceptance.
- **Acceptance:** `invariant` and `example` are first-class durable kinds; examples are subtyped; `decision` is narrowed; `constraint`, `criterion`, and `invariant` semantics are enriched; `checkability` and witness strength are represented; relation families, negative relations, edge epistemic metadata, relation-policy directionality, and endpoint-relative display labels for dependency/dependent context snapshots are explicit.
- **Verification:** Corpus/fixture observer probes comparing old vs refined ontology; relation-policy unit tests for mixed-direction relations and endpoint-relative labels; graph-review manual assessment for precision/noise; context-pack probe outputs show authority, witness, relation support, dependency/dependent grouping, and directionality labels.
- **Traceability:** Requirement 38; A77, A78, A80, A81, A84; D134, D136, D137, D139, D140.
- **Design docs:** `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/archive/design/INTENT_SPEC_EVOLUTION.md`; FE-705 strategy/proposal notes for relation directionality.

### changeset-ledger

- **Name:** Semantic changeset ledger + proposal-turn staleness
- **Linear:** FE-701
- **Kind:** structural
- **Status:** not-started
- **Objective:** Introduce the semantic history spine that separates graph mutation history from conversational turn ancestry.
- **Why now / unlocks:** Scenario bundle acceptance, direct-edit atomicity, accepted-with-issues flows, stale proposal detection, graph-review repairs, side-chat V4b item versioning, and future architect/reconciliation agents all need a durable semantic mutation boundary. Without it, productized scenario-options can stay probe-only but cannot safely commit candidate bundles. The current DB substrate is already halfway there: `chat` and `reconciliation_need` exist, `specification.active_turn_id` / `chat.active_turn_id` are deliberately duplicated during the multi-chat transition, and `reconciliation_need.caused_by_patch_id` is a historical placeholder that should become changeset-backed provenance rather than be deleted as ordinary cruft.
- **Current schema observations:** Legacy dedicated knowledge tables (`decision`, `assumption`, `requirement`, `criterion`, and old join/parent tables) are retired in migration `0010`; current semantic truth is `knowledge_item` + `knowledge_edge` + `turn_knowledge_item`. `annotation` and `reconciliation_need` are active process/read-model tables even when empty in local DBs. `turn.turn_kind` / `turn.is_resolution` remain transitional structural-artifact markers until continuous workspace and multi-chat proposal semantics replace that projection. `docs/schema.dbml` is stale relative to `src/server/schema.ts` and should be regenerated or deleted when FE-701 touches schema docs.
- **Migration watch:** Live local `.brunch/brunch.db` was observed with only 18 applied migrations, stopping at `0017_reconciliation_need`; it lacked `0018` source snapshot columns and `0019` reconciliation-agent columns even though `src/server/schema.ts` defines them. There is no explicit `npm run migrate`; app/server `createDb()` runs Drizzle migrations automatically. Before FE-701 schema work, verify the target DB by inspecting `__drizzle_migrations` and `PRAGMA table_info(reconciliation_need)` so drift is not misread as product intent.
- **Acceptance:** Schema and operation vocabulary use `changeset` / `change`; specifications track latest semantic changeset; proposal turns carry base/opened changeset identity; `reconciliation_need.caused_by_changeset_id` replaces/connects the historical patch placeholder; non-accept proposal actions cannot mutate graph truth; a changeset is the smallest atomic unit preserving semantic coherence.
- **Verification:** DB atomicity tests for changeset + changes + reconciliation_need writes, staleness tests for open proposal turns across multi-chat changes, migration/drift checks against an actual SQLite DB, and capability/transition tests proving non-accept actions cannot mutate graph truth.
- **Traceability:** Requirements 39, 42, 44; A71, A79; D135, D138, D143.
- **Design docs:** `docs/design/PATCH_LEDGER.md` (historical filename; future vocabulary is changeset/change); `docs/design/SUBSTRATE_STRANGLER_COORDINATION.md`; FE-705 strategy/proposal notes for semantic history and proposal turns.

### graph-review-scenario-options

- **Name:** Graph-review oracle + scenario-options probes
- **Linear:** FE-702 for graph-review / scenario probes; FE-649 and FE-640 remain productization children under FE-698 where relevant
- **Kind:** structural
- **Status:** not-started
- **Objective:** Build the internal critique path and artifact-only candidate bundle probes before product UI.
- **Why now / unlocks:** Product wants first-turn strategy choice and mid-interview acceleration, but engineering needs graph-review critique to make generated candidate bundles credible. This lane can advance in parallel with FE-700 if it stays artifact-only and does not commit canonical graph truth.
- **Acceptance:** Candidate graph bundle and graph-review finding artifacts exist; graph-review prompt/context pack and rubric cover coherence, fixed-premise respect, coverage, tradeoff honesty, checkability, granularity, scenario fidelity, epistemic labels, provenance, and downstream usefulness; candidate readiness is classified as `draft` / `reviewing` / `reviewed_clean` / `reviewed_with_issues` / `blocked`; broader graph-review issues remain turn-owned unless querying/filtering needs prove otherwise.
- **Verification:** Scenario-runner fixtures, FE-705 JSONL-generated completed-spec fixtures, raw output review, structured parse validation, qualitative scorecards, and comparison against drilldown-produced graphs. Middle/outer-loop oracle design should decide when fixture candidates become golden.
- **Traceability:** Requirements 20, 21, 31, 32, 40, 41, 43, 44; A67, A68, A80, A85, A87, A89; D126, D127, D139, D141, D147.
- **Design docs:** `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`; `docs/design/AGENT_MUTATION_SURFACE.md`; FE-705 strategy/proposal notes.

### productized-scenario-options

- **Name:** Productized scenario-options / candidate-spec completion assist
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** blocked
- **Objective:** Replace skip-only remainder handling with first-turn strategy choice and a mid-interview `speed this up` path that generates reviewed candidate graph bundles with tradeoffs, completing the current direction by default.
- **Why now / unlocks:** This is the likely first user-visible alternative to long drilldown, but product UI waits on graph-review probes, FE-700 semantics, and FE-701 changesets. Until then, scenario-options remain artifact/proposal-only.
- **Acceptance:** Users can choose or request acceleration via scenario options; generated bundles preserve accepted graph truth as fixed premise, present tradeoff profiles, and become canonical only through coherent accepted changesets with known issues represented as follow-on review/process debt.
- **Verification:** Probe comparison against direct drilldown, graph-review scorecards, accepted-with-issues flow tests once changesets exist, and manual user-flow review for trust/comprehension.
- **Traceability:** Requirements 31, 40, 44; A67, A77, A78, A85, A90, A91; D126, D134, D136, D139, D151, D152.
- **Design docs:** FE-705 strategy/proposal notes until canonicalized; `docs/design/BEHAVIORAL_KERNELS.md`; `docs/design/INTENT_GRAPH_SEMANTICS.md`.

### first-run-provider-setup

- **Name:** First-run provider setup
- **Linear:** FE-633 covers the OpenRouter/default-provider part; dashboard credential UX + XDG key storage may need a sibling issue if split from provider proving
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Make missing LLM credentials visible on the dashboard, add a shared AI runtime provider seam for interviewer/observer model construction, support UI-entered keys through XDG-compliant user auth state, and evaluate whether OpenRouter should become the preferred onboarding provider while preserving Anthropic-specific capabilities or explicit degradation.
- **Why now / unlocks:** Can proceed independently and reduces first-run friction for real users and probe workflows.
- **Acceptance:** Dashboard surfaces provider credential status before specification creation; setup flow stores UI-entered keys outside the project workspace; interviewer/observer construction routes through a shared provider seam.
- **Verification:** Unit tests for provider precedence/storage paths, manual first-run walkthroughs, and provider capability spike for model naming, structured output, tool use, and reasoning/thinking support.
- **Traceability:** Requirements 34, 35, 36; A74, A75; D130, D131, D132; I106.
- **Design docs:** none yet beyond SPEC/PLAN entries.

### workspace-gitignore-assist

- **Name:** Workspace hygiene / `.brunch/` gitignore assist
- **Linear:** FE-648
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Detect whether generated local state is already ignored and, with explicit confirmation, add an idempotent `.gitignore` entry or create `.gitignore` when absent.
- **Why now / unlocks:** Low-conflict guardrail that reduces accidental commits of local Brunch state.
- **Acceptance:** The app detects absent, present, and already-covering ignore states; previews repository mutation; mutates `.gitignore` only after explicit confirmation; append/create behavior is idempotent and content-preserving.
- **Verification:** Unit tests for ignore detection/append behavior and manual dashboard walkthrough with absent, present, and already-covering `.gitignore` states.
- **Traceability:** Requirement 37; A76; D133; I107.
- **Design docs:** none yet beyond SPEC/PLAN entries.

### productized-web-research

- **Name:** Productized web research capability
- **Linear:** FE-649
- **Kind:** structural
- **Status:** not-started
- **Objective:** Add web search and page-fetch tools as interviewer-invoked context gathering, surfaced as preface cards after the scenario substrate proves query framing, tool ergonomics, and provisional-context handling.
- **Why now / unlocks:** Extends the same phase-agnostic preface-card model to external research, but should wait for prompt/context scenario substrate proof so web research does not become an ad hoc tool surface.
- **Acceptance:** Research tools are invoked through interviewer context gathering, outputs render as provisional preface cards paired with questions, and observer capture treats the validated full turn as atomic.
- **Verification:** Prompt/context scenario probes for query framing and tool-output summarization, plus manual review of provisional-context handling.
- **Traceability:** Requirements 20, 21, 40, 41; D125, D139, D140, D142.
- **Design docs:** FE-698 prompt/context scenario substrate references; future productized research notes if needed.

### relation-first-observer-enrichment

- **Name:** Relation-first observer capture enrichment
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Broaden observer output across the refined ontology without flooding the graph.
- **Why now / unlocks:** First cut is shipped; enrichment waits for FE-700 relation policy so observer output can become semantically richer while preserving prompt-budgeted compact anchors and user trust.
- **Acceptance:** Observer extraction captures richer relation families and operational metadata with abstention under weak support.
- **Verification:** Observer corpus probes, graph/export review for precision/noise, and context-pack output review.
- **Traceability:** Requirements 30, 38, 40; A66, A81, A84; D125, D136, D137, D139, D140; I109.
- **Design docs:** `docs/design/INTENT_GRAPH_SEMANTICS.md`.

### architect-generator-loop

- **Name:** Architect / generator loop
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Explore an autonomous agent that iterates over the intent graph and proposes semantic changes for HITL review through the same future changeset/reconciliation pathway as user-driven edits.
- **Why now / unlocks:** Related to scenario-options but broader; keep productized architect proposals behind multi-chat, reconciliation, and semantic changesets. Use the scenario substrate for shadow/proposal-only probes first.
- **Acceptance:** Shadow/proposal-only architect outputs can be compared against user-driven edits without mutating canonical graph truth.
- **Verification:** Scenario substrate probes and human comparison against accepted user edits.
- **Traceability:** A73, A85, A87; D139, D141.
- **Design docs:** `docs/design/BEHAVIORAL_KERNELS.md`; future design doc if promoted.

### server-mini-library-compartmentalization

- **Name:** Server mini-library compartmentalization
- **Linear:** unassigned in this plan snapshot
- **Kind:** refactor
- **Status:** in-progress opportunistically on FE-705 lane; `db.ts` persistence facade extraction complete, broader server roots remain horizon.
- **Objective:** Refactor growing server seams into plural public roots with same-named private subtrees where FE-698 / FE-705 pressure has made boundaries too implicit.
- **Why now / unlocks:** Near-term refactor candidate after FE-705 integration, not product roadmap work. The persistence facade now proves the pattern: `db.ts` owns connection setup and curated public exports while private `src/server/db/*-store.ts` modules own cohesive persistence implementation.
- **Acceptance:** Candidate seams such as `db.ts`, `fixtures.ts`, `context-packs.ts`, `prompts.ts`, `scenario-runner.ts`, `entity-apis.ts`, and `agent-apis.ts` hide private implementation subtrees behind stable public roots where real pressure exists.
- **Verification:** Existing test suite plus import-boundary review; for the completed `db.ts` slice, focused store/route/workflow tests, `npm run check`, and `npm run build` pass.
- **Traceability:** code organization convention in `AGENTS.md`.
- **Design docs:** none.

### side-chat-v4b-item-versioning

- **Name:** Side-chat V4b — item versioning + branched exploration
- **Linear:** FE-675 umbrella, V4b half
- **Kind:** structural
- **Status:** horizon
- **Objective:** Add item versioning and branched exploration once the changeset ledger lands.
- **Why now / unlocks:** Item versioning unblocks dangling-annotation repair and soft-edit audit; branched exploration lets drill-downs, past-turn edits, and revisits coexist with the original chain.
- **Acceptance:** Prior item versions are queryable for diff/comparison/audit while active-path projection always reflects latest semantic truth.
- **Verification:** Changeset-backed versioning tests, revisit cascade tests, and annotation repair walkthroughs.
- **Traceability:** A72, A73, A85; D139, D141.
- **Design docs:** `docs/design/MULTI_CHAT.md`; `docs/design/PATCH_LEDGER.md`.

### dashboard-summaries

- **Name:** Dashboard result summaries and completeness metrics
- **Linear:** unassigned in this plan snapshot
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Improve progress visibility across specifications.
- **Why now / unlocks:** Lower-priority product surface after core workspace and semantic substrate stabilize.
- **Acceptance:** Dashboard communicates spec progress/completeness without implying false closure.
- **Verification:** Manual dashboard walkthroughs.
- **Traceability:** Requirements 8, 13, 15.
- **Design docs:** none.

### spatial-graph-layout

- **Name:** Spatial canvas layout for graph view
- **Linear:** unassigned in this plan snapshot
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Add the spatial DAG layout as a second layout choice inside graph mode, alongside the structured-list route.
- **Why now / unlocks:** Graph view already ships as a structured-list peer route; spatial layout follows once relation density and graph interaction needs justify it.
- **Acceptance:** Users can switch between structured-list and spatial canvas layouts without changing projection semantics or action contracts.
- **Verification:** Manual graph-view walkthroughs at low/high edge density plus visual regression if available.
- **Traceability:** Requirement 33; A69, A70; D128.
- **Design docs:** graph-view sections in SPEC; future graph-view design notes if promoted.

### graph-view-active-path-filter

- **Name:** Graph view active-path render filter + scope toggle
- **Linear:** unassigned in this plan snapshot
- **Kind:** bounded feature
- **Status:** horizon
- **Objective:** Render only active-path items by default in graph view, with a `Show all` toggle.
- **Why now / unlocks:** Lower-priority graph legibility improvement after core graph semantics and projection surfaces stabilize.
- **Acceptance:** Active-path filtering is default, user can inspect all items, and edge rendering remains honest under both scopes.
- **Verification:** Graph-view fixtures for active-path/all toggles.
- **Traceability:** D128 and graph-view requirements.
- **Design docs:** none.

### mcp-adapter

- **Name:** MCP server adapter for core operations
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Expose future adapter over capability contracts, not direct ORM/route wrappers.
- **Why now / unlocks:** Deferred until capability contracts stabilize through FE-705 and real agent/probe use.
- **Acceptance:** MCP tools wrap Brunch-owned capability contracts and preserve resource identity, authority metadata, and mutation semantics.
- **Verification:** Contract adapter tests and import-boundary tests.
- **Traceability:** Requirements 42, 43; D143, D147.
- **Design docs:** `docs/design/AGENT_MUTATION_SURFACE.md`.

### file-based-persistence

- **Name:** Git-friendly file-based persistence representation for diffable exported specs
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Explore a diffable file representation for exported/durable spec truth.
- **Why now / unlocks:** Deferred until product ontology and changeset semantics are clearer.
- **Acceptance:** File representation preserves intent graph meaning and review/export boundaries without becoming a second source of truth.
- **Verification:** Round-trip and diff-fixture tests if promoted.
- **Traceability:** Product direction from planning specs toward intent specs; D134, D135.
- **Design docs:** future design needed if promoted.

### typed-fixture-builder-convergence

- **Name:** Typed fixture-builder convergence for happy-path tests
- **Linear:** unassigned in this plan snapshot
- **Kind:** hardening
- **Status:** horizon
- **Objective:** Converge test fixtures around typed builders that represent current product semantics.
- **Why now / unlocks:** Useful after semantic schema work stabilizes so tests do not fossilize obsolete ontology names.
- **Acceptance:** Happy-path tests can create coherent specs/chats/turns/intent graph state through typed builders with minimal duplication.
- **Verification:** Existing test suite, fixture API review, and migration of representative tests.
- **Traceability:** I48, I109, I111, I112.
- **Design docs:** none.

### structured-development-spec-registry

- **Name:** Structured development spec registry
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural / process
- **Status:** horizon
- **Objective:** Prototype file-backed canonical spec records, deterministic checks, generated markdown views, and task-local slices for Brunch's own development workflow.
- **Why now / unlocks:** Self-tooling experiment, not product functionality. It would make `memory/SPEC.md` / `memory/PLAN.md` generated views over structured records to reduce drift and merge conflicts.
- **Acceptance:** Generated views preserve current planning ergonomics while reducing merge churn and cross-reference drift.
- **Verification:** Deterministic generation checks and branch-conflict dry runs.
- **Traceability:** dev-layer trajectory only; not product-layer ontology.
- **Design docs:** `docs/design/ln-skills/EVOLUTION.md`.

### portability-boundaries

- **Name:** Portability boundaries
- **Linear:** unassigned in this plan snapshot
- **Kind:** structural
- **Status:** horizon
- **Objective:** Split durable store/read-model, interview session runtime, and workspace capability provider if Brunch targets hosted, remote, embedded, or sandbox-backed operation.
- **Why now / unlocks:** Future architecture boundary map for non-local deployments or adapter-backed execution. Deferred until hosted/remote/sandbox operation becomes a product goal.
- **Acceptance:** Boundary map supports hosted/remote/sandbox decisions without prematurely abstracting the local-first product.
- **Verification:** Architecture review and spike if product direction changes.
- **Traceability:** portability assumptions in design docs; current local-first constraint in SPEC.
- **Design docs:** `docs/design/PORTABILITY_BOUNDARIES.md`.

## Recently Completed

- [2026-05-21] `orchestrator-poc` — Done: FE-730 / PR #143 + Phase 0 compiler extraction. Extracted `PetriNet` interpreter → `petri-net.ts`, net compiler → `net-compiler.ts`, `FiringPolicy` type. Both engines now call shared `compilePlan()`. Retry state moved from `ctx.retries` Map into in-net `retry-budget` places. Adapter tests pin net topology. Verified: `npm run verify` 120/120 files, 1384 tests pass. Watch: proc and petri are currently identical (same compiler + serial policy); Phase 2 re-introduces divergence via parallel firing policy.
- [2026-05-13] `continuous-workspace` — Done: FE-709 / PR #134. Replaced per-phase InterviewView with ContinuousWorkspaceView (cumulative center pane), extracted `useContinuousWorkspaceController`, added sidebar scroll-spy via WorkspaceFocusContext, extracted shared controller helpers to core, retired route-first test assumptions. Verified: `npm run verify` 1213 / 1214 pass (1 pre-existing flake). Watch: Step 5 route-collapse decision deferred — hybrid works as intended.
- [2026-05-11] `side-chat-v3-1-agent-grouped-reconciliation` — Done: FE-674 / PR #124 + downstack closed the V3.x arc end-to-end with spec-level classifier route, per-row reset route, agent classification lifecycle, chips, per-class actions, and bulk Confirm-all / Apply-all-suggested. Verified: `npm run verify` 1178 / 1179 pass with one unrelated `side-chat-route` flake. Watch: A88 outer-loop walkthrough on a dense spec remains open to assess legibility vs V3.0's flat list.
- [2026-05-11] `fe-698-reconciliation-context-pack` — Done: added proposal-only reconciliation prompt/context scenario rendering open reconciliation needs with source/target anchors, reason/status, prompt/context fingerprints, and read-only capability metadata. Verified: `npm run verify`. Watch: next FE-698 work can broaden read-only/proposal-only probes and Pi adapter spike without treating this pack as a resolution agent.
Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
TRACK A — Conversational Workspace Runtime umbrella
continuous-workspace (Track 1, done — FE-709)
  └──→ chat-runtime-secondary-chats (Track 2; no schema-level thread)
        ├──→ reconciliation-runtime (Track 3, also needs Track 4)
        └──→ chat-context-provision (Track 5; transcript-first snapshots/handles)
changeset-ledger (Track 4, parallel with Track 2)
  ├──→ richer attribution in reconciliation-runtime (Track 3)
  ├──→ real item versions for chat-context-provision handle freshness (Track 5)
  ├──→ original-capture / last-update historical neighborhoods for context snapshots (Track 5)
  └──→ unlocks architect-generator-loop and side-chat-v4b-item-versioning

TRACK B — Agent fixture substrate / strangler handler seam
prompt/context scenario substrate foundation (completed)
  └──→ agent-fixture-substrate
        ├──→ shared route/capability handler seam without frontend DTO cutover
        ├──→ generated completed-spec fixture candidates
        ├──→ graph-review-scenario-options
        └──→ Pi harness comparison (future, FE-635)

TRACK C — Semantic substrate (highest coordination)
multi-chat-substrate + reconciliation-needs (completed)
  ├──→ intent-graph-semantics
  │     ├──→ relation-first-observer-enrichment
  │     ├──→ robust direct-edit / reconciliation cascade policy
  │     └──→ graph-review-scenario-options becomes semantically meaningful
  └──→ changeset-ledger
        ├──→ canonical scenario bundle acceptance
        ├──→ direct-edit atomicity with caused_by_changeset_id
        ├──→ stale open proposal detection
        └──→ architect-generator-loop / verifier/import mutation provenance

TRACK D — Strategy probes, frontend artifacts, and product acceleration
agent-fixture-substrate + intent-graph-semantics
  └──→ graph-review-scenario-options
        ├──→ fixture-backed candidate / graph-review UI artifacts can proceed without canonical mutation
        └──→ productized-scenario-options
              ├──→ absorbs / reshapes two-axis interview framing
              └──→ absorbs / reshapes progressive detail / recursive deflation

TRACK E — Low-conflict parallel work
first-run-provider-setup
workspace-gitignore-assist
productized-web-research

TRACK F — Petri-net execution substrate (umbrella H-6476)
orchestrator-poc (Phase 0: compiler extraction — done)
  └──→ petri-semantic-lanes (Phase 1: two-lane subnet + §7 events — done)
        └──→ petri-parallel-execution (Phase 2: concurrent firing + resource pools — done)
              ├──→ petri-epic-verification-merge (hardening: merge slice worktrees for verify-epic — done)
              └──→ petri-declarative-routing (Phase-3-prep: topology-level Guard predicates; FE-700-independent — done)
                    ├──→ petri-petrinaut-semantics (FE-761: Petri-net-faithful refactor — done)
                    │     ├──→ petri-blueprint-export (FE-762: net.json + SDCPN export per run — done)
                    │     └──→ petri-event-stream (FE-763: initial markings + transition firings — done)
                    │           ├──→ petrinaut-colour-fold (FE-784: colour-fold export projection — done; set aside for the no-colour demo)
                    │           └──→ petri-sync-server (FE-764: ACTIVE — ephemeral cook-hosted SSE live stream; replay-on-connect; brunch-initiated session; Bristol demo)
                    ├──→ spec-to-cook-plan (demo front-half: completed intent graph → cook plan.yaml; projection + LLM planning pass + reconciliation; spikes done; feeds FE-764 stream; NOT blocked by FE-700)
                    ├──→ petri-graph-compilation (Phase 3: compile from plan-graph + relation policy; needs FE-700; premise weakened — partially subsumed by spec-to-cook-plan; residual value = Phase 4 sim oracle)
                    └──→ petri-simulation-oracle (Phase 4: reachability, deadlock, resume; declarative-routing structural prerequisite now satisfied; Phase 3 still needed for graph-derived gates)

LOWER-PRIORITY / DEFERRED
side-chat-v4b-item-versioning (depends on changeset-ledger)
spatial-graph-layout + graph-view-active-path-filter
dashboard-summaries
mcp-adapter / file-based-persistence / typed-fixture-builder-convergence
structured-development-spec-registry
portability-boundaries

RETIRED
side-chat-persistence-v4a — superseded by chat-runtime-secondary-chats (Track 2)
```
