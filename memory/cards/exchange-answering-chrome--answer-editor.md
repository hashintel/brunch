# Bordered free-text answer editor for structured exchanges

Frontier: exchange-answering-chrome
Status:   active
Mode:     single
Created:  2026-07-06

## Orientation

- Containing seam: `src/.pi/extensions/exchanges/shared/answer-source.ts` owns free-text answer collection; `src/.pi/components/` owns Pi-native bordered presentation. The `answer` response kind is the last live answering surface still rendered by raw Pi chrome (`ctx.ui.editor`'s sealed `ExtensionEditorComponent` dialog).
- Frontier item: `exchange-answering-chrome` / FE-1138 on branch `ln/fe-1138-answering-chrome`; this card is **thread 1** of the frontier (the decision-picker card `exchange-answering-chrome--decision-picker.md` was thread 2, now `Status: done`). Same branch, same Linear issue — no new tracker artifacts.
- Volatile state: branch is at pi **0.80.3** (bumped 2026-07-06). Two disciplines established on this branch bind here: capability guards must check `ctx.hasUI` **before** method shape (0.80.x `noOpUIContext` carries stub `custom`/`editor` functions that resolve `undefined`), and every interactive await is bracketed with `withWorkingIndicatorHidden` (`shared/ui-context.ts`).
- Main open risk: hosting pi-tui's `Editor` inside a `ctx.ui.custom` component (focus, key routing, self-drawn horizontal rules). De-risked: pi's own `ExtensionEditorComponent` is the in-dependency proof of the exact composition, and `brunch-editor.ts` already strips `Editor`'s rules for re-boxing.

Posture: proving (inherited from `exchange-answering-chrome`).

## Decisions settled at scope time (do not re-litigate)

- **Option B (user, 2026-07-06): Brunch-owned component via `ctx.ui.custom`.** Pi's `ctx.ui.editor` dialog is sealed — `showExtensionEditor` hardcodes `ExtensionEditorComponent` (DynamicBorder rules, title line, embedded `Editor` with its own rules, hint) with no options or factory. Restyling it upstream was considered and rejected: rounded side-bordered chrome is Brunch's visual language, not pi's.
- **Fallback chain (PLAN thread-1 spec):** `ctx.ui.custom` (bordered editor) → `ctx.ui.editor` (existing sealed dialog, kept intact) → `answerBroker` (headless path C, FE-873) → `unavailable`. Guard order is `hasUI` first, then method shape.
- **Prompt renders once, inside the box** (user-approved mock): when the picker replaces the input surface, the box must state what it is collecting; the transcript question may be scrolled away. Do not pass the prompt to any outer title.
- **`Editor`'s self-drawn rules are stripped**, not shown — no editor-within-editor. Extract `isEditorBorderLine` + `stripEditorBorder` (and `padContentToMinimum` if useful) from `brunch-editor.ts` into a shared components module so both consumers read one carrier; `brunch-editor.ts` behavior must not change.
- **Family chrome:** `projectRoundedBox` with the established picker padding (`{ x: 2, top: 1, bottom: 1 }`), sections joined via `stackSections` (box owns spacing — components never author `''` margin rows). Dim help line inside the box: `enter submits · shift+enter/ctrl+j newline · esc cancels` (family-consistent; the user mock omitted it — keep unless product review objects).
- **Empty submit re-prompts, never terminates.** Enter on empty/whitespace text keeps the editor mounted and shows a warning inside the box (e.g. `Enter an answer, or Esc to cancel.`), mirroring the required-input discipline (`shared/required-input.ts`, multi-choice warning precedent). Esc / ctrl+c resolves `undefined` → existing `cancelled` terminal.
- **ctrl+g external editor is deferred** — mark with a `ceiling:` comment naming the upgrade path (reuse pi's `ExtensionEditorComponent` external-editor spawn); the `ctx.ui.editor` fallback still offers it.
- **Out of scope:** `ctx.ui.setEditorComponent` / persistent main editor (that is `main-editor-chrome`, Horizon); transcript renderers; broker changes; per-item review commentary.

## Full scope card

### Target Behavior

Local-TUI free-text structured-exchange answers are collected through a Brunch-owned bordered answer editor component.

### Full-card cold-start reads

- `memory/SPEC.md` — requirements 17, 24, 28; decisions D37-L, D38-L, D104-L, D106-L, D108-L; invariant I23-L; lexicon: Structured exchange / Response tool / Offer response.
- `memory/PLAN.md` — frontier: `exchange-answering-chrome` (thread 1 objective + the D22-L/D35-L boundary note: `ctx.ui.editor` is `request_response`'s one-shot dialog, structurally independent of `setEditorComponent`).
- `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` — the three answering paths, coverage matrix (column A `answer` row changes here), the 0.80.3 drift notes (hasUI-first rule), and the re-verification checklist this card must keep true.
- `src/.pi/components/TOPOLOGY.md` — component ownership, box-owns-spacing rule, two-tier test convention (direct + VirtualTerminal harness).
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — "Answer sources" policy paragraph (this card changes it: TUI-editor-authoritative → custom-first).
- Implementation anchors (read before building):
  - `src/.pi/extensions/exchanges/shared/answer-source.ts` — current chain: `hasUI+editor` → broker → unavailable; `withWorkingIndicatorHidden` already brackets the editor await.
  - `src/.pi/extensions/exchanges/shared/ui-context.ts` — ctx slice + `withWorkingIndicatorHidden`; add nothing here unless the ctx slice needs no new methods (it should not — `custom` is already typed).
  - `src/.pi/components/brunch-editor.ts` — `isEditorBorderLine` / `stripEditorBorder` / `padContentToMinimum` to extract; `projectBorderedChrome` stays put (main-editor territory).
  - `src/.pi/components/exchange-decision-picker.ts` — the family shape to mirror (BOX_PADDING, stackSections, help line, `box.push('')` trailing blank).
  - `src/.pi/components/rounded-box.ts` — `projectRoundedBox`, `roundedBoxInnerWidth`, `stackSections`.
  - `src/dev/component-preview/theme.ts` — `createComponentPreviewEditorTheme(theme)`: the Theme→EditorTheme recipe (`{ borderColor, selectList }`); production derivation is the same shape from the factory's theme.
  - `node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/components/extension-editor.js` — pi's own dialog: the composition parity reference (Editor + `onSubmit` on enter, cancel matching, focus delegation via a `focused` setter).
  - `node_modules/@earendil-works/pi-tui/dist/components/editor.d.ts` — `Editor` constructor `(tui, EditorTheme, options?)`, `onSubmit`, `setText`, `getText`, `focused`; `EditorOptions.paddingX`.
  - `src/.pi/components/__tests__/brunch-editor.harness.test.ts` — the precedent for driving an editor component through a real `TUI(VirtualTerminal)` and for constructing an `EditorTheme` in tests.

### Boundary Crossings

```text
→ request_response tool execution (answer response kind)
→ collectAnswerFromSources (shared/answer-source.ts)
→ ctx.ui.custom component factory in local TUI (withWorkingIndicatorHidden bracket)
→ ExchangeAnswerEditorComponent (rounded box hosting pi-tui Editor, rules stripped)
→ resolved string | undefined
→ projectRequestAnswer (answered | cancelled) → formatter content
→ request_response toolResult details/content
```

Boundaries to preserve untouched:

```text
→ session.submitExchangeResponse (column B — never reaches ctx.ui)
→ answerBroker.awaitAnswer (column C — headless web-driver; hasUI false short-circuits before custom)
x> ctx.ui.setEditorComponent (main-editor-chrome territory)
```

### Risks and Assumptions

- RISK: pi-tui `Editor` inside a custom component misroutes keys or renders no cursor (focus never set).
  → MITIGATION: mirror `ExtensionEditorComponent`: expose a `focused` getter/setter delegating to `editor.focused`, set it true on mount; delegate `handleInput` to the editor except cancel keys; VirtualTerminal harness test drives the real TUI focus/input path.
- RISK: `Editor`'s self-drawn rules (`───`, `─── ↑ N more ───`) leak into the box or the strip drops content lines.
  → MITIGATION: reuse the extracted `brunch-editor.ts` helpers verbatim (they already handle both rule shapes and the autocomplete-rows-after-bottom-border case); direct render test asserts no rule rows appear between the box borders.
- RISK: the new branch regresses the headless broker path (C) or the RPC path (B).
  → MITIGATION: hasUI-first guard order; existing broker/editor/unavailable tests in `exchanges-present-request.test.ts` must keep passing unmodified; column B is structurally unreachable from this change (answering-paths doc).
- RISK: empty-text answers keep persisting via the non-interactive paths even after the TUI fix.
  → MITIGATION: see the empty-answer contract acceptance item — builder validates current `session.submitExchangeResponse` behavior for empty answer text **before** deciding the schema refine's blast radius; TUI-side prevention lands regardless.
- ASSUMPTION: the `ctx.ui.custom` factory's first argument is a real `TUI` usable for `Editor` construction.
  → IMPACT IF FALSE: component cannot host an Editor; thread 1 needs an upstream pi change.
  → VALIDATE: pi 0.80.3 `showExtensionCustom` passes `this.ui` (verified 2026-07-06); the harness test constructs with a real `TUI(VirtualTerminal)`.
- ASSUMPTION: deriving `EditorTheme` from the factory's theme (`{ borderColor: theme.fg('border', …), selectList }`) renders acceptably in production, matching what pi builds internally.
  → IMPACT IF FALSE: visual mismatch only; swap to a different fg key or plumb pi's `getEditorTheme` equivalent.
  → VALIDATE: manual smoke (outer loop) — this is the first production use of the derivation outside the preview harness.

### Posture check

Proving tracer on all three axes:

- **Proof of life:** first production surface hosting a pi-tui `Editor` inside `ctx.ui.custom` — the composition `main-editor-chrome` will also need, proven here on the smaller one-shot seam first.
- **Invariants:** completes the family rule "no raw Pi chrome on live answering surfaces" across all four response kinds, and locks the fallback-chain ordering (custom → editor → broker → unavailable) with tests.
- **Uncertainty:** retires the carried render-height/embedding question for one-shot editors (the reason thread 1 was deferred at the 2026-07-02 split).

### Acceptance Criteria

✓ Direct component test — renders a rounded border with the prompt (accent) inside the box, editor content lines, a dim help line, family blank padding, and **no** `─` rule rows between the box borders.

✓ Direct component test (empty submit) — enter with empty/whitespace text keeps the component mounted and renders the warning line; `onDone` is not called.

✓ VirtualTerminal harness test — typing routes into the embedded editor through the real TUI focus path (cursor visible); enter resolves the typed string; shift+enter (or ctrl+j) inserts a newline instead of submitting; esc resolves `undefined`.

✓ Answer collector test — with `hasUI` and `custom` present, `ctx.ui.custom` is used and `ctx.ui.editor` is **not** called; the resolved string projects to `answered` details; `undefined` projects to `cancelled`; the working indicator is hidden then restored (`[false, true]`).

✓ Fallback-chain tests — `hasUI` with `custom` absent but `editor` present → existing sealed-dialog path (unchanged behavior); `hasUI` false with broker → broker (existing test passes unmodified); neither → `unavailable` (existing test passes unmodified).

✓ Empty-answer contract — after validating current `session.submitExchangeResponse` behavior for empty answer text: the answered free-text payload rejects empty/whitespace `text` at the schema (mirroring the required-comment refinement), and the RPC acceptance path returns `ok: false` with a clear message instead of persisting a blank answer. If validation reveals a consumer that legitimately submits empty text, stop and surface instead of forcing the refine.

✓ Shared helper extraction — `brunch-editor.ts` imports the strip helpers from the new shared module; `brunch-editor.test.ts` / `.harness.test.ts` pass unmodified.

✓ Preview registry — `npm run dev:components` exposes an `exchange-answer-editor` entry mirroring the real presentation contract (inline swap).

✓ Docs reconciled — answering-paths coverage matrix column A `answer` row reads `ctx.ui.custom (ExchangeAnswerEditorComponent), ctx.ui.editor fallback, broker third`; exchanges TOPOLOGY "Answer sources" paragraph updated (TUI editor no longer described as the authoritative surface); components TOPOLOGY layout lists the new component + shared helper module.

### Verification Approach

- Inner: direct-render component tests + collector unit tests — render shape, strip correctness, empty-submit re-prompt, fallback ordering, terminal-outcome projection, indicator bracket.
- Middle: VirtualTerminal harness test — real TUI focus/input/cursor path for the embedded editor (the one behavior direct tests cannot reach).
- Middle: schema + RPC guard tests for the empty-answer contract (only after the validation step in acceptance).
- Outer: manual physical-terminal smoke — first production `Editor`-in-custom surface and first production use of the EditorTheme derivation; check cursor rendering, multi-line growth, long-text scroll indicator, and that scrollback stays free while the editor waits (indicator bracket).

### Cross-cutting obligations

- Preserve D37-L/I23-L: durable semantics live in `toolResult.details`/formatter content; live UI state is transient.
- Preserve D38-L + answering-paths doc: this is a column-A-only change; `session.submitExchangeResponse` (B) and the broker (C) are behaviorally untouched except the explicitly-scoped empty-answer guard.
- hasUI-first capability guards (pi 0.80.x noOpUIContext stubs) — never gate on method shape alone.
- Bracket every interactive await with `withWorkingIndicatorHidden` (scrollback stays free while waiting on the user).
- Box owns spacing: `projectRoundedBox` padding + `stackSections`; the component authors no `''` margin rows and no private lateral margins.
- Keys-only; no wheel/mouse handling in this slice.
- Terminal-outcome semantics feed FE-1135's capture contract: cancelled means the user declined; answered means real content — the empty-submit re-prompt exists to keep that boundary honest.
- Keep `exchange-rendering` closed: no formatter/renderer changes (the `answer` content register is untouched).

### Expected touched paths (tentative)

```text
src/.pi/components/
├── exchange-answer-editor.ts                  +
├── editor-lines.ts                            +   (extracted isEditorBorderLine/stripEditorBorder)
├── brunch-editor.ts                           ~   (import extracted helpers; no behavior change)
├── TOPOLOGY.md                                ~
└── __tests__/
    ├── exchange-answer-editor.test.ts          +
    └── exchange-answer-editor.harness.test.ts  +

src/.pi/extensions/exchanges/
├── TOPOLOGY.md                                ~
└── shared/
    └── answer-source.ts                       ~

src/.pi/extensions/__tests__/
└── exchanges-present-request.test.ts          ~

src/exchanges/schemas/
├── request.ts                                 ~?  (empty-answer refine — after validation step)
└── __tests__/request.test.ts                  ~?

src/session/structured-exchange-loop/
└── accepted-response.ts                       ~?  (empty-answer RPC guard — after validation step)
src/session/__tests__/
└── structured-exchange-loop.test.ts           ~?

src/dev/component-preview/
└── registry.ts                                ~

docs/design/
└── STRUCTURED_EXCHANGE_ANSWERING_PATHS.md     ~
```

Overlap test: `exchange-answering-chrome--decision-picker.md` is `Status: done`; no active card shares these write paths.
