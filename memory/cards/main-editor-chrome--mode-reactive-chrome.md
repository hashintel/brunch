# Mode-reactive input chrome — shift+tab mode cycle + border color by mode

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seam: the chrome getter seam Card 1 (persistent editor tracer) opened — labels/colors flow through one `getLabels`-style getter — plus Pi's `KeybindingsManager` override surface (`app.thinking.cycle` default `shift+tab`, `core/keybindings.js`).
- Frontier: `main-editor-chrome` (FE-1169) thread 4. Groundwork for Horizon `develop-mode` (must extend to a third mode with zero re-plumbing).
- Ordering: independent of the ask-surface-ux and details-rendering files except one declared touch point — Card 2 here colors the ask surfaces via the `EditorTheme`/theme injection at the `ctx.ui.custom` call sites in `ask.ts`; those files change picker *content*, not the theme injection. Land this after ask-surface-ux Card 2 to avoid textual merge noise in `ask.ts`.
- Main open risk: keybinding overrides are user-config territory in Pi (`~/.pi/agent/keybindings.json` read by `KeybindingsManager`) — Brunch must set the default programmatically without clobbering user overrides.

Posture: proving (inherited from main-editor-chrome).

---

## Card 1 (full) — shift+tab cycles operational mode; thinking-cycle retired from user surface · status: done

### Target Behavior

Pressing shift+tab in a Brunch session cycles the operational mode (specify → execute → specify) through the same transcript-backed switch path as `/brunch:mode`, and no user-facing binding cycles the thinking level.

### Full-card cold-start reads

```
- memory/SPEC.md   — D113-L (thinking level is pinned policy — the justification), D98-L (mode set),
  I25-L (mode reconstructable from transcript entries), D34-L (containment posture), D109-L (a real
  mode switch claims the J5 juncture), I59-L (no-auth gate)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 4
- src/.pi/extensions/commands/index.ts — applyModeSwitchAndOrient (the ONE mode-switch path: in-flight
  settle, J5 gate claim, active-tool recomputation, chrome refresh) + the alt+m getCommandContext
  borrowing pattern for shortcut contexts
- src/app/pi-settings.ts — sealed settings/profile policy (the likely home for the keybinding override)
- node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js — KEYBINDINGS +
  KeybindingsManager override file mechanics
```

### Boundary Crossings

```
→ physical shift+tab in the sealed Pi profile (pi-settings.ts / keybinding registration)
→ Pi KeybindingsManager (app.thinking.cycle rebind/suppression)
→ Brunch shortcut handler → getCommandContext borrowing (shortcut contexts lack waitForIdle)
→ applyModeSwitchAndOrient (transcript entry, in-flight settle, J5 claim, tool recomputation)
→ requestChromeRefresh → footer + editor labels re-render
```

### Risks and Assumptions

```
- ASSUMPTION: Brunch can rebind/suppress app.thinking.cycle programmatically (registry-layer, D113-L
  style) without forking Pi or clobbering a user's keybindings.json overrides.
    → IMPACT IF FALSE: alt+m and /brunch:mode remain the functional path; document shift+tab as
      blocked by Pi API shape and route the keybinding question to ln-spike (do not improvise a
      different chord in this card — chord choice is a UX decision)
    → VALIDATE: red-phase probe against the installed keybinding API around pi-settings /
      shortcut registration — first commit of this card; assert through the Brunch-launched
      profile, not a helper unit-tested in isolation
- RISK: a second mode-switch implementation creeps in beside applyModeSwitchAndOrient and leaks
  Pi thinking-level policy back in
  → MITIGATION: the handler is a thin dispatcher into applyModeSwitchAndOrient; no new mutation path
- RISK: shortcut contexts lack waitForIdle, recreating the already-solved J5 race
  → MITIGATION: reuse the alt+m getCommandContext borrowing path verbatim
- RISK: cycling with no allowlisted model fires an orientation/kick path
  → MITIGATION: J5 stays routed through the existing session-orientation/no-auth gates; pin with a
    no-auth shortcut test if existing coverage misses the shortcut entry
- RISK: shift+tab arrives while a picker/overlay is focused and cycles mode mid-dialog
  → MITIGATION: handler no-ops when a ctx.ui.custom surface is mounted; assert in test
```

### Posture check

Proving. Uncertainty: retires the "can we reclaim Pi's default binding cleanly?" unknown — the
develop-mode groundwork depends on the answer. Invariants: mode switching stays single-path
(transcript-backed, I25-L), no second switch mechanism.

### Acceptance Criteria

```
✓ commands-runtime-switch.test.ts (extended) — shortcut-triggered cycling reuses
  applyModeSwitchAndOrient: same runtime-switch entry shape, in-flight settle, J5 gate claim,
  active-tool recomputation, chrome refresh
✓ same suite — cycling wraps (specify → execute → specify) and derives the order from
  OPERATIONAL_MODE_IDS (a third mode joins the cycle with no handler change; develop is NOT
  synthesized before it exists)
✓ same suite — handler no-ops while a custom UI surface is mounted
✓ pi-settings.test.ts or brunch-tui.test.ts — the Brunch-launched profile no longer exposes
  shift+tab as app.thinking.cycle and maps it to Brunch mode cycling (asserted through the real
  profile/registration path, mechanism per red-phase probe)
✓ no-auth shortcut test — cycling does not fire a provider turn when no allowlisted model resolves
  (I59-L stays green)
✓ chrome.test.ts — footer/editor projected mode updates after a shortcut-triggered switch
✓ registry.test.ts — registration inventory green
```

### Invariants preserved

```
- Thinking level remains ModelRegistry-pinned policy (D113-L) — guarded by: existing model-policy
  tests + the profile keybinding assertion
- alt+m mode picker and /brunch:mode unchanged — guarded by: existing commands-runtime-switch tests
- Mode switch settles in-flight assistant work before orienting (D109-L J5 choreography) — guarded
  by: existing J5 race tests + the shortcut-path reuse assertion (stop-the-line)
- I25-L transcript reconstructability — guarded by: same entry shape assertion above
```

### Verification Approach

```
- Inner: commands shortcut tests + sealed profile/keybinding assertions
- Middle: app boot/extension registration test proving the binding exists in the real Brunch profile
- Outer: manual beat — shift+tab in a live session cycles mode in footer + editor label; shift+tab
  inside a picker does nothing
```

### Cross-cutting obligations

```
- Develop-mode groundwork: cycle order derived from the canonical mode-id list, never hardcoded pairs
```

### Expected touched paths (tentative)

```
src/.pi/extensions/commands/index.ts          ~  (shift+tab shortcut + cycle dispatcher)
src/app/pi-settings.ts                        ~  (sealed-profile keybinding override — likely home)
src/.pi/extensions/__tests__/
├── commands-runtime-switch.test.ts           ~
├── chrome.test.ts                            ~
└── registry.test.ts                          ~
src/app/__tests__/brunch-tui.test.ts          ~  (profile binding assertion)
src/app/pi-extensions.ts                      ?  (only if registration must install at boot)
```

### Completion Notes

- Built 2026-07-08: `shift+tab` now cycles the transcript-backed operational mode through
  `applyModeSwitchAndOrient`, deriving wrap order from `OPERATIONAL_MODE_IDS`; `/brunch:mode` still owns
  the picker/explicit command path.
- Brunch profile creation now preserves existing `keybindings.json` entries while forcing
  `app.thinking.cycle` to `[]`, freeing `shift+tab` from Pi's reserved thinking-cycle binding in the
  Brunch-launched profile.
- Verification: focused card suites green; `npm run fix` green; full `npm run verify` blocked twice by the
  pre-existing full-suite-only `src/app/__tests__/git-host-promotion-port.test.ts` timeout documented in
  `HANDOFF.md`, while that file passes in isolation.

**Card 1 built 2026-07-08 (`b11a4995`) — post-landing judo-review addendum:** the shipped keybinding
mechanism (file-write to the shared `~/.pi/agent/keybindings.json`) and the alt+m removal + stale
`opt-m` footer hint are superseded by `memory/cards/main-editor-chrome--keybinding-scope-fix.md`,
which also owns updating Card 1's profile-assertion leaf to the in-process mechanism. Card 2 (border
color) is unaffected but lands after that fix.

Card 1 merged 2026-07-08 from `--second-look-mode-controls.md` Card 1 (superseded/deleted): its
applyModeSwitchAndOrient reuse framing, J5/waitForIdle race mitigation via getCommandContext
borrowing, no-auth I59-L leaf, pi-settings.ts as the binding home, and the blocked→ln-spike escape.
Its /brunch:menu+consult card was folded as confirmation into --commands-and-menus.md (chrome-header
key-hint copy + D34-L containment leaf adopted there).

---

## Card 2 (light) — border + border-label color by operational mode · status: pending (after Card 1)

### Objective

The main editor and ask-surface borders (and their embedded labels) take a mode-keyed theme color — one color role per operational mode — updating live on mode switch, while workspace-dialog and orientation surfaces keep their stable surface-identity border color.

### Light-card cold-start reads

```
- memory/SPEC.md   — D35-L (single-renderer chrome discipline)
- memory/PLAN.md    — frontier: main-editor-chrome, threads 4 + 6 boundary (two border channels)
- src/.pi/components/brunch-editor.ts — getLabels/borderColor seam from the tracer card
- src/.pi/extensions/exchanges/ask.ts — EditorTheme/theme injection at ctx.ui.custom call sites
- src/.pi/themes/brunch-light.json + brunch-dark.json — where mode role colors live
```

### Acceptance Criteria

```
✓ theme test (src/dev/component-preview/__tests__/theme.test.ts or new) — both theme files define
  the mode color roles (one per OPERATIONAL_MODE_IDS entry; adding a mode id without a theme role fails)
✓ chrome.test.ts — editor border color resolves from projected operational mode; switching mode
  re-renders with the other role (freshness through the getter, no re-mount)
✓ ask surface test — decision/multi/answer-editor surfaces receive the mode-keyed border color
  through their theme injection; workspace-dialog assertions unchanged (surface-identity untouched)
✓ dev:components — editor + one ask surface previewable under each mode color in both themes
```

### Verification Approach

```
- Inner: theme role tests + chrome/component tests
- Outer: dev:components both themes; live mode-switch beat (shares Card 1's manual session)
```

### Cross-cutting obligations

```
- Border semantics (thread 6): implement as named theme roles (mode-reactive channel), not literal
  colors — this card creates the first named roles the theme-expansion card will demo
- No raw ctx.ui.* scatter: color flows through the existing getter/injection seams only
```

### Assumption dependency

None — the getter seam exists (tracer card landed) and theme files are Brunch-owned.

### Expected touched paths (tentative)

```
src/.pi/themes/brunch-light.json              ~
src/.pi/themes/brunch-dark.json               ~
src/.pi/extensions/chrome/index.ts            ~  (mode → role resolution into editor labels/color)
src/.pi/extensions/exchanges/ask.ts           ~  (theme injection carries mode role)
src/.pi/components/__tests__/                 ~
src/.pi/extensions/__tests__/chrome.test.ts   ~
src/dev/component-preview/registry.ts         ~
```
