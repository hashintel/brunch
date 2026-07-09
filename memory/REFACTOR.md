# Refactor: PR #305 review findings (ln-induct pass 2, 2026-07-09)

> Temporary execution aid for `ln-refactor`. Delete when complete or superseded.
> Source: `ln-induct` pass over PR #305 review comments (2026-07-09, second pass). All three
> findings verified against code; all fix-in-place (no lens promoted). The prior REFACTOR.md
> (vocabulary residues) was consumed by `2c5e4908`.

## Problem Statement

Three point defects on the FE-1169 branch, all in chrome/ask surfaces the frontier built:

1. **Continue hint over-promises and never expires.** Root-esc on a *standalone* ask sets the
   `brunch.continue` status ("Run /brunch:continue to resume"), but the continue command only
   recovers declared offer continuations — a cancelled standalone ask is invisible to it, so the
   user follows the hint into "Nothing to continue." The status also has no lifecycle owner:
   nothing clears it after a successful continue (or ever). And the ask/continuation split left
   `surfaceContinueHint` + `CONTINUE_STATUS_KEY`/`CONTINUE_COMMAND_HINT` duplicated in both files.
2. **Best-effort keybinding cleanup can crash startup.** The one-time `keybindings.json` cleanup
   guards its read with try/catch but not its write; a read-only agent dir throws out of
   `createBrunchPiSettings` and kills boot for pure hygiene.
3. **Welcome copy bypasses the shortcut-hint formatter.** The startup header interpolates the raw
   shortcut constants (`alt+m`, `shift+tab`) while every other chrome surface renders them through
   `formatChromeShortcutHint` (`alt-m`) — inconsistent register within one screen of chrome.

## Solution

The continue hint is minted only when the continue command can actually recover (declared
continuations), carries an owner that clears it on successful recovery, and lives in one module;
keybinding cleanup tolerates write failure; all chrome shortcut hints render through the one
formatter.

```pseudo graph — current
standalone ask root-esc -> setStatus(brunch.continue, "run /brunch:continue")   # unrecoverable promise
declared-continuation esc -> setStatus(...)                                     # recoverable, ok
/brunch:continue success -> (status persists forever)                           # no owner
surfaceContinueHint: ask.ts copy + ask/continuation.ts copy                     # duplicated post-split
cleanup keybindings.json: read guarded, write unguarded -> startup crash path
welcome copy: raw "alt+m" | footer: formatChromeShortcutHint -> "alt-m"
```

```pseudo graph — desired
standalone ask root-esc -> cancelled terminal only (no false hint)              # or reworded honest hint
declared-continuation esc -> setStatus(...)
/brunch:continue success -> clearStatus(brunch.continue)
surfaceContinueHint: one home (ask/continuation.ts), imported by ask.ts
cleanup keybindings.json: read + write both tolerant; failure = skip, not crash
all chrome shortcut hints -> formatChromeShortcutHint
```

## Commits

Each leaves the codebase working; `npm run verify` gates each.

1. ✅ Render the startup-header welcome shortcuts through the canonical hint formatter so header and
   footer share one register. Cosmetic; existing header tests updated to reject the raw `+` form.
2. ✅ Make the keybinding-file cleanup fully best-effort: tolerate write failure the same way read
   failure is tolerated (skip silently; never throw out of settings creation). Pinned with a
   read-only file test that a failing write does not propagate.
3. Deduplicate the continue-hint helper into a single home and give the status a lifecycle: hint is
   set only on cancels the continue command can recover (declared continuations); a successful
   `/brunch:continue` recovery clears the status key. Standalone-ask cancels either surface no
   continue hint or an honest message that does not name the command. Behavioral commit, last.
   Tests: standalone cancel produces no dead-end hint; declared-continuation cancel still hints;
   successful continue clears the status.

## Decisions

- The `brunch.continue` status gains an explicit owner (set on recoverable cancel, cleared on
  recovery) — matches the chrome TOPOLOGY precedent of retiring the leaky `brunch.kick` status.
- Whether standalone cancels get *no* hint or a reworded one is the builder's call at red-green
  time; the invariant is only "never promise a command that will report Nothing to continue."
- Interface changes: none public. `StructuredExchangeUiContext.ui` may need `setStatus`'s clearing
  convention documented (empty text vs a dedicated clear call — follow Pi's actual API).
- Topology files: none expected; if the hint-helper home move changes what the exchanges TOPOLOGY
  names, update it in the same commit.

## Testing Decisions

- Commit 3's tests assert *user-visible contract*, not internals: the status text after each
  cancel/recovery path, and that no path leaves a hint naming a command that cannot recover.
- Prior art: chrome status handling tests (`chrome.test.ts` status sanitization), the D3
  continue-command coverage in `commands-runtime-switch.test.ts`.
- Commit 2: simulate write failure (mock `writeFileSync` throw or a read-only tmpdir) and assert
  settings creation still returns.

## Out of Scope

- Legacy question read-path retirement (PLAN §Next, separate slice off `next`).
- FE-1163 derived-inventory candidate row (noted on the FE-1163 Active bullet).
- Any broadening of the continue command's recovery scope (e.g. re-presenting standalone asks) —
  that would be a feature decision for a future frontier, not this fix.
