# Keybinding policy scope fix — in-process thinking-cycle suppression + mode-shortcut hints

Frontier: main-editor-chrome
Status:   active
Mode:     single
Created:  2026-07-08

Orientation:

- Containing seam: C1's keybinding policy (`src/app/pi-settings.ts` `applyBrunchKeybindingPolicy`) and the mode-shortcut surface (`commands/index.ts`, footer hint in `chrome/index.ts`).
- Source: ln-judo-review findings 1+2 over commits `b11a4995`/`3b7e2490`. **Sequence before C2/D2/D3.**
- Main open risk: the pi-tui keybindings registry is populated at `InteractiveMode` construction; the override must run after that point (session_start handler) and before first user input matters.

Posture: proving (inherited from main-editor-chrome).

## Card (full) — scope the thinking-cycle suppression to the Brunch process; reconcile mode shortcuts

### Target Behavior

Suppressing Pi's thinking-cycle binding affects only the running Brunch session — the user's `~/.pi/agent/keybindings.json` is never written — and every advertised mode shortcut (footer hint, header copy) matches a binding that actually works.

### Full-card cold-start reads

```
- memory/SPEC.md   — D113-L (pinned thinking level), D34-L (containment posture), D39-L (sealed
  profile without forking Pi)
- memory/PLAN.md    — frontier: main-editor-chrome (judo-review addendum)
- src/app/pi-settings.ts — applyBrunchKeybindingPolicy (the file-write to delete)
- node_modules/@earendil-works/pi-tui — getKeybindings/setKeybindings module registry +
  KeybindingsManager.setUserBindings (the in-process seam)
- node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js —
  KeybindingsManager.create() at construction; setKeybindings(this.keybindings)
```

### Boundary Crossings

```
→ Brunch extension session_start (or equivalent post-InteractiveMode hook)
→ pi-tui getKeybindings() → KeybindingsManager.setUserBindings (merge: preserve user bindings,
  clear app.thinking.cycle, bind shift+tab to nothing Pi-side — Brunch's shortcut handles it)
→ commands/index.ts mode shortcuts (shift+tab cycle KEPT; alt+m picker RESTORED as a second
  shortcut — the C1 card pinned it as a preserved invariant and its removal was never decided)
→ chrome/index.ts footer status hint ('opt-m' stale literal → derived from the shortcut constants)
```

### Risks and Assumptions

```
- ASSUMPTION: getKeybindings() returns the live manager instance InteractiveMode registered, and
  setUserBindings takes effect for already-constructed editors (CustomEditor holds the manager by
  reference).
    → IMPACT IF FALSE: fall back to the file-write mechanism but hardened: write only when the
      desired key differs, restore-on-exit note, and a ceiling: comment naming the in-process seam
      as the upgrade path
    → VALIDATE: red-phase probe — construct InteractiveMode-shaped harness, flip a binding, assert
      dispatch changes
- RISK: user's file-based keybindings already mutated by earlier boots of C1's version
  → MITIGATION: one-time cleanup: if keybindings.json contains app.thinking.cycle: [] exactly as
    C1 wrote it, remove the key on boot (best-effort, logged); do not otherwise touch the file
- RISK: no-UI/print modes have no InteractiveMode and no registry to override
  → MITIGATION: hook no-ops when the registry is empty; assert in test
```

### Posture check

Proving. Closes the cross-product side-effect class (retires the "Brunch may mutate shared Pi user
config" behavior before it ships in an alpha); stabilizes the keybinding-override seam the
develop-mode groundwork will reuse.

### Acceptance Criteria

```
✓ pi-settings/keybinding test — no code path writes keybindings.json under getAgentDir()
  (applyBrunchKeybindingPolicy + its fs helpers deleted; rg sweep for writeFileSync in pi-settings)
✓ new keybinding-override test — after the session_start hook, app.thinking.cycle resolves to no
  keys in the live manager while a user-set custom binding on another action survives
✓ cleanup test — a keybindings.json carrying exactly C1's written suppression gets the key removed
  once; a user file with other content is untouched
✓ commands-runtime-switch.test.ts — alt+m opens the mode PICKER (restored invariant) and shift+tab
  CYCLES; both asserted
✓ chrome.test.ts — footer mode hint derives from BRUNCH_MODE_* constants (no 'opt-m' literal);
  header copy in chrome-header.ts matches
✓ brunch-tui.test.ts — profile-level assertion updated from the file-write mechanism to the
  in-process override (replaces C1's leaf)
```

### Invariants preserved

```
- Thinking level pinned by ModelRegistry (D113-L) — guarded by: existing model-policy tests
- shift+tab cycle behavior from C1 — guarded by: existing commands-runtime-switch cycle tests
- Sealed profile: no Pi fork, public seams only (D39-L) — guarded by: import-surface review in the
  card diff (pi-tui public exports only)
```

### Verification Approach

```
- Inner: keybinding-override + commands + chrome tests
- Outer: manual beat — live session: shift+tab cycles, alt+m opens picker, plain `pi` in another
  terminal still cycles thinking with shift+tab
```

### Cross-cutting obligations

```
- Develop-mode groundwork: the override helper takes a bindings map, not a hardcoded single key
- C2/D2/D3 sequencing: this card lands first (C2's profile leaf and D2's hint leaf reference the
  post-fix mechanism)
```

### Expected touched paths (tentative)

```
src/app/pi-settings.ts                        ~  (delete applyBrunchKeybindingPolicy + fs helpers)
src/app/pi-extensions.ts                      ~  (session_start override hook home)
src/.pi/extensions/commands/index.ts          ~  (restore alt+m picker shortcut beside shift+tab)
src/.pi/extensions/chrome/index.ts            ~  (footer hint derives from constants)
src/.pi/components/chrome-header.ts           ~  (copy alignment)
src/app/__tests__/brunch-tui.test.ts          ~
src/.pi/extensions/__tests__/
├── commands-runtime-switch.test.ts           ~
└── chrome.test.ts                            ~
```
