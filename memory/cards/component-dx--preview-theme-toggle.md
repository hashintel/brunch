# Component preview gallery — live dark/light theme toggle

Frontier: component-dx (FE-1115)
Status:   active
Mode:     slices
Created:  2026-07-07

> Branch: `ln/fe-1115-tui-refinements-1` — TUI component/rendering refinement lane.
> This file is the mini-queue for the lane. Card 1 is scoped; further refinement
> cards are appended here as they become legible while browsing the gallery
> (do not pre-scope speculative refinements — anti-speculation gate).

## Card 1 — live theme toggle via delegating SwitchableTheme [done 2026-07-07]

> Built as scoped, one divergence: the toggle lives in an exported
> `registerComponentPreviewThemeToggle(tui, theme)` in `theme.ts` (not inline in
> `component-preview.ts`) because `runComponentPreviewGallery` constructs its
> `ProcessTerminal` internally and the listener needed to be testable against
> `VirtualTerminal`. `custom-ui.ts` untouched. Outer manual check still owed:
> `npm run dev:components`, ctrl+t at the menu and inside an open editor entry,
> plus the deep-link path.
>
> Outer-check findings (2026-07-07, Ghostty + Zed) and their fixes, same branch:
> 1. Terminal page background didn't follow the toggle — OSC 11 paint +
>    OSC 111 restore added (`7524c18d`). Zed's terminal ignores OSC 11;
>    recorded as a `ceiling:` in `theme.ts`.
> 2. Kitty keyboard protocol (Ghostty) broke raw-byte key matching — first in
>    the gallery/toggle (`754ea9c7`), then confirmed in the previewed
>    production components themselves. Card 2 below swept all `handleInput`
>    raw-byte comparisons to `matchesKey`.

## Card 2 — matchesKey sweep across .pi component input handling [done 2026-07-07]

Light scope card, appended from Card 1's outer-check finding (not speculative:
user-observed freeze in Ghostty for axis-picker left/right and
exchange-decision-picker up/down).

### Objective

Every `handleInput` under `src/.pi/components/` matches keys through pi-tui's
`matchesKey`/`Key` so components work under both legacy and kitty
keyboard-protocol encodings.

### Inventory (closed)

```
src/.pi/components/
├── exchange-decision-picker.ts        ✓ esc/q/enter/up/down/j/k
├── multi-choice-picker.ts             ✓ esc/q/enter/space/up/down/j/k
├── runtime-posture/axis-picker.ts     ✓ esc/q/enter/left/right/h/l/j/k
├── tui-lab/style-lab-component.ts     ✓ esc/q/left/right/h/l (preview-only)
├── exchange-answer-editor.ts          ✓ esc/ctrl+c cancel, ctrl+g guard (editor delegate unchanged)
└── workspace-dialog/component.ts      ✓ ctrl+c (rest already used matchesKey)
```

### Acceptance Criteria

```
✓ Kitty press encodings (\x1b[1;1:1B down, \x1b[1;1:1C right, \x1b[13;1:1u enter,
  \x1b[27;1:1u esc, \x1b[32;1:1u space) verified against matchesKey via node probe
✓ Ghostty-regression direct tests added for decision picker, multi-choice picker, axis picker
✓ Legacy encodings still pass (existing test suites unchanged and green)
✓ Key-matching convention recorded in src/.pi/components/TOPOLOGY.md §Build/test convention
```

Light scope card.

Posture: earned (inherited from component-dx — the preview harness is a settled dev-tooling seam; both theme JSONs and the variant-aware `createComponentPreviewTheme(variant)` already exist).

### Objective

`npm run dev:components` switches between the shipped Brunch dark and light themes live — including while a previewed component is open — via a harness-owned delegating `Theme` subclass, instead of only at launch via `BRUNCH_PREVIEW_THEME`.

### Light-card cold-start reads

```
- memory/SPEC.md   — None (dev tooling; no product decisions/invariants touched)
- memory/PLAN.md    — frontier: component-dx (FE-1115), §Frontier Definitions
- src/dev/TOPOLOGY.md — "Component Preview Harness" section (truth-environment rationale)
- src/dev/component-preview.ts + src/dev/component-preview/{theme,gallery-component,registry}.ts — current wiring:
  one Theme constructed at boot, shared by reference with the gallery and every entry's
  open(tui, theme, keybindings)
```

### Design shape (settled at scope time — tier 3, delegation not mutation)

Verified against `pi-coding-agent`'s `Theme` implementation (`dist/modes/interactive/theme/theme.js`): colors resolve to ANSI strings once in the constructor into private maps; `fg`/`bg`/`getFgAnsi`/`getBgAnsi` are per-call lookups; components call `theme.fg(...)` inside `render()` every pass and cache nothing.

- **`SwitchableTheme extends Theme`** (harness-only, in `src/dev/component-preview/theme.ts`): constructed from the two prebuilt variant `Theme` instances (`createComponentPreviewTheme('dark')` / `('light')`), super-called with the initial variant's tables so it is a legitimate `Theme`. Overrides the public color methods — `fg`, `bg`, `getFgAnsi`, `getBgAnsi`, `getColorMode`, `getThinkingBorderColor`, `getBashModeBorderColor` — to delegate to the active variant. `bold`/`italic`/`underline`/`inverse`/`strikethrough` are theme-independent chalk passthroughs; no override. Exposes `toggle(): ComponentPreviewThemeVariant` and `variant`.
- **No mutation of Theme internals, no retheme contract on components.** Everyone already shares the one instance by reference (gallery chrome, open entries, the `EditorTheme` border closure), so `toggle()` + one `tui.requestRender()` reskins everything currently on screen.
- **Harness-global toggle key: `ctrl+t`** (`\x14`), intercepted in the harness input path before focused-component dispatch so open entries (editors included) never see it. Plain `t` stays free for components. Implementation point: the harness/gallery layer, not per-entry.
- **Variant indicator** in the gallery hint line (e.g. `ctrl+t theme (dark)`).
- `BRUNCH_PREVIEW_THEME` keeps selecting the *initial* variant; the toggle works in both gallery and `entryId` deep-link modes (the key is global, so deep-link previews get it too).

### Acceptance Criteria

```
✓ SwitchableTheme delegates: fg/getFgAnsi return the dark palette's ANSI before toggle and the light palette's after, on the same instance
✓ SwitchableTheme is accepted wherever Theme is (typechecks via subclassing; existing entries unchanged)
✓ ctrl+t toggles while an entry is open — the entry's next render uses the new palette without reopen (harness test: render lines before/after toggle differ in ANSI, content identical)
✓ ctrl+t is consumed by the harness, never delivered to the focused component
✓ Gallery hint line names the active variant and flips on toggle
✓ BRUNCH_PREVIEW_THEME=light still selects the initial variant in gallery and deep-link modes
✓ Existing harness tests stay green (theme.test.ts, custom-ui.test.ts, static-preview.test.ts)
```

### Verification Approach

```
- Inner: npm run fix; vitest on src/dev/component-preview/__tests__ —
  SwitchableTheme unit tests (delegation before/after toggle, getFgAnsi parity with the
  underlying variant Themes); input-interception test (feed \x14, assert focused component's
  handleInput not called and render output reskins)
- Outer: manual — npm run dev:components, ctrl+t at the menu and inside an open editor entry;
  npm run dev:components -- brunch-editor for the deep-link path
```

### Cross-cutting obligations

```
- Harness stays workspace/session/DB-free (bare ProcessTerminal + TUI) — no sealed resource
  loader or session theme plumbing
- Entries keep mirroring their real production presentation contract (registry.ts rule);
  the toggle lives in harness chrome/input, entry open contracts unchanged
- SwitchableTheme overrides only public Theme API (delegation) — no reaching into the
  private color maps; if a pi bump adds new public color methods, delegation must be extended
  (theme.test.ts should assert override coverage against Theme.prototype's color methods)
```

### Assumption dependency

None — this slice's correctness does not hinge on any live `memory/SPEC.md` §Assumptions.

### Expected touched paths (tentative)

```
src/dev/component-preview/
├── theme.ts                        ~  (SwitchableTheme + variant plumbing)
├── gallery-component.ts            ~  (hint line variant indicator)
├── custom-ui.ts                    ?  (if the global-key interception point lands here)
└── __tests__/
    ├── theme.test.ts               ~  (SwitchableTheme delegation + override-coverage tests)
    └── static-preview.test.ts      ?  (reskin-without-reopen harness assertion, if it fits here)
src/dev/component-preview.ts        ~  (construct SwitchableTheme; global ctrl+t interception)
src/dev/TOPOLOGY.md                 ?  (one-line harness-section note)
```

### Promotion checklist

All no: no requirement/assumption/decision/invariant change, no new seam, one settled dev-tooling seam, containing seam and rationale nameable from live docs (FE-1115 definition + src/dev/TOPOLOGY.md). The pi-internals dependency is read-only verification of public-API behavior (constructor-time resolution), not a durable coupling.
