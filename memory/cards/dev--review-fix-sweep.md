# Review-fix sweep — localized bot-flagged defects, fixed at top of stack

Frontier: n/a (dev hygiene; defects originated on PRs #189/#195/#196/#203/#204)
Status:   active
Mode:     single
Created:  2026-06-11

> Sequencing: LAST of the four review-fix work items on `ln/fe-847-turn-boundary-closure`
> (shares `src/app/brunch-tui.ts` with the continuity-chain and gap-legality cards —
> do not build in parallel with them). Each fix is an independent commit-sized edit
> inside a settled seam; no finding here changes a decision or invariant.

## Objective

Retire every remaining localized defect from the 2026-06-11 ln-induct pass over stack PR comments, so the stack merges without known bot-flagged correctness or contract nits.

### Light-card cold-start reads

```
- memory/SPEC.md   — None load-bearing (D35-L startup-header drift is explicitly
                     EXCLUDED from this sweep; it goes through ln-sync)
- memory/PLAN.md    — category concern: dev hygiene on the FE-847 closure branch
- docs/praxis/pi-types.md — before the duplicate-Component fix (typing over pi APIs)
- Original bot comment text (only if a fix needs more context than the acceptance
  line gives): the unresolved review threads on PRs #189/#195/#196/#203/#204 via gh
```

### Acceptance Criteria

Each line is one independent fix; verify and commit in small groups.

```
✓ brunch-tui env scoping: applyBrunchOfflineDefault sets PI_SKIP_VERSION_CHECK ??= '1'
  alongside PI_OFFLINE (or, if version-check noise is judged not real, the save/restore
  ceremony for it is deleted instead — pick one, no half-state); the unused `dev`
  param on runWithScopedBrunchOfflineDefault is removed (check call sites first);
  both brunch-tui.test.ts env cases assert the chosen PI_SKIP_VERSION_CHECK behavior.
✓ chrome-header: the expand affordance is either reachable (input/shortcut wired to
  setExpanded) or the expanded content + "more" copy is removed — no advertised
  unwired behavior; the logo render respects truecolor detection consistent with the
  workspace dialog (reuse its detection, do not duplicate it).
✓ commands extension: a runtime posture switch immediately refreshes the footer
  (render request / runtime-state publish after the switch); the appendCustomEntry
  adapter returns the real entry id (or the helper's contract is changed to void if
  no caller needs the id — no silent '' placeholder); /brunch:mode messages echo the
  actual current/requested mode and list supported modes from the canonical enum,
  no hardcoded 'elicit'/'execute' strings.
✓ runtime-posture/axis-picker.ts and tui-lab/index.ts import the pi-tui Component
  type instead of redeclaring local Component interfaces (per docs/praxis/pi-types.md).
✓ seed-fixtures CLI: runSeedFixturesCli honors its Promise<number> contract — semantic
  failures (unknown seed, unreadable fixture, executor errors) are caught at the CLI
  boundary and return usage/error + nonzero exit, never a stack trace; the
  brunch.test.ts seeding call asserts the returned exit code. (Partially addressed
  already — verify current behavior before patching.)
✓ web: DrawerCard initializes expanded to false when it cannot toggle (defaultExpanded
  only honored when canToggle); structured-list-view uses an imported ReactNode type,
  no bare React namespace reference.
```

### Verification Approach

```
- Inner: npm run verify per commit group; targeted unit tests where the fix is
  behavioral (env scoping, CLI exit codes, DrawerCard state init).
- Middle: none required — all seams already carry behavioral coverage.
```

### Cross-cutting obligations

```
- D35-L startup-header behavior and the stale tooling--runtime-state-commands.md card
  are OUT of scope here — they are canonical-doc reconciliation, routed to ln-sync.
- Mode/strategy/lens strings come from the canonical vocabulary modules, not new
  literals (runtime-vocab-leaf direction, D73-L).
```

### Assumption dependency

None — every fix sits inside a settled seam with named current rationale.

### Expected touched paths (tentative)

```
src/app/
├── brunch-tui.ts                       ~
├── brunch-tui.test.ts                  ~
└── brunch.test.ts                      ~
src/.pi/
├── brunch-pi-settings.ts               ~
├── components/
│   ├── chrome-header.ts                ~
│   └── runtime-posture/axis-picker.ts  ~
└── extensions/
    ├── commands/index.ts               ~
    ├── chrome/index.ts                 ?
    └── tui-lab/index.ts                ~
src/graph/
├── seed-fixtures.ts                    ~
└── seed-fixtures.test.ts               ?
src/web/
├── components/drawer-card.tsx          ~
└── features/graph/structured-list-view.tsx ~
```

### Promotion checklist

All answers no — stays light. (The only near-trip: the entry-id contract fix touches
a helper used by the continuity seam; resolved by fixing the adapter to honor the
existing contract rather than changing the contract.)
