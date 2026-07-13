# WR18 remediation cluster — shortcut, prompt hygiene, cancel hints

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-13

Posture: proving (inherited from walkthrough-remediation-2)

Three light cards over settled seams — the legible WR18-promoted product fixes
that neither depend on each other's findings nor touch the entry surface the
auth reversal (commit 5938981d) just landed. The duplicated
`.brunch/debug/origination.md` records row is diagnosis-shaped and is **not**
pre-scoped here; route it through `ln-diagnose` when picked up.

## Card 1 · Remove Shift+Tab mode-cycle shortcut — `done`

### Objective

Retire the `shift+tab` mode-cycle shortcut and its design entirely: it
conflicts with a Pi built-in (WR18 O1 promoted failure); mode switching remains
available via `alt+m` picker and `/brunch:mode`.

### Light-card cold-start reads

```
- memory/SPEC.md   — D98-L (two operational modes; 1:1 mode↔agent)
- memory/PLAN.md    — frontier: walkthrough-remediation-2 §Boundary/findings inventory
- TESTING_FINDINGS.md — WR18 closure table row O1 (promoted failure)
```

### Acceptance Criteria

```
✓ `rg -i 'shift\+?tab' src/` is empty — shortcut constant, registration, and
  header/footer copy all removed (chrome-shortcuts.ts, commands/index.ts docs)
✓ src/.pi/extensions/__tests__/commands-runtime-switch.test.ts — no mode-cycle
  shortcut assertions remain; mode picker (`alt+m`) and `/brunch:mode` paths stay green
✓ src/app/__tests__/pi-keybindings.test.ts and __tests__/brunch-tui.test.ts —
  reshaped to the reduced shortcut set, green
✓ gate — `npm run verify` green
```

### Verification Approach

```
- Inner: contract/unit — shortcut-registration and chrome-copy tests above
- Outer: none — deletion of a UI affordance; the mode picker's live behavior is
  already witnessed and unchanged
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/chrome-shortcuts.ts               ~   (drop BRUNCH_MODE_SHORTCUT)
src/.pi/extensions/commands/index.ts                 ~   (registration + header copy)
src/.pi/extensions/__tests__/commands-runtime-switch.test.ts ~
src/app/__tests__/pi-keybindings.test.ts             ~
src/app/__tests__/brunch-tui.test.ts                 ~?
src/.pi/components/TOPOLOGY.md                       ~?  (if shortcut is named)
```

## Card 2 · Remove Pi-documentation references from the provider system prompt — `done`

### Objective

The provider-facing system prompt (mirrored at `.brunch/debug/system-prompt.md`)
must not carry Pi's own documentation block (README/docs/examples paths and
"when asked about pi" guidance) — that content addresses Pi development, not
Brunch's product agent (WR18 O3 promoted failure).

### Light-card cold-start reads

```
- memory/SPEC.md   — sealed-profile boundary decisions (D52-L family)
- memory/PLAN.md    — frontier: walkthrough-remediation-2 §Boundary/findings inventory
- src/app/pi-settings.ts + pi-session-options.ts — where Brunch shapes the session
- Pi docs (npm pi-coding-agent 0.80.6): README.md + docs/sdk.md — the system-prompt
  configuration surface (which option suppresses/replaces the default docs block)
```

Note: the reference leaks from Pi's default prompt assembly, not from Brunch
source (`rg 'Pi documentation' src/` is empty) — the fix is a session/profile
configuration change, staying on Pi's supported surface, not string surgery.

### Acceptance Criteria

```
✓ src/app/__tests__/brunch-tui.test.ts (or the pi-session-options test home) —
  session boot options assert the prompt configuration that excludes Pi's docs
  block
✓ Tier-2/faux-harness boot — `.brunch/debug/system-prompt.md` mirror contains no
  `pi-coding-agent` doc paths; bind via existing debug-mirror test if present,
  else one targeted assertion in the harness tests
✓ gate — `npm run verify` green
```

### Verification Approach

```
- Inner: boot-option projection test
- Middle: debug-mirror content assertion on a real boot (tier-2/faux harness)
- Outer: none additional — the mirror is the product-facing artifact
```

### Assumption dependency

None recorded in SPEC. Local working assumption: Pi 0.80.6 exposes a supported
way to omit/replace the docs block. If it does not, stop and report — the
fallback (post-processing the prompt) is a design decision, not a build call.

### Expected touched paths (tentative)

```
src/app/pi-settings.ts               ~?
src/app/pi-session-options.ts        ~?
src/app/__tests__/brunch-tui.test.ts ~
src/dev/faux-harness.ts              ~?  (if the mirror assertion lands there)
src/dev/__tests__/                   ~?
```

## Card 3 · Post-ask-cancellation recovery hints — `next`

### Objective

Cancelling an ask leaves the user with actionable next steps: the cancellation
status surface names `/brunch:continue`, `/brunch:consult`, and `/brunch:mode`
(WR18 O4 promoted failure — currently the continuation collector re-surfaces
only the `/brunch:continue` hint).

### Light-card cold-start reads

```
- memory/SPEC.md   — D119-L (unified /continue + continue/wait lexicon), D109-L
                     (juncture family)
- memory/PLAN.md    — frontier: walkthrough-remediation-2 §Boundary/findings inventory
- src/.pi/extensions/commands/index.ts — header comment: "The ask collector owns
  cancellation status hints"; the collector's hint lifecycle (re-surface on
  cancel, clear on answered result)
```

### Acceptance Criteria

```
✓ ask-collector cancellation test (existing collector test home under
  src/exchanges/ or src/.pi/extensions/__tests__/) — cancelled ask surfaces all
  three hints; answered ask clears them
✓ src/.pi/extensions/__tests__/commands-runtime-switch.test.ts — hint copy names
  live commands only (no retired `brunch login`-era copy)
✓ gate — `npm run verify` green
```

### Verification Approach

```
- Inner: collector lifecycle tests (cancel → hints, answer → cleared)
- Outer: owned by FE-1187 punch-list (ask-cancellation beat) — record the live
  re-check in TESTING_FINDINGS.md when the next walkthrough runs this surface
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/commands/index.ts   ~   (hint copy/lifecycle)
src/exchanges/                          ~?  (if the collector owns the status line)
src/.pi/extensions/__tests__/           ~
```
