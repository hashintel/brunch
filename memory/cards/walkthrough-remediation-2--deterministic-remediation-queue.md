# FE-1187 deterministic remediation queue

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-16

## Orientation

- **Containing seam:** the Brunch-owned Pi TUI/session boundary, from active-branch conduct state through menu/chrome/Ask adapters into provider-visible prompting and transcript read-back.
- **Frontier:** `walkthrough-remediation-2` / FE-1187 on `ln/fe-1187-remediation-4`; every card remains on this plan-level issue and branch.
- **Volatile handoff state:** D98-L/D109-L/D119-L/D120-L are canonical but not materialized; the mixed `brunch.session_orientation`, old shell/menu copy, and incomplete deterministic Ask proof remain live.
- **Main risk:** the production write paths for carrier cutover, shell/menu treatment, orientation rendering, and Ask inputs overlap heavily under `src/.pi/`; they are one sequential execution context, not parallel delegations.

**Posture: proving (inherited from `walkthrough-remediation-2`).**

Sequence discipline:

1. Cards 1–4 are sequentially legible from settled decisions; none depends on findings from an earlier card.
2. Primary write overlap is intentional inside this one `Mode: slices` file. Do not delegate these cards concurrently.
3. Stop after any card if implementation reveals a new public seam, changes a canonical decision, or widens beyond the tentative manifest; return to `ln-plan` rather than guessing through fog.
4. Continue lexical closure is deliberately not pre-scoped: its closed current-surface inventory depends on the production vocabulary left by Cards 1–4.
5. The disjoint KA handoff note lives in `memory/cards/walkthrough-remediation-2--ka-data-model-handoff.md` and may build independently.

Frontier-level obligations carried by every card:

- Chart every decision path and endpoint before implementation; FE-1187 remains the closing member of `deterministic-orientation`.
- Preserve active-root-to-leaf branch semantics, provider-auth kick gating, seed-before-kick delivery, D37-L exchange boundaries, and the two-mode/concentric-authority contract.
- Deterministic inner/middle proof is acceptance. User-dependent live-provider, manual, qualitative, and both-theme evidence remains owned by `walkthrough-remediation-2` / FE-1187 and re-enters only at the triggers named below.
- R6, R12, Impact Ledger/web walkthroughs, A43-L semantic quality/latency evidence, KA-owned O7–O9, and the paused consolidated outer checkpoint are not implementation license in this file.

---

## Card 1 · Persistent elicitation style and one-shot process moves — `done`

Build note (2026-07-16): direct cutover landed with separate active-branch style and kick-fresh process-move carriers, persistent Specify prompt projection, conservative model-independent availability, and lifecycle narrowing. The implementation did not need `src/app/pi-extensions.ts` or `src/app/brunch-tui.ts`; it additionally updated the existing tier-2 harness comment because the retired carrier name was part of the direct-cutover negative-space inventory.

### Target Behavior

Every Specify elicitor turn follows the active branch’s last selected elicitation style, while explicit execution actions are carried only as one-shot process moves.

### Cold-start reads

- `memory/SPEC.md` — D24-L, D37-L, D40-L, D78-L, D98-L, D109-L, D119-L, D120-L; A43-L; I59-L, I62-L, I64-L
- `memory/PLAN.md` — frontier `walkthrough-remediation-2`, arc `deterministic-orientation`
- `HANDOFF.md` — direct-cutover negative space and A43-L separation
- `src/session/TOPOLOGY.md` — active-branch contract, current mixed carrier, origination choreography
- `src/.pi/extensions/TOPOLOGY.md` — menu/juncture ownership, auth gate, seed-before-kick, explicit command paths
- `src/agents/runtime/TOPOLOGY.md` and `src/agents/runtime/elicitor/TOPOLOGY.md` — Pi-independent prompt-policy boundary
- `docs/praxis/pi-types.md` — Pi-owned custom-entry and extension-context types

### Boundary Crossings

```text
→ Pi active session branch (`SessionManager.getBranch()`)
→ `brunch.elicitation_style` / `brunch.process_move` parse-fold-append seams
→ automatic or explicit orientation juncture
→ origination seed for one fresh process move
→ foreground Specify prompt composition for persistent style
→ provider turn
```

### Decision flow

```text
session start
├── new branch + Specify + no style + UI/auth
│   └── open menu
│       ├── first/changed style → append elicitation_style → originate/kick
│       ├── current style       → no style append          → originate/kick
│       ├── available move      → append process_move      → seed once → kick once
│       └── Escape/timeout      → no append                → no move/kick
├── new branch + established style → no menu → normal boot origination
└── resumed/existing branch         → no menu → normal resume-debt decision

operational-mode switch
└── settle old turn → append mode → open target-mode menu
    ├── style / available move → corresponding endpoint above
    └── Escape/timeout         → no carrier write or orientation kick

/brunch:consult
└── open current-mode menu explicitly
    ├── style / available move → corresponding endpoint above
    └── Escape/timeout         → no carrier write or orientation kick

session switch / tree navigation / assistant abort
└── restore projected branch state → no orientation menu or orientation-owned kick

later provider turns
├── Specify → latest active-branch style appears in every elicitor prompt
└── fresh move → one origination directive; next kick consumes it
```

Required deterministic fallback boundary:

```yaml
specify:
  interrogate: available
  disambiguate: available
  propose: available
  move_to_execution: unavailable
execute:
  prepare_execution: available
  compile_plan: unavailable
  execute_plan: unavailable
```

The fallback is deliberately conservative. A caller may later supply a richer availability result, but carrier, authority, prompt, and no-write behavior may not depend on A43-L’s optional model-backed path.

### Risks and Assumptions

- **RISK:** deleting `session-orientation.ts` reveals more consumers than the known menu/origination/prompt seams.
  **MITIGATION:** use compile/test breakage as the direct-cutover fix list; add no alias, legacy parser, or dual carrier.
- **RISK:** same-style selection needs to kick without duplicating style history.
  **MITIGATION:** keep dialog outcome separate from carrier mutation and test no-write plus correctly styled prompting.
- **RISK:** removing tree/abort orientation handlers removes unrelated lifecycle behavior.
  **MITIGATION:** delete only orientation registration; preserve runtime, continuity, and resume-debt handlers with named regression suites.
- **RISK:** latest-entry reconstruction makes a process move accidentally persistent.
  **MITIGATION:** only `brunch.process_move` uses kick-relative freshness; style deliberately ignores kick freshness.
- **RISK:** the existing menu descriptors tempt the cutover to make availability resolution part of carrier or prompt ownership.
  **MITIGATION:** accept only a pure caller-supplied availability value at the menu boundary and prove the fallback above with no evaluator import; if that boundary cannot remain pure, stop rather than making A43-L load-bearing.

### Posture check

- **Stabilizes:** D98-L/D109-L active-branch session-to-prompt semantics.
- **Retires:** uncertainty that persistent style and consumed moves can share origination choreography without sharing a carrier.
- **Lights up:** style selection → branch reconstruction → later Specify prompt.

If deterministic availability cannot stay independent from semantic preflight, stop and return to `ln-plan`; do not absorb A43-L into this card.

### Acceptance Criteria

- ✓ `src/session/__tests__/elicitation-style.test.ts` — exactly `interrogate | disambiguate | propose` parse; invalid/legacy values fail closed; active-branch sibling rivals and intervening kicks prove last valid style persists.
- ✓ `src/session/__tests__/process-move.test.ts` — exactly `move_to_execution | prepare_execution | compile_plan | execute_plan` parse; a move is fresh only after the latest kick; the next kick consumes it; style entries never satisfy or overwrite the move fold.
- ✓ `src/agents/runtime/elicitor/__tests__/compose-live-prompt.test.ts` and `src/.pi/extensions/__tests__/agent-runtime-system-prompts.test.ts` — current style appears in every Specify prompt, survives later kicks/recomposition, changes only after a later active-branch style entry, and never becomes role/capability/target-plane state.
- ✓ `src/.pi/extensions/session-orientation/__tests__/juncture.test.ts` — style change or move append precedes its directed seed/kick; same-style selection writes no duplicate; Escape/timeout, unavailable moves, and append failure start no move/kick; carriers do not interfere.
- ✓ `src/.pi/extensions/session-orientation/__tests__/registrar.test.ts` — only style-less new-session entry and operational-mode switch auto-open; established startup, resume, existing-session switch, tree navigation, and abort do not; provider-auth and no-UI behavior remain honest.
- ✓ `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts` — mode switch and `/brunch:consult` reopen the current-mode menu; dismissal writes nothing; `/brunch:continue` resumes work without synthesizing style or move entries.
- ✓ `src/agents/contexts/seeds/__tests__/origination.test.ts` and `src/session/__tests__/originate-assistant-turn.test.ts` — only a fresh process move renders one provider directive; persistent style comes from foreground prompt composition.
- ✓ `src/session/__tests__/exchange-projection.test.ts` and `src/projections/session/sweep-watermark.test.ts` — both new carriers stay outside structured exchanges/capture sweep; `brunch.session_orientation` has no compatibility path.
- ✓ `src/.pi/extensions/session-orientation/__tests__/index.test.ts` — the fallback value is consumable without a model/preflight dependency and exposes exactly the safe subset above.
- ✓ `npm run verify` — direct cutover compiles, all focused/default tests pass, and no mixed-carrier reference survives the build.

### Invariants preserved

- Active product state is reconstructed from Pi’s active branch, never append order — guarded by: sibling-rival carrier tests and `src/session/__tests__/active-branch-reader-inventory.test.ts`.
- Operational mode remains the only top-level role/authority state — guarded by: `src/.pi/extensions/__tests__/agent-runtime-authority-matrix.test.ts` and prompt-control assertions.
- No provider turn fires without resolvable auth — guarded by: registrar, juncture, and command runtime-switch suites.
- Live junctures deliver seed before kick and fabricate no user/exchange row — guarded by: origination and juncture suites.
- **Stop the line:** active-branch, provider-auth, seed-before-kick, or no-fabricated-user failures require respec/replan, not fixture updates.

### Verification Approach

- **Inner:** parser/fold, branch-rival, prompt-composition, menu, juncture, and origination tests.
- **Middle:** extension integration, capture-exclusion suites, and `npm run verify`.
- **Outer:** deferred — owner `walkthrough-remediation-2` / FE-1187; re-enter style persistence/resume/tree evidence after Cards 1–3 land and the user supplies a seeded live-TUI walkthrough. Outer evidence is not acceptance for this card.

### Cross-cutting obligations

- Retire generic strategy/lens/method runtime state, persisted lens selection, Enhance mode, `continue`/`dismissed` pseudo-choices, and legacy `proceed`/`backfill` ids rather than aliasing them.
- Keep menu evaluation read-only and non-authoritative; only the user’s selected carrier append may write.
- Reconcile `src/session/TOPOLOGY.md`, `src/.pi/extensions/TOPOLOGY.md`, and `src/agents/runtime/TOPOLOGY.md` in this cutover. Route canonical SPEC/PLAN reconciliation through `ln-sync`; the existing PLAN pointer already names this execution file.
- Do not implement A43-L’s model call, terminal shell styling, the complete Ask proof, or any outer checkpoint here.

### Expected touched paths (tentative)

```text
src/session/
├── session-orientation.ts                              -
├── elicitation-style.ts                                +
├── process-move.ts                                     +
├── originate-assistant-turn.ts                         ~
├── TOPOLOGY.md                                         ~
└── __tests__/
    ├── session-orientation.test.ts                      -
    ├── elicitation-style.test.ts                        +
    ├── process-move.test.ts                             +
    ├── originate-assistant-turn.test.ts                 ~
    ├── exchange-projection.test.ts                      ~
    └── active-branch-reader-inventory.test.ts           ?
src/agents/
├── contexts/
│   ├── data-model/session-orientation.ts                -
│   ├── data-model/process-move.ts                       +
│   └── seeds/
│       ├── origination.ts                               ~
│       └── __tests__/origination.test.ts                ~
└── runtime/
    ├── TOPOLOGY.md                                      ~
    ├── foreground-policy.ts                             ~
    └── elicitor/
        ├── compose-live-prompt.ts                        ~
        └── __tests__/compose-live-prompt.test.ts         ~
src/.pi/extensions/
├── TOPOLOGY.md                                          ~
├── agent-runtime/system-prompts/index.ts                ~
├── commands/index.ts                                    ~
├── __tests__/
│   ├── agent-runtime-system-prompts.test.ts              ~
│   └── commands-runtime-switch.test.ts                  ~
└── session-orientation/
    ├── index.ts                                         ~
    ├── juncture.ts                                      ~
    ├── registrar.ts                                     ~
    └── __tests__/
        ├── index.test.ts                                 ~
        ├── juncture.test.ts                              ~
        └── registrar.test.ts                             ~
src/projections/session/sweep-watermark.test.ts          ~
src/app/pi-extensions.ts                                 ?
src/app/brunch-tui.ts                                    ?
```

---

## Card 2 · Terminal-adaptive chrome and reusable menu shell — `next`

### Target Behavior

The live TUI presents one terminal-adaptive Brunch shell whose operational inputs, navigation menus, telemetry footer, command affordance, and new-session introduction have deterministic visual identities.

### Cold-start reads

- `memory/SPEC.md` — D22-L, D35-L, D39-L, D40-L, D52-L, D104-L, D116-L, D119-L; I59-L
- `memory/PLAN.md` — `walkthrough-remediation-2` terminal-adaptive shell and editor/footer/intro/spec-menu rows
- `HANDOFF.md` — exact shell identity and deferred outer-evidence boundary
- `src/.pi/components/TOPOLOGY.md` — reusable Pi TUI component ownership and direct/harness test tiers
- `src/.pi/extensions/chrome/TOPOLOGY.md` and `src/.pi/extensions/TOPOLOGY.md` — shell installation and command ownership
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — Ask input collectors and border contracts
- `src/dev/TOPOLOGY.md` — component-preview role
- `docs/praxis/pi-types.md` — `ExtensionUIContext` ownership for editor/widget/footer seams

### Boundary Crossings

```text
shipped theme JSON + activated product state
→ reusable Brunch menu/input/chrome components
→ chrome, workspace, orientation, and Ask Pi adapters
→ Pi TUI render + keyboard dispatch
→ tagged render/harness/component-preview oracles
```

### Decision flow

```text
surface request
├── persistent editor / Ask / questionnaire / Other / comment input
│   └── project current active-branch mode
│       ├── Specify → cyan mode border
│       └── Execute → magenta mode border
├── workspace/spec menu or orientation menu
│   └── reusable presentation shell → blue menu identity
├── stable footer
│   └── [web URL when present] + model_info | thinking_level | context_percentage
│       └── transient status/working text remains outside stable footer fields
└── launch
    ├── new spec/session → install one borderless, non-transcript welcome card once
    └── resume/switch/reload → no welcome card
```

### Risks and Assumptions

- **RISK:** replacing custom terminal foregrounds with defaults/ANSI roles degrades HTML export.
  **MITIGATION:** validate terminal tokens separately from concrete `export` colors; do not reuse terminal defaults in export fields.
- **RISK:** a reusable menu component absorbs workspace/orientation decisions.
  **MITIGATION:** share presentation, key handling, choice rows, and border identity only; keep startup and in-session decision models in their existing owners.
- **RISK:** Other/comment still use Pi’s unbordered `ctx.ui.input`.
  **MITIGATION:** route those nested inputs through a small Brunch-owned mode-bordered collector while preserving Back/Escape semantics for Card 4.
- **RISK:** footer simplification accidentally “fixes” R12’s split model source without diagnosis.
  **MITIGATION:** test projection from supplied telemetry only; do not alter model-resolution ownership or working-message lifecycle in this card.
- **ASSUMPTION:** the already-shipped public seams used by `BrunchEditorComponent`, `ConsultMenuComponent`, exchange pickers, and chrome header/footer installation remain sufficient for this composition-only shell cutover.
  **IMPACT IF FALSE:** Card 2 stops before private API adoption; Cards 3–4 keep their settled menu and collector contracts and must not absorb a chrome-topology experiment.
  **VALIDATE:** existing direct/harness suites prove each seam before the card begins; extend those same oracles rather than introducing a new Pi integration path.

### Posture check

- **Stabilizes:** D35-L’s one Brunch-owned chrome projection and the shared component boundary.
- **Lights up:** shipped theme → real Pi component → deterministic tagged render for every active input and menu class.
- **Retires:** uncertainty that terminal adaptation can preserve HTML export and visual role distinctions without live-human acceptance.

### Acceptance Criteria

- ✓ `src/dev/component-preview/__tests__/theme.test.ts` — both shipped themes use terminal default/ANSI 0–15 roles for ordinary foreground/semantic colors; only an explicit subtle-background/small-gray allowlist remains custom; HTML `export` colors remain concrete.
- ✓ `src/dev/component-preview/__tests__/theme-testbed.test.ts` — both tagged themes emit cyan Specify borders, magenta Execute borders, blue menu-shell borders, and distinct muted/default roles without depending on visual judgment.
- ✓ `src/.pi/components/__tests__/brunch-editor.test.ts` and `brunch-editor.harness.test.ts` — editor top border owns current mode, bottom border owns spec title, and border identity follows current mode.
- ✓ `src/.pi/extensions/__tests__/ask-runtime-mount.test.ts`, `src/.pi/extensions/exchanges/shared/required-input.test.ts`, and focused component tests — free-text, single/multi, questionnaire, Other, and comment inputs all receive the current mode border; nested input treatment preserves cancellation/back signaling.
- ✓ `src/.pi/components/__tests__/menu-shell.test.ts`, `consult-menu.test.ts`, and `workspace-dialog.test.ts` — workspace and orientation menus consume one reusable blue presentation shell while retaining separate decision models and stable choice ids.
- ✓ `src/.pi/extensions/__tests__/chrome.test.ts` — stable dim footer contains only conditional web URL plus `model_info | thinking_level | context_percentage`; mode/spec labels remain on the editor; extension status and working messages are not folded into those stable fields.
- ✓ `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts`, `registry.test.ts`, and `src/app/__tests__/brunch-tui.test.ts` — `/brunch:spec-menu` and `alt+s` invoke the workspace picker; `/brunch:menu` and `ctrl+shift+b` are absent, not aliases.
- ✓ `src/.pi/extensions/__tests__/chrome.test.ts` and `src/app/__tests__/brunch-tui.test.ts` — a new spec/session installs exactly one borderless non-transcript welcome card teaching spec-menu, mode, consult/continue, model, and thinking controls plus “low/medium thinking often works best”; resume/switch/reload installs none and appends no session entry.
- ✓ `npm run verify` — tagged render, harness, command registry, default tests, and build pass.

### Invariants preserved

- Chrome receives one activated state value and does not read workspace/web/db state — guarded by: chrome unit tests and topology reconciliation.
- Components return decisions but do not mutate product state — guarded by: component test harnesses and dependency direction.
- R12 remains diagnostic work; supplied telemetry is rendered honestly without changing its source — guarded by: injected-telemetry chrome tests.
- HTML export colors stay concrete and are not treated as terminal-adaptation work — guarded by: theme parser tests.

### Verification Approach

- **Inner:** theme-token allowlist, pure render projections, command registry tests, and direct component input tests.
- **Middle:** `VirtualTerminal` harnesses, component-preview tagged-theme checks, app composition tests, and `npm run verify`.
- **Outer:** deferred — owner `walkthrough-remediation-2` / FE-1187 Theme closure gate; re-enter both-theme/live-terminal judgment only after Cards 2–3 land and the user supplies that walkthrough. It is not acceptance here.

### Cross-cutting obligations

- Use mostly ANSI 0–15/default terminal roles; no broad custom palette redesign.
- Keep startup and in-session menu decisions separate despite the shared shell.
- Do not diagnose/fix R12, implement R6 result visuals, or perform both-theme human review.
- Update co-located component/chrome/extension topology in the same build.

### Expected touched paths (tentative)

```text
src/.pi/
├── themes/
│   ├── brunch-dark.json                                 ~
│   └── brunch-light.json                                ~
├── components/
│   ├── menu-shell.ts                                    +
│   ├── consult-menu.ts                                  ~
│   ├── workspace-dialog/component.ts                    ~
│   ├── mode-border-theme.ts                             ~
│   ├── brunch-editor.ts                                 ~
│   ├── chrome-header.ts                                 ~
│   ├── chrome-shortcuts.ts                              ~
│   ├── exchange-answer-editor.ts                        ~
│   ├── exchange-decision-picker.ts                      ~
│   ├── exchange-questionnaire.ts                        ~
│   ├── multi-choice-picker.ts                           ~
│   ├── mode-input.ts                                    +?
│   ├── welcome-card.ts                                  +?
│   ├── TOPOLOGY.md                                      ~
│   └── __tests__/
│       ├── menu-shell.test.ts                            +
│       ├── consult-menu.test.ts                          ~
│       ├── workspace-dialog.test.ts                      ~
│       ├── brunch-editor.test.ts                         ~
│       ├── brunch-editor.harness.test.ts                 ~
│       └── exchange-*.test.ts                            ~
└── extensions/
    ├── chrome/
    │   ├── index.ts                                     ~
    │   └── TOPOLOGY.md                                  ~
    ├── commands/
    │   ├── index.ts                                     ~
    │   └── names.ts                                     ~
    ├── exchanges/
    │   ├── ask.ts                                       ~
    │   ├── shared/required-input.ts                      ~
    │   ├── shared/required-input.test.ts                 ~
    │   └── TOPOLOGY.md                                  ~
    ├── TOPOLOGY.md                                      ~
    └── __tests__/
        ├── chrome.test.ts                                ~
        ├── commands-runtime-switch.test.ts               ~
        ├── ask-runtime-mount.test.ts                     ~
        └── registry.test.ts                              ~
src/app/
├── brunch-tui.ts                                        ~
├── pi-extensions.ts                                     ~
└── __tests__/brunch-tui.test.ts                         ~
src/dev/component-preview/
├── registry.ts                                          ~
├── theme-testbed.ts                                     ~
└── __tests__/
    ├── theme.test.ts                                    ~
    └── theme-testbed.test.ts                            ~
```

---

## Card 3 · Deterministic orientation rendering and availability — `queued`

### Objective

Orientation menus render the current style and only the caller-supplied mode-appropriate choices, with an independently safe deterministic fallback.

### Cold-start reads

- `memory/SPEC.md` — D74-L, D98-L, D109-L, D119-L, D120-L; A43-L; I50-L, I62-L, I64-L
- `memory/PLAN.md` — `walkthrough-remediation-2` orientation semantics/menu and readiness-tracer boundary
- `HANDOFF.md` — fixed fallback constraints and optional-preflight separation
- `src/.pi/components/TOPOLOGY.md` — shared menu-shell presentation contract after Card 2
- `src/.pi/extensions/TOPOLOGY.md` — orientation ownership after Card 1
- `src/agents/references/readiness-bands.md` — graph-fact/readiness semantics and non-authority rule

### Decision flow

```text
build current-mode menu(currentStyle, availability?)
├── availability absent/error/timeout result
│   └── deterministic fallback
│       ├── Specify → all three styles; no Move to execution
│       └── Execute → Prepare execution only
└── explicit availability supplied
    ├── Specify → all styles + Move to execution iff available
    └── Execute → Prepare + Compile/Execute iff each is available

render
├── current style → marked + initially selected; reselect writes no style entry
├── each row → short label + dim description
└── Escape → visible dismiss/custom-instruction help → no write/move/kick
```

### Acceptance Criteria

- ✓ `src/.pi/extensions/session-orientation/__tests__/index.test.ts` — labels are exactly **Work via intent / examples / proposals**, **Move to execution**, **Prepare execution**, **Compile a plan**, and **Execute the plan**, each with the D109-L/D120-L description and stable id.
- ✓ `src/.pi/components/__tests__/consult-menu.test.ts` — current style is visibly marked and initially selected; every choice description uses the dim channel; Escape help says dismissal returns control for another instruction and no explicit Wait row renders.
- ✓ `src/.pi/extensions/session-orientation/__tests__/index.test.ts` — absent/failure-shaped availability uses the conservative fallback; explicit availability may reveal only its corresponding process move; styles are never gated.
- ✓ `src/.pi/extensions/session-orientation/__tests__/juncture.test.ts` — fallback/availability evaluation itself appends no transcript entry, writes no graph/session truth, and cannot change operational mode; only a selected style/move reaches Card 1’s append path.
- ✓ `src/dev/component-preview/__tests__/registry.test.ts` — deterministic preview entries cover Specify with current style, Specify with Move available, Execute fallback, and Execute fully available through the shared blue menu shell.
- ✓ `npm run verify` — deterministic menu/render and integration suites pass without a model/preflight module.

### Verification Approach

- **Inner:** pure menu-descriptor/availability matrix and component render/input tests.
- **Middle:** juncture no-effect assertions, component-preview registry contract, and `npm run verify`.
- **Outer:** deferred — owner `walkthrough-remediation-2` / FE-1187 Orientation outer evidence; re-enter label comprehension/readiness salience only after Card 3 lands and the user supplies a live TUI review. No live-provider questionnaire or Execute O7–O9 conduct is acceptance here.

### Cross-cutting obligations

- A43-L remains optional and unbuilt. This card accepts the deterministic fallback and the input boundary, not semantic quality or ≤3-second live-provider performance.
- Menu availability is advisory/read-only, never a stored grade, transcript fact, graph gate, or authority gate.
- Preserve one semantic identity per Execute move; KA retains outer conduct evidence O7–O9.

### Assumption dependency

`None` — correctness is fully determined by settled menu vocabulary, caller-supplied availability, and the mandatory fallback. A43-L is explicitly not required.

### Expected touched paths (tentative)

```text
src/.pi/
├── components/
│   ├── consult-menu.ts                                  ~
│   └── __tests__/consult-menu.test.ts                    ~
└── extensions/session-orientation/
    ├── index.ts                                         ~
    ├── juncture.ts                                      ~
    └── __tests__/
        ├── index.test.ts                                 ~
        └── juncture.test.ts                              ~
src/dev/component-preview/
├── registry.ts                                          ~
└── __tests__/registry.test.ts                            +
src/.pi/components/TOPOLOGY.md                           ~
src/.pi/extensions/TOPOLOGY.md                           ~
```

---

## Card 4 · Deterministic full Ask matrix — `queued`

### Target Behavior

Every supported Ask interaction deterministically reaches a self-contained answered or cancelled terminal through the same production collectors and read-back contracts.

### Cold-start reads

- `memory/SPEC.md` — requirements 17 and 24; D37-L, D38-L, D104-L–D106-L, D110-L, D116-L, D119-L, D125-L; I57-L
- `memory/PLAN.md` — `walkthrough-remediation-2` deterministic Ask matrix and explicit outer exclusions
- `src/exchanges/TOPOLOGY.md` and `src/exchanges/schemas/TOPOLOGY.md` — Ask schema/projection/read-back ownership
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — production collectors, nested Back/Escape, cancellation guidance
- `src/.pi/components/TOPOLOGY.md` — direct vs `VirtualTerminal` component proof
- `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` — TUI/editor/broker mechanism distinctions

### Boundary Crossings

```text
validated Ask params
→ Pi adapter collector
→ Brunch custom component / nested input
→ canonical Ask detail projection
→ provider-visible formatter + Pi JSONL/session exchange read-back
```

### Ask state machine

```text
open Ask
├── free text
│   ├── submit non-empty [+ optional comment] → answered text terminal
│   └── root Escape                           → cancelled terminal + standalone notice
├── single select
│   ├── listed [+ optional comment]           → answered choice terminal
│   ├── Other → nested text → comment         → answered Other terminal
│   └── nested Escape/Back                    → root picker; root Escape → cancelled
├── multi select
│   ├── listed set [+ optional comment]       → answered choices terminal
│   ├── Other → nested text → comment         → answered choices terminal
│   └── nested Escape/Back                    → root picker with selections restored
└── mixed questionnaire (free + single + multi)
    ├── Next / Back restores keyed answers → final Submit → one aggregate terminal
    └── root Escape                        → cancelled; no accepted-abstract carrier

terminal
├── formatAsk(details) contains question + selected/write-in/comment/keyed answers
└── session projection reconstructs the same terminal from JSONL-like entries
```

### Risks and Assumptions

- **RISK:** tests pass by calling projection constructors instead of mounted production collectors.
  **MITIGATION:** drive each matrix row through `createAskTool`/`collectAskResponse` and real `TUI(VirtualTerminal)` where focus/input routing matters.
- **RISK:** nested Escape is confused with root cancellation.
  **MITIGATION:** assert Back restores picker state and only root Escape creates a cancelled terminal.
- **RISK:** result read-back only snapshots formatter text and misses persisted detail drift.
  **MITIGATION:** compare schema-valid terminal details, formatter text, and session exchange projection for the same fixture.
- **ASSUMPTION:** existing production collector seams cover the full matrix; this card is proof/hardening, not a new interaction protocol.
  **IMPACT IF FALSE:** closing the matrix would require a protocol decision outside this settled hardening slice.
  **VALIDATE:** first red is the complete mounted matrix; if closing it needs schema/protocol widening, stop and route to `ln-plan`.

### Posture check

- **Stabilizes:** the D116-L one-terminal Ask surface across component, adapter, detail, and read-back boundaries.
- **Retires:** uncertainty that existing tests cover Other/comment nesting, mixed questionnaire Back/Escape, cancellation recovery, and self-contained terminal replay as one matrix.
- **Lights up:** deterministic mounted input → durable detail → formatter/session read-back without provider or human judgment.

### Acceptance Criteria

- ✓ `src/.pi/extensions/__tests__/ask-runtime-mount.test.ts` — mounted free text, listed single, listed multi, and one mixed free/single/multi questionnaire submit schema-valid terminal details through production collectors.
- ✓ `src/.pi/extensions/__tests__/ask-response-export.test.ts` and `exchanges-present-request.test.ts` — single and multi Other write-ins, required/optional comments, nested Escape/Back, restored selections, and final answer semantics use the shared collector path.
- ✓ `src/.pi/extensions/__tests__/ask-runtime-mount.test.ts` — root Escape cancels each ordinary mode and questionnaire; cancelled digest questionnaire creates no submitted/accepted-abstract carrier.
- ✓ `src/.pi/extensions/__tests__/commands-runtime-switch.test.ts` plus `exchanges-present-request.test.ts` — declared-continuation cancellation remains recoverable through `/brunch:continue`; standalone cancellation names only `/brunch:consult` and `/brunch:mode`; neither emits persistent footer status.
- ✓ `src/agents/contexts/exchanges/__tests__/ask.test.ts`, `src/session/__tests__/exchange-projection.test.ts`, and `src/exchanges/projections/__tests__/ask-questionnaire.test.ts` — every answered fixture reads back question, listed choices, Other text, comment, and ordered keyed questionnaire answers from self-contained details; malformed/unknown/duplicate/missing-required answers fail closed.
- ✓ `src/session/__tests__/digest-questionnaire-lifecycle.test.ts` — submit/cancel/supersession/duplicate transitions preserve I57-L and only the final submitted digest-referencing terminal enters capture.
- ✓ `npm run verify` — full deterministic matrix, existing exchange family contracts, default tests, and build pass.

### Invariants preserved

- `ask` remains the only interactive terminal; no generic form protocol or resurrected request tool — guarded by: exchange family completeness/registry suites.
- Trust-boundary validation remains schema-owned; constructors do not parse self-created values — guarded by: schema source-boundary tests.
- Answered details are self-contained and capture consumes only accepted terminals — guarded by: formatter, projection, and I57-L lifecycle suites.
- Headless/RPC ceilings for nested Other/comment remain declared; this card does not widen broker answer shape — guarded by: existing headless discovery contracts.

### Verification Approach

- **Inner:** schema/projection/formatter and scripted collector tests over every matrix row.
- **Middle:** real `VirtualTerminal` mounted components, JSONL-like session reconstruction, lifecycle model tests, and `npm run verify`.
- **Outer:** deferred — owner `walkthrough-remediation-2` / FE-1187 Ask outer evidence; re-enter the live-provider TUI questionnaire and public-RPC live witness only after this deterministic matrix is green and the user supplies provider/manual evidence. Neither witness is acceptance here.

### Cross-cutting obligations

- Use Card 2’s mode-bordered input components and preserve working-indicator bracketing.
- Do not implement R6’s four-state result visuals, a React questionnaire form, provider conduct evidence, or public-RPC live evidence.
- Production changes are allowed only to close a deterministic matrix red inside settled D116-L seams; protocol widening stops the sequence.

### Expected touched paths (tentative)

```text
src/.pi/
├── components/
│   ├── exchange-answer-editor.ts                        ?
│   ├── exchange-decision-picker.ts                      ?
│   ├── exchange-questionnaire.ts                        ?
│   ├── multi-choice-picker.ts                           ?
│   └── __tests__/exchange-*.test.ts                     ~
└── extensions/
    ├── exchanges/
    │   ├── ask.ts                                       ?
    │   ├── ask/continuation.ts                          ?
    │   └── shared/required-input.ts                     ?
    └── __tests__/
        ├── ask-runtime-mount.test.ts                     ~
        ├── ask-response-export.test.ts                   ~
        └── exchanges-present-request.test.ts             ~
src/agents/contexts/exchanges/__tests__/ask.test.ts       ~
src/exchanges/
├── projections/__tests__/ask-questionnaire.test.ts       ~
└── schemas/__tests__/questionnaire.test.ts               ?
src/session/__tests__/
├── exchange-projection.test.ts                           ~
└── digest-questionnaire-lifecycle.test.ts                ~
```

---

## Intentionally unscoped follow-through

- **Continue lexical closure** remains owned by `walkthrough-remediation-2` / FE-1187, but is not a fifth pre-scoped card. Its exact current-surface inventory and touched-path manifest depend on the production vocabulary left by Cards 1–4, so pre-scoping it would fail the hard anti-speculation gate.
- **Re-entry trigger:** after Card 4 is green, inventory current UI/control copy, ids/directives, prompts, tests, and current docs/topology; then run `ln-scope` for the bounded D119-L closure before the consolidated outer checkpoint.
- Archives, historical evidence, promoted transcripts, fixture prose, dependencies, the TypeScript `continue` keyword, workspace resume copy, and `/brunch:continue`’s actual resume semantics remain explicit negative space.
- **A43-L semantic/model preflight** is also unscoped. Re-enter only through a separate proving scope that can bind deterministic latency and quality acceptance; no card in this queue depends on it.
