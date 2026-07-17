# FE-1215 corrected private-mission comparison tracer

Frontier: operator-comparison-workflow
Status:   active
Mode:     single
Created:  2026-07-17

## Orientation

- **Containing seam:** project-local Pi operator tooling over FE-1210’s rendered-state actor, target adapters, document acquisition, cleanup, and retained comparison evidence.
- **Frontier:** `operator-comparison-workflow` / FE-1215 on `ln/fe-1215-saved-mission-comparison`; this remains one correction slice on the existing issue and branch.
- **Volatile state:** no `HANDOFF.md`. Coordinator-authored corrections already live in `memory/SPEC.md` and `memory/PLAN.md`; both are protected read-only inputs for this delegation and build. The current prompt and mission README implement the superseded model and are not accepted behavior.
- **Main risk:** the existing prompt gives contender selection and framing to the saved mission and does not cleanly model the Pi actor as the private mission’s user/PM. Static prose review can establish the corrected instruction boundary, but only a real `/compare-specs` run can prove that the actor follows it without leaking the mission.

**Posture: proving (inherited from `operator-comparison-workflow`).**

Frontier-level obligations carried by this slice:

- Preserve the corrected boundary among the rich private **agent-as-user mission**, separate minimal per-run contender setup, target-visible interaction, and immutable operator-only run evidence.
- Preserve D70-L’s artifact roles: editable product-neutral missions live under `testing/comparisons/missions/`; ephemeral lane work and assembly live under `.fixtures/scratch/comparisons/`; deliberate immutable run snapshots, target outputs, and reports live under `.fixtures/runs/agent-as-user-comparison/`. Missions are not Brunch seeds.
- `.pi/prompts/compare-specs.md` remains the one v1 production entry point for create, revise, review, and run. Reuse FE-1210 actor cadence and adapters without extracting a skill, package, parser, checker, runner, or generic harness abstraction.
- Static checks prove only prompt discovery, corrected visible instructions, Markdown validity, and repository health. Only an actual fresh-Pi `/compare-specs` invocation may witness actor conduct, mission isolation, launch, notification timing, target authorship, or report usefulness.

## Supersession record

The prior **Card 1 · Complete real project prompt and mission-home guidance** completion is **invalidated and superseded by the user’s 2026-07-17 domain-model correction**. Its earlier review/check results prove only that the now-contradicted prose was syntactically valid; they do not accept its mission model or current prompt behavior.

Specifically, the prior card incorrectly treated opening ask, private reveal material, contender selection, shared framing, and per-harness framing as six co-owned saved-mission input groups. The corrected model makes the mission the Pi actor-as-user’s rich private role definition and moves all contender selection/configuration into minimal, separately approved run setup. The real-Pi gate was not run and remains blocked. No prior run artifact is rewritten.

## Scope boundary and sequence discipline

1. This file scopes one bounded correction build: update the actual production prompt and the mission-home README, then reconcile this scope card’s status.
2. `memory/SPEC.md` and `memory/PLAN.md` already contain the authorized canonical correction. They are cold-start reads and protected non-writes, not reconciliation targets for this build.
3. The correction does not add tests or implementation machinery. Do not add a surrogate lifecycle test, runner, parser, checker, package, skill, browser UI, judge, rubric, statistics, database, or generic harness abstraction.
4. The current `.pi/prompts/compare-specs.md` and `testing/comparisons/missions/README.md` are contradicted implementation context. Do not preserve their six-group mission model for compatibility, and do not cite current behavior as accepted.
5. Keep the owned real-Pi gate blocked until both corrected files pass the direct review and read-only checks in this card. There is no prewritten downstream build through that gate.
6. Existing-mission revise/rerun remains findings-dependent after the first real witness and must preserve every earlier immutable snapshot.

---

## Correction build · Restore the private user-mission boundary — `done`

### Target Behavior

The project prompt and mission-home guidance enforce the corrected private agent-as-user mission boundary throughout the comparison workflow.

### Full-card cold-start reads

- `memory/SPEC.md` — requirement 24; A5-L; D70-L; lexicon `Agent-as-user mission` / `Comparison report`; Verification Design §Operator-led cross-product comparisons
- `memory/PLAN.md` — frontier: `operator-comparison-workflow`, especially objective, acceptance, boundary, verification, and current execution pointer
- Pi `docs/prompt-templates.md` — project prompt location, frontmatter, arguments, and non-recursive discovery
- `.agents/skills/agent-as-user-comparison/SKILL.md` — fresh-lane actor boundary, rendered-state cadence, target adapters, document acquisition, failure retention, and cleanup
- `docs/praxis/comparison-runs.md` — rigorous/approachable boundary and existing adapter facts; read only
- `.fixtures/README.md` — seed/workbench/run/scratch roles and deliberate promotion/path-portability discipline
- `docs/praxis/manual-testing.md` — real interactive capability preflight, artifact retention, cleanup, and owned findings discipline
- `.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/manifest.md` — prior actor/adapter lessons only; do not rewrite or copy its frozen campaign ceremony
- `.pi/prompts/compare-specs.md` and `testing/comparisons/missions/README.md` — contradicted current implementation to correct, not accepted behavior

### Boundary Crossings

```text
→ project Pi prompt discovery (`.pi/prompts/compare-specs.md`)
→ private mission create / revise / review
→ separate run-specific contender selection and exact framing approval
→ fresh Pi actor receives the full private mission
→ contender receives only minimal framing plus actor-authored user turns
→ operator-only retained report separates private baseline from target-visible evidence
```

### Required corrected content

A direct cold read of the prompt and README must establish this model:

```text
private agent-as-user mission
├── belongs to the fresh Pi actor playing the user/PM
├── defines objective, context, priorities, preferences, constraints,
│   known facts, uncertainties, decision latitude,
│   conversational/disclosure posture, and natural opening request
├── is readable product-neutral Markdown
├── contains no contender selection or harness configuration
└── is received wholesale only by the actor, never a contender

actor conduct
├── opens the target conversation as the simulated user
├── answers questions from mission truth and disclosure posture
├── considers recommendations and tradeoffs as the PM would
├── makes decisions only where the mission grants latitude
└── says unknown or undecided when the mission does not authorize invention

separate run setup
├── selects from Brunch | Claude Code | Codex | Cursor/agent | Pi
├── remains intentionally small and run-specific
├── Brunch: built-in Specify mode + only necessary output instruction
├── generic harness: small instruction to conduct a question-led
│   specification conversation and author the requested review-ready document
├── shows exact per-contender framing for operator approval
└── snapshots approved setup with the run, never into the reusable mission

target-visible boundary
├── minimal approved harness framing
├── actor's natural opening user message
├── actor's subsequent answers and decisions
├── never the full mission text
└── never the mission file or path in target context/cwd

operator-only retained report
├── may reproduce the full private mission as the comparison baseline
├── identifies the separate exact contender setup
├── separates target-visible initial framing and transcript per lane
├── retains lane outcomes and target-authored documents
└── makes leakage and elicitation legible without a winner or fixed rubric
```

The prompt must continue to state that revision changes only the editable mission and future runs; it never rewrites an existing run directory, private mission snapshot, contender-setup snapshot, transcript, output, or report.

### Risks and Assumptions

- **RISK:** the old six-group language survives in one path and silently re-couples reusable mission truth to contender setup.
  - **MITIGATION:** direct cold-read both files for create, revise, review, approval, lane launch, and report instructions; remove rather than alias the superseded model.
- **RISK:** “private” is interpreted as hiding the mission from the operator report as well as from contenders.
  - **MITIGATION:** state that the operator-only report may show the full mission baseline while keeping it visibly separate from target-visible framing/transcript.
- **RISK:** the actor fills gaps to keep the conversation moving.
  - **MITIGATION:** require mission-consistent decisions only within granted latitude and explicit unknown/undecided responses otherwise.
- **RISK:** static prose checks are mistaken for proof that Pi obeys the prose.
  - **MITIGATION:** keep the real-Pi gate blocked and explicitly limit every autonomous oracle’s claim.
- **ASSUMPTION:** one project prompt can conduct the corrected workflow using existing Pi and FE-1210 capabilities without helper machinery.
  - **IMPACT IF FALSE:** the prompt/orchestration boundary and downstream scope must be reshaped.
  - **VALIDATE:** the owned fresh-Pi Brunch + Claude witness below; static review does not validate this assumption.

### Posture check

- **Lights up:** the actual project prompt’s corrected mission → actor → target → report information flow.
- **Stabilizes:** the reusable private mission / minimal run setup / target-visible interaction boundary future comparisons depend on.
- **Locates uncertainty:** whether a fresh Pi actor can internalize the rich mission, behave consistently without invention, and avoid wholesale or path-level leakage. The owned behavioral gate, not a surrogate test, carries that proof.

### Acceptance Criteria

- ✓ **Direct prompt mission-model review** — create/revise/review instructions define the saved mission as the actor-user’s rich private role; intake covers objective, context, priorities, preferences, constraints, known facts, uncertainties, decision latitude, conversational/disclosure posture, and natural opening request; mission content excludes contender selection and harness instructions.
- ✓ **Direct prompt actor-conduct review** — each lane loads the complete approved private mission only into a fresh Pi actor; the actor opens the conversation, answers and weighs tradeoffs consistently, decides only within granted latitude, and says unknown/undecided rather than inventing.
- ✓ **Direct prompt target-boundary review** — each contender receives only its minimal exact framing, the actor’s opening user message, and subsequent actor-chosen answers; the prompt forbids putting the mission wholesale or its file/path into target context or cwd.
- ✓ **Direct prompt run-setup review** — contender selection is separate from mission authoring; the concrete roster is Brunch, Claude Code, Codex, Cursor/agent, and Pi; Brunch uses built-in Specify mode plus only necessary output instruction; generic harnesses receive a small question-led specification/document-authoring instruction; exact setup is approved and snapshotted with the run, not saved in the mission.
- ✓ **Direct prompt report review** — `report.md` may reveal the full private mission to its operator reader but clearly separates that baseline from exact target-visible initial framing and transcript per lane, then retains lane outcomes and target-authored documents without a rubric, score, recommendation, or winner.
- ✓ **Mission-home README cold read** — the README documents the same private actor-role mission fields, excludes contender/setup fields from mission files, explains actor-only wholesale access and target-visible disclosure, points to separate run setup in `/compare-specs`, and preserves future-only revision semantics.
- ✓ **Canonical-path and negative-space review** — the files preserve the mission/scratch/run homes and introduce no surrogate lifecycle test, runner, parser, checker, package, skill, browser UI, judge, rubric, statistics, database, campaign framework, or generic harness abstraction.
- ✓ **`npx remark .pi/prompts/compare-specs.md testing/comparisons/missions/README.md --frail`** — the two corrected Markdown files parse cleanly and their links resolve.
- ✓ **`npm run check`** — the repository’s read-only lint/format/link/skill/promoted-run checks remain green; no passing check is cited as evidence of runtime behavior.
- ✓ **Protected-state fingerprint check before and after build** — `memory/SPEC.md` remains SHA-256 `92bf0ac7864e2c32dec4da2402815621cd8e2c982ac8540a4ecb91d55f41a238` and `memory/PLAN.md` remains SHA-256 `0e39a3bfaded62fe20e80c13011801cbdf941c0cb69a31be41b2d8329570fb29`.

### Invariants preserved

- Existing promoted evidence, especially `.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/`, remains untouched — guarded by: expected write-manifest review.
- The rigorous frozen-packet procedure remains distinct and unmodified — guarded by: expected write-manifest and direct negative-space review.
- No test/helper becomes a second implementation of the prompt workflow — **stop the line**, guarded by: expected write-manifest review.
- Missions remain product-neutral Markdown outside `.fixtures/`; historical run inputs remain immutable — guarded autonomously by: direct content/path review; behaviorally by: the real-Pi gate and later revise/rerun obligation.
- Current prompt behavior is not accepted merely because the correction text passes static checks — guarded by: the blocked gate and explicit oracle limits above.

### Verification Approach

- **Inner:** Pi prompt-template/frontmatter cold read, required-content and negative-space review, targeted Remark, `npm run check`, and protected-state fingerprint comparison. These establish corrected visible instructions and repository health only.
- **Middle:** none for workflow behavior. There is no executable production lifecycle seam to test; a dry-run state machine would supply the behavior it claimed to prove.
- **Outer:** mandatory owned gate below. It exercises the actual `/compare-specs` entry point and blocks further autonomous scope.

### Cross-cutting obligations

- Give the complete mission privately to the actor, never to the contender; target-visible overlap with mission facts must arise only through the actor’s opening message and later answers.
- Keep reusable user truth independent of contender roster and harness framing. Exact framing is approved and snapshotted per run.
- A run may sequence lanes; do not promise parallel execution or add concurrency machinery.
- Preserve failed lanes and missing documents honestly; the actor may acquire a target document but never author, reconstruct, or improve it.
- Do not claim corrected prompt usability or runtime correctness before the real witness.

### Expected touched paths (tentative)

```text
.pi/prompts/
└── compare-specs.md                                      ~
testing/comparisons/missions/
└── README.md                                             ~
memory/cards/
└── operator-comparison-workflow--first-proving-tracer.md ~
```

Explicit non-writes:

```text
memory/SPEC.md                                            unchanged
memory/PLAN.md                                            unchanged
docs/praxis/comparison-runs.md                           unchanged
src/dev/__tests__/compare-specs-prompt.test.ts           absent
.fixtures/runs/agent-as-user-comparison/lockers-r1-20260716/** unchanged
```

### Correction-build completion evidence

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Saved mission is the actor-user's rich private role and excludes contender/setup configuration | met | Direct cold read: `.pi/prompts/compare-specs.md` §§Artifact and information boundaries, Create or revise |
| Fresh actor receives the mission wholesale and conducts the PM role without invention | met | Direct cold read: `.pi/prompts/compare-specs.md` §Run steps 2–3 |
| Contender sees only minimal framing and actor-authored turns; mission text/file/path forbidden | met | Direct cold read: `.pi/prompts/compare-specs.md` §§Artifact and information boundaries, Run steps 2 and 6 |
| Run setup is separate/minimal; roster and Brunch/generic framing are exact | met | Direct cold read: `.pi/prompts/compare-specs.md` §Prepare and approve a separate run setup |
| Operator-only report separates full private baseline from exact target-visible evidence | met | Direct cold read: `.pi/prompts/compare-specs.md` §Retained run and operator-only report |
| Mission-home README carries the same boundary and future-only revision semantics | met | Direct cold read: `testing/comparisons/missions/README.md` |
| Canonical homes preserved; no surrogate machinery or out-of-manifest implementation added | met | `git status --short` and changed-path review: only the three authorized paths |
| Targeted Remark | met | `npx remark .pi/prompts/compare-specs.md testing/comparisons/missions/README.md --frail` — no issues |
| Repository read-only check | met | `npm run check` — green; six pre-existing `typescript(unbound-method)` warnings only |
| Protected SPEC/PLAN fingerprints | met | SPEC `92bf0ac…a238`; PLAN `0e39a3…fb29` |
| Runtime conduct/isolation/notification/actor consistency/report usefulness | dropped | Deliberately not claimed; remains owned by the blocked Fresh-Pi gate below |

Skipped-test-count delta vs parent: **0** (no tests added, changed, run, skipped, or parked; this docs/prompt correction used the card's static verification boundary).

Canonical reconciliation: no-op by delegation. The authorized SPEC/PLAN correction already records the durable boundary and both files remain protected; this correction materializes it without changing topology or frontier status. The scope file remains active because the owned behavioral gate and findings-dependent obligation remain unfinished.

---

## Owned behavioral gate · Corrected Fresh-Pi first proving run — `blocked`

- **Current block:** do not invoke the gate until the correction build’s direct review, targeted Remark, `npm run check`, and protected-state fingerprint checks all pass. The current prompt/README do not satisfy this re-entry condition.
- **Owner and verdict:** **Dora/PM** owns mission authorship, mission-consistency judgment, conversational-usability judgment, and report cold-read usefulness. **Lu** may facilitate environment preflight and record technical identities, but may not replace Dora/PM’s verdict.
- **Re-entry trigger:** the two corrected tracked files satisfy every correction-build acceptance leaf and are available in a newly started project-trusted Pi session.
- **Exact required capability:** a newly started project-trusted Pi TUI at the repository root that discovers the real `/compare-specs` template; valid provider/model and filesystem access; the pinned `pi-interactive-shell` package and push/prune extensions; working Brunch and Claude Code adapters; and one separately identifiable fresh harness-level Pi actor process/session plus one fresh isolated target cwd per lane. If fresh actor identity cannot be demonstrated, the gate remains blocked.
- **Required first witness:** Dora/PM invokes actual `/compare-specs`, authors one real private agent-as-user mission, separately reviews and approves the exact minimal Brunch + Claude setup, and observes one fresh mission-loaded actor per lane conduct both real interactions through completion. The operator then opens the retained `report.md`.
- **Behavioral verdict:** the witness shows that each actor opens naturally, answers and decides consistently with mission authority, says unknown/undecided where required, and never exposes the mission wholesale or its path to the contender. The retained operator report includes the full private mission baseline but separately shows what each contender was initially told, what it elicited, what it produced, lane outcomes, and cleanup. A cold reader can explain those distinctions without controller logs.
- **Failure disposition:** retain and record the actual `/compare-specs` finding under the manual-testing findings discipline, then return to `ln-scope` before changing prompt topology or adding orchestration code. Do not proceed through a failed gate.

Expected gate outputs are deliberately outside the autonomous correction-build write manifest:

```text
testing/comparisons/missions/<mission-id>.md                        +
.fixtures/scratch/comparisons/<run-id>/**                           +
.fixtures/runs/agent-as-user-comparison/<run-id>/**                 +  after review/promotion
TESTING_FINDINGS.md                                                  ?  only with owner + re-entry trigger
```

### Findings-dependent obligation after the gate

Existing-mission revise/rerun is not scoped through first-run fog. If the first witness passes without orchestration-changing findings, the next findings-informed action may revise the same editable mission and run it again through actual `/compare-specs`. Otherwise the coordinator must rescope from the findings.

Frontier closure still requires real-path evidence that:

- the first run’s private mission and separate contender-setup snapshots remain byte-for-byte unchanged after revision;
- the editable mission contains the revision and still contains no contender configuration;
- only the later approved run receives the revised mission and newly approved run setup; and
- no existing run directory, transcript, output, or report is overwritten.

## Correction-build tracked write manifest

```text
.pi/prompts/compare-specs.md                                      ~
testing/comparisons/missions/README.md                            ~
memory/cards/operator-comparison-workflow--first-proving-tracer.md ~
```

This scope-file revision is the only write authorized in the current scoping delegation:

```text
memory/cards/operator-comparison-workflow--first-proving-tracer.md ~
```
