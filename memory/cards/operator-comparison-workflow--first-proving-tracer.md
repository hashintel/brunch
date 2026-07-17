# FE-1215 real-prompt comparison tracer

Frontier: operator-comparison-workflow
Status:   active
Mode:     single
Created:  2026-07-17

## Orientation

- **Containing seam:** project-local Pi operator tooling over FE-1210’s rendered-state actor, target adapters, document acquisition, cleanup, and retained comparison evidence.
- **Frontier:** `operator-comparison-workflow` / FE-1215 on `ln/fe-1215-saved-mission-comparison`; this scope remains one slice on that issue and branch.
- **Volatile state:** no `HANDOFF.md`; the only authorized pre-existing work is this untracked scope file. The retained `lockers-r1-20260716` run is immutable prior evidence, not a template to rewrite.
- **Main risk:** `.pi/prompts/compare-specs.md` is Markdown interpreted by a real Pi agent. A test-owned lifecycle or dry-run state machine would be a surrogate implementation and could pass while `/compare-specs` never conducts the workflow. The autonomous slice therefore authors and statically reviews the actual production prompt, then stops at a real-Pi behavioral gate.

**Posture: proving (inherited from `operator-comparison-workflow`).**

Frontier-level obligations carried by this slice:

- Preserve D70-L’s artifact roles: editable product-neutral missions live under `testing/comparisons/missions/`; ephemeral lane work and assembly live under `.fixtures/scratch/comparisons/`; deliberate immutable run snapshots, target outputs, and reports live under `.fixtures/runs/agent-as-user-comparison/`. Missions are not Brunch seeds.
- Keep the approachable workflow distinct from the rigorous frozen-packet procedure. Do not add matched budgets, blinded or scripted judgment, a fixed rubric, an automatic winner, statistics, an unattended campaign, a database/service, or a generic harness abstraction.
- `.pi/prompts/compare-specs.md` is the one v1 production entry point for create, revise, review, and run. Reuse the FE-1210 actor cadence and adapters without extracting a new skill, package, parser, checker, or runner before real use demonstrates the need.
- Prompt instructions must fail closed behind explicit approval of the complete mission, common framing, and exact per-harness additions; require a fresh actor context and target cwd per lane; preserve failures and target-authored documents honestly; notify only after all selected lanes resolve; and produce a free-form no-winner report.
- Static checks prove only the prompt’s discoverable shape and visible instructions. Only an actual fresh-Pi `/compare-specs` invocation may witness conversational conduct, launch, isolation, revision semantics, notification timing, target authorship, or report usefulness.

## Scope boundary and sequence discipline

1. This file scopes one autonomous build slice: author the complete production prompt and the minimum mission-home README needed by an operator or maintainer who opens a saved mission directly.
2. `docs/praxis/comparison-runs.md` already has a clear reader and owns the separate rigorous campaign procedure. It is read-only context here; the approachable workflow’s complete operating instructions belong in the prompt, so this slice does not modify that document.
3. Do not add `src/dev/__tests__/compare-specs-prompt.test.ts`. No executable production lifecycle seam exists for it to call, and no parser/checker or helper state machine should be introduced merely to test prose.
4. After the autonomous slice passes static review and repository checks, the owned real-Pi gate below blocks further autonomous scoping. Findings may reshape the prompt or orchestration, so there is no prewritten Card 2.
5. Existing-mission revise/rerun remains required before frontier closure, including proof that revision changes only future runs and leaves historical snapshots unchanged. It may extend the first witness only if first-run findings do not call the flow into question; otherwise it is the next findings-dependent scope.
6. `memory/PLAN.md` still permits a temporary-directory fixture or scripted dry run as middle evidence. The binding coordinator review narrows that verifier here because no executable production lifecycle seam exists; whether PLAN should be reconciled through `ln-sync` remains for coordinator review, not this scope-only write.

---

## Card 1 · Complete real project prompt and mission-home guidance — `done`

Completed 2026-07-17. Direct prompt/README review, targeted Remark, and `npm run verify` passed. The owned Fresh-Pi behavioral gate remains pending and blocks further autonomous scope; it was not executed or simulated.

### Target Behavior

The project exposes a discoverable `/compare-specs` prompt whose visible instructions completely specify the saved-mission comparison workflow for a real Pi operator.

### Full-card cold-start reads

- `memory/SPEC.md` — requirement 24; A5-L; D70-L; lexicon `Comparison mission` / `Comparison report`; Verification Design §Operator-led cross-product comparisons
- `memory/PLAN.md` — frontier: `operator-comparison-workflow`
- Pi `docs/prompt-templates.md` — project prompt location, frontmatter, arguments, and non-recursive discovery
- `.agents/skills/agent-as-user-comparison/SKILL.md` — fresh-lane actor boundary, rendered-state cadence, target adapters, document acquisition, failure retention, and cleanup
- `docs/praxis/comparison-runs.md` — rigorous/approachable boundary and the existing Brunch, Claude Code, and Cursor adapter facts; read only
- `.fixtures/README.md` — seed/workbench/run/scratch roles and deliberate promotion/path-portability discipline
- `docs/praxis/manual-testing.md` — real interactive capability preflight, artifact retention, cleanup, and owned findings discipline
- `.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/manifest.md` — prior actor/adapter lessons only; do not copy its frozen campaign or judgment ceremony

### Boundary Crossings

```text
→ project Pi prompt discovery (`.pi/prompts/compare-specs.md`)
→ `/compare-specs [mission-id-or-path]`
→ create / revise / review / run instructions
→ editable readable mission under `testing/comparisons/missions/`
→ complete contender setup and explicit approval instructions
→ fresh actor + isolated target adapter instructions per lane
→ scratch assembly and immutable run snapshot/output instructions
→ aggregate completion notification and free-form `report.md` instructions
```

### Required prompt content

A direct cold read must find one coherent operator procedure covering:

```text
invocation
├── no argument: offer create | revise | run
└── mission id/path: resolve only inside mission home; offer review | revise | run

create / revise
├── ask one material question at a time
├── collect opening ask, simulated-user knowledge/reveal policy,
│   useful-document expectation, contenders, shared framing,
│   and exact addition for each selected harness
├── save ordinary-language Markdown, not controller YAML
└── revision changes the editable mission only

approval / run
├── display the complete saved mission and exact contender setup
├── explicit reject/revise/ambiguity: do not launch
└── explicit approval
    ├── allocate collision-safe scratch and run identities
    ├── copy the exact approved mission/setup as immutable run input
    ├── run selected lanes sequentially if desired
    │   ├── fresh harness-level Pi actor context and fresh target cwd per lane
    │   ├── visible ready | running | waiting | finished | failed status
    │   ├── approved target-visible packet only; private reveal material stays out
    │   ├── FE-1210 rendered-state cadence and selected target adapter
    │   ├── acquire, never reconstruct or improve, target-authored output
    │   └── retain failures and clean actor/target processes
    ├── notify only after every selected lane reaches finished or failed
    └── assemble one run
        ├── exact approved mission/setup snapshot
        ├── every target-authored document that exists
        ├── lane outcome and cleanup notes explaining missing output
        └── report.md with setup, outcomes, relative document links/content,
            empty/free-form Operator observations, and no automatic winner/rubric
```

The prompt must also state that later mission revisions affect future runs only and never rewrite an existing run directory or its approved snapshot.

### Risks and Assumptions

- **RISK:** static prose checks are mistaken for proof that the agent obeys the prose.  
  **MITIGATION:** label the static proof boundary in acceptance and stop at the owned real-Pi gate; do not build a surrogate lifecycle fixture.
- **RISK:** one large prompt is incomplete or unreliable in real conversation.  
  **MITIGATION:** make the complete procedure directly reviewable in one production file, then let first-run findings decide whether the wording or orchestration needs revision. Do not preemptively extract machinery.
- **RISK:** mission guidance duplicates the production procedure and drifts.  
  **MITIGATION:** keep `testing/comparisons/missions/README.md` limited to its current reader: a human browsing or hand-revising saved missions. It names the mission fields, path/role, `/compare-specs` entry point, and immutable-history rule; operational choreography stays in the prompt.
- **RISK:** the operator environment cannot supply genuinely fresh Pi actor contexts for both lanes.  
  **MITIGATION:** the real-Pi gate requires separately identifiable fresh actor sessions and fails closed if the capability is absent; do not reinterpret coordinator discipline or distinct target cwds as actor isolation.
- **ASSUMPTION:** one project prompt can conduct the approachable workflow using existing Pi and FE-1210 capabilities without a helper package or runner.  
  → **IMPACT IF FALSE:** the prompt/orchestration boundary and all downstream scope must be reshaped.  
  → **VALIDATE:** the owned fresh-Pi create → approve → two-contender → report witness below; static review does not validate this assumption.

### Posture check

- **Lights up:** the real project-level `/compare-specs` production entry point and its complete instruction path, rather than a test-only surrogate.
- **Stabilizes:** the human-readable editable-mission versus immutable-run-snapshot boundary and the three canonical mission/scratch/run homes.
- **Locates uncertainty:** whether a real Pi agent can reliably conduct the packaged workflow and obtain fresh actor contexts. The owned behavioral gate, not autonomous tests, is the tracer that can retire or reshape that uncertainty.

### Acceptance Criteria

- ✓ **Pi prompt-template documentation + direct frontmatter review** — `.pi/prompts/compare-specs.md` is at Pi’s non-recursive project prompt home, has valid `description` and optional `[mission-id-or-path]` argument hint frontmatter, and uses Pi-supported argument expansion; this proves the discoverable template shape, not runtime conduct.
- ✓ **Prompt content cold-read checklist (“Required prompt content” above)** — the production file visibly names every create/revise/review/run input, decision, guardrail, actor/adapter step, status, notification, report section, and artifact instruction required by this card; this proves instruction presence only.
- ✓ **Canonical-path and negative-space direct review** — the prompt names exactly `testing/comparisons/missions/`, `.fixtures/scratch/comparisons/`, and `.fixtures/runs/agent-as-user-comparison/`; it does not instruct writes outside those roles, absolute workstation paths, seed substitution, controller YAML, a fixed rubric, an automatic winner, a scripted/API judge, a generic runner, or a new package/skill.
- ✓ **Mission-home README cold read** — `testing/comparisons/missions/README.md` clearly serves operators/maintainers who browse or hand-revise missions, names the six mission input groups and `/compare-specs`, distinguishes missions from seeds, and states that editable revisions affect future runs only while historical run snapshots remain unchanged.
- ✓ **`npx remark .pi/prompts/compare-specs.md testing/comparisons/missions/README.md --frail`** — both new Markdown files parse cleanly and their links resolve.
- ✓ **`npm run verify`** — the normal repository checkpoint remains green; no passing test is cited as evidence of conversational conduct, isolation, launch, notification, target authorship, revision behavior, or report usefulness.

### Invariants preserved

- Existing promoted evidence, especially `.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/`, remains untouched — guarded by: expected write manifest review.
- The rigorous campaign procedure remains distinct and unmodified — guarded by: expected write manifest review and direct prompt negative-space review.
- No test/helper becomes a second implementation of the prompt workflow — **stop the line**, guarded by: absence of `src/dev/__tests__/compare-specs-prompt.test.ts` and any new parser/checker/runner from the expected write manifest.
- Missions remain product-neutral Markdown outside `.fixtures/`; historical run inputs remain immutable by instruction — guarded autonomously only by direct content/path review, then behaviorally by the real-Pi gate and later revise/rerun obligation.

### Verification Approach

- **Inner:** Pi prompt-template documentation review, direct required-section/path/guardrail review, targeted Remark, and `npm run verify`. These establish syntax, discovery shape, instruction completeness, and repository health only.
- **Middle:** none for conversational behavior. There is no executable production lifecycle seam to test; a temporary-root dry run would supply the workflow it claimed to prove.
- **Outer:** mandatory owned gate below. It exercises the actual `/compare-specs` entry point in a fresh project Pi process and blocks the next scope.

### Cross-cutting obligations

- Keep exact common framing and each selected harness’s additions visible before approval; “equivalent instructions” is not a substitute for explicit adapter input.
- Keep controller-only simulated-user knowledge outside every target cwd and reveal it only according to the approved mission.
- A run may sequence lanes; do not promise parallel execution or add concurrency machinery.
- Preserve failed lanes and missing documents honestly; the actor may acquire a target document but never author, reconstruct, or improve it.
- Do not claim the prompt is usable or correct merely because it is complete on inspection.

### Expected touched paths (tentative)

```text
.pi/prompts/
└── compare-specs.md                       +
testing/comparisons/missions/
└── README.md                              +
```

Explicit non-writes:

```text
src/dev/__tests__/compare-specs-prompt.test.ts            absent
docs/praxis/comparison-runs.md                             unchanged
memory/SPEC.md                                              unchanged
memory/PLAN.md                                              unchanged
```

---

## Owned behavioral gate · Fresh-Pi first proving run — `blocks the next scope`

- **Owner and verdict:** **Dora/PM** owns mission authorship, conversational-usability judgment, and report cold-read usefulness. **Lu** may facilitate environment preflight and record technical identities, but may not replace Dora/PM’s verdict.
- **Re-entry trigger:** Card 1’s two tracked files pass direct review, targeted Remark, and `npm run verify`, and are available in a fresh checkout/session for operator use.
- **Exact required capability:** a newly started, project-trusted Pi TUI at the repository root that discovers the real `/compare-specs` template; valid provider/model access; filesystem write access to the canonical mission/scratch/run homes; the pinned `pi-interactive-shell` package and push/prune extensions; working Brunch and Claude Code target adapters; and a real mechanism that starts one separately identifiable fresh harness-level Pi actor process/session plus one fresh target cwd for each lane. If fresh actor identity cannot be demonstrated, stop—the gate is blocked, not passed with a coordinator-context surrogate.
- **Required witness:** Dora/PM invokes the discovered `/compare-specs` command in that fresh Pi process, authors one new mission through one-question-at-a-time intake, reviews the complete Brunch + Claude Code setup, explicitly approves it, observes both real target lanes resolve and aggregate notification occur, then opens the saved mission and generated `report.md`. The retained run must contain the exact approved snapshot, separately identified actor/target contexts, both target-authored documents, lane outcomes/cleanup, and relative links/content.
- **Behavioral verdict:** Dora/PM can cold-read the mission/report and explain what was asked, how each harness was framed, what each produced, and what happened without controller logs. This is the only first-slice oracle for conversational conduct, fresh isolation, launch/notification timing, target authorship, and report usefulness.
- **Failure disposition:** record the actual `/compare-specs` finding and resulting artifacts under the manual-testing findings discipline, then return to `ln-scope` before changing prompt topology or adding orchestration code. Do not proceed through a failed gate.

Expected gate outputs are deliberately outside the autonomous Card 1 write manifest:

```text
testing/comparisons/missions/<mission-id>.md                         +
.fixtures/scratch/comparisons/<run-id>/**                            +
.fixtures/runs/agent-as-user-comparison/<run-id>/**                  +  after review/promotion
TESTING_FINDINGS.md                                                   ?  only when a finding needs disposition
```

### Findings-dependent obligation after the gate

Existing-mission revise/rerun is not fully scoped through first-run fog. If the first witness passes without orchestration-changing findings, Dora/PM may extend the same witness by invoking the actual `/compare-specs <mission-id-or-path>` entry point, revising the editable mission, approving a second run, and comparing the two real run artifacts. Otherwise the coordinator must author the next scope from the findings.

In either shape, frontier closure still requires real-path evidence that:

- the first run’s approved mission/setup snapshot remains byte-for-byte unchanged after revision;
- the editable mission contains the revision;
- only the later approved run receives the revised mission/setup; and
- no existing run directory is overwritten.

## Autonomous tracked write manifest

```text
.pi/prompts/compare-specs.md                                      +
testing/comparisons/missions/README.md                            +
```

This scope-file revision itself is the only write in the current scoping delegation:

```text
memory/cards/operator-comparison-workflow--first-proving-tracer.md ~
```
