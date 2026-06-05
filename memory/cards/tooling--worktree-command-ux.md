# Worktree command UX hardening

Frontier: n/a
Status:   active
Mode:     chain
Created:  2026-06-05

## Orientation

- Containing seam: project-local direct-Pi developer tooling in `.pi/extensions/worktree/index.ts`, not Brunch product runtime code.
- Relevant frontier item: n/a. This is a tooling follow-up to commits `ab562d64` and `f6ee3104`; it should stay outside `memory/PLAN.md` unless the user promotes developer-workflow tooling to a frontier.
- Volatile handoff state: no `HANDOFF.md`; worktree is clean except the unrelated active `memory/cards/dev-seed-fixtures--curation-loop.md` scope file, which this slice must not touch.
- Main open risk: slash-command UX can drift from Brunch's established namespacing convention or accidentally preserve old aliases; this local tooling is still under free-rewrite posture, so make the new command names canonical.

Posture: proving (inherited from project default; no containing PLAN frontier).

Cross-cutting obligations this chain carries:

- Preserve D39-L's tooling exception: root `.pi/extensions/worktree/index.ts` is direct-Pi developer convenience only and must not enter `src/.pi/pi-extension-shell.ts` or the sealed Brunch Pi Profile.
- Preserve worktree safety invariants from the landed extension: create from caller `HEAD`, warn on dirty caller state, preserve old session files, and never delete/prune worktrees.
- Use the existing Brunch command namespace pattern as the reference: `src/.pi/extensions/commands.ts` registers literal command names like `brunch:switch`; its file comment documents that Pi parses slash command names up to the first whitespace and passes colons through verbatim.

## Card 1 — Namespace worktree slash commands

Status: done
Weight: light

### Objective

Make `/worktree:create` and `/worktree:switch` the canonical slash commands for the project-local worktree extension.

### Acceptance Criteria

```pseudo
command registration
├── registers `worktree:create` for sibling worktree creation
├── registers `worktree:switch` for session relocation
├── does not register `/create-worktree` or `/switch-worktree` aliases
└── follows the `src/.pi/extensions/commands.ts` pattern: literal command constants containing `:`

staged command text
├── `createSiblingWorktree` stages `/worktree:switch <new-path>`
├── `switch_worktree` stages `/worktree:switch <target-path>`
├── tool descriptions / prompt snippets name `/worktree:switch`
└── test expectations no longer mention old slash-command names except as negative assertions

canonical docs
└── `memory/SPEC.md` D39-L tooling exception, if it names slash commands, names `/worktree:create` and `/worktree:switch`
```

### Verification Approach

- Inner: `npm test -- src/.pi/__tests__/project-worktree-extension.test.ts` — proves registration, editor staging, and command-text changes.
- Inner: `npx oxlint .pi/extensions/worktree/index.ts src/.pi/__tests__/project-worktree-extension.test.ts` and `npx oxfmt --check ...` — proves touched files remain linted/formatted.

### Cross-cutting obligations

- Keep tool names `create_worktree` and `switch_worktree`; this card only renames slash commands.
- Do not add compatibility aliases for old slash commands unless the user explicitly asks.
- Do not modify Brunch product command registration under `src/.pi/extensions/commands.ts`; use it only as a pattern reference.

### Assumption dependency

None — Pi colon command parsing is already used by `src/.pi/extensions/commands.ts` and covered by existing Brunch command practice.

### Expected touched paths (tentative)

```pseudo
.pi/extensions/
└── worktree/
    └── index.ts                                      ~

src/.pi/__tests__/
└── project-worktree-extension.test.ts                ~

memory/
└── SPEC.md                                           ?
```

Done 2026-06-05:

- Renamed canonical slash commands to `/worktree:switch` and `/worktree:create` while preserving tool names `switch_worktree` and `create_worktree`.
- Updated create/switch editor staging and tool descriptions/prompt snippets to name `/worktree:switch`.
- Reconciled D39-L tooling exception in `memory/SPEC.md` to name the namespaced slash commands.

### Promotion checklist

- [ ] Does this change a requirement? No — this is local tooling UX naming.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this slice depend on an unvalidated high-impact assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No — follows existing colon namespace pattern.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.

## Card 2 — Offer existing worktrees from no-arg switch

Status: next
Weight: light

### Objective

Make `/worktree:switch` without a path open an interactive selector over existing sibling/current-repo worktrees.

### Acceptance Criteria

```pseudo
no-arg switch discovery
├── `/worktree:switch <path>` keeps the existing direct validation + confirm + relocation behavior
├── `/worktree:switch` runs `git worktree list --porcelain` from the caller cwd
├── parses worktree entries into path plus branch/detached display metadata
├── excludes the caller worktree root from selectable targets
├── notifies when the caller cwd is not in a git repository
├── notifies when there are no other worktrees
└── cancels cleanly when the user dismisses the selector

interactive selection
├── uses `ctx.ui.select` so the choice appears in Pi's overlay/dialog UI
├── labels options with enough context to distinguish path and branch/detached state
├── passes the selected path through the existing `runSwitchWorktree` validation path
└── keeps the existing confirmation before session relocation

tests
├── covers porcelain parsing for branch and detached entries
├── covers exclusion of the current worktree
├── covers selector cancellation
└── covers selecting an existing worktree and reaching the switch path
```

### Verification Approach

- Inner: helper tests for `git worktree list --porcelain` parsing and option filtering.
- Inner: command-handler/unit tests with fake `ctx.ui.select` — proves no-arg behavior, cancellation, and selected-path handoff.
- Middle: temp-git smoke in `src/.pi/__tests__/project-worktree-extension.test.ts` if practical — proves discovery sees linked worktrees created by real git.
- Gate: `npm run verify` before commit, scoped failures outside touched files reported rather than fixed.

### Cross-cutting obligations

- Keep relocation itself on the existing validated/confirmed `runSwitchWorktree` path; the selector is only target choice, not a bypass.
- Do not build worktree list/delete/prune management.
- Do not auto-switch when only one alternative exists; still show/select or otherwise require explicit user action.
- Do not use this command as a Brunch product spec/session switcher; it is direct-Pi cwd/session relocation only.

### Assumption dependency

None — this depends only on Git's stable porcelain worktree listing and existing Pi `ctx.ui.select` behavior.

### Expected touched paths (tentative)

```pseudo
.pi/extensions/
└── worktree/
    └── index.ts                                      ~

src/.pi/__tests__/
└── project-worktree-extension.test.ts                ~
```

### Promotion checklist

- [ ] Does this change a requirement? No — this hardens local tooling UX.
- [ ] Does this create, retire, or invalidate an assumption? No.
- [ ] Does this slice depend on an unvalidated high-impact assumption? No.
- [ ] Does this make or reverse a non-trivial design decision? No.
- [ ] Does this establish a new seam-level invariant? No.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [ ] Does it cross more than two major seams? No.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [ ] Can you not name the containing seam or current rationale from the live docs? No.
