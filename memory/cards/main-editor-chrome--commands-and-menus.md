# Brunch commands + menu surfaces — /brunch:menu, styled consult dialog, /brunch:continue

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seam: the `brunch:` command registry (`src/.pi/extensions/commands/index.ts`), the orientation-juncture dialog (`src/.pi/extensions/session-orientation/`), and the startup workspace dialog (`src/.pi/components/workspace-dialog/`).
- Frontier: `main-editor-chrome` (FE-1169) thread 5, plus thread 6's menu-styling halves (E1 pre-session theming, consult two-line styling). Lexicon (grill-settled): **menu** = top-level workspace/spec navigation; **consult** = orientation dialog.
- Ordering: lands after `main-editor-chrome--mode-reactive-chrome.md` Card 1 (both write `commands/index.ts`; sequential, not parallel). Card 3 here depends on the exported ask re-present loop from `main-editor-chrome--ask-surface-ux.md` Card 2. Card 1's two-line row projection (ask-surface-ux file) is reused by Card 2 here.
- Main open risk: the orientation juncture currently renders through a plain select (`runJunctureForContext` → `menu.items.map(label)`); restyling it means the juncture path takes a custom component — the esc→`dismissed` inert mapping (D109-L) must survive that swap exactly.

Posture: proving (inherited from main-editor-chrome).

---

## Card 1 (light) — `/brunch:menu` replaces `/brunch:switch` · status: done

### Objective

The top-level workspace/spec navigation command is `/brunch:menu` (same workspace-dialog action, same `ctrl+shift+b` shortcut); `/brunch:switch` is retired outright (pre-release posture: no alias).

### Light-card cold-start reads

```
- memory/SPEC.md   — D34-L (containment/namespace posture), D11-L/D21-L (workspace activation seam)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 5 (lexicon: menu = workspace/spec navigation)
- src/.pi/extensions/commands/index.ts — BRUNCH_SWITCH_COMMAND + shortcut wiring
```

### Acceptance Criteria

```
✓ registry.test.ts — /brunch:menu registered; /brunch:switch absent (retired, not aliased)
✓ commands tests — menu command runs runBrunchWorkspaceAction through the same
  command-capable-context fallback as the old switch command; ctrl+shift+b shortcut still opens it
✓ chrome copy tests (chrome.test.ts / chrome-header assertions) — visible command hints say
  /brunch:menu, not switch/create wording
✓ D34-L containment tests stay green — built-in visibility/effect blocking not widened by the rename
✓ rg sweep — no remaining 'brunch:switch' references in src/ or docs/
```

### Verification Approach

```
- Inner: registry + commands tests; rg sweep as a checklist step
```

### Cross-cutting obligations

```
- Footer chrome key hints (chrome/index.ts) must show the new command name — same-commit update
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/commands/index.ts          ~
src/.pi/extensions/chrome/index.ts            ~  (key-hint copy)
src/.pi/components/chrome-header.ts           ?  (if header copy names the command)
src/.pi/extensions/__tests__/
├── registry.test.ts                          ~
├── chrome.test.ts                            ~
└── commands-runtime-switch.test.ts           ~  (shared command test home)
```

### Completion report

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| `/brunch:menu` registered; retired command absent | met | `commands-runtime-switch.test.ts` menu registration test; `registry.test.ts` shell registration test; `npm run test -- src/.pi/extensions/__tests__/commands-runtime-switch.test.ts src/.pi/extensions/__tests__/registry.test.ts src/.pi/extensions/__tests__/chrome.test.ts src/app/__tests__/brunch-tui.test.ts` |
| Menu command runs `runBrunchWorkspaceAction`; `ctrl+shift+b` still opens it through command-context fallback | met | `commands-runtime-switch.test.ts` menu command + shortcut fallback tests; `brunch-tui.test.ts` boot picker shortcut assertion |
| Visible chrome/header hints say `/brunch:menu`, not switch/create wording | met | `chrome.test.ts` footer and startup-header assertions |
| D34-L containment not widened by rename | met | `registry.test.ts` command registration remains only Brunch namespaced commands; no built-in visibility/effect changes |
| `rg` sweep has no retired command spelling in `src/` or `docs/` | met | `rg --hidden "brunch:switch|BRUNCH_SWITCH|switches spec/session" "src" "docs"` returned no matches |

Skipped-test-count delta vs parent commit: `0` for focused tests; full-suite runs reported the existing `3 skipped` count but failed twice on the known `git-host-promotion-port.test.ts` timeout before build, then the failing file passed in isolation and `npm run build` passed.

Card 1 cross-checked 2026-07-08 against `--second-look-mode-controls.md` Card 2 (superseded/deleted):
adopted its chrome-copy and D34-L containment leaves; kept retire-outright over its conditional alias
(pre-release posture). Its no-entry-when-no-UI consult leaf was already covered by Card 2 below.

---

## Card 2 (full) — `/brunch:consult` + styled consult dialog · status: pending (after Card 1)

### Target Behavior

`/brunch:consult` opens the orientation dialog as a bordered, surface-identity-styled component with two-line options (label + dim description, edited copy), and esc still resolves to the inert `dismissed` outcome with no kick.

### Full-card cold-start reads

```
- memory/SPEC.md   — D109-L (juncture semantics; esc = inert dismissed — stop-the-line), D98-L
  (menu routes), D35-L (chrome discipline)
- memory/PLAN.md    — frontier: main-editor-chrome, threads 5+6; arc deterministic-orientation
  ("/consult forces the dialog")
- src/.pi/extensions/session-orientation/{index,juncture,registrar}.ts — menu descriptors, gate,
  forceClaimOrientationJuncture (already imported by commands/index.ts)
- src/.pi/components/exchange-decision-picker.ts — the two-line row projection to reuse (from
  ask-surface-ux Card 1)
```

### Boundary Crossings

```
→ /brunch:consult command (commands/index.ts) → forceClaimOrientationJuncture + runJunctureForContext
→ session-orientation juncture render path: plain ctx.ui.select → NEW bordered custom component
→ two-line option rows (shared row projection) + surface-identity border role
→ selection → SessionOrientationMenuDescriptor item id → orientation entry (unchanged schema)
→ esc/timeout → 'dismissed' (unchanged semantics)
```

### Risks and Assumptions

```
- RISK: swapping select → custom component breaks a juncture caller that assumed select availability
  (no-UI paths, startup boot surface)
  → MITIGATION: capability-gate exactly like ask.ts (custom when available, select fallback, no-UI
    synthesizes nothing); registrar tests cover all three shapes
- RISK: option copy editing drifts menu ids
  → MITIGATION: ids are the contract (menu.items.find by id after this card — the current find-by-label
    mapping must be replaced, it breaks the moment copy changes); labels/descriptions free to edit
- ASSUMPTION: the orientation menu descriptor can carry a description per item without touching the
  session-orientation entry schema
    → IMPACT IF FALSE: schema touch promotes wider; stop and check D109-L homes
    → VALIDATE: descriptor type is Brunch-owned (session-orientation/index.ts) — confirm at red phase
```

### Posture check

Proving. Invariants: stabilizes the juncture dialog seam as a styled component while pinning the
D109-L esc-inert contract in component form. Proof of life: first surface-identity-styled menu
(the visual counterpart to the mode-reactive channel).

### Acceptance Criteria

```
✓ session-orientation registrar tests — /brunch:consult forces the dialog; selection routes by item
  id (find-by-label replaced); esc/timeout → 'dismissed', entry recorded, no kick (STOP-THE-LINE)
✓ new consult-menu component test — bordered box, two-line options, surface-identity border role
  (visibly distinct from mode-reactive editor/ask colors), both themes snapshot
✓ no-UI path test — no custom/select available → no orientation entry synthesized (unchanged)
✓ dev:components — consult menu preview entry in both themes
✓ registry.test.ts — /brunch:consult registered
```

### Invariants preserved

```
- Esc is inert at junctures (D109-L revision: "esc always means wait for me") — guarded by:
  registrar esc test; a red here is a respec signal, not a fixture update
- Orientation entries excluded from capture sweep — guarded by: existing sweep-watermark exclusion tests
- Startup/boot juncture path (extension-UI relay) still functions — guarded by: existing
  session-orientation juncture tests
```

### Verification Approach

```
- Inner: registrar + component tests (three capability shapes)
- Outer: manual beat — /brunch:consult live; esc; re-open; pick a generative option (doubles as
  FE-1167-adjacent evidence but does not discharge it)
```

### Cross-cutting obligations

```
- Border semantics: surface-identity role is a named theme role (thread 6 channel), no raw colors
- Two-line rows come from the shared row projection (ask-surface-ux Card 1) — no second implementation
```

### Expected touched paths (tentative)

```
src/.pi/extensions/session-orientation/
├── index.ts                                  ~  (descriptor gains per-item description; id routing)
├── juncture.ts                               ~  (custom-component render path + fallback)
└── __tests__/registrar.test.ts               ~
src/.pi/extensions/commands/index.ts          ~  (/brunch:consult)
src/.pi/components/
├── consult-menu.ts                           +
└── __tests__/consult-menu.test.ts            +
src/.pi/themes/*.json                         ~  (surface-identity role, if not already named)
src/dev/component-preview/registry.ts         ~
src/.pi/extensions/__tests__/registry.test.ts ~
```

---

## Card 3 (light) — `/brunch:continue` revival · status: pending (after ask-surface-ux Card 2)

### Objective

`/brunch:continue` re-presents the most recent incomplete structured exchange (open ask / undischarged declared continuation) through the exported ask re-present loop, and cancel-shaped interruptions surface a status hint that `/brunch:continue` resumes the flow.

### Light-card cold-start reads

```
- memory/SPEC.md   — D116-L (ask terminal; open-ask concept), A39-L boundary (headless discovery
  stays out — this is TUI-side only)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 5
- src/.pi/extensions/commands/index.ts — BRUNCH_CONTINUE_COMMAND disabled-constant design notes
- src/exchanges/recovery.ts — findIncompleteStructuredExchangePresents (existing scan)
- ask-surface-ux Card 2's exported re-present loop (ask.ts)
```

### Acceptance Criteria

```
✓ commands tests — /brunch:continue with an incomplete exchange re-presents its collection UI and
  the completed answer lands as the canonical result detail; with nothing open it notifies
  'nothing to continue' and no-ops
✓ cancel-hint test — after a root-esc cancel, a setStatus hint names /brunch:continue (the
  disabled-constant design's listener half)
✓ registry.test.ts — /brunch:continue registered (constant un-disabled)
```

### Verification Approach

```
- Inner: commands tests over scripted incomplete-exchange fixtures
- Outer: manual beat — cancel an ask, /brunch:continue, answer, verify one durable result
```

### Cross-cutting obligations

```
- Reuses the ask re-present loop export — no second collection path (the loop is the seam,
  ask-surface-ux Card 2 names it)
```

### Assumption dependency

Depends on: none from SPEC §Assumptions; sequenced on ask-surface-ux Card 2 landing (mechanical
dependency, not epistemic — the loop export's shape is declared there).

### Expected touched paths (tentative)

```
src/.pi/extensions/commands/index.ts          ~
src/.pi/extensions/exchanges/ask.ts           ~  (loop entry only; no collection logic change)
src/.pi/extensions/__tests__/
├── commands-runtime-switch.test.ts           ~
└── registry.test.ts                          ~
```

---

## Card 4 (light) — pre-session menu surfaces take the injected theme · status: pending (independent)

### Objective

The startup-gate workspace dialog (invoked before Pi's interactive runtime, D22-L) renders with the Brunch theme instead of unthemed defaults, using the same theme-injection pattern the in-session dialog already receives.

### Light-card cold-start reads

```
- memory/SPEC.md   — D22-L (Brunch-owned pre-Pi startup gate), I22-L (startup ordering)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 6 (E1)
- src/app/brunch-tui.ts — pre-Pi boot path constructing the startup dialog
- src/.pi/components/workspace-dialog/ — theme parameter already in the component contract
```

### Acceptance Criteria

```
✓ startup-gate test (workspace-dialog-preflight.harness.test.ts or brunch-tui.test.ts) — the pre-session
  dialog receives the resolved Brunch theme (same Theme instance family as in-session)
✓ workspace-dialog.test.ts — no in-session regression (suite named, stays green)
✓ manual check — npm run dev boot dialog renders themed in light + dark
```

### Verification Approach

```
- Inner: boot-path test asserting theme injection
- Outer: manual boot check both themes
```

### Cross-cutting obligations

```
- I22-L startup ordering untouched — theming only, no activation-flow change
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/app/brunch-tui.ts                         ~  (theme resolution before dialog construction)
src/.pi/components/workspace-dialog/          ?  (only if a default-theme fallback needs removal)
src/app/__tests__/brunch-tui.test.ts          ~
```
