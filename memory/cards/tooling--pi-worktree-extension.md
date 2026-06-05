# Project-local Pi worktree extension

Frontier: n/a
Status:   active
Mode:     chain
Created:  2026-06-05

## Orientation

- Containing seam: project-local Pi extension discovery at `.pi/extensions/`, used by humans/agents running `pi` in this repo; this is development tooling, not Brunch product runtime code.
- Relevant frontier item: n/a. This is a tooling scope outside `memory/PLAN.md`; no Linear issue/Graphite branch boundary is implied unless the user chooses to promote it.
- Volatile handoff state: `HANDOFF.md` is absent. Current worktree already contains untracked `memory/cards/dev-seed-fixtures--curation-loop.md` and `src/probes/fixture-curation-loop*`; this scope must not touch those paths.
- Main open risk: root `.pi/extensions/` is ambient Pi configuration, while Brunch's product contract deliberately seals product Pi resources; the extension must remain a developer convenience and never enter `src/.pi/pi-extension-shell.ts` or the Brunch runtime profile.

Posture: proving (inherited from project default; no containing PLAN frontier).

Frontier-level obligations this slice carries:

- Preserve D39-L: Brunch product behavior remains sealed and explicitly wired; root `.pi/extensions/worktree/` is only ambient developer tooling for direct Pi sessions.
- Preserve co-tenancy: generated worktrees and session files are created only after explicit command/tool action and confirmation; do not delete existing sessions by default.
- Preserve local worktree semantics: all defaults derive from the git worktree where the command is invoked, not from the repository's main worktree.

## Card 1 — Port session relocation extension

Status: done
Weight: full

### Target Behavior

The project-local extension can relocate the active Pi session to a validated git working tree.

### Boundary Crossings

```pseudo
Pi auto-discovered project extension
→ registered `switch_worktree` tool and `/switch-worktree` command
→ git working-tree validation for target path
→ Pi SessionManager fork/switch runtime boundary
→ replacement session continues from the target cwd
```

### Risks and Assumptions

- RISK: The original extension deletes the old session file after relocation, which can surprise users treating worktrees as parallel resumable contexts.
  → MITIGATION: port with session preservation as the default; if deletion is still useful, make it an explicit command flag only if implementation finds a current need.
- RISK: Session replacement uses stale command-context objects after `ctx.switchSession`.
  → MITIGATION: keep the upstream `withSession` pattern and use only the replacement callback context for post-switch notifications/messages.
- RISK: Tests placed under `.pi/extensions/` would be auto-discovered as extensions.
  → MITIGATION: keep tests outside auto-discovered extension paths; export only narrow pure helpers if tests need them.
- ASSUMPTION: The current Pi extension APIs used by the source extension (`registerTool`, `registerCommand`, `SessionManager.forkFrom`, `ctx.switchSession`, `ctx.ui.setEditorText`) are available in this project's installed `@earendil-works/pi-coding-agent`.
  → IMPACT IF FALSE: the extension needs a smaller command-only shape or an SDK/API update before creation flows can be scoped.
  → VALIDATE: type-check the local extension and manually load it with Pi or `pi -e` before relying on it.

### Posture check

This is a proving slice:

- Proof of life: a project-local extension can safely move the current Pi conversation into another git worktree without launching a fresh session manually.
- Invariants: it establishes the developer-tooling/product-profile separation for root `.pi/extensions/`.
- Uncertainty: it validates that the third-party worktree extension's session replacement trick still matches the installed Pi SDK surface.

If the Pi API has drifted, stop after a minimal working command/tool relocation path rather than adding compatibility layers.

### Acceptance Criteria

```pseudo
extension loading
├── `.pi/extensions/worktree/index.ts` is auto-discoverable by Pi
├── it registers `/switch-worktree <path>`
├── it registers a `switch_worktree` tool with clear prompt guidelines
└── it has no test/scratch files under auto-discovered `.pi/extensions` entries

target validation
├── accepts absolute and relative target directories
├── rejects missing paths
├── rejects non-directories
├── rejects non-git directories
└── rejects bare repositories

session relocation
├── confirms before switching in interactive mode
├── forks the current session file against the target cwd
├── removes dangling parent-session metadata if present
├── preserves the old session file by default
└── sends a replacement-session follow-up that work can continue in the target cwd
```

### Verification Approach

- Inner: type/lint/format check for the touched extension and any helper tests — proves the extension compiles against the installed Pi APIs.
- Inner: pure helper tests where practical for path normalization, git-validation result handling, and session-header cleanup.
- Middle: manual/shell smoke in a temporary git repository with two worktrees — proves `/switch-worktree` validates and reaches the pre-confirmation/session-switch path without relying on this repo's protected worktree state.

### Cross-cutting obligations

- Do not import this root `.pi/extensions/worktree` module into Brunch product code under `src/`.
- Do not introduce a package/discovery layer; this is one local extension directory.
- Do not overwrite `.pi/extensions/.gitkeep`; leave it or remove it only if the final directory makes the placeholder obsolete and the user/build confirms deletion is safe.

### Expected touched paths (tentative)

```pseudo
memory/cards/
└── tooling--pi-worktree-extension.md                 +

.pi/extensions/
├── .gitkeep                                          ?
└── worktree/
    └── index.ts                                      +

src/.pi/__tests__/
└── project-worktree-extension.test.ts                ?
```

Done 2026-06-05:

- Added `.pi/extensions/worktree/index.ts` as an auto-discovered project-local extension with `/switch-worktree <path>` and `switch_worktree`.
- Covered target normalization/git worktree validation, session header cleanup, source-session preservation, confirmation, and replacement-context continuation in `src/.pi/__tests__/project-worktree-extension.test.ts`.
- Reconciled D39-L with the root-extension tooling exception; this remains non-product developer tooling and is not imported into Brunch's sealed Pi profile.

## Card 2 — Create sibling worktree from caller HEAD

Status: next
Weight: full

### Target Behavior

The extension can create a sibling git worktree from the caller worktree's committed HEAD.

### Boundary Crossings

```pseudo
Pi tool or slash command in current cwd
→ current git worktree root detection
→ sibling path and branch-name selection
→ `git worktree add -b <branch> <sibling-path> <current-head-sha>`
→ switch-worktree relocation handoff
```

### Risks and Assumptions

- RISK: Running from a linked worktree accidentally bases the new worktree on the main worktree or default branch.
  → MITIGATION: resolve `git rev-parse --show-toplevel` and `git rev-parse HEAD` using the current `ctx.cwd`; pass the resolved commit SHA to `git worktree add`.
- RISK: A dirty current worktree could make users expect uncommitted files to appear in the new worktree.
  → MITIGATION: allow creation from committed HEAD, but notify loudly when `git status --porcelain` is non-empty that uncommitted changes are excluded.
- RISK: Random Greek suffix collides with an existing directory or branch.
  → MITIGATION: choose from a fixed Greek-word list, retry a bounded number of unused candidates, and fail loud with the attempted names if exhausted.
- RISK: Default branch naming fights existing project branch conventions.
  → MITIGATION: default branch name to the generated sibling directory basename for predictability; allow an explicit branch/path override only if needed to complete the current command without overbuilding a branch-naming framework.
- ASSUMPTION: `git worktree add -b <branch> <path> <sha>` works from both the main worktree and linked worktrees in the current Git version.
  → IMPACT IF FALSE: creation needs a lower-level `git worktree add --detach` plus branch creation step, or must be limited to one invocation shape.
  → VALIDATE: smoke-test from this repo's linked-worktree shape or a temporary linked-worktree fixture.

### Posture check

This is a proving tracer bullet:

- Proof of life: a user can ask Pi to make a sibling worktree and continue the same conversation there.
- Invariants: it locks default creation to caller-HEAD/caller-sibling semantics, including linked-worktree callers.
- Uncertainty: it tests the exact Git invocation shape before this becomes a habit-forming workflow tool.

If creation works but session relocation is awkward, keep creation as the landed behavior and route a narrower follow-up for relocation UX; do not build a generalized worktree manager.

### Acceptance Criteria

```pseudo
creation defaults
├── command/tool works when invoked from the main worktree
├── command/tool works when invoked from a linked worktree
├── source commit is exactly `git rev-parse HEAD` from the caller cwd
├── target directory defaults to a sibling of the caller worktree root
├── target directory basename defaults to `<caller-dir-basename>-<greek-word>`
└── created branch defaults to the target directory basename

safety and diagnostics
├── dirty caller worktree produces a visible warning that uncommitted changes are excluded
├── missing git repository fails loud
├── path collision fails or retries before shelling out
├── branch collision fails or retries before shelling out
└── git command failures return stderr/stdout enough for the agent/user to diagnose

handoff
├── after successful creation, the extension validates the new worktree
├── the editor is prefilled with `/switch-worktree <new-path>` or an equivalent confirmation flow
├── the user can press Enter to relocate the active session
└── the tool result reports source commit, branch, path, and dirty-state warning if applicable
```

### Verification Approach

- Inner: helper tests for Greek suffix selection, sibling path derivation, branch/path collision handling, and command construction from a fake git state.
- Middle: shell smoke in a temporary git repo with a linked worktree — run the command path from both main and linked roots and assert the new worktree HEAD matches the caller HEAD.
- Outer: one manual Pi smoke — call the tool/command from this repo, confirm the editor prefill/session relocation UX, and stop before any destructive cleanup of generated worktrees unless the generated paths are explicitly in the session manifest.

### Cross-cutting obligations

- Do not create a full worktree lifecycle manager: no list/delete/prune UI unless the current slice needs it.
- Do not integrate Graphite/Linear branch naming; this is generic Pi worktree convenience, not the Brunch frontier workflow.
- Do not clean up or delete generated worktrees automatically; report the exact path and let the user remove it later.
- Keep randomization deterministic-testable by isolating suffix selection behind a pure helper or injectable chooser.

### Expected touched paths (tentative)

```pseudo
.pi/extensions/
└── worktree/
    └── index.ts                                      ~

src/.pi/__tests__/
└── project-worktree-extension.test.ts                ?
```
