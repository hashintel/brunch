# Pi TUI component test harness + build/organization conventions

Frontier: n/a (category: tooling — Pi TUI component verification substrate)
Status:   active
Mode:     chain
Created:  2026-06-15

## Orientation

- **Seam:** `src/.pi/components` (D52-L: sealed Pi-harness reusable TUI components) plus its test home `src/.pi/__tests__/`. This is verification/tooling substrate for that seam, not product wiring and not presentation polish — so it is a category file, **not** the `demo-polish` frontier (which is presentation-only and "stay shallow") and **not** a `dx-feedback-loops` launcher (D68-L is dev *launchers*; this is inner/middle-loop vitest test infra).
- **Relevant frontier:** none owns this directly. `demo-polish` (FE-858) is the nearest neighbor because it touches `src/.pi/components`; this work must not change product wiring or presentation, only add test infra + docs. If a component change is later needed, it routes through the normal worktree rule (presentation rides the top line; wiring pushes down).
- **Volatile state:** branch `ln/xxx-sobering-up`; no HANDOFF. A hand-rolled `FakeTerminal implements Terminal` already exists inside `src/.pi/__tests__/workspace-dialog.test.ts` (~L369) — it records lifecycle events but **discards `write()`**, so it cannot assert rendered output. That is the partial precedent this harness supersedes for viewport assertions. `runWorkspaceDialogPreflight(inventory, { terminal })` already injects a `Terminal` and builds a real `TUI` + `showOverlay` + `start()` (zero production refactor needed to test end-to-end).
- **Open risk:** porting the `@xterm/headless` adapter (written for `bun:test`) to vitest/NodeNext — ESM/CJS default-import interop and render-timing flakiness are the only real unknowns; both are low blast radius.

**Origin:** patterns analysed from the standalone workbench `dot-agents/tui-components/pi` (oracle-reviewed). Adopted: the VirtualTerminal harness (highest leverage) and the component build/organization conventions. **Deliberately NOT adopted** (see §Out of scope): the anchor/geometry marker protocol, the Popper placement math, and the workbench app/playground shell — all deferred behind explicit tripwires to avoid banking unused machinery (global AGENTS.md §completionist sprawl).

**Posture:** earned for the seam shape (the harness is a proven reference implementation; component organization sits over a settled `.pi/components` seam), with **Card 1 treated as proving** — it lights up a brand-new end-to-end test path and retires the load-bearing assumption "the real pi-tui `TUI` render contract is testable under vitest." Cards 2–3 are earned closure (materialize the convention, canonicalize the harness, retire per-file terminal fakes where viewport assertions add value).

**Chain discipline check:** the three cards are sequentially obvious follow-through, not guesses. Card 2 depends on the harness *artifact* from Card 1, not on any *finding* from building it (the harness API — `start` / `sendInput` / `waitForRender` / `getViewport` — is already known from the reference impl). Card 3 documents what 1–2 establish. No card is expected to change a requirement, assumption, decision, or invariant. If Card 1's port surprises us enough to reshape Card 2 (e.g. the harness API must differ materially), stop the chain and re-scope.

## Oracle design (ln-oracles, 2026-06-15)

The deliverable is itself an instrument, so oracle design is mostly about the harness's trust boundary. Settled interactively with the user.

- **Diagnosis:** this work moves TUI-component **observability low → high** (interactive TUI → text viewport via `getViewport()`); **reproducibility** and **controllability** are **high** (in-process, deterministic, no LLM, agent-driven `sendInput`/`waitForRender`).
- **Oracle pairing (deliberate two-artifact design):** fast **direct `render()` / `handleInput()` tests** (precise on render + logic) paired with **harness integration tests** (focus + input routing + overlay/dialog render). Card 2 *complements, never replaces* the direct test — the pairing is the point, not redundancy.
- **Assertion granularity — settled (a):** harness tests assert on **semantic / visible-text substrings** from `getViewport()`, never raw ANSI and **not** viewport goldens. `toMatchFileSnapshot` viewport goldens are deferred until a clear layout-regression need appears (they would then mirror the `renderer-golden-coverage` convention). Tripwire: a layout/spacing regression slips through substring asserts.
- **Loop tier — settled:** middle-loop, kept in the **default `npm run test`** lane (not a separate `test:tui` lane) until `waitForRender` sleeps accumulate enough to warrant splitting. Card 3 documents this as the convention.
- **Negative-space oracles (cheap, encouraged in harness tests):** no unhandled exception on input; teardown leaves no open handles/timers; visible width never exceeds terminal columns (the existing `tui-lab` tests already assert this shape).
- **Acknowledged blind spot (accepted deferral, user-confirmed):** `getViewport()` reflects **xterm-headless's** interpretation of emitted bytes, not a real terminal's — kitty-protocol / true-color / wide-char / emoji-width fidelity is out of scope. The harness is a **contract check against xterm's model** (the same model pi-tui's own tests use), not a reality check; real-terminal feel stays an **outer-loop `demo-polish` manual walkthrough**. **Revisit trigger:** a wide-char / emoji / width bug ships that the harness passed.
- **Behavioral claims** (legibility, "feels right") are **not** harness-provable and stay outer-loop manual.

---

# Card 1 — VirtualTerminal shared test harness + preflight viewport proof

**Weight:** full scope card · **Status:** next · **Posture:** proving

### Target Behavior

A shared xterm-backed `VirtualTerminal` test helper lets a vitest test drive a real pi-tui `TUI` end-to-end and assert on the rendered terminal viewport, proven against `runWorkspaceDialogPreflight`.

### Full-card cold-start reads

```
- memory/SPEC.md   — D52-L (.pi/components ownership), D22-L/D36-L (TUI boot, workspace-dialog), §Verification Design (middle-loop tiers), D67-L (pi version tracking)
- memory/PLAN.md    — frontier: n/a; nearest neighbor demo-polish (boundary: no wiring/presentation change here)
- src/.pi/components/workspace-dialog/preflight.ts — the terminal-injectable TUI entry under test
- src/.pi/__tests__/workspace-dialog.test.ts        — existing FakeTerminal (~L369) this harness supersedes for viewport assertions
- dot-agents/tui-components/pi/test/virtual-terminal.ts — reference xterm-headless Terminal adapter being ported
```

### Boundary Crossings

```
→ package.json / package-lock.json        (add @xterm/headless devDep)
→ src/.pi/__tests__/support/virtual-terminal.ts   (new shared Terminal adapter, vitest + .js imports)
→ vitest test process → real TUI(VirtualTerminal) → runWorkspaceDialogPreflight → showOverlay → render
→ assert on VirtualTerminal.getViewport() visible lines + resolved decision
```

### Risks and Assumptions

```
- ASSUMPTION: the pi-tui TUI render contract is exercisable under vitest with an xterm-headless-backed Terminal.
    → IMPACT IF FALSE: the whole harness (and Cards 2–3) is invalid; rework = abandon shared harness, keep per-file fakes.
    → VALIDATE: this card IS the validation — a passing viewport assertion against preflight retires it (proving slice).
    → [→ memory/SPEC.md §Assumptions — add if it survives as a durable claim]
- RISK: @xterm/headless is CJS; default-import shape (`import xterm from '@xterm/headless'; xterm.Terminal`) may need interop handling under NodeNext.
    → MITIGATION: mirror the reference adapter's import; if it fails, use `createRequire`/named-import fallback; isolate in the one support file.
- RISK: render timing flake — `waitForRender()` uses nextTick + ~20ms + flush; Bun→vitest timing may differ.
    → MITIGATION: keep all timing in the single support file so it is tuned once; always tear down in try/finally; assert visible text, not raw ANSI.
- RISK: vitest environment defaults to non-node (jsdom) and breaks xterm.
    → MITIGATION: vite.config has no `test.environment` set (defaults to node); if a default ever changes, pin these files to the node environment via a test-file directive.
- ASSUMPTION: adding @xterm/headless as a devDep does not enter the shipped bundle.
    → IMPACT IF FALSE: dist weight / seal concern.
    → VALIDATE: it is test-only (`src/.pi/__tests__/`), excluded from `tsconfig.build.json` test globs; confirm `npm run build` output is unchanged.
```

### Posture check (proving)

Scores on **proof of life** (first end-to-end TUI-render test path in the repo) and **uncertainty** (retires the "real TUI testable under vitest" assumption). It is a tracer bullet that breaks if the assumption is wrong — build it, do not study it.

### Acceptance Criteria

```
✓ support/virtual-terminal.ts implements pi-tui Terminal (columns/rows/start/stop/write/clear*/getViewport/sendInput/waitForRender) under vitest, no bun:test imports
✓ workspace-dialog-preflight.harness.test.ts — starting preflight on a VirtualTerminal renders the branded dialog: getViewport() contains the spec/session picker home text
✓ same test — sending Enter ('\r') resolves runWorkspaceDialogPreflight to the expected SpecSessionActivationDecision for a controlled inventory
✓ same test — tears down the TUI in a finally block; no open handles / unresolved timers
✓ npm run verify passes (fix + test + build); build output unaffected by the new devDep
```

### Verification Approach

```
- Inner: oxlint type-aware + `npm run fix` — adapter types satisfy pi-tui Terminal.
- Middle: integration/contract test over the real TUI render contract (in-process vitest), viewport + decision assertions against preflight.
```

### Cross-cutting obligations

```
- D52-L: keep test infra inside `src/.pi/__tests__/` (sealed surface); no product import of test helpers.
- Pre-release posture: prefer the shared harness over duplicated per-file terminal fakes — but only retire FakeTerminal where viewport assertions add value (Card 2/3 territory); do not churn pure lifecycle/decision tests that the FakeTerminal already serves.
- Build seal: @xterm/headless stays a devDep; never imported by shipped `src/.pi/**` runtime code.
```

### Expected touched paths (tentative)

```
package.json                                              ~
package-lock.json                                         ~
src/.pi/__tests__/
├── support/
│   └── virtual-terminal.ts                               +
└── workspace-dialog-preflight.harness.test.ts            +
vite.config.ts                                            ?   (only if env pinning proves necessary)
```

---

# Card 2 — Interactive focusable component proof through the harness

**Weight:** light scope card · **Status:** next · **Posture:** earned

### Objective

Prove the harness generalizes beyond a modal dialog by driving an interactive focusable component (the runtime axis picker) through a real `TUI` overlay — exercising focus + key routing + overlay render that the existing direct-`render()`/`handleInput()` test cannot reach.

### Light-card cold-start reads

```
- memory/SPEC.md   — D52-L, D58-L (runtime posture pickers), §Verification Design middle-loop
- memory/PLAN.md    — frontier: n/a (tooling); demo-polish backlog notes axis-picker UX (esc dismissal) — out of scope here
- src/.pi/components/runtime-posture/axis-picker.ts — component under test (Component; cycle/enter/esc, onDone)
- src/.pi/__tests__/runtime-axis-picker.test.ts     — existing direct-render test this complements (does NOT replace)
- src/.pi/__tests__/support/virtual-terminal.ts     — harness from Card 1
```

### Acceptance Criteria

```
✓ runtime-axis-picker.harness.test.ts mounts the axis picker in a real TUI(VirtualTerminal) overlay with focus set
✓ sending arrow/hjkl keys through terminal.sendInput cycles the highlighted segment as seen in getViewport()
✓ sending Enter routes through the focused component and fires onDone with the selected value
✓ sending Esc fires onDone with no value (cancel) — routed through real input, not a direct method call
✓ the existing direct-render test remains unchanged and passing
✓ npm run verify passes
```

### Verification Approach

```
- Inner: `npm run fix`.
- Middle: harness-based integration test — focus + input routing + overlay render through the real TUI.
```

### Cross-cutting obligations

```
- Complement, do not replace, the fast direct-render test (it is precise and cheap for render logic).
- No component behavior change: this card is test-only. Any axis-picker UX change (e.g. esc dismissal from the demo-polish backlog) is OUT of scope and belongs on demo-polish.
```

### Assumption dependency

`Depends on: Card 1 harness assumption (validated by Card 1's passing test).` No live SPEC assumption hinges on this slice.

### Expected touched paths (tentative)

```
src/.pi/__tests__/
└── runtime-axis-picker.harness.test.ts                   +
```

### Promotion checklist

All "no": no requirement/assumption/decision/invariant change; no new seam; ≤1 file; settled seam; test-only. Stays light.

---

# Card 3 — Components topology README + harness/build convention

**Weight:** light scope card · **Status:** next · **Posture:** earned

### Objective

Codify "how we build and test Pi TUI components" as a co-located topology README under `src/.pi/components`, documenting the fractal sub-tree organization (already used by `workspace-dialog/`, `runtime-posture/`, `tui-lab/`) and the two-tier test convention (fast direct-render tests + harness-based integration tests via `support/virtual-terminal.ts`).

### Light-card cold-start reads

```
- memory/SPEC.md   — D52-L (.pi/components ownership + dependency direction), D58-L
- memory/PLAN.md    — frontier: n/a (tooling/docs)
- AGENTS.md         — "topology READMEs", "fractal sub-tree", "code organization" conventions
- src/.pi/README.md — parent topology README shape to mirror (ownership / boundary rules / layout)
- src/.pi/components/ (current contents) + the harness from Cards 1–2
```

### Acceptance Criteria

```
✓ src/.pi/components/README.md exists, following the established topology-README shape: ownership statement, D52-L reference + dependency rules, layout sketch, and the component build/test convention
✓ it documents the fractal sub-tree rule (public entry file + same-named private folder) with the existing components as examples — no new abstraction invented
✓ it documents the two-tier test convention: direct-render tests for render/logic; harness (support/virtual-terminal.ts) for focus/input/overlay integration, with a pointer to the Card 1/2 example tests
✓ it names what .pi/components does NOT own (consistent with src/.pi/README.md) and the deferred patterns + tripwires from §Out of scope below
✓ npm run check passes (docs change; no code)
```

### Verification Approach

```
- Inner: `npm run check` (no writes); prose/topology accuracy reviewed against actual directory contents.
```

### Cross-cutting obligations

```
- Keep it short — orientation surface, not a design doc (AGENTS.md). Deep rationale stays in SPEC/this card.
- Must not contradict src/.pi/README.md or D52-L dependency direction; it refines, not redefines.
- Record the deferred patterns (anchor/placement/playground) as explicit non-goals-for-now with tripwires, so a future maintainer does not re-derive the decision.
```

### Assumption dependency

`None.`

### Expected touched paths (tentative)

```
src/.pi/components/
└── README.md                                             +
```

### Promotion checklist

All "no": documents existing boundaries, does not change them; no code; no new invariant (codifies existing convention). Stays light. (If writing it surfaces a real boundary change, stop and route to `ln-spec`.)

---

## Out of scope (deferred patterns + tripwires)

These workbench patterns are intentionally **not** scoped now (oracle-concurred). Each carries a tripwire that, when tripped, justifies a fresh `ln-scope`:

- **Popper-style placement math** (`placement.ts`): pure, well-tested, cheap to port — but brunch overlays are centered today (`anchor: 'center'`). **Tripwire:** the first real non-centered / trigger-relative overlay request. Then port as `src/.pi/components/overlay.ts` (public seam) + `overlay/placement.ts`, tests first.
- **Anchor/geometry marker protocol** (`anchor-markers.ts` / `anchor-registry.ts` / `anchored.ts`): DOM-like measured rects via invisible ANSI markers. Powerful, easiest place to over-engineer, and its measurement semantics need adaptation (records container width, not child visible width). **Tripwire:** ≥2 anchored overlays or inline-trigger alignment that centered/fixed positioning cannot serve. Adapt, do not straight-port; add an `overlay/README.md`.
- **Workbench app factory + playground shell** (`app.ts`, `playground/main.ts`): the one reusable idea (injectable terminal) brunch already has via `preflight.ts` and now the harness. The standalone shell / demo layout / hot-reload do **not** belong in the sealed `.pi` surface. **Tripwire:** an explicit decision to build a separate Brunch TUI component playground (would be its own frontier).
- **Ad-hoc SGR style helpers**: brunch keeps the real `@earendil-works/pi-coding-agent` `Theme` / `ThemeColor`; do not import the workbench's hand-rolled escape helpers.

---

## Traceability

- Category file (no frontier); canonical reconciliation is a no-op unless a card promotes. None is expected to (Card 1 may add one durable SPEC assumption if the "TUI testable under vitest" claim is worth recording).
- D52-L governs the `.pi/components` seam and Card 3's README dependency direction.
- If the placement/anchor tripwires fire, that work becomes real frontier/demo-polish-adjacent scope and routes through `ln-plan`/`ln-scope` afresh — it is not silently absorbed here.
