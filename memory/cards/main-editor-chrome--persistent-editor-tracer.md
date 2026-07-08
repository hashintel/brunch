# Persistent Brunch editor chrome — tracer + headless guard

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

> Merged 2026-07-08 from two independent scoping passes (this file's first commit + a second take);
> structure and oracles from the second pass, evidence base and product-path tier from the first.

Orientation:

- Containing seam: Pi's `ctx.ui.setEditorComponent` (public, documented, with a shipped worked example) consumed from Brunch's chrome extension — the D35-L surface that already owns footer/header/title.
- Frontier: `main-editor-chrome` (FE-1169), thread 1 of six; this is the tracer the other five threads aim from (thread 4's mode-reactive border colors plumb through the seam this slice opens).
- Volatile state: Card 1 landed as `a83080d` (`FE-1169: Mount persistent Brunch editor chrome`). FE-1164 tie-off is adjacent stack state, not a dependency.
- Main open risk: the swap path is production-unexercised — factory invocation timing at session start, differential height accounting for a taller boxed editor (F18 precedent: embedded height drift ate transcript lines), and focus/autocomplete routing are all assumptions until a live session renders.

Posture: proving (inherited from main-editor-chrome).

---

## Card 1 (full): `BrunchEditorComponent` becomes the persistent input editor

Status: done — 2026-07-08

### Target Behavior

In a UI-capable Brunch session, the main input editor renders as the Brunch bordered editor with live border labels (operational mode top-right, spec title bottom-right, sidecar URL below) that update when runtime state changes, with no regression in typing, autocomplete, or app keybindings.

### Full-card cold-start reads

```
- memory/SPEC.md   — D22-L, D35-L, D115-L, D34-L, A18-L, I22-L, I59-L; D40-L/I25-L (mode projection)
- memory/PLAN.md    — frontier: main-editor-chrome (threads 1 + 4 boundary)
- src/.pi/extensions/chrome/TOPOLOGY.md — chrome ownership + single-renderer rule
- src/.pi/components/TOPOLOGY.md — BrunchEditorComponent status + component test conventions
- src/.pi/components/brunch-editor.ts — component + getLabels freshness contract
- node_modules/@earendil-works/pi-coding-agent/docs/tui.md — Pattern 7 / setEditorComponent factory contract
- node_modules/@earendil-works/pi-coding-agent/examples/extensions/border-status-editor.ts — shipped
  current-version worked example of exactly this install (line ~148)
- src/dev/TOPOLOGY.md — dev:components preview harness contract for brunch-editor
```

### Boundary Crossings

```
→ Brunch TUI session boot (src/app/brunch-tui.ts / createBrunchPiExtensions)
→ Pi extension registration (src/app/pi-extensions.ts)
→ chrome session_start handler (src/.pi/extensions/chrome/index.ts — registerBrunchChrome installs the
  editor factory; BrunchChromeUi pick widens with setEditorComponent)
→ ctx.ui.setEditorComponent(factory) [Pi public seam]
→ BrunchEditorComponent.render → getLabels() → projectBrunchAgentState(ctx.sessionManager.getEntries())
  + chrome state (spec title, sidecar URL)
→ pi-tui differential renderer (height accounting)
```

### Risks and Assumptions

```
- ASSUMPTION: InteractiveMode's differential renderer correctly accounts for the boxed editor's
  extra rows (borders + belowLines) as content grows/shrinks.
    → IMPACT IF FALSE: transcript-line corruption like F18; the belowLines channel may have to move
      to the footer and the wrapper flatten — reshapes threads 4/6, not just this card.
    → VALIDATE: manual smoke in a real terminal (grow past MIN_CONTENT_LINES, autocomplete open/close,
      resize); harness render-at-multiple-widths assertion as the repeatable inner proxy.
    → memory/SPEC.md §Assumptions: add as a new A-row only if it survives as a caveat rather than
      being retired here.
- ASSUMPTION: setEditorComponent installed from the same session_start handler that sets
  footer/header/title takes effect for the initial editor mount, not only after a later swap.
    → IMPACT IF FALSE: needs a deferred install hook or different mounting seam before threads 4/6
      can proceed; contained to chrome/index.ts.
    → VALIDATE: extension-level session_start test + product-path boot test observing the installed
      factory; manual smoke first item. (The shipped border-status-editor example installs from an
      extension activate path — read it before building.)
- RISK: border labels duplicate or contradict footer chrome (mode already renders in the footer
  status line — two sources of truth feel)
  → MITIGATION: mount only canonical facts already in BrunchChromeState / live telemetry; decide
    top-right = mode, bottom-right = spec title deliberately against the footer's content, and note
    any duplication for thread 6's border-semantics pass rather than improvising here.
- RISK: label getters sample stale runtime state after /brunch:mode switch
  → MITIGATION: getLabels pulled fresh every render (existing contract); reuse the footer's
    requestChromeRefresh path (commands already call it after mode switch); test asserts labels
    re-render from re-projected entries.
- RISK: headless/RPC contexts expose enough UI methods that a naive guard gives false confidence
  → MITIGATION: install only when the context exposes setEditorComponent as a function (same guard
    family as ask.ts hasUI checks) and test the actual degraded context shape used by Brunch
    fakes/Tier-2 boot, keeping behavior product-shaped rather than Pi-exception-shaped.
```

### Posture check

Proving. Scores on all three axes: **proof of life** (first production path through `ctx.ui.setEditorComponent` with Brunch-owned chrome state), **invariants** (stabilizes D35-L by keeping persistent input chrome under the chrome renderer seam — and shapes the getter seam thread 4 colors and `develop`-mode groundwork extends), **uncertainty** (retires the render-height / swap-timing / focus-routing assumption). Landing it tells us whether the bordered-wrapper approach holds for persistent chrome or must flatten.

### Acceptance Criteria

```
✓ src/.pi/extensions/__tests__/chrome.test.ts — registerBrunchChrome installs a ctx.ui.setEditorComponent
  factory during session_start when the UI context supports it; factory constructs BrunchEditorComponent
✓ src/.pi/extensions/__tests__/chrome.test.ts — no-UI/stub context: no install attempt, no throw
✓ src/.pi/extensions/__tests__/chrome.test.ts — labels derive from activated chrome state + live
  telemetry (mode top-right, spec title bottom-right, sidecar URL below), not hardcoded placeholders
✓ src/.pi/extensions/__tests__/chrome.test.ts — a runtime-state append re-renders with the new mode
  label (getLabels freshness, not cached)
✓ src/app/__tests__/brunch-tui.test.ts — createBrunchPiExtensions wires the editor mount through the
  same chrome registrar used by normal Brunch TUI launch (product path, not direct injection)
✓ src/.pi/components/__tests__/brunch-editor.harness.test.ts — boxed editor renders at multiple widths
  with autocomplete rows open without leaking rows outside the box (repeatable proxy for the height
  assumption); existing typing/escape/ctrl-d behavior stays green
✓ src/.pi/components/__tests__/brunch-editor.test.ts — existing direct suite stays green
✓ src/.pi/extensions/__tests__/registry.test.ts — extension registration inventory stays green
✓ Manual outer smoke — one real terminal run: mounted editor does not corrupt input height or focus
  after typing, autocomplete, resize, and submitting one prompt; anomalies recorded in build handoff/PR
```

### Invariants preserved

```
- Default Pi editing behavior (typing, app keybindings, autocomplete, external editor ctrl+g) —
  guarded by: CustomEditor super delegation (ambient — name it in the install comment) +
  brunch-editor.harness.test.ts + manual smoke
- Startup chrome still renders footer/title/header through renderBrunchChrome (D35-L single-renderer
  discipline; no new raw ctx.ui.* scatter) — guarded by: existing chrome.test.ts + brunch-tui.test.ts
  chrome assertions
- BrunchEditorComponent stays a presentation component with domain labels injected by caller —
  guarded by: src/.pi/components/TOPOLOGY.md dependency rules + component tests
- D22-L/I22-L startup ordering: no transcript rendering or agent loop before workspace activation —
  guarded by: existing I22-L suites (stop-the-line if red)
- D115-L/I59-L no-auth/no-UI degradation: chrome work must not backdoor a provider turn — guarded by:
  existing I59-L suites (stop-the-line if red)
```

### Verification Approach

```
- Inner: vitest — chrome registrar tests, component direct/harness tests (fake ui context): seam
  wiring, label projection + freshness, no-UI degradation, height proxy
- Middle: product-path test in brunch-tui.test.ts — the mount rides Brunch's real extension bundle
- Outer: manual TUI walkthrough per docs/praxis/manual-testing.md — render height, focus, swap timing,
  resize; ALSO discharges the absorbed physical-terminal wheel smoke beat (iTerm2/Kitty/Ghostty,
  same session, same terminals)
```

### Cross-cutting obligations

```
- Border semantics (thread 6): border color stays theme 'border' in this slice, but label/color inputs
  must flow through one getLabels-style getter so thread 4 swaps in mode-reactive color without
  re-plumbing — no raw border colors at the install site
- Scope fence: do not pull in FE-1169 later threads (shift+tab mode cycling, details-driven transcript
  rendering, /brunch:* command reshaping) beyond the minimum labels this tracer needs
- D34-L containment posture: no new commands/keybindings in this slice
- Absorbed outer beat: physical-terminal wheel smoke recorded with this card's manual smoke evidence
```

### Expected touched paths (tentative)

```
src/.pi/extensions/chrome/
├── index.ts                                   ~  (install editor factory; widen BrunchChromeUi pick)
└── TOPOLOGY.md                                ~  (editor surface joins chrome ownership)
src/.pi/extensions/__tests__/chrome.test.ts    ~
src/.pi/components/
├── brunch-editor.ts                           ?  (only if label shape needs a gap fix)
├── TOPOLOGY.md                                ~
└── __tests__/brunch-editor.harness.test.ts    ~  (width/autocomplete height proxy)
src/app/
├── pi-extensions.ts                           ~  (label/spec/sidecar inputs if not already in chrome state)
└── __tests__/brunch-tui.test.ts               ~
src/dev/TOPOLOGY.md                            ?  (only if the preview entry contract shifts)
```

### Completion report

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Install `ctx.ui.setEditorComponent` factory during `session_start` | met | `src/.pi/extensions/__tests__/chrome.test.ts` — “installs BrunchEditorComponent during session_start when the UI supports editor swaps” |
| No-UI/stub context does not install or throw | met | `src/.pi/extensions/__tests__/chrome.test.ts` — “does not install the editor in no-UI/stub contexts” |
| Labels derive from chrome state + live telemetry | met | `src/.pi/extensions/__tests__/chrome.test.ts` — mode/spec/sidecar assertions from factory labels |
| Runtime-state append re-renders with new mode label | met | `src/.pi/extensions/__tests__/chrome.test.ts` — “keeps editor labels fresh when runtime state changes” |
| Product path wires mount through normal extension bundle | met | `src/app/__tests__/brunch-tui.test.ts` — “wires the persistent editor mount through the normal Brunch extension bundle” |
| Boxed editor renders at multiple widths with autocomplete rows boxed | met | `src/.pi/components/__tests__/brunch-editor.harness.test.ts` — “keeps autocomplete rows inside the box at multiple widths” |
| Existing direct editor suite stays green | met | `npm run test -- src/.pi/components/__tests__/brunch-editor.harness.test.ts src/.pi/components/__tests__/brunch-editor.test.ts src/.pi/extensions/__tests__/chrome.test.ts src/app/__tests__/brunch-tui.test.ts src/.pi/extensions/__tests__/registry.test.ts` — 5 files / 113 tests passed |
| Extension registration inventory stays green | met | same targeted command — `src/.pi/extensions/__tests__/registry.test.ts` included |
| Manual outer smoke | met-with-divergence | `expect` pseudo-terminal smoke launched `npm run dev -- --workspace .fixtures/workbenches/workspace-alpha-grounding`, accepted the default dialog, typed editor text, opened slash autocomplete, resized PTY, submitted, and exited without crash; physical iTerm2/Kitty/Ghostty wheel-specific check remains better human evidence but no anomaly was observed in the agent-drivable terminal |
| Default Pi editing behavior preserved | met | existing `BrunchEditorComponent` extends `CustomEditor`; `src/.pi/components/__tests__/brunch-editor.harness.test.ts` typing/escape/ctrl-d tests green |
| Startup chrome still renders through one chrome seam | met | `registerBrunchChrome` owns editor + footer/header/title install; chrome topology updated; existing chrome tests green |
| Component stays presentation-only with caller-injected labels | met | `BrunchEditorComponent` unchanged; labels built in chrome registrar; `src/.pi/components/TOPOLOGY.md` refreshed |
| D22-L/I22-L startup ordering | met | product-path mount test exercises `createBrunchPiExtensions`; no launch choreography changed |
| D115-L/I59-L no-auth/no-UI degradation | met | no-UI editor guard test; no provider-turn path changed |

Skipped-test delta vs parent: 0 observed in targeted suite (no skipped tests reported). Full-suite `npm run verify` attempted twice after Card 1 and hit the known `git-host-promotion-port` timeout both times (PLAN already names this roving-suite flake); targeted card suite and `npm run build` passed.

Fresh-thread resume for Card 2:

- Card 1 is committed; worktree was clean except this scope-file status update when this note was added.
- A brief Card 2 red probe was started then intentionally removed to keep the next thread clean; the useful shape was a new `src/.pi/extensions/__tests__/workspace-action-headless.test.ts` asserting (1) no `ui.custom` means no throw, product-shaped `notify(..., 'warning')`, and no `activateWorkspace(undefined)`, and (2) UI-capable decision/cancelled/needs_human branches still flow as today.
- The implementation target remains `src/.pi/extensions/workspace/index.ts`: guard before the `ctx.ui.custom<SpecSessionActivationDecision>(...)` call, mirroring `ask.ts`'s `ctx.hasUI && typeof ctx.ui?.custom === 'function'` capability style. No SPEC/PLAN promotion expected.

---

## Card 2 (light): workspace dialog headless guard

Status: next

### Objective

`runBrunchWorkspaceAction` no longer throws in no-UI contexts: the ungated `ctx.ui.custom` call (`workspace/index.ts:51`) and the subsequent `activateWorkspace(decision)` on an undefined decision are gated behind a UI-capability check that degrades to a product-shaped notify/`needs_human` outcome.

### Light-card cold-start reads

```
- memory/SPEC.md   — A18-L (containment sufficiency), D115-L (no-UI degraded paths precedent)
- memory/PLAN.md    — frontier: main-editor-chrome (absorbed obligation workspace-dialog-headless-guard)
- src/.pi/extensions/exchanges/ask.ts — the hasUI + typeof ui.custom guard family to mirror
```

### Acceptance Criteria

```
✓ new workspace-action headless test (src/.pi/extensions/__tests__/) — stub context without ui.custom
  (use the actual degraded context shape from Brunch fakes/Tier-2 boot, not a minimal invented stub):
  action returns without throwing, surfaces product-shaped degradation (notify/needs_human),
  coordinator.activateWorkspace never called with an undefined decision
✓ same suite — UI-capable path unchanged (decision flows to activateWorkspace; cancelled/needs_human
  branches intact)
```

### Verification Approach

```
- Inner: vitest with stubbed ExtensionContext (both capability shapes)
```

### Cross-cutting obligations

```
- Guard shape mirrors the ask.ts hasUI family — one idiom for UI-capability gating, not a second
```

### Assumption dependency

None — the throw path is mechanically visible in source; no live SPEC assumption gates it.

### Expected touched paths (tentative)

```
src/.pi/extensions/workspace/index.ts                          ~
src/.pi/extensions/__tests__/workspace-action-headless.test.ts +
```

### Promotion checklist

All no — stays light. (No requirement/assumption/decision change; single settled seam; guard idiom already canonical in ask.ts.)
