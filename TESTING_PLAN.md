# Brunch Outer-Loop Testing Plan

Status: **current post-PR-305 alpha walkthrough script**. PR #305 has merged, so this is not a gate for `main-editor-chrome`; it is an outer-loop audit on top of the merged product surface. The 2026-07-02 broad demo/audit plan is superseded; its still-relevant observations are collated in `TESTING_FINDINGS.md`.

Use this file as a concern-grouped checklist, not a priority order. Findings go in `TESTING_FINDINGS.md`; durable planning changes still reconcile through `memory/PLAN.md` / `memory/SPEC.md`, not new sidecar ledgers.

## Session frame

Current branch observed when this plan was updated:

```sh
git branch --show-current
# ln/fe-TEMP-alpha-walkthroughs
```

Core evidence rule: workbench `.brunch/` state is local runtime, not canonical fixture truth. Promote only reviewed artifacts deliberately under `.fixtures/runs/`.

Baseline inspection commands:

```sh
git rev-parse --short HEAD
git branch --show-current
npm run dev-cli -- rpc workspace.state --workspace <workspace>
npm run dev-cli -- rpc session.runtimeState --workspace <workspace>
npm run dev-cli -- rpc graph.overview '{"specId":1}' --workspace <workspace>
```

Useful debug mirrors, when triggered:

- `<workspace>/.brunch/debug/entry-contents.md`
- `<workspace>/.brunch/debug/origination.md`
- `<workspace>/.brunch/debug/system-prompt.md` after a provider request
- `<workspace>/.brunch/debug/tool-contents.md` after Brunch tool results
- `<workspace>/.brunch/debug/transcript.md` only when the harness/debug path writes it; absence in ordinary TUI runs is not automatically a failure
- session JSONL under the workspace `.brunch` state

## Concern 1 — Onboarding and first-run safety

Purpose: verify Brunch works for alpha users who are not already Pi users, and that workspace entry is safe across empty, populated, and legacy workspaces.

### 1A. No pre-existing Pi auth/login

Use a scratch Pi agent dir so ambient `~/.pi/agent/auth.json` cannot leak into the run. `PI_CODING_AGENT_DIR` isolates file-backed auth only; Pi also resolves provider API-key environment variables, so the two Brunch-allowlisted fallbacks must be removed for a real no-auth run:

```sh
AGENT_DIR=$(mktemp -d /tmp/brunch-agent-auth.XXXXXX)
WORKSPACE=.fixtures/workbenches/manual-no-auth
mkdir -p "$WORKSPACE"

# Source/direct CLI form (the browser opens by default):
env -u ANTHROPIC_API_KEY -u OPENROUTER_API_KEY \
  PI_CODING_AGENT_DIR="$AGENT_DIR" \
  npm run dev -- --cwd "$WORKSPACE"

# Built/package CLI form:
env -u ANTHROPIC_API_KEY -u OPENROUTER_API_KEY \
  PI_CODING_AGENT_DIR="$AGENT_DIR" \
  brunch --cwd "$WORKSPACE"
```

Check:

- Workspace entry warns that no allowlisted model auth is configured.
- Spec/session creation remains available.
- No orientation juncture or provider turn fires before auth exists.
- Copy points to `brunch login` and `/login`.
- `auth.json` is created only under the scratch `PI_CODING_AGENT_DIR` if the flow needs it; no ambient auth is read.

Then run the login path from the same scratch agent dir:

```sh
# Source/dev launcher form:
PI_CODING_AGENT_DIR="$AGENT_DIR" npm run dev -- login

# Built/package CLI form:
PI_CODING_AGENT_DIR="$AGENT_DIR" brunch login
```

Check:

- Provider choices match the Brunch allowlist order.
- API-key or OAuth flow writes Pi-shaped auth storage.
- Exit report says which allowlisted model and thinking policy Brunch will use.
- Relaunch now fires normal orientation/kick behavior.

### 1B. New bare workspace

Use a throwaway empty cwd under `.fixtures/workbenches/`; do not use the repo root.

Check:

- Workspace/spec chooser handles no existing `.brunch/` state.
- New spec creation is understandable.
- First orientation asks/assumes greenfield only after confirming the workspace is bare.
- The agent does not invent brownfield codebase context.

### 1C. New populated workspace

Use a throwaway cwd with a few ordinary project files but no `.brunch/` state.

Check:

- Brunch notices or is able to reason that the cwd is populated.
- New-spec flow asks/confirms whether this is a full product, a feature inside the codebase, or another scope.
- It asks/confirms whether the work is brownfield before using codebase facts as specification authority.

### 1D. Existing Brunch 0.x database — caution

Do not point this test at an irreplaceable real workspace. Use a disposable copy of a 0.x `.brunch/` directory if one is available.

Check:

- Boot does not silently corrupt or partially migrate the legacy database.
- If migration is supported, the user sees a clear compatibility/migration path before writes.
- If migration is not supported, Brunch fails safe with a legible message and no destructive writes.
- Record the exact source version and copied workspace path.

If no disposable 0.x database is available today, log this as an unwitnessed onboarding risk rather than manufacturing one mid-session.

## Concern 2 — Workspace/spec posture orientation and capture logic

Purpose: validate whether the entry flow establishes enough posture before the agent starts treating material as spec truth.

Use this matrix as the behavioral oracle:

```text
no specs exist yet: create a new spec
├── workspace populated?
│   └── ask/confirm
│       ├── is this full product or feature within codebase?
│       └── is this brownfield?
└── workspace is bare?
    └── confirm: is this greenfield?

some specs exist
├── resume a spec
│   ├── assume posture is capture unless stored state says otherwise
│   └── orient: style/action
├── new spec & workspace populated
│   └── ask/confirm
│       ├── is this full product or feature within codebase?
│       └── does it relate to another spec?
└── new spec & workspace is bare
    └── ask/confirm
        ├── is this a product, feature, or something smaller?
        ├── does it relate to another spec?
        └── is this greenfield?
```

Check for each path sampled:

- ✅ What, if anything, records `spec.posture` or equivalent posture/state? — the
  `specs` DB row (`origin`, confirmed `kind`, `relatesToSpecId`; D118-L, spec-posture
  frontier). Not prompt-carried.
- ✅ Does the agent ask posture-establishing questions before domain-detail
  questions? — the workspace dialog asks kind+origin at spec creation, before any
  session/agent turn exists.
- Does capture distinguish user-confirmed posture from inferred or speculative
  posture? — out of scope for spec-posture (capture-conduct posture reader,
  FE-1196 residue); still open.
- ✅ Does resuming a spec preserve prior orientation instead of restarting as
  blank? — established posture is read (never re-asked); a spec created outside
  the dialog gets the establishment step once at next resume. (The resume half
  was inner-tested but unwired until the 2026-07-14 run-B walkthrough caught it —
  finding T2; now wired through the dialog's resume routing +
  `CommandExecutor.establishSpecPosture`, establish-once at the command boundary.)
- If posture is only prompt-carried today, is that legible in debug mirrors and
  session JSONL? — moot: posture is DB-row state, not prompt-carried.

Landed narrowing (spec-posture, D118-L): the interactive establishment step asks
only kind + origin (populated cwd: combined kind ask + brownfield confirm; bare
cwd: greenfield confirm only), never the matrix's "does it relate to another
spec?" question — D118-L's minimal-question mandate treats a relates-to ask as
deferred richness, not inferable-skippable. `relatesToSpecId` is settable
structurally (schema + `CommandExecutor.createSpec` + the coordinator's `newSpec`
decision) and exercised by the A41-L probe, but only reachable today through a
non-dialog caller (e.g. RPC) — the dialog does not yet prompt for it. Do not fork
a second posture matrix; this note narrows the existing one.

## Concern 3 — Seeding conditions and initial agent orientation

Purpose: verify that seeded/initial context is useful, not overwhelming, and that the agent follows Brunch guidance before asking questions.

Suggested seeds/workbenches:

```sh
npm run seed -- --seed workspace-alpha-grounding/base --reset
npm run dev-cli -- --workspace .fixtures/workbenches/workspace-alpha-grounding --dev-tools
```

Also sample at least one richer or differently-shaped seed if time allows, such as `workspace-alpha-grounding/intent-settled`, `workspace-alpha-grounding/requirements-accepted`, or a realistic project-port seed from `.fixtures/seeds/`.

Inspect:

- `entry-contents.md`: what overview is injected?
- `system-prompt.md`: what directives and heuristics explain how to interpret the overview?
- Session JSONL: what orientation/custom entries were appended?
- First assistant behavior: does it read/interpret current graph facts first, then ask?

Check:

- No stale count-based gap scoring or ranked elicitation gap language appears.
- The agent uses readiness/posture guidance before asking a next question.
- The agent distinguishes graph facts, advisory material, scratchpad obligations, and user-confirmed intent.
- It is possible to steer “how to think” through the intended style/action menu or prompt resources rather than ad hoc user coercion.

✅ Resolved (spec-posture, D118-L): `spec.posture` is a real `specs` DB row
(`origin`/`kind`/`relatesToSpecId`), established once at the workspace dialog,
never simulated through prompt context.

## Concern 4 — Prompt, skill, and model routing audit

Purpose: learn whether the active agent sees the right prompt resources, whether skill routing overloads the model, and whether the model policy is helping or hurting.

For each sampled session, inspect after a provider request:

- `system-prompt.md` for foreground role prompt, skill manifest, model/thinking policy, and stale instructions.
- `tool-contents.md` for tool result legibility.
- session JSONL for skill `read` calls and tool choices.

Questions to answer:

- What prompt or skill content is not loading when it should?
- What content is loading but overloading or distracting the model?
- Does the model follow Brunch-specific guidance first, or default to generic coding-assistant behavior?
- Does `thinking: low` help responsiveness without hurting conduct?
- Would some actions work better with thinking off, or with a different model?
- Which exact model ids should be tested next? Verify catalog ids before changing policy.
- Are there action classes that justify dynamic model selection later (for example: orientation, capture, proposal generation, execution planning, code execution)?

Do not implement dynamic models during the walkthrough. Classify evidence as:

- model-policy tweak candidate
- prompt trim / skill trim candidate
- skill-routing bug
- future dynamic-model frontier

## Concern 5 — Debug mirror and trigger legibility

Purpose: confirm `.brunch/debug/` tells the operator what happened without requiring raw DB spelunking.

Check:

- `system-prompt.md` appears after the first provider request and is clearly the final provider prompt.
- `entry-contents.md` names product-injected entries and overviews in a way that explains trigger/source.
- `origination.md` records decisions and outcomes early enough to debug hung/aborted starts.
- `tool-contents.md` has enough latest/tail context to know which tool result was just mirrored.
- `transcript.md` behavior is understood: either present with a clear trigger, or absent with a known reason.

Desired finding shape if inadequate: name the missing operator question, e.g. “What triggered this turn?”, “Which tool result is this?”, “What was the last provider prompt?”, rather than prescribing a storage format.

## Concern 6 — Style/action `/brunch:consult` menu

Purpose: verify the consult surface offers useful action choices for each role without reviving old runtime strategy/lens/method axes.

In Specify / elicitor mode, `/brunch:consult` should make these choices discoverable or naturally reachable:

- by-decision
- by-example
- by-proposal
- prep for execution: design / oracle / commitment

In Execute / executor mode, `/brunch:consult` should make these choices discoverable or naturally reachable:

- design / oracle / commitment work
- plan compilation
- plan execution

Check:

- Labels are understandable to a first-time alpha user.
- Choices route to the intended role/skill behavior.
- The menu does not imply unsupported third modes or obsolete Enhance-style behavior.
- Escape/dismiss behavior is inert and legible.
- Menu outcome is recorded in session state/JSONL clearly enough to audit routing.

## Concern 7 — Merged chrome/rendering carryover checks

Purpose: retain the useful FE-1169 manual checks now that #305 has merged.

### 7A. Physical-terminal wheel smoke

Run the current TUI in available real terminals: iTerm2 / Kitty / Ghostty.

Check wheel/trackpad scrolling, rounded-box integrity, editor redraw, status/footer/header stability, and terminal-specific failures.

### 7B. Live mode-switch beat

In Brunch:

- `shift+tab` cycles Specify ↔ Execute.
- `alt+m` opens the picker.
- footer/header labels, editor label, and border color update.
- ask surfaces pick up the active mode border role.

Scoping proof:

```sh
pi
```

Plain Pi should still own its normal `shift+tab` thinking-cycle behavior.

### 7C. Component gallery walk

```sh
npm run dev:components
```

Walk both themes. Check candidates preview, review-set rich render, theme-testbed text variations, border levels, mode-reactive roles, and surface-identity roles.

### 7D. Continue/recovery

Declared continuation:

1. Present a declared continuation, preferably candidates → ask.
2. Root-esc before answering.
3. Confirm status hint names `/brunch:continue`.
4. Run `/brunch:continue`.
5. Answer.
6. Confirm one durable synthetic pair and status clears.

Standalone ask:

1. Root-esc a standalone ask.
2. Confirm no continue hint appears.

### 7E. Persistent editor render-height/focus

Across normal input, dialogs, pickers, ask cancellation/recovery, mode switches, scroll, and relaunch:

- editor height is stable
- input does not overwrite transcript or borders
- focus returns to the editor
- multi-line input wraps/grows predictably

### 7F. Structured answering chrome

Exercise each response kind through the live TUI:

- Single-choice and decision pickers render inside the active-mode border role.
- Multi-select enforces `None` exclusivity and supports an `Other` write-in re-prompt.
- Free-text answers use the bordered editor and return focus to the main editor afterward.
- Escape/dismiss is inert: it does not submit a choice or mutate graph state.
- No flow falls back to an unframed raw Pi select surface.

### 7G. Capture-ingest-throughline

Paste or load a large design note in Specify mode, then exercise the digest review path:

1. Brunch offers a prose digest rather than treating the full source as accepted specification truth.
2. Request changes and confirm the regenerated digest supersedes the prior proposal.
3. Approve the digest and confirm the accepted-abstract echo is the sole carrier into capture/sweep behavior.
4. Inspect the resulting advisory review-set map and graph mutation receipt.

Check:

- Review vocabulary and successor/cancel behavior are legible.
- Rejected or superseded digest text does not leak into accepted graph state.
- The mutation receipt reports what was actually approved and applied; it does not imply broader capture.
- Debug mirrors and session JSONL make the source → digest → review → accepted abstract path auditable.

## Concern 8 — FE-1167 overlap opportunities

These remain owned by FE-1167 unless witnessed explicitly with evidence today:

- Web sidecar during an open ask.
- Capture sweep after ask answers.
- Resume re-render of persisted ask results.
- Generative menu evidence: intent/design/oracle/frontier-level plan flows entered through deterministic junctures.
- Execute thin/rich entry beats: CODE entry offers proceed, backfill, design-first, oracle-first, and project-plan paths; readiness resolves to Proceed / Negotiate / Ask before execution tooling; deferred orientation-choice questions remain deferred.
- The handoff from CODE readiness into `execute_plan_check` / `execute_orchestrate` preserves the authority boundary: executor includes elicitor tools, while write-execution tools remain executor-only and host application still requires explicit acceptance.

If a current test naturally covers one, mark it in `TESTING_FINDINGS.md` as `FE-1167 overlap`; do not force the whole FE-1167 batch unless priorities change.

## Finding classification

| Finding kind | Meaning |
| --- | --- |
| product behavior | The user-visible flow is wrong even if internals are working. |
| data model | Graph/session facts are missing, stale, illegally shaped, or over/under-settled. |
| prompt/context | The model did not see the right context, or saw misleading/stale prompt text. |
| skill routing | Skill manifest/path/load behavior is wrong, or model chooses the wrong prompt resource. |
| model policy | Model, thinking level, or provider choice appears to affect conduct, speed, or capability. |
| exchange protocol | Structured exchange present/answer/review-set tuple is illegal or unobservable. |
| transport/projection | RPC/web/TUI projections disagree with canonical state. |
| observability | Behavior might be correct, but debug/probe surfaces do not let us prove it. |
| onboarding safety | First-run, auth, workspace, or legacy-data behavior risks confusing or damaging users. |
| demo friction | Product may be sound, but the operator path is too hard for demos. |

Post-session routing:

- Broken behavior with unclear cause → `ln-diagnose`.
- Bounded fix inside a named settled seam → `ln-scope` / `ln-build`, or direct build if tiny.
- Systemic prompt/skill/model issues → likely `ln-induct`, `ln-review`, or `ln-oracles` before build.
- Findings that change frontier ordering, admit a new frontier, or close FE-1167 sub-items → reconcile with `memory/PLAN.md` via `ln-sync` / `ln-plan`.
- Architecture changes such as dynamic model routing or durable `spec.posture` semantics require `ln-spec` / `ln-plan` before implementation.
