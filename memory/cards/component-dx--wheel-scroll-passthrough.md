# component-dx — wheel-scroll passthrough (preview-harness tracer)

Frontier: component-dx
Status:   active
Mode:     single
Created:  2026-07-01

## Orientation

- **Containing seam:** `src/dev/component-preview/custom-ui.ts`'s `showComponentPreview` shim, which every registry entry (`registry.ts`) already opens through; the concrete consumer is the `workspace-dialog-scroll` entry (built on `WorkspaceDialogComponent` + `projectScrollViewport`, `.pi/components/scroll-viewport.ts`).
- **Relevant frontier item:** `component-dx` (FE-1115), branch `ln/fe-1115-component-preview-dx`. No live scope card exists otherwise (harness and scroll-viewport cards were both retired by the 2026-07-01 `ln-sync` once reconciled into `memory/PLAN.md` + the co-located `TOPOLOGY.md` homes).
- **Volatile handoff state:** none — `HANDOFF.md` is absent.
- **Main open risk:** the `ln-spike` (2026-07-01, reconciled in `memory/PLAN.md`'s `component-dx` entry) confirmed the *mechanism* works (pi-tui delivers an SGR wheel sequence byte-intact through the public `addInputListener`/focused-component path, safely ignored by unaware components) but did **not** verify a real (non-`agent-tui`-virtual) terminal actually emits this exact shape on physical wheel scroll — that remains a real-terminal smoke-test residual this slice should name, not silently assume away.

Posture: proving (inherited from `component-dx`) — this is the first mouse input of any kind in the codebase; it establishes a new seam (an opt-in wheel-scroll option on the shared preview shim) whose shape would ripple if wrong.

## Full-card cold-start reads

```
- memory/PLAN.md — frontier: component-dx (the wheel-scroll spike verdict and residuals, in the component-dx frontier paragraph)
- src/dev/TOPOLOGY.md — "Component Preview Harness" section: showComponentPreview's real-vs-preview presentation-contract discipline this slice must keep honoring
- src/.pi/components/TOPOLOGY.md — layout sketch; this slice adds one sibling file to scroll-viewport.ts
- src/dev/component-preview/custom-ui.ts — the exact showComponentPreview shape being extended (read in full; already read this session, contents summarized below)
- src/dev/component-preview/registry.ts — the workspace-dialog-scroll entry this slice wires wheel support into
- src/.pi/components/workspace-dialog/component.ts — confirm its handleInput's fall-through-does-nothing safety property still holds (Key.up/Key.down/Key.escape/Key.enter only in list-navigation mode; no catch-all printable insertion outside newSpecTitle stage)
- src/.pi/__tests__/support/virtual-terminal.ts — test harness this slice extends with a raw-write log (needed to assert mouse-mode enable/disable)
```

No `memory/SPEC.md` ids apply — `component-dx` carries no SPEC traceability for tooling/component-level work (see its frontier definition's Traceability line).

## Boundary Crossings

```
→ terminal emits a wheel-scroll SGR escape sequence on real stdin (out of scope to verify this slice — see risk above)
→ pi-tui's stdin-buffer.ts framing (existing, unmodified) delivers it as one intact chunk
→ TUI.handleInput -> registered addInputListener (new, owned by showComponentPreview when wheelScroll: true)
→ parseWheelEvent() (new pure fn, .pi/components/mouse-wheel.ts) recognizes it, returns 'up' | 'down' | undefined
→ recognized event synthesizes the equivalent arrow-key byte string ('\x1b[A' / '\x1b[B')
→ component.handleInput(synthesizedKey) — the *same* Component instance showComponentPreview already created via factory(...); no new component-level API
→ WorkspaceDialogComponent's existing Key.up/Key.down handling (existing, unmodified) -> projectScrollViewport-driven render (existing, unmodified)
```

## Risks and Assumptions

```
- RISK: agent-tui cannot exercise a real physical wheel event (its `scroll` command is a keystroke-emulation shim, confirmed by the prior spike) → MITIGATION: this slice's oracle is a VirtualTerminal-driven harness test injecting a literal SGR byte sequence via `sendInput`, matching the spike's own method; name a real-terminal (iTerm2/Kitty/Ghostty) manual smoke-test as a follow-up, not a blocking gate for this tracer.
- ASSUMPTION: treating wheel-scroll as equivalent to arrow-key input (not a separate "look without moving selection" mode) is the right first-cut semantic for a picker list.
    → IMPACT IF FALSE: a future consumer wanting decoupled free-scroll would need a real `onWheelScroll`-shaped component API instead of key-forwarding; low rework cost since the translation lives entirely in `showComponentPreview`'s new opt-in branch, not baked into `WorkspaceDialogComponent` or `projectScrollViewport`.
    → VALIDATE: cheapest proof is this tracer itself — if it feels wrong once built/demoed, the isolation makes it cheap to replace.
- ASSUMPTION: opt-in per preview entry (`wheelScroll: true` on `ComponentPreviewCustomOptions`, mirroring the existing `overlay` boolean) is the right scope for *this* slice's lifecycle ownership.
    → IMPACT IF FALSE: production wiring (a real TUI session with many components/overlays over its lifetime) will need a different, session-scoped owner; this slice explicitly does not answer that — named as a deferred question in memory/PLAN.md already, not silently assumed resolved.
    → VALIDATE: N/A for this slice (harness-only, no production call site touched).
```

## Posture check (proving)

Scores on two of the three convergent axes:

- **Proof of life** — lights up the first real end-to-end mouse-input path in the codebase, live and demoable via `npm run dev:components -- workspace-dialog-scroll`.
- **Invariants** — locates the seam for wheel-scroll opt-in (`ComponentPreviewCustomOptions.wheelScroll`) as a single, small, shared shim addition rather than one-off wiring duplicated per registry entry.

Does not retire the real-terminal-emission assumption (named above as an explicit residual, not swept under this slice) — that is intentional: reshaping the slice to also prove real-terminal emission would require a human at a physical terminal, which is a different, not-cheaper oracle than the one this tracer already has cheap access to (`VirtualTerminal` + `sendInput`, exactly mirroring the spike's own proof).

## Acceptance Criteria

```
✓ parseWheelEvent unit tests — recognizes '\x1b[<65;C;RM' (wheel down) and '\x1b[<64;C;RM' (wheel up) shapes, returns undefined for click/motion SGR variants (bit 32 set, or button bits not matching the wheel flag) and for non-mouse input entirely
✓ showComponentPreview harness test — with { wheelScroll: true }, terminal.write is called with the mouse-enable DECSET sequence when the component opens, and the disable sequence when done() fires (assert via VirtualTerminal's new raw-write log)
✓ showComponentPreview harness test — without wheelScroll (or with it false/omitted), no mouse DECSET sequences are ever written, for both existing overlay and inline-swap paths (regression: this slice must not change default behavior for any existing entry)
✓ workspace-dialog-scroll harness test — injecting a wheel-down SGR sequence via VirtualTerminal.sendInput moves the rendered selection/window exactly as an equivalent ArrowDown keypress would (reuse the same assertions style as the existing long-list scroll tests in workspace-dialog.test.ts)
✓ existing workspace-dialog.test.ts and custom-ui.test.ts suites remain green unmodified in behavior (only VirtualTerminal gains new observability, no existing assertions change)
```

## Verification Approach

```
- Inner: direct unit tests on parseWheelEvent() — pure function, no TUI needed.
- Middle: VirtualTerminal-backed harness tests (extends the existing custom-ui.test.ts/workspace-dialog patterns) proving the opt-in enable/disable lifecycle and the synthesized-keypress routing end-to-end through a real TUI instance.
- Outer: none for this slice — a real-terminal manual smoke-test is named as a residual, not built as an automated oracle here (agent-tui cannot exercise it, per the risk above).
```

## Cross-cutting obligations

```
- Keep mirroring each entry's real production presentation contract (src/dev/TOPOLOGY.md's harness discipline) — wheelScroll is a preview-harness-only opt-in; it must not silently become "always on" for entries whose real production call site never opts in.
- component-dx carries no SPEC traceability for this tooling-level work; do not add memory/SPEC.md entries for it.
```

## Expected touched paths (tentative)

```
src/.pi/components/
├── mouse-wheel.ts                              +  parseWheelEvent(data) => 'up' | 'down' | undefined
src/.pi/components/__tests__/
├── mouse-wheel.test.ts                         +
src/dev/component-preview/
├── custom-ui.ts                                ~  ComponentPreviewCustomOptions.wheelScroll?: boolean; owns enable/disable + addInputListener + key-synthesis when set
├── registry.ts                                 ~  workspace-dialog-scroll entry adds { wheelScroll: true }
├── __tests__/
│   └── custom-ui.test.ts                       ~  new wheelScroll on/off cases
src/.pi/__tests__/support/
├── virtual-terminal.ts                         ~  expose a raw write() log for assertions (additive, no existing behavior change)
src/.pi/components/__tests__/
├── workspace-dialog.test.ts                    ~  one new harness-style case: wheel-down moves the windowed selection
src/dev/TOPOLOGY.md                             ~  note the wheel-scroll opt-in + residual real-terminal smoke-test
```
