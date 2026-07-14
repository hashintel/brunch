# Host-landing cutover: helper, /brunch:land acceptance, patch-path deletion

Frontier: host-landing
Status:   active
Mode:     slices
Created:  2026-07-14

Sequence: card 1 → 2 → 3 → 4. Cards are independent of each other's implementation findings (anti-speculation gate holds: the design is settled and the tracer proved the port). Stop the sequence and reroute if any card trips its promotion checklist or contradicts the frontier definition.

---

## Card 1 — executor landing helper + `landed` lifecycle [done]

> Landed 2026-07-14. Divergence noted: the `landed` status fanned out to seven
> lifecycle consumers beyond the declared paths (run-abandon, run-retry-eligibility,
> orchestrate.petriInputRequiredStep, petri-runtime, petri-terminal, petri-events
> status record, observer-read tolerance guards, web runs.tsx status color) — same
> seam, landed treated like promotion_prepared for net history/terminal purposes
> and added to every terminal set. run-abandon gained a refusal test for landed runs.

### Target Behavior

A `promotion_prepared` run can be landed exactly once through `src/executor/landing.ts` — preflight is read-only, apply is acceptance-gated and advances run metadata to `landed` only on port success.

### Cold-start reads

```
- memory/SPEC.md   — D111-L, I58-L, D112-L
- memory/PLAN.md   — frontier: host-landing (design synthesis + tracer status live there)
- src/executor/TOPOLOGY.md — §promotion.ts / §host-promotion.ts (incl. the FE-1201 migration note)
- src/executor/host-promotion.ts — the metadata/report agreement validation to port into preflight
- src/app/git-host-land-port.ts + git-host-land-port.test.ts — the proven port semantics (commit 448f0f56)
```

### Boundary Crossings

```
→ src/executor/landing.ts (new: preflightLanding / applyLanding)
→ src/executor/run.ts (RunMetadata: landed status + landing identity fields)
→ GitHostLandPort (existing; consumed via fake in this card's tests)
```

### Risks and Assumptions

```
- RISK: dispatch needs the run's mode, but only `substrate` is persisted today →
  MITIGATION: dispatch on substrate (git_worktree → integrate against cwd;
  empty_dir → materialize into a target dir); card 3 makes mode the sole input
  that derives substrate — dispatch semantics do not change.
- ASSUMPTION: promotion metadata/report agreement checks in host-promotion.ts
  port over unchanged (same runId/commit/branch validation).
    → IMPACT IF FALSE: preflight admits stale promotions; caught by ported tests.
    → VALIDATE: port the corresponding host-promotion.test.ts cases onto landing.
```

### Posture check

Proving: stabilizes the seam slice-2 cards aim from (invariants axis); the acceptance-carrier shape (`LandAcceptance` constructed only by callers, never a bare SHA param) is the structural half of claim 3.

### Acceptance Criteria

```
✓ landing.test.ts :: preflight ready — a valid promotion_prepared run yields mode/substrate,
  runBaseSha, promotionCommitSha, reviewBranch, and target report with sideEffects: []
✓ landing.test.ts :: preflight refusals — missing run / not-promoted / metadata-report
  disagreement return the ported non-ready statuses without effects
✓ landing.test.ts :: apply requires acceptance — applyLanding without a LandAcceptance value
  is unrepresentable (required param); acceptance whose promotedCommitSha no longer matches
  a re-run preflight returns acceptance_stale with zero port calls beyond preflight reads
✓ landing.test.ts :: apply landed — port 'landed' advances metadata once to status 'landed'
  with landedSha/landedVia/landedTarget recorded; a second apply returns already_landed
  without invoking the port
✓ landing.test.ts :: apply refusal/conflict/failure — port refused/conflict/failed leave
  metadata at promotion_prepared with no landing fields (I58-L)
✓ landing.test.ts :: authority — applyLanding under a held run-execution owner returns
  run_execution_active with no effects (existing withRunExecutionAuthority pattern)
```

### Invariants preserved

- Old host-promotion path still green (deleted only in card 2) — guarded by: `src/executor/__tests__/host-promotion.test.ts` unchanged.
- D112-L: landing stays outside the driven chain — guarded by: no `drive()`/scheduler edits in this card (negative space via full `npm test`).

### Verification Approach

- Inner: fake-port unit tests (`src/executor/__tests__/landing.test.ts`; add `createFakeGitHostLandPort` to fake-ports.ts).
- Middle: full `npm test` — lifecycle negative space.
- Outer: rides card 2's command flow + the frontier's FE-1197 oracle-9 walkthrough.

### Expected touched paths (tentative)

```
src/executor/
├── landing.ts                +
├── run.ts                    ~   (landed status + landedSha/landedVia/landedTarget/landedAt)
└── __tests__/
    ├── landing.test.ts       +
    └── fake-ports.ts         ~   (+ createFakeGitHostLandPort)
```

---

## Card 2 — `/brunch:land` acceptance surface + patch-path deletion [done]

> Landed 2026-07-14. Divergences: the runtime tool inventory lives in
> `src/agents/runtime/executor/active-tools.ts` (not just the registries the card
> named); registry counts updated 32→31 executor tools and 52→51 provider-facing.
> The land command registers before the commands extension, so it leads the
> command-order assertion. Claim 3's wiring half is retired by stubbed-ctx tests;
> the live TUI/RPC confirm beat remains the frontier's owned outer evidence.

### Target Behavior

Host mutation is reachable only through the `/brunch:land` command's `ctx.ui.confirm` flow — the agent retains a read-only `execute_land_preflight` tool, and the patch-apply path (`execute_host_promotion_*`, `host-promotion.ts`, `git-host-promotion-port.ts`, `acceptedCommitSha`) no longer exists.

### Cold-start reads

```
- memory/SPEC.md   — D111-L, I58-L (host-mutation clause this card re-materializes)
- memory/PLAN.md   — frontier: host-landing
- src/executor/TOPOLOGY.md — §host-promotion migration note + the RUN_MUTATION_ENTRY_INVENTORY /
  PRODUCTION_EXECUTE_TOOL_MUTATIONS registry paragraph
- src/.pi/extensions/commands/index.ts — command registration + ctx.hasUI / ctx.ui patterns
- src/app/pi-extensions.ts — ExecutionPorts wiring (gitHostPromotion → gitHostLand swap)
- node_modules/@earendil-works/pi-coding-agent ExtensionUIContext — confirm/input signatures
```

### Boundary Crossings

```
→ /brunch:land command handler (resolve run → preflightLanding → ctx.ui.confirm
  [greenfield: ctx.ui.input for target] → applyLanding with handler-constructed acceptance → notify)
→ execute_land_preflight tool (read-only, renders plan + directs the agent to /brunch:land)
→ src/app/pi-extensions.ts composition (wire createGitHostLandPort; drop gitHostPromotion)
→ deletions across executor / app / .pi tool layers
```

### Risks and Assumptions

```
- ASSUMPTION (design claim 3): a blocking ctx.ui.confirm inside a command flow carries sole
  acceptance authority in TUI and RPC surfaces.
    → IMPACT IF FALSE: acceptance UX must move to a custom component or an RPC confirm method;
      the executor helper and port are unaffected (acceptance stays a typed value).
    → VALIDATE: unit tests with stubbed ctx (confirm true → landed; false/no-UI → zero mutation);
      live TUI+RPC beat is the owned outer evidence below.
    → memory/SPEC.md §Assumptions: record as a new A-row at ln-sync (frontier Retires list, claim 3).
- RISK: tool-inventory static tests (RUN_MUTATION_ENTRY_INVENTORY / PRODUCTION_EXECUTE_TOOL_MUTATIONS)
  require exact classifications → MITIGATION: update inventories in the same red/green as the
  tool deletion/addition; they are the guard, not an obstacle.
- RISK: no-UI surfaces (print/json) can neither confirm nor land → MITIGATION: hasUI-gated
  notify("landing requires an interactive session"), zero mutation — assert in unit test.
```

### Posture check

Proving: retires claim 3's wiring half (uncertainty axis) and lights up the first user-authorized host mutation path (proof-of-life axis).

### Acceptance Criteria

```
✓ land-command.test.ts :: confirm-gated apply — stubbed ctx.ui.confirm(true) lands via
  applyLanding with handler-constructed acceptance; confirm(false) and hasUI:false perform
  zero mutation
✓ land-command.test.ts :: run resolution — explicit runId used; omitted runId resolves a sole
  promotion_prepared run; ambiguous/none notifies without mutation
✓ registry.test.ts — execute_land_preflight registered read-only; execute_host_promotion_preflight
  and execute_host_promotion_apply are gone from the registry and tool-name constants
✓ inventory static tests — PRODUCTION_EXECUTE_TOOL_MUTATIONS / RUN_MUTATION_ENTRY_INVENTORY
  reflect the new surface exactly (suite names: existing static inventory tests in
  src/executor/__tests__ / src/.pi/extensions/__tests__)
✓ `grep -r "acceptedCommitSha\|GitHostPromotionPort\|host-promotion" src --include="*.ts"`
  returns nothing outside landing lexicon — deletion is total (oracle: grep check in the
  completion report; npm run verify green proves no dangling imports)
✓ full npm test — no skipped-count increase; deleted suites removed with their subjects
```

### Invariants preserved

- I58-L host-mutation boundary: exactly one confirm-gated mutation path — guarded by: the land-command unit tests + absence of any agent-callable apply (registry test). Stop-the-line: an agent-callable mutating land tool is a respec signal.
- Promotion (`execute_promotion_prepare`) behavior unchanged — guarded by: promotion.test.ts + registry.test.ts existing leaves.

### Verification Approach

- Inner: command-handler unit tests with stubbed ctx; registry/inventory static tests.
- Middle: full `npm test` + `npm run verify`.
- Outer: owned — live `/brunch:land` walkthrough beat in TUI and RPC rides the frontier's
  FE-1197 oracle-9 re-entry (named owner: host-landing definition, Verification outer line).

### Expected touched paths (tentative)

```
src/executor/
├── host-promotion.ts                         -
├── execution-ports.ts                        ~   (- GitHostPromotionPort/PreflightPort types)
└── __tests__/
    ├── host-promotion.test.ts                -
    └── fake-ports.ts                         ~   (- createFakeGitHostPromotionPort)
src/app/
├── git-host-promotion-port.ts                -
├── pi-extensions.ts                          ~   (wire gitHostLand; drop gitHostPromotion)
└── __tests__/git-host-promotion-port.test.ts -
src/.pi/extensions/
├── executor/execute-host-promotion/          -
├── executor/execute-land-preflight/          +
├── commands/ (or executor home)              ~   (/brunch:land registration + handler + tests)
└── __tests__/registry.test.ts                ~
src/session/schema/tool-names.ts              ~
src/executor/TOPOLOGY.md                      ~   (host-promotion paragraph → landing)
```

---

## Card 3 — mode as sole authority, substrate derived [done]

> Landed 2026-07-14. The tool reads the persisted plan's mode before projection,
> derives the substrate, and persists both on RunMetadata; createRun keeps its
> internal substrate arg for tests/probes (the unrepresentability lives at the
> tool boundary, where finding 3's contradiction lived). Two brownfield tool
> tests dropped their now-nonexistent mode param; the schema test pins ['runId'].

### Target Behavior

Run creation derives the workspace substrate from the selected plan's mode (greenfield → empty_dir, brownfield → git_worktree), and no tool input can contradict it.

### Cold-start reads

```
- memory/SPEC.md   — D111-L (FE-1166 empty_dir exception), D130-L (run creation consumes admitted plan truth)
- memory/PLAN.md   — frontier: host-landing (finding-3 rationale)
- src/.pi/extensions/executor/execute-run-create/index.ts — the two params to delete
- src/executor/run.ts + launch.ts — where plan mode is readable at creation
- src/agents/prompts/executor.md — the "prefer empty_dir" conduct line to drop
```

### Boundary Crossings

```
→ execute_run_create params (delete substrate + mode inputs)
→ createRun (read plan mode; persist mode + derived substrate)
→ executor.md prompt (conduct line removal)
```

### Risks and Assumptions

```
- ASSUMPTION (design claim, recorded in frontier): no plan legitimately needs
  brownfield + empty_dir or greenfield + git_worktree.
    → IMPACT IF FALSE: derivation needs an explicit plan-authored override — a
      widening, not a rework.
    → VALIDATE: this card is the tracer; the first plan that needs the illegal
      combination fails loudly at run creation.
```

### Posture check

Proving-frontier closure move: makes finding 3's invalid combinations unrepresentable (locks in a shape); no new unknowns.

### Acceptance Criteria

```
✓ run.test.ts / run-create tests — greenfield plan → substrate empty_dir persisted;
  brownfield plan → git_worktree; mode persisted on RunMetadata
✓ execute-run-create schema test — substrate/mode params no longer exist (registry.test.ts
  or tool schema assertion)
✓ existing worktree/orchestrate suites stay green (substrate consumers unchanged)
✓ executor.md no longer contains the empty_dir preference line (grep leaf in completion report)
```

### Verification Approach

- Inner: run-create unit tests; schema assertion.
- Middle: full `npm test`.
- Outer: n/a (no user-facing surface beyond tool schema; covered by frontier walkthrough).

### Expected touched paths (tentative)

```
src/.pi/extensions/executor/execute-run-create/index.ts  ~
src/executor/run.ts                                      ~
src/executor/__tests__/run.test.ts                       ~
src/agents/prompts/executor.md                           ~
src/.pi/extensions/__tests__/registry.test.ts            ~
```

---

## Card 4 — lexicon: `GitLandPort` → `GitRunPromotionPort` [pending]

### Objective (light card)

"Land" means exactly one thing — host landing; the run-local promotion port and adapter are renamed to match.

### Cold-start reads

```
- memory/SPEC.md   — none (mechanical rename; lexicon rule in AGENTS.md)
- memory/PLAN.md   — frontier: host-landing
```

### Acceptance Criteria

```
✓ GitLandPort/createGitLandPort/git-land-port.ts renamed to GitRunPromotionPort/
  createGitRunPromotionPort/git-run-promotion-port.ts; ExecutionPorts.gitLand → gitRunPromotion
✓ `grep -rn "GitLandPort\|gitLand\b" src` returns nothing (completion-report oracle)
✓ npm run verify green (type-check proves total rename); TOPOLOGY/comment references updated
```

### Verification Approach

- Inner: type-check via `npm run fix`; full `npm test`.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/executor/execution-ports.ts, promotion.ts            ~
src/app/git-land-port.ts → git-run-promotion-port.ts     ~ (rename)
src/app/pi-extensions.ts                                 ~
src/app/__tests__/git-land-port.test.ts (rename)         ~
src/executor/__tests__/fake-ports.ts + consumers         ~
src/executor/TOPOLOGY.md                                 ~
```

### Promotion checklist

All no — rename only; no requirement/assumption/decision/invariant change beyond the lexicon closure the frontier already names.
