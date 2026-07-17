# Direct comparison-harness control

Frontier: operator-comparison-workflow
Status:   active — autonomous implementation complete; owned outer smoke outstanding
Mode:     single
Created:  2026-07-17

Card weight: full

## Orientation

- Containing seam: the project-local `/compare-specs` operator prompt and its saved-mission/report artifact flow; this is developer/operator tooling, not Brunch product runtime.
- Frontier: `operator-comparison-workflow` (FE-1215) on `ln/fe-1215-saved-mission-comparison`.
- Volatile state: no `HANDOFF.md`; retained run `minimal-petri-net-editor-20260717T132344Z` is immutable failure/design evidence from the nested-actor attempt.
- Main risk: correcting the nested actor topology must not leak the private mission, weaken one-shell-at-a-time control, rewrite historical evidence, or accidentally claim the later full multi-harness witness.
- Cross-cutting obligations: preserve D70-L artifact roles, D134-L/I67-L control and portability, and the explicit distinction between this approachable sequential workflow and FE-1210's rigorous fresh-per-lane campaign recipe.

Posture: proving (inherited from `operator-comparison-workflow`).

## Target Behavior

A stock-Pi `/compare-specs` run reaches a normal-width Brunch Specify exchange through one top-level simulated-user session and one direct comparison-harness shell.

## Cold-start reads

- `memory/SPEC.md` — D70-L, D134-L, I67-L; Lexicon entries `Agent-as-user mission`, `Comparison harness`, and `Comparison report`; Verification Design `Saved-mission comparison witness`
- `memory/PLAN.md` — frontier `operator-comparison-workflow`; dependency `saved-mission-comparison-witness`
- `.pi/prompts/compare-specs.md` — current operator procedure to replace in place
- `testing/comparisons/missions/README.md` — reusable mission/operator contract
- `docs/praxis/comparison-runs.md` — approachable-versus-rigorous workflow boundary
- `docs/praxis/manual-testing.md` — interactive-shell control, evidence, cleanup, and findings-ledger discipline
- `.fixtures/runs/agent-as-user-comparison/minimal-petri-net-editor-20260717T132344Z/report.md` — operator-observed failure evidence; read only
- Pi prompt-template docs: `/Users/lunelson/.local/share/mise/installs/npm-earendil-works-pi-coding-agent/0.80.7/lib/node_modules/@earendil-works/pi-coding-agent/docs/prompt-templates.md`

## Boundary Crossings

```text
→ stock Pi discovers and expands project prompt `/compare-specs`
→ operator chooses/reviews a saved private mission through ordinary text
→ invoking top-level Pi session holds the mission and acts as the simulated user
→ top-level session opens one selected harness directly through `interactive_shell`
→ Brunch controller runs from the repository root with the isolated target passed via `--workspace`; generic harness spawns run in the isolated target cwd
→ harness receives only approved minimal framing plus natural user messages
→ focused Brunch interaction settles or fails honestly
→ top-level session cleans up the direct harness and reports its terminal status
```

## Risks and Assumptions

- RISK: shared top-level context can carry knowledge from an earlier harness into a later one → MITIGATION: disclose lane order/shared actor context, drive only one harness at a time, and make no rigorous isolation claim; FE-1210 retains the isolated campaign recipe.
- RISK: deleting synthetic provider/actor smoke turns could hide real launch failures → MITIGATION: retain bounded filesystem/adapter checks for selected harnesses and report provider/model failure at the real launch.
- RISK: terminology cleanup rewrites historical evidence → MITIGATION: future artifacts use `harness-setup.md`, but the retained `contender-setup.md` snapshot and every file under the failed run remain byte-stable.
- RISK: a custom question tool becomes an accidental hidden dependency → MITIGATION: write every choice/approval so typed ordinary text is sufficient; a structured tool may only enhance presentation.
- ASSUMPTION: one top-level Pi session can drive a direct Brunch shell at normal host dimensions without an actor subprocess.
  → IMPACT IF FALSE: D134-L's chosen approachable topology and the later saved-mission witness would need replanning.
  → VALIDATE: the focused stock-Pi → `/compare-specs` → direct Brunch smoke in this card.
- ASSUMPTION: mission-grounded natural messages are sufficient to preserve the private-mission boundary without a separate actor process.
  → IMPACT IF FALSE: the approachable workflow cannot safely reuse one top-level actor across sequential harnesses.
  → VALIDATE: inspect the smoke's exact target-visible framing/opening and confirm no mission text, path, or wholesale payload enters the Brunch cwd/session.

## Posture Check

This slice is the tracer rather than a study step:

- **Lights up:** actual `/compare-specs` discovery → plain-text setup → top-level simulated user → one direct Brunch shell → visible Specify exchange.
- **Stabilizes:** I67-L's one-actor/one-shell/private-mission boundary and D134-L's stock-Pi portability rule.
- **Falsifies cheaply:** whether removing the nested actor restores a usable normal-width Brunch interaction without weakening mission isolation.

The full Brunch + Claude report/readability and mission-revision immutability proof remains outside this tracer and is owned by `saved-mission-comparison-witness` after this remediation lands and an operator session is scheduled.

## Acceptance Criteria

Autonomous correction is complete and statically verified. The card remains active because the live tool surface has no `interactive_shell`; the focused smoke is owned by the top-level/operator session and re-enters after the autonomous correction commit.

- ✓ **FE-1215 prompt-contract audit** — `.pi/prompts/compare-specs.md` says the invoking top-level Pi session is the sole simulated-user actor, permits at most one direct `interactive_shell` comparison harness at a time, and makes ordinary typed text sufficient for all choices and approvals.
- ✓ **FE-1215 negative-space audit** — reusable prompt/mission guidance contains no nested/fresh actor launch, required `ask_user_question`, per-run synthetic provider conversation, `contender` vocabulary, or assumed-PM role; run:

  ```sh
  if rg -n 'fresh harness-level Pi actor|actor process|actor subprocess|ask_user_question|contender|simulated user/PM|synthetic provider|throwaway provider' \
    .pi/prompts/compare-specs.md testing/comparisons/missions/README.md; then
    exit 1
  fi
  ```

- ✓ **Selected-harness preflight audit** — the prompt checks only the chosen harness's filesystem/adapter prerequisites before launch, distinguishes Brunch's repository-root controller cwd from the isolated `--workspace` target and generic harness target cwd, and reports provider/model failure honestly at the real harness launch; direct review against D134-L.
- ✓ **Private-mission carrier audit** — only the top-level session receives the whole mission; every harness receives only approved minimal framing plus the natural opening and later mission-grounded answers; direct prompt/README review and focused-smoke transcript inspection.
- ✓ **Artifact-name and history audit** — future setup snapshots are named `harness-setup.md`, historical `contender-setup.md` remains untouched, and no retained failed-run byte changes:

  ```sh
  git diff --exit-code f7e13568924a56eb5203c3dc1ecb0f04a9667c7b -- \
    .fixtures/runs/agent-as-user-comparison/minimal-petri-net-editor-20260717T132344Z
  ```

- ✓ **Approachable/rigorous documentation audit** — operator docs distinguish the shared top-level sequential `/compare-specs` workflow from FE-1210's fresh-per-lane rigorous campaign and make no isolation equivalence claim.
- ✓ **Targeted Markdown check** — modified prompt/operator Markdown passes:

  ```sh
  npx remark \
    .pi/prompts/compare-specs.md \
    testing/comparisons/missions/README.md \
    testing/comparisons/missions/minimal-petri-net-editor.md \
    docs/praxis/comparison-runs.md \
    --quiet --frail
  ```

- ◐ **Focused stock-Pi smoke — outstanding owned outer gate** — a fresh project-trusted Pi session discovers the real `/compare-specs` template, completes mission/run choices using ordinary text without a custom question tool, selects Brunch only, opens exactly one direct normal-width Brunch shell whose controller process runs from the Brunch repository root while its isolated comparison target is supplied through `--workspace <fresh-target-cwd>`, sends only approved framing plus the mission's natural opening, observes one Brunch Specify response/exchange beyond the startup splash, and leaves no harness/background process after cleanup. **Owner:** top-level/operator session. **Trigger:** after the autonomous prompt/docs correction commit. Follow `docs/praxis/manual-testing.md`; record any new defect in `TESTING_FINDINGS.md` with an owner/disposition.
- ✓ **Repository gate** — `npm run verify` and `npm run check:promoted-run-paths` pass after the prompt/docs correction.

## Invariants Preserved

- Private mission text, file path, and wholesale payload never enter a comparison-harness context or cwd — guarded by: prompt/README audit plus focused-smoke target-visible transcript inspection.
- At most one comparison-harness interactive shell is live — guarded by: prompt contract plus focused-smoke background-session/process inspection.
- Historical run inputs, transcripts, target outputs, and report remain immutable — guarded by: baseline `git diff --exit-code` acceptance command.
- Editable mission, run-specific harness setup, scratch assembly, and retained evidence remain distinct D70-L artifact roles — guarded by: prompt/README path audit and `npm run check:promoted-run-paths`.
- The approachable workflow does not claim FE-1210's fresh-per-lane isolation, matched budgets, blinding, or adjudication — guarded by: `docs/praxis/comparison-runs.md` review.
- No automatic winner, fixed rubric, generic runner/framework, package, or extracted skill is introduced — guarded by: touched-path manifest and prompt negative-space review.
- Stop the line: if direct-shell control still cannot expose a usable Brunch interaction at normal dimensions, do not weaken I67-L or update the failed fixture as passing evidence; route back through `ln-plan` with the observed topology failure.

## Verification Approach

- Inner: targeted Markdown validation, D134-L positive/negative prompt audits, retained-run byte differential, and `npm run verify` — prove the authored contract is valid, current, and does not disturb existing evidence or repository checks.
- Middle: none; this slice changes a project prompt/operator procedure rather than product runtime, and static surrogate orchestration would recreate the false proof the real-entry smoke exists to avoid.
- Outer: this card owns the focused stock-Pi/direct-Brunch smoke through the real `/compare-specs` entry point. The full Brunch + Claude run, report-usefulness judgment, aggregate notification, and mission-revision snapshot proof remain owned by `saved-mission-comparison-witness`, re-entering only after this branch lands and an operator session is scheduled.

## Cross-cutting Obligations

- Preserve D134-L/I67-L single-level control and plain-text portability.
- Preserve D70-L's editable mission / scratch / retained-evidence separation.
- Preserve private mission isolation and exact target-visible disclosure.
- Keep selected-harness setup separate from mission content.
- Keep FE-1210's rigorous campaign recipe unchanged and explicitly distinct.
- Do not modify or rename any file in the retained failed run.
- Do not create a helper state machine, generic harness abstraction, package, skill, automatic judge, or browser workspace in this slice.
- Any outer-smoke finding must receive a terminal disposition or a named owner plus re-entry trigger in `TESTING_FINDINGS.md`.

## Expected Touched Paths (Tentative)

```text
.pi/prompts/
└── compare-specs.md                                              ~
testing/comparisons/missions/
├── README.md                                                     ~
└── minimal-petri-net-editor.md                                  ?
docs/praxis/
└── comparison-runs.md                                            ~
memory/
├── PLAN.md                                                       ~
└── cards/
    └── operator-comparison-workflow--direct-harness-control.md   -  (consume on completion)
TESTING_FINDINGS.md                                               ?  (only if the smoke reveals a finding)
.fixtures/runs/agent-as-user-comparison/
└── minimal-petri-net-editor-20260717T132344Z/                    !  read-only; byte-stable
```
