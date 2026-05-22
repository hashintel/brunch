# FE-744 cleanup cards

## Orientation

- Containing seam: Brunch's internal Pi extension shell (`src/pi-extensions/brunch/`) and TUI launcher wiring.
- Frontier item: `pi-ui-extension-patterns` / FE-744 on `ln/fe-744-pi-ui-extension-patterns`; this is cleanup inside the existing branch/issue, not a new frontier.
- Volatile handoff state: absorbed and deleted; latest builder pass removed overlay usage, empty footer formatting, and custom spinner behavior.
- Main risk: preserving product-shell behavior while deleting inert extension seams; do not widen into new custom UI patterns or upstream Pi command policy work.

Frontier obligations to preserve:

- Brunch chrome/status affordances route through Brunch-owned wrappers rather than scattered raw `ctx.ui.*` calls.
- Workspace switcher UI remains pure decision rendering; coordinator activation owns session/state effects.
- Replacement-session work after `ctx.switchSession()` uses only the `withSession` replacement context.
- Exact built-in Pi command/keybinding suppression remains a documented upstream policy gap, not local workaround code.

## Card 1 — Delete inert working-indicator seam

Status: done

### Objective

Remove Brunch's no-op working-indicator reset from the chrome wrapper so the current shell only owns Pi UI surfaces with product behavior.

### Acceptance Criteria

✓ `renderBrunchChrome` no longer requires or calls `setWorkingIndicator`.
✓ Brunch chrome tests still prove header, footer restoration, status, widget, and title projection from one product-state snapshot.
✓ The Pi UI extension memo no longer claims Brunch tests or wrapper behavior around working-indicator reset; it only records custom spinner patterns as deferred future evidence.

### Verification Approach

- Inner: targeted unit tests plus `npm run fix` — proves the wrapper surface and exports compile after deletion.
- Gate: `npm run verify` before commit.

### Cross-cutting obligations

- Keep `renderBrunchChrome` as the sole Brunch chrome projection API for current downstream TUI affordances.
- Do not add a replacement spinner abstraction until a concrete side-task/reviewer spinner is product-proven.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light.

## Card 2 — Rename extension shell and make workspace command dependency explicit

Status: next

### Objective

Make the Brunch Pi extension factory describe the full extension shell and make workspace-command registration impossible to call with an absent coordinator.

### Acceptance Criteria

✓ The exported/internal factory name reflects that it registers the Brunch Pi extension shell, not chrome only.
✓ Workspace command registration accepts a required coordinator and contains no optional coordinator branch or non-null assertion.
✓ Existing tests still prove session-start chrome binding, branch-flow cancellation, command registration, workspace activation, and replacement-context use.
✓ Public re-exports and TUI launcher imports use the new name consistently, with no stale `createBrunchChromeExtension` references.

### Verification Approach

- Inner: targeted search/tests plus `npm run fix` — proves naming and type-contract cleanup across imports/exports.
- Gate: `npm run verify` before commit.

### Cross-cutting obligations

- Preserve the internal extension layout by Pi surface/responsibility.
- Keep `/brunch-workspace` product-owned and routed through coordinator activation before any Pi session replacement.
- Do not use extension command collisions as a built-in command override mechanism.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

Result: stays light.
