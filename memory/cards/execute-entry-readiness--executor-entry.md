# Executor entry readiness — concentric authority, CODE-side menu, executor conduct

Frontier: execute-entry-readiness
Status:   active
Mode:     slices
Created:  2026-07-04

## Orientation

- **Containing seam:** the landed session-orientation dialog/juncture seam (`src/.pi/extensions/session-orientation/{index,juncture,registrar}.ts` + carrier `src/session/session-orientation.ts`) and the runtime authority seam (`src/agents/runtime/{executor,elicitor}/active-tools.ts` behind `foreground-policy.ts`). The J5 CODE-side branch is explicitly reserved for this frontier at `applyModeSwitchAndOrient` in `src/.pi/extensions/commands/index.ts` (fires only on `nextMode === 'elicit'` today).
- **Frontier item:** `execute-entry-readiness` (FE-1137), branch `ln/fe-1137-executor-readiness`, stacked on the closed FE-1134 seam (`950db05c` judo cleanup landed — sequencing gate clear).
- **Volatile state:** none — no HANDOFF.md live state beyond the FE-1137 handoff doc; parent branch is inner-loop closed.
- **Main open risk:** menu content/conduct is `proving` (unwitnessed); the authority widening is a bounded near-`earned` matrix change whose main decision (full-superset membership, incl. `subagent`) is settled below.

Posture: proving (inherited from execute-entry-readiness; card 1 is the frontier's near-earned matrix half).

**Frontier cross-cutting obligations carried by every card:**

- One carrier: CODE-side outcomes extend `brunch.session_orientation`; no parallel entry type (D109-L).
- Orientation entries stay sweep-excluded process state (shared probe precedent with FE-1134).
- `orchestrator_stub` remains the honest execution boundary — no `orchestrator-tool-port` scope (cook tooling, sandboxes).
- Plan projection stays at D103-L frontier depth — must not pull `planning-process-model` forward.
- No third mode; no mode ping-pong (D98-L, grill G6b rejected).
- Kick-context traps from FE-1134 hold: kick turns bypass `before_agent_start` (directives ride the origination seed); harness boots stay on the no-UI degraded row; the 750ms juncture debounce ceiling stands.
- **Deferred decision (logged in PLAN, decide after practical testing):** orientation-choice statefulness and `continue`/`proceed` semantics. Option A (escape default `proceed`, always-kick) was chosen 2026-07-04 for flexibility; orientation entries stay one-shot kick-consumed directives, never standing style (D98-L). Walkthrough beats should capture evidence bearing on whether a standing/sticky posture or different `continue` meaning is wanted — do not resolve it inside this scope file.

## Decision-flow chart (scoping deliverable, ship-gate cross-cutting rule)

Mode-switch → assessment flow, every endpoint named:

```pseudo
flow: J5-CODE (mode switch INTO execute)
  → /brunch:mode → picker | direct switch
    ├─ picked mode == current      → notify only; no dialog, no entry, no kick
    └─ nextMode == execute         → applyModeSwitch (runtime entry + chrome refresh), then:
       ├─ no UI (print/json, hasUI false) → no dialog, no entry, no kick   [degraded row, unchanged]
       └─ dialog: CODE menu (ctx.ui.select; RPC mode keeps the 60s timeout floor)
          choices (canonical ids, extend SessionOrientationChoice):
            proceed        ← escape/timeout default (CODE-side default is proceed, not SPEC continue)
            backfill       "backfill missing information via questions [Negotiate/Ask]"
            design_first   "design the technical approach first [propose/project:design]"
            oracle_first   "design the verification approach first [propose/project:oracle]"
            project_plan   "project a frontier-level plan and proceed [project]"
          → entry: brunch.session_orientation { choice, trigger: 'mode-switch' }   [entry rule: every resolution writes]
          → kick: ALWAYS fires (all five endpoints) — origination resumeOrigin 'manual_trigger', forceSeed
            (the readiness assessment is the point of the juncture; unlike SPEC-side J5,
             the default endpoint still owes an opening turn)
          → executor opening turn = readiness assessment over seed reads
            (bands + settlement D99-L/I52-L + capability-readiness D74-L; seed already carries
             graph overview, graph-fact seed, scratchpad — no new plumbing)
            ├─ proceed      → assessment states posture (Proceed / Proceed-advisory / Negotiate / Ask);
            │                 names next safe execution step
            │                 └─ execution beyond stub → orchestrator_stub → "not implemented yet" back-out
            ├─ backfill     → accept the user's desired move, then ask scratchpad-obligation-driven
            │                 questions (present_question/request_response); NO bounce to SPEC mode
            ├─ design_first → propose/project:design skill route (grants inherited via card 1)
            ├─ oracle_first → propose/project:oracle skill route
            └─ project_plan → project skill at frontier-level depth (D103-L) → proceed → stub boundary
  switch INTO elicit: unchanged (SPEC-side J5, landed FE-1134)
```

Guard endpoint: switch-to-CODE never shows SPEC-side menu content and vice versa (leak test, card 2).

---

## Card 1 — Concentric authority as code contract (status: done)

Full scope card. Materializes the D40-L target contract; the frontier's near-earned half.

### Target Behavior

`EXECUTOR_ALLOWED_TOOL_NAMES` is a strict superset of `LIVE_ELICITOR_ALLOWED_TOOL_NAMES` with write-execution tooling (`orchestrator_stub`) executor-only, and the invariant is locked by tests.

### Cold-start reads

```
- memory/SPEC.md   — D40-L (concentric superset target), D98-L, D93-L, I49-L (delegatable-set boundary), I42-L (dev-only), D86-L (readiness never withholds a graph-write tool — bands must not gate the widened grants)
- memory/PLAN.md    — frontier: execute-entry-readiness (objective thread 1, grill G6a)
- src/agents/runtime/TOPOLOGY.md — boundary rules for runtime policy
- src/agents/runtime/{executor,elicitor}/active-tools.ts, shared/blocked-tools.ts
- src/.pi/extensions/__tests__/agent-runtime-authority-matrix.test.ts
```

### Boundary Crossings

```
→ src/agents/runtime/executor/active-tools.ts (allowlist widening)
→ src/agents/runtime/foreground-policy.ts (executor branch gains dev-allow parity if needed)
→ src/.pi/extensions/agent-runtime adapter (no change expected — dispatch already role-keyed)
→ test seam: authority-matrix + skill-manifest invariant tests
```

### Settled decisions (this card, from D40-L/G6a)

- **Full superset, not cherry-picked additions:** executor gains everything in `LIVE_ELICITOR_ALLOWED_TOOL_NAMES` — exchange tools (`present_*`, `request_response`), `mutate_graph`, scratchpad tools, reconciliation tools, `web_fetch`/`web_search`, and `subagent` — expressed structurally (executor list composed from the elicitor list + `orchestrator_stub`) so the invariant cannot drift.
- **`subagent` rides I49-L unchanged:** the delegatable-set allowlist stays the write-safety boundary; execute mode inherits the same code-owned delegatable set (no executor-specific set until a concrete need). The stale comment in `src/app/brunch-tui.ts` ("executor's excludes it") is corrected.
- **Blocked-tools floor unchanged:** executor policy applies `withoutBrunchBlockedToolNames` like the elicitor path (`bash`/`edit`/`write` stay blocked; the executor.md tool-posture line stays true).
- **Skill-manifest concentricity is already trivially true** (both prompts render the full `renderBrunchSkills()` manifest); the card only locks it with a test so a future per-role filter cannot silently break the superset.

### Risks and Assumptions

```
- RISK: widening surprises existing prompt snapshots (active-tools list is rendered into the
  executor control block) → MITIGATION: regenerate snapshots; assert the new list content, not churn.
- ASSUMPTION: full concentricity (incl. subagent/web tools) is what G6a intends, not only the
  tools named in the frontier objective.
    → IMPACT IF FALSE: allowlist churn only — single-file blast radius, cheap to narrow later
    → VALIDATE: D40-L text ("concentric superset of SPEC-mode authority") + handoff scope line
      ("EXECUTOR ⊇ LIVE_ELICITOR minus dev-only") both state the full superset; proceed.
- ASSUMPTION: no live tool registration path registers elicitor tools conditionally on mode such
  that executor activation would dangle.
    → IMPACT IF FALSE: activation no-ops (filter by registered names) — benign
    → VALIDATE: activeToolNamesFor* already intersect with registeredToolNames.
```

### Posture check (earned-flavored closure inside a proving frontier)

Closes the dual shape (D40-L specifies concentricity; code still denies it), locks the superset invariant as the completion test, retires the stale executor-excludes-subagent comment. Named closure target: the authority matrix.

### Acceptance Criteria

```
✓ superset invariant — EXECUTOR_ALLOWED_TOOL_NAMES ⊇ LIVE_ELICITOR_ALLOWED_TOOL_NAMES (structural + test)
✓ executor-only floor — 'orchestrator_stub' ∈ executor list, ∉ elicitor list (test)
✓ blocked floor — activeToolNamesForExecutor never yields bash/edit/write even when registered (test)
✓ skill superset — executor prompt skill manifest ⊇ elicitor prompt skill manifest (test over renderBrunchSkills usage)
✓ matrix row — authority-matrix test gains the executor row alongside the elicit row
```

### Verification Approach

- Inner: vitest — authority-matrix + active-tools unit tests; prompt snapshot regen; `npm run verify`.

### Expected touched paths (tentative)

```
src/agents/runtime/
├── executor/active-tools.ts                 ~
├── foreground-policy.ts                     ?  (dev-allow parity for executor)
└── shared/blocked-tools.ts                  (read-only)
src/.pi/extensions/__tests__/
└── agent-runtime-authority-matrix.test.ts   ~
src/agents/skills/__tests__/registry.test.ts ?  (skill-superset lock, if not homed in matrix test)
src/app/brunch-tui.ts                        ~  (stale comment only)
memory/SPEC.md                               ?  (D40-L thin-to-pointer once materialized)
```

---

## Card 2 — CODE-side orientation menu + J5 CODE branch (status: next)

Full scope card. Extends the one-carrier choice schema and lights the CODE-side juncture end to end.

### Target Behavior

Switching into CODE mode fires the orientation dialog with the CODE-side menu, records the resolution on `brunch.session_orientation`, and always kicks an executor opening turn whose seed directive matches the chosen route.

### Cold-start reads

```
- memory/SPEC.md   — D109-L (orientation seam + entry rules), D40-L, D78-L (context-seed content), D103-L (plan depth), D98-L, I46-L/I47-L (origination never fabricates user entries; continuity facts ride custom entries)
- memory/PLAN.md    — frontier: execute-entry-readiness (objective thread 2); decision-flow chart above
- src/session/session-orientation.ts — choice schema, entry rule, latest-wins fold, kick-staleness guard
- src/.pi/extensions/session-orientation/{index,juncture}.ts — menu, dialog fn, juncture modes
- src/.pi/extensions/commands/index.ts — applyModeSwitchAndOrient (J5 call site)
- src/agents/contexts/data-model/session-orientation.ts + seeds/origination.ts — directive rendering
- src/.pi/extensions/TOPOLOGY.md + src/session/TOPOLOGY.md — current seam state
```

### Boundary Crossings

```
→ src/.pi/extensions/commands/index.ts (mode-switch entry, execute branch)
→ src/.pi/extensions/session-orientation/ (menu descriptor + juncture kick semantics)
→ src/session/session-orientation.ts (choice-id schema extension, one carrier)
→ src/agents/contexts/ (seed directive text for new ids)
→ kick composition (existing originate/kick helpers — no new plumbing)
```

### Design points settled here (per the chart)

- **Menu descriptor, not menu fork:** `runSessionOrientationDialog`/`runAndRecordSessionOrientation`/`runJunctureForContext` take a menu descriptor (options + escape-default id) instead of hardwiring the SPEC menu; SPEC callers pass the existing menu with `continue` default, the CODE J5 caller passes the CODE menu with `proceed` default. One dialog/entry/kick flow, two menus.
- **Kick semantics:** CODE-side J5 kicks on *every* resolution (incl. `proceed`/escape) — juncture gains an always-kick variant of `'follow-choice'` (`resumeOrigin: 'manual_trigger'`, `forceSeed: true`) because the assessment turn is the juncture's product. SPEC-side semantics unchanged.
- **New canonical choice ids** `proceed | backfill | design_first | oracle_first | project_plan` extend `SessionOrientationChoice` (one union, one carrier); each gets one directive in `ORIENTATION_DIRECTIVES` (assessment-first phrasing; `project_plan` names the D103-L depth bound in its directive).

### Risks and Assumptions

```
- RISK: SPEC/CODE menu content leaks across modes → MITIGATION: guard test asserting menu option
  sets are disjoint per trigger context (switch-to-CODE never renders SPEC labels, and vice versa).
- RISK: always-kick on mode switch burns a turn the user didn't want mid-conversation
  → MITIGATION: this is the frontier's explicit design ("kick opens with an assessment");
    escape still lands on `proceed` whose directive is assessment-only — cheap turn, honest posture.
- ASSUMPTION: RPC relay handles the CODE dialog identically to SPEC (60s floor, timeout → default).
    → IMPACT IF FALSE: RPC clients block or mis-default on CODE switches
    → VALIDATE: same adaptOrientationUi path; if a walkthrough beat hits a live RPC dialog
      round-trip, record it (handoff: floor is unobserved evidence-wise)
- ASSUMPTION: executor opening turn composes correctly through the existing role-keyed
  foreground-policy dispatch when kicked from the juncture path (built/tested elicitor-side).
    → IMPACT IF FALSE: CODE kick renders an elicitor-shaped prompt — caught by injected-event test
    → VALIDATE: injected-event test asserts executor prompt/control block on the kicked turn.
```

### Posture check (proving)

Scores on proof of life (first CODE-side juncture route, dialog → entry → kick → executor turn, end to end) and uncertainty (retires "does the seam generalize past the SPEC menu" — the menu-descriptor question). Landing it is the proof.

### Acceptance Criteria

```
✓ J5-CODE fires — injected mode-switch to execute shows CODE menu (fake-pi handler-map convention)
✓ entry rule — every CODE resolution (incl. escape → proceed) writes { choice, trigger: 'mode-switch' }
✓ always-kick — kick fires on all five endpoints; seed carries the matching directive section
✓ menu guard — CODE menu labels never appear on SPEC junctures and vice versa
✓ degraded row — hasUI false: no dialog, no entry, no kick (unchanged)
✓ schema — new ids round-trip parseSessionOrientationEntryData; fold/staleness guard unchanged
```

### Verification Approach

- Inner: vitest injected-event extension tests (25-test FE-1134 precedent) + carrier unit tests.
- Middle: sweep-exclusion probe re-run over a CODE-side entry (shared with FE-1134's probe).
- Outer: live walkthrough mode-switch beat (card 3 carries the conduct half).

### Cross-cutting obligations

- One carrier; sweep exclusion; D103-L depth in the `project_plan` directive; no SPEC bounce language in directives.

### Expected touched paths (tentative)

```
src/session/session-orientation.ts                       ~
src/.pi/extensions/session-orientation/
├── index.ts                                             ~  (menu descriptors, CODE menu labels)
├── juncture.ts                                          ~  (always-kick variant, descriptor plumb)
└── __tests__/                                           ~
src/.pi/extensions/commands/index.ts                     ~  (execute branch at applyModeSwitchAndOrient)
src/.pi/extensions/__tests__/commands-runtime-switch.test.ts ~
src/agents/contexts/data-model/session-orientation.ts    ~  (directives)
src/session/TOPOLOGY.md                                  ~
src/.pi/extensions/TOPOLOGY.md                           ~
```

---

## Card 3 — Executor readiness-assessment + gentle-backfill conduct (status: pending)

Light scope card. Prompt/reference guidance inside seams cards 1–2 settle.

### Objective

The executor opens CODE mode with an honest readiness assessment (Proceed / Proceed-advisory / Negotiate / Ask over seed reads) and, when information is missing, backfills it in place — accept the user's desired move, ask what's needed, never bounce to SPEC mode — stopping honestly at the `orchestrator_stub` boundary.

### Cold-start reads

```
- memory/SPEC.md   — D74-L (capability-readiness), D99-L/I52-L (settlement), D98-L, D40-L, D94-L (band ladder), D86-L/I31-L (readiness never withholds tools or bars work), I56-L (scratchpad non-authoritative)
- memory/PLAN.md    — frontier: execute-entry-readiness (objective thread 3, grill G6b)
- src/agents/references/readiness-bands.md — §Elicitor Use postures (the model this extends)
- src/agents/prompts/executor.md + src/agents/runtime/executor/compose-prompt.ts
```

### Acceptance Criteria

```
✓ executor.md opens with assessment conduct: state posture from seed reads before acting
✓ readiness-bands.md postures section speaks to both roles (executor inherits Proceed/Negotiate/Ask;
  §Elicitor Use generalized or an executor subsection added — one canonical statement, no duplication)
✓ backfill conduct named: accept the move, gather via questions/scratchpad obligations, no mode bounce
✓ stub back-out named: execution beyond orchestrator_stub states "not implemented yet"
✓ executor control block reflects the widened posture (stale "narrow" phrasing corrected); snapshots regen
```

### Verification Approach

- Inner: prompt snapshot tests; `npm run verify`.
- Outer: live walkthrough thin-seed vs rich-seed beats — thin asks/negotiates, rich proceeds; menu→conduct
  routing evidence in session JSONL. Generative-route evidence (design/oracle/plan) shares the
  `walkthrough-batch-2` seed-variant gate (verification-blocked, not build-blocked).

### Cross-cutting obligations

- Bands stay heuristic; authority is the executable contract (no band-gating language).
- D103-L depth bound restated where the plan-projection conduct is described.

### Assumption dependency

`None` hard; conduct quality is the frontier's declared `proving` half — witnessed by the outer loop, not assumed.

### Expected touched paths (tentative)

```
src/agents/prompts/executor.md                       ~
src/agents/references/readiness-bands.md             ~
src/agents/runtime/executor/compose-prompt.ts        ~  (control-block phrasing)
src/agents/runtime/elicitor/__snapshots__/           ?  (only if shared snapshot files)
```

### Promotion checklist

All no: no requirement change (D40-L/D74-L already state the contract), no new assumptions, no design reversal, no new seam invariant, ≤2 seams, seams familiar from cards 1–2. Stays light.

---

## Sequence discipline

1 → 2 → 3. No card depends on implementation *findings* of an earlier one (card 2's menu routes and card 3's conduct are fixed by the frontier/grill regardless of how card 1's widening lands); cards 2 and 3 do depend on card 1's grants being present at runtime, which is a landed-artifact dependency, not a findings dependency. If card 2's always-kick decision surprises (e.g. resume-debt interaction), stop and re-scope card 3 before building it.
