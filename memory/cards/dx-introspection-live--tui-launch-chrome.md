# TUI launch chrome and dev update quieting

Frontier: dx-introspection-live
Status:   active
Mode:     chain
Created:  2026-06-10

## Orientation

- Seam: Brunch TUI launch wiring in `src/app/brunch-tui.ts` plus Brunch-owned Pi chrome projection in `src/.pi/extensions/chrome/`; reusable Pi UI helpers, if needed, belong under `src/.pi/components/`.
- Frontier item: `dx-introspection-live` — this is the BRUNCH_DEV / real-TUI polish part of the DX follow-on, with D35-L chrome obligations mixed in because sidecar URL and startup header are TUI chrome surfaces.
- Volatile handoff state: none (`HANDOFF.md` absent). Current evidence comes from Pi source at `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts` and `utils/version-check.ts`, plus current Brunch `brunch-tui.ts` tests.
- Main open risk: D71-L currently says BRUNCH_DEV includes a scoped offline-default lift, but suppressing Pi update/package indicators requires keeping `PI_OFFLINE` or equivalent update-suppression env during `InteractiveMode.run()`; reconcile this as a narrowed interpretation or a small SPEC update if implementation confirms the text is now misleading.

Posture: proving (inherited from dx-introspection-live)

Frontier-level cross-cutting obligations this file carries:

- Preserve D39-L sealed-profile behavior: Brunch-launched Pi behavior comes from programmatic settings and explicit extension factories, not ambient Pi settings/resources.
- Preserve D35-L chrome discipline: downstream TUI affordances go through Brunch-owned chrome projection rather than scattering raw `ctx.ui.setHeader` / `setWidget` calls.
- Preserve I42-L dev-safety: dev affordances stay gated by `BRUNCH_DEV`, and environment overrides are save/restore scoped, never naked global mutations.
- Preserve app/.pi topology (D52-L): `app/` wires launch context; `.pi/extensions/chrome` adapts Pi UI; domain/session truth remains outside `.pi`.

---

## Card 1 — Scoped Pi startup update suppression

Status: done
Weight: full

### Target Behavior

Brunch-launched Pi sessions do not show Pi version or package update indicators during startup.

### Full-card cold-start reads

- `memory/SPEC.md` — decisions / invariants / assumptions: D39-L, D67-L, D71-L, I42-L, A25-L
- `memory/PLAN.md` — frontier: `dx-introspection-live`
- `src/app/README.md` — app wiring ownership and topology
- `src/.pi/brunch-pi-settings.ts` — current offline default and sealed settings policy
- `src/app/brunch-dev.ts` — current `BRUNCH_DEV` gate
- `src/app/brunch-tui.ts` — `runWithScopedBrunchOfflineDefault` and `launchPiInteractive`
- `src/app/brunch-tui.test.ts` — existing offline-default / dev-registration launch tests
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/utils/version-check.ts` — Pi version-check env gates (`PI_SKIP_VERSION_CHECK`, `PI_OFFLINE`)
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts` — Pi package-update check and startup notification flow
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/core/package-manager.ts` — package update check's `PI_OFFLINE` behavior

### Boundary Crossings

```pseudo
→ Brunch TUI launch (`runBrunchTui` / `launchPiInteractive`)
→ scoped process env policy for embedded Pi `InteractiveMode.run()`
→ Pi startup version/package update checks
→ unit tests over env save/restore and dev/default behavior
```

### Risks and Assumptions

- RISK: Keeping `PI_OFFLINE=1` in `BRUNCH_DEV` could accidentally disable a real-provider path beyond startup network operations.
  → MITIGATION: verify against Pi source before changing behavior; if provider calls are unaffected, prefer `PI_OFFLINE=1` because it suppresses both version and package update banners. If provider calls are affected, set `PI_SKIP_VERSION_CHECK=1` and document/package-update residue as requiring a Pi upstream seam.
- RISK: D71-L text says BRUNCH_DEV includes an offline-default lift.
  → MITIGATION: implemented 2026-06-10 — D71-L/I42-L now clarify that BRUNCH_DEV enables dev affordances but does not re-enable Pi startup update checks.
- ASSUMPTION: Pi startup update indicators are fully covered by `PI_OFFLINE` for package checks and by `PI_OFFLINE` or `PI_SKIP_VERSION_CHECK` for version checks.
  → IMPACT IF FALSE: this needs a Pi upstream option or a Brunch-local wrapper suppression cannot be complete.
  → VALIDATE: focused tests around `runWithScopedBrunchOfflineDefault` plus source-confirmed env gates.
  → memory/SPEC.md §Assumptions: A25-L / D71-L interaction

### Posture check

This tracer bullet retires the immediate unknown at the Pi/Brunch env boundary: it proves whether the sealed profile can suppress Pi's own update chrome without forking Pi and without leaking env mutations after the embedded TUI exits.

### Acceptance Criteria

```pseudo tree
startup update suppression
├── ✓ default Brunch TUI launch scopes `PI_OFFLINE=1` through `InteractiveMode.run()` and restores prior env afterward
├── ✓ BRUNCH_DEV launch still suppresses Pi version/package update indicators unless an explicit user env override already controls the value
├── ✓ tests prove prior `PI_OFFLINE` / `PI_SKIP_VERSION_CHECK` values are restored after success and failure
└── ✓ SPEC D71-L / I42-L text is reconciled if the BRUNCH_DEV offline-lift wording is no longer true
```

### Verification Approach

- Inner: focused `src/app/brunch-tui.test.ts` tests over scoped env save/restore and dev/default suppression policy.
- Middle: `npm run fix` plus focused Vitest file; `npm run verify` before commit.
- Outer: optional manual `BRUNCH_DEV=1 npm run dev -- --mode tui` smoke to confirm no Pi update block appears.

### Cross-cutting obligations

- No Pi source patch and no ambient user `.pi/settings.json` dependence.
- Do not globally mutate `process.env` outside the existing save/restore helper.
- Do not disable Brunch's own provider/network behavior unless source proves Pi offline affects only startup/package tooling.

### Expected touched paths (tentative)

```pseudo tree
memory/SPEC.md                    ?  # only if D71/I42 wording must be reconciled
src/app/
├── brunch-tui.ts                 ~
└── brunch-tui.test.ts            ~
src/.pi/
└── brunch-pi-settings.ts         ?
```

---

## Card 2 — Dev sidecar stays visible without browser auto-open

Status: next
Weight: full

### Target Behavior

In local dev, Brunch starts the web sidecar without opening a browser and shows the active sidecar URL in the upper TUI widget area.

### Full-card cold-start reads

- `memory/SPEC.md` — decisions / invariants / assumptions: D35-L, D39-L, D52-L, D70-L, D71-L, I42-L
- `memory/PLAN.md` — frontier: `dx-introspection-live`
- `src/app/README.md` — app launch ownership
- `src/.pi/extensions/README.md` — Pi registrar / chrome topology
- `docs/architecture/pi-ui-extension-patterns.md` — D35 chrome wrapper evidence and RPC degradation notes
- `src/app/brunch-dev.ts` — reliable local dev gate
- `src/app/brunch-tui.ts` — web sidecar launch, `autoOpen`, launch context, and extension-factory wiring
- `src/.pi/extensions/chrome/index.ts` — `BrunchChromeState`, `renderBrunchChrome`, `registerBrunchChrome`
- `src/.pi/__tests__/chrome.test.ts` — chrome wrapper tests and fake UI shape
- `src/app/brunch-tui.test.ts` — existing sidecar auto-open tests
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/core/extensions/types.ts` — `setWidget` placement API
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts` — widget rendering semantics and `MAX_WIDGET_LINES`

### Boundary Crossings

```pseudo
→ TUI launch (`runBrunchTui` web sidecar URL)
→ launch context / chrome state projection
→ Brunch Pi extension bundle (`createBrunchPiExtensions`)
→ TUI chrome wrapper (`renderBrunchChrome`)
→ Pi `ctx.ui.setWidget(..., { placement: "aboveEditor" })`
```

### Risks and Assumptions

- RISK: `NODE_ENV=development` is not reliable for `npm run dev` today.
  → MITIGATION: make `BRUNCH_DEV` the primary gate; optionally treat `NODE_ENV === "development"` as additional evidence only if tests cover both.
- RISK: Sidecar URL passed through chrome state could make product sessions noisy.
  → MITIGATION: show the widget only when a sidecar URL exists and auto-open is suppressed by local dev/default policy; keep production/default behavior explicit and tested.
- ASSUMPTION: `ctx.ui.setWidget` with `placement: "aboveEditor"` is the right TUI surface for a persistent sidecar URL.
  → IMPACT IF FALSE: use footer/status/title instead, but D35 says chrome wrapper owns the raw Pi call either way.
  → VALIDATE: chrome unit tests assert the widget key/content/options; optional live TUI smoke validates visibility.

### Posture check

This slice stabilizes a chrome seam rather than just adding UI text: it passes app-owned launch state into the Brunch chrome projection and proves the sidecar URL can be visible in the real product TUI without auto-opening the browser in local dev.

### Acceptance Criteria

```pseudo tree
web sidecar dev behavior
├── launch policy
│   ├── ✓ `BRUNCH_DEV=1` defaults browser auto-open off
│   ├── ✓ explicit `autoOpen: true` still opens when requested
│   └── ✓ explicit `autoOpen: false` remains honored outside dev
└── chrome widget
    ├── ✓ sidecar URL reaches `BrunchChromeState` / render options through app wiring
    ├── ✓ `registerBrunchChrome` sets a Brunch-owned upper widget containing the active sidecar route URL
    ├── ✓ widget content is width-safe / newline-safe enough for Pi string-array widgets
    └── ✓ chrome wrapper tests prove product sessions with no sidecar URL do not set the widget
```

### Verification Approach

- Inner: `src/app/brunch-tui.test.ts` sidecar policy tests; `src/.pi/__tests__/chrome.test.ts` widget projection tests.
- Middle: `npm run fix` plus focused Vitest files; `npm run verify` before commit.
- Outer: optional live TUI smoke in `BRUNCH_DEV=1` confirming the URL appears above the editor and no browser opens.

### Cross-cutting obligations

- Do not route sidecar URL through a generic status key; D35 chrome wrapper owns this UI call.
- Do not expose dev-only behavior through ambient Pi settings; use Brunch launch context and explicit extension factory wiring.
- Do not change sidecar read-only RPC semantics.

### Expected touched paths (tentative)

```pseudo tree
src/app/
├── brunch-dev.ts                  ?
├── brunch-tui.ts                  ~
└── brunch-tui.test.ts             ~
src/.pi/
├── brunch-pi-extensions.ts        ?
├── extensions/chrome/index.ts     ~
└── __tests__/chrome.test.ts       ~
```

---

## Card 3 — New-session full startup header

Status: next
Weight: full

### Target Behavior

When Brunch creates a new session, the TUI shows a Brunch-owned expandable startup header with full session/spec/help information.

### Full-card cold-start reads

- `memory/SPEC.md` — decisions / invariants / assumptions: D35-L, D39-L, D52-L, D71-L, I42-L
- `memory/PLAN.md` — frontier: `dx-introspection-live`
- `src/.pi/extensions/README.md` — chrome extension ownership
- `docs/architecture/pi-ui-extension-patterns.md` — startup/header evidence and D35 wrapper pattern
- `src/app/brunch-tui.ts` — activation decision, launch context, `chromeStateForWorkspace` wiring
- `src/session/workspace-session-coordinator.ts` — `SpecSessionActivationDecision` values and ready-state shape
- `src/.pi/extensions/chrome/index.ts` — current footer/title-only chrome wrapper
- `src/.pi/__tests__/chrome.test.ts` — fake UI and chrome assertions
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts` — built-in `ExpandableText` startup header pattern and `setExtensionHeader` behavior
- `/Users/lunelson/.pi/pi-mono/packages/coding-agent/src/index.ts` — exported `keyHint`, `keyText`, `rawKeyHint`, and available component exports

### Boundary Crossings

```pseudo
→ workspace activation decision (`newSpec` / `newSession` vs resume/open)
→ TUI launch context
→ Brunch chrome state / render options
→ `ctx.ui.setHeader` custom component factory
→ Pi expandable-header duck type (`setExpanded(expanded)`)
```

### Risks and Assumptions

- RISK: Pi's internal `ExpandableText` class is not exported.
  → MITIGATION: implement a tiny Brunch-local header component under `.pi/components` or inside chrome if truly local, using the exported Pi TUI `Text`/component interface and a `setExpanded` duck-typed method.
- RISK: Inferring new-session state from transcript entries is brittle after bindings or init entries are appended.
  → MITIGATION: pass the activation decision kind from `runBrunchTui` / launch context into chrome state; do not infer from JSONL length unless there is no cleaner source.
- ASSUMPTION: Only `newSpec` and `newSession` should show the full startup header; `continue` and `openSession` keep the quiet/resume experience.
  → IMPACT IF FALSE: users may want the full header every launch or only first-ever spec creation; that is a product copy/policy adjustment, not a Pi seam change.
  → VALIDATE: tests over decision-to-header policy plus optional manual TUI smoke.

### Posture check

This is a seam-stabilizing tracer bullet: Brunch keeps Pi `quietStartup` but restores the missing product onboarding surface through D35 chrome, proving startup information can be product-owned instead of relying on Pi's built-in header.

### Acceptance Criteria

```pseudo tree
new-session startup header
├── launch context
│   ├── ✓ activation decision kind is available to chrome rendering
│   └── ✓ only new-session/new-spec decisions request the full startup header
├── header component
│   ├── ✓ collapsed view shows Brunch identity, project/spec/session, sidecar hint if present, and expand hint
│   ├── ✓ expanded view shows full Brunch help/status lines comparable in information density to Pi's built-in startup help
│   ├── ✓ component implements `setExpanded(expanded: boolean)` so Pi's expand/collapse key updates it
│   └── ✓ width-sensitive lines are sanitized/truncated without ANSI leakage
└── chrome behavior
    ├── ✓ `ctx.ui.setHeader` is called only by Brunch chrome wrapper
    └── ✓ resumed/opened sessions do not install the full startup header
```

### Verification Approach

- Inner: pure render/component tests in `src/.pi/__tests__/chrome.test.ts` or a focused chrome-header test file.
- Middle: `src/app/brunch-tui.test.ts` launch-decision propagation tests; `npm run fix`; `npm run verify`.
- Outer: optional manual new-session TUI smoke to confirm expanded/collapsed behavior matches Pi's `app.tools.expand` key.

### Cross-cutting obligations

- Keep `quietStartup: true`; do not re-enable Pi's generic startup header wholesale.
- Keep the raw `setHeader` call inside the Brunch chrome wrapper path.
- Do not persist the header as a transcript message.
- Do not make the header depend on ambient Pi docs/resources or user `.pi` config.

### Expected touched paths (tentative)

```pseudo tree
src/app/
├── brunch-tui.ts                  ~
└── brunch-tui.test.ts             ~
src/.pi/
├── components/
│   └── chrome-header.ts           ?
├── extensions/chrome/index.ts     ~
└── __tests__/
    ├── chrome.test.ts             ~
    └── chrome-header.test.ts      ?
```

### Promotion checklist

Already promoted to full cards because the chain crosses app launch, Pi extension chrome, and live SPEC/D71 interpretation.
