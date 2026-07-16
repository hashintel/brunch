# Automation & observability DX consolidation

Frontier: automation-observability-dx
Status:   active
Mode:     slices
Created:  2026-07-16

## Orientation

- Containing seam: the dev tooling / observability surface — `src/dev/**`, the dev-mode extensions under `src/.pi/extensions/dev-mode/`, the product CLI's dev flags in `src/app/`, and the praxis docs that describe them. Not product runtime behavior except deleting the dead `--dev-tools` surface.
- Frontier: `automation-observability-dx` (FE-1208, reshaped 2026-07-16 from `consequential-fact-discovery-tracer`; same issue and branch `ln/fe-1208-traces-and-evals-1`).
- Volatile state: `HANDOFF.md` still describes the pre-redirect campaign focus; it is superseded once this scope file is active and gets overwritten by card 4. The parked campaign card (`consequential-fact-discovery-tracer--warrant-ablation-campaign.md`) is historical context, not the active scope.
- Main risk: the `--dev-tools` deletion silently breaking a consumer the grep sweep missed (e.g. the transcript-context tool-name set, tier-2 harness plumbing, or the parked campaign runner's compile). Mitigation: card 1's acceptance is the full `npm run verify` gate plus an explicit residual-reference grep.
- Cross-cutting obligations inherited from the frontier: do not touch the `--mode web` seam (parallel branch); preserve the `--evaluation-arm` / `evaluationDirectiveAblation` seam (it belongs to the parked evaluator, not `--dev-tools`); traces remain dev/eval artifacts, never product truth; protect untracked `galarza.md`.

Posture: earned (inherited from `automation-observability-dx`).

Sequence order: card 1 → 2 → 3 → 4. Docs land last (card 4) so they describe the post-cleanup state. Cards 1–3 are independent in substance; the ordering only prevents doc churn.

---

## Card 1 — Kill `--dev-tools` and the opt-in query-tool channel

Status: done
Weight: full

### Target Behavior

No Brunch launch path parses, plumbs, or acts on `--dev-tools`; the `brunch_session_query` / `brunch_introspect_query` extensions and the `devAllowedToolNames` opt-in channel no longer exist; passive `.brunch/debug/*` mirroring is unchanged.

### Cold-start reads

```
- memory/SPEC.md   — D69-L (introspection tap; narrows to passive-only), the
                     "Conversational introspection" capability row (retire), D70-L/D71-L
                     (artifact routing / BRUNCH_DEV — unchanged)
- memory/PLAN.md   — frontier: automation-observability-dx (§Deletes / retires, §Locks in)
- src/dev/README.md — §"What --dev-tools changes" (the surface being deleted; both tools
                     are already flagged "candidate for retirement")
- src/.pi/extensions/dev-mode/introspection/TOPOLOGY.md — the passive tap that stays
```

### Boundary Crossings

```
→ product CLI argv (src/app/brunch.ts)
→ TUI launch options (src/app/brunch-tui.ts)
→ extension composition root (src/app/pi-extensions.ts)
→ dev-mode extensions (src/.pi/extensions/dev-mode/)
→ agent-runtime tool policy (devAllowedToolNames channel → elicitor active-tools)
→ dev launcher / harnesses (src/dev/dev-cli.ts, tier-2-harness.ts, campaign runner)
```

### Risks and Assumptions

- RISK: a missed consumer of the tool names or flag breaks at runtime, not compile time → MITIGATION: after edits, grep living code and docs for `dev-tools`, `developerTools`, `devAllowedToolNames`, `brunch_session_query`, `brunch_introspect_query`; only dated `testing/walkthroughs/*` and `docs/archive/*` references may remain.
- RISK: deleting the channel accidentally widens tool exposure (the opt-in list also constrained what dev tools could activate) → MITIGATION: `registry.test.ts` and elicitor `active-tools.test.ts` keep asserting the product tool set; the removal must leave the product allowlist byte-identical.
- ASSUMPTION: nothing outside this repo invokes `brunch --dev-tools`.
    → IMPACT IF FALSE: a colleague's script warns/fails on an unknown flag.
    → VALIDATE: pre-release posture (prototype); flag was dev-only and documented only in this repo's docs. Acceptable breakage.

### Posture check

Earned closure: **deletes/retires** the dual observability story (`--dev-tools` query tools vs passive mirrors) and the whole `devAllowedToolNames` seam; **locks in** passive `.brunch/debug/*` mirrors as the only ambient dev observability — nothing prompt-affecting is dev-gated anymore.

### Acceptance Criteria

```
✓ npm run verify — full gate green after removal; no unexplained skipped-test increase
✓ src/app/__tests__/brunch.test.ts — usage output no longer mentions --dev-tools; unknown-flag
  behavior for `--dev-tools` is parseArgs fail-loud (no bespoke handling)
✓ src/app/__tests__/brunch-tui.test.ts — debug-mirror-by-default assertions stay green with the
  queryTools gating assertions removed
✓ src/.pi/extensions/__tests__/registry.test.ts — product tool registration set unchanged;
  no introspectionQueryTools branch remains
✓ src/agents/runtime/elicitor/__tests__/active-tools.test.ts — active-tool selection has no
  devAllowedToolNames parameter; product policy assertions unchanged
✓ deleted: src/.pi/extensions/dev-mode/{session-query,introspect-query}/ and their test files
  (dev-mode-session-query.test.ts, dev-mode-introspect-query.test.ts,
  fixtures/dev-mode-tool-schemas.pre-fe-1163.ts)
✓ residual-reference grep — `rg 'dev-tools|developerTools|devAllowedToolNames|brunch_session_query|brunch_introspect_query'`
  over src/, docs/ (excluding docs/archive/), TESTING_PLAN.md, memory/SPEC.md returns only
  the parked-card mention and sanctioned history
```

### Invariants preserved

- Passive `.brunch/debug/*` mirroring (system-prompt, entry-contents, origination, tool-contents, trajectory.ndjson) fires in source/dev TUI runs with no flag — guarded by: `dev-mode-introspection.test.ts`, `brunch-tui.test.ts` debug-mirror assertions.
- `--evaluation-arm` → `evaluationDirectiveAblation` still wires through `dev-cli` → `runBrunchCli` → composition root — guarded by: `dev-cli.test.ts` and the prompt-differential tests in `compose-live-prompt.test.ts`.
- Product tool policy (D40-L allowlists) unchanged — guarded by: `registry.test.ts`, `active-tools.test.ts`. Stop-the-line: a diff in the product tool set is a defect, not a fixture update.
- Product subagents remain non-dev-gated — guarded by: `subagents` registry assertions; `agent-runner-port.ts` error text updated to drop the `--dev-tools` mention without changing the gating.

### Verification Approach

- Inner: `npm run verify` — the deletion's regression net; trimmed suites named above.
- Outer: none needed — no user-facing surface gained; the deleted surface was unused by declaration.

### Expected touched paths (tentative)

```
src/app/
├── brunch.ts                                          ~
├── brunch-tui.ts                                      ~
├── pi-extensions.ts                                   ~
├── agent-runner-port.ts                               ~
└── __tests__/{brunch,brunch-tui,agent-runner-port}.test.ts  ~
src/.pi/extensions/
├── dev-mode/index.ts                                  ~
├── dev-mode/session-query/                            -
├── dev-mode/introspect-query/                         -
├── agent-runtime/runtime/index.ts                     ~
├── agent-runtime/system-prompts/index.ts              ~
├── TOPOLOGY.md                                        ~
├── subagents/TOPOLOGY.md                              ~
└── __tests__/
    ├── dev-mode-session-query.test.ts                 -
    ├── dev-mode-introspect-query.test.ts              -
    ├── fixtures/dev-mode-tool-schemas.pre-fe-1163.ts  -
    └── {registry,dev-mode-introspection,agent-runtime-system-prompts}.test.ts  ~
src/agents/runtime/
├── foreground-policy.ts                               ~
└── elicitor/active-tools.ts (+ test)                  ~
src/projections/session/transcript-context.ts          ~
src/dev/
├── dev-cli.ts (+ test)                                ~
├── tier-2-harness.ts (+ test)                         ~
├── consequential-fact-campaign-runner.ts              ~   (drop '--dev-tools' arg; keeps compiling)
├── README.md                                          ~
└── TOPOLOGY.md                                        ~
src/.pi/README.md                                      ~
docs/praxis/seeded-dev-rpc.md                          ~
TESTING_PLAN.md                                        ~
memory/SPEC.md                                         ~   (D69-L narrowing; retire the
                                                            "Conversational introspection" row)
```

---

## Card 2 — Trajectory report joins the `.brunch/debug/` convention

Status: done
Weight: light

### Objective

`writeTrajectoryReport` emits its joined report beside its input: `<workspace>/.brunch/debug/trajectory.json` + `trajectory-report.md` (latest-wins, like the other mirrors) instead of repo-root `.fixtures/scratch/trajectory/<run-id>/`.

### Cold-start reads

```
- memory/SPEC.md   — D70-L (dev-loop artifact routing — this narrows the trajectory report
                     out of the scratch path into the workspace debug cache)
- memory/PLAN.md   — frontier: automation-observability-dx (§Acceptance, trajectory leaf)
- src/dev/TOPOLOGY.md — trajectory/report ownership; .brunch/debug contract
```

### Acceptance Criteria

```
✓ src/dev/__tests__/trajectory-report.test.ts — output lands at
  <workspace>/.brunch/debug/trajectory.json and trajectory-report.md; a second run overwrites
  (latest-wins); the report still validates run identity and correlation
✓ src/dev/__tests__/dev-cli.test.ts — `dev-cli trajectory` prints the new output path
✓ npm run verify — parked consequential-fact-campaign-runner call site compiles against the
  new signature/paths
✓ docs — src/dev/README.md "Debug mirrors" tree and src/dev/TOPOLOGY.md list
  trajectory.json + trajectory-report.md; the .fixtures/scratch/trajectory mention is removed
```

### Verification Approach

- Inner: `npm run verify`; trajectory-report + dev-cli suites.
- Outer: none — artifact relocation inside the dev loop.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/dev/
├── trajectory-report.ts (+ test)                  ~
├── dev-cli.ts (+ test)                            ~
├── consequential-fact-campaign-runner.ts          ~
├── README.md                                      ~
└── TOPOLOGY.md                                    ~
src/.pi/extensions/dev-mode/introspection/TOPOLOGY.md  ?
```

---

## Card 3 — Remove `cli-cmux`; settle the TUI-driving priority order

Status: pending
Weight: light

### Objective

The superseded `cli-cmux` skill is removed (user-sanctioned; user ports it to their global collection) and `docs/praxis/manual-testing.md` names exactly one driving order with no competing advice.

### Cold-start reads

```
- memory/PLAN.md   — frontier: automation-observability-dx (§Deletes / retires, §Locks in)
- docs/praxis/manual-testing.md — §Setup items 1–3 (the hedge being removed)
```

### Acceptance Criteria

```
✓ .agents/skills/cli-cmux/ deleted (tracked files; reaches .claude/skills via the symlink —
  no second delete)
✓ docs/praxis/manual-testing.md — the "/cli-cmux remains useful" hedge is gone; priority
  order reads: pi-interactive-shell (host-capable) → npm run tui-driver (sandbox/headless);
  web observed via agent-browser, CDP for console/network detail
✓ docs/praxis/manual-testing.md — one line states zigpty is reached only indirectly through
  the pinned pi-interactive-shell package (no direct integration)
✓ npm run check — check:markdown-links and check:skills green after the deletion
```

### Verification Approach

- Inner: `npm run check` (link + skill-set checks are the oracle for skill removal).

### Assumption dependency

None.

### Expected touched paths (tentative)

```
.agents/skills/cli-cmux/           -
docs/praxis/manual-testing.md      ~
```

---

## Card 4 — One door per audience: docs, evaluator de-wire, handoff retirement

Status: pending
Weight: light

### Objective

A dev-/PM-facing doc gives each audience one entry door, the parked evaluator disappears from the advertised DX surface (code untouched), and the stale `HANDOFF.md` is superseded.

### Cold-start reads

```
- memory/PLAN.md   — frontier: automation-observability-dx (§Two use cases, §Acceptance
                     documentation leaf) and agent-as-user-comparison (the unbuilt piece the
                     doc must name honestly)
- docs/praxis/manual-testing.md — the seeded walkthrough workflow the PM door builds on
- src/dev/README.md — the launcher/rpc surface the dev cheatsheet draws from
```

### Acceptance Criteria

```
✓ docs/praxis/comparison-runs.md exists and covers: (a) the PM seed door end to end
  (npm run dev-cli → menu → seed → web sidecar; where richness shows), (b) the dev
  deterministic-read cheatsheet (rpc / print / mutate / export), (c) the agent recipe
  (pi-interactive-shell / tui-driver + trajectory join for evidence), (d) the agent-as-user
  comparison approach — mission/concept catalog, matched budget, "ready" stop condition —
  stating plainly that the general actor is unbuilt and owned by `agent-as-user-comparison`,
  and that seeds are not usable for cross-product comparison
✓ cross-links — src/dev/README.md and docs/praxis/manual-testing.md link to the new doc;
  npm run check:markdown-links green
✓ evaluator de-wire — src/dev/README.md and src/dev/TOPOLOGY.md no longer advertise
  `evaluate-consequential-fact` / the campaign runner as active DX; each keeps a one-line
  parked pointer to PLAN §Later `warrant-ablation-campaign`; the subcommands stay functional
  (dev-cli.test.ts unchanged on their behavior)
✓ HANDOFF.md — overwritten with a thin superseded note pointing at PLAN
  (automation-observability-dx) and this scope file, per its own retirement rule
✓ npm run check — green
```

### Verification Approach

- Inner: `npm run check` (links, skills, fmt).
- Outer: one PM-shaped dry run of the documented seed door (launch → observe → read), witnessed against the new doc rather than tribal knowledge — owned by the frontier's acceptance (`automation-observability-dx` §Verification, outer); record the result per `docs/praxis/manual-testing.md` §Findings ledger discipline.

### Cross-cutting obligations

- The doc must keep the two use cases distinct (seed-based intra-product vs mission-driven cross-product); conflating them is the failure mode this frontier exists to prevent.
- Do not delete `HANDOFF.md` outright — overwrite to supersede; the user may delete later.

### Assumption dependency

None.

### Expected touched paths (tentative)

```
docs/praxis/comparison-runs.md     +
docs/praxis/manual-testing.md      ~
src/dev/README.md                  ~
src/dev/TOPOLOGY.md                ~
HANDOFF.md                         ~   (overwrite with superseded note)
```
