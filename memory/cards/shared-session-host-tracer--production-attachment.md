# Production TUI PTY tracer

Frontier: shared-session-host-tracer
Status:   active
Mode:     single
Created:  2026-08-05

## Orientation

- Containing seam: D141-L keeps normal TUI and standalone web as two legitimate runtime compositions while converging sealed runtime construction, target-addressed Brunch semantic RPC/projections, JSONL truth, and cross-process single-writer authority.
- Frontier: FE-1321 / `shared-session-host-tracer`; inner writer authority, the exact-session TUI semantic adapter, production contract wiring, semantic-only canonical `/rpc`, and split-transport regressions are built in commits `3d44aa88b`, `e7f05440a`, and `247430556`.
- Rejected shape: Pi 0.83.0's `InteractiveMode.stop()` leaves its `run()` loop and `getUserInput()` callback pending, so this frontier does not build an independently-lived host, detachable TUI, remote terminal, or Pi fork.
- Main open risk: the accepted inner composition may still be harness-only confidence until a subprocess runs the production normal-TUI entry through real `InteractiveMode` under deterministic control.

Posture: proving (inherited from `shared-session-host-tracer`).

## Target Behavior

A deterministic PTY journey completes one ordinary turn through the production normal-TUI `InteractiveMode`.

## Full-card cold-start reads

- `memory/SPEC.md` — A51-L; D39-L, D141-L; I64-L, I65-L; Verification Design “Session runtime contract convergence oracle”
- `memory/PLAN.md` — frontier `shared-session-host-tracer` and arc `shared-session-host-convergence`
- `src/app/TOPOLOGY.md` — normal-TUI composition ownership
- `src/dev/tui-driver.ts` and `src/dev/tui-driver/{session,screen,keys}.ts` — existing PTY control and rendered-screen contract
- `src/app/brunch-tui.ts` — production `runBrunchTui` → default `launchPiInteractive` path and provider-service substitution boundary
- `src/dev/__tests__/web-driver-streaming-support.ts` — existing faux-provider setup patterns
- `src/app/__tests__/session-runtime-contract-tracer.slow.test.ts` — accepted injected-boundary contract tracer; do not mistake it for this real-TUI witness
- Pi `docs/sdk.md` and `docs/tui.md` — real `InteractiveMode` lifecycle and editor behavior

## Boundary Crossings

```text
Vitest slow witness
→ existing tui-driver startSession (expect PTY; no new terminal surface)
→ purpose-built test child in a temporary workspace
  → register deterministic faux provider/services in the child process
  → choose one deterministic workspace activation
  → runBrunchTui without a launchInteractive override
→ production launchPiInteractive
→ createAgentSessionRuntime with the sealed Brunch factory
→ real InteractiveMode screen/editor
→ tui-driver sendText + Enter
→ deterministic assistant response
→ rendered PTY screen + sole Pi JSONL postconditions
→ Ctrl-D normal exit and bounded scratch cleanup
```

## Risks and Assumptions

- RISK: the test reconstructs the TUI in a helper and passes without production wiring → MITIGATION: the child must call `runBrunchTui` and omit `launchInteractive`; only workspace activation, provider-backend substitution, and text-native test reporting may be injected.
- RISK: the parent faux-provider registry is invisible to the child process → MITIGATION: register the provider and create its model runtime inside the child; do not depend on inherited in-memory state or live provider credentials.
- RISK: a general IPC/control framework grows around one witness → MITIGATION: use the existing PTY FIFO for interaction and at most one test-owned JSON report file for sidecar URL/target/readiness facts needed by the next slice. No socket, daemon, or reusable orchestration protocol.
- RISK: screen text alone can be faked or a JSONL assertion can pass without a real editor → MITIGATION: require both real rendered Pi/Brunch chrome-editor markers and the exact ordinary-turn response in the canonical session JSONL.
- RISK: terminal residue survives a failed assertion → MITIGATION: every path stops/removes the named tui-driver session and checks its liveness marker; temporary workspaces remain OS-temporary and are never promoted as evidence.
- ASSUMPTION: a narrow provider-service override can reach the existing default `launchPiInteractive` path without replacing it.
  → IMPACT IF FALSE: the next slice needs a small production composition seam before the witness is honest; later companion slices remain unscoped.
  → VALIDATE: a contract test pins the override's arrival at the sealed runtime factory while the PTY test proves real `InteractiveMode` rendering.

## Posture check

- **Lights up:** the first deterministic subprocess path through the production normal-TUI entry and real Pi editor.
- **Stabilizes:** the boundary between test-only provider substitution and the production `runBrunchTui` → `launchPiInteractive` composition.
- **Retires:** the immediate uncertainty that the landed semantic/writer wiring can coexist with a real TUI lifecycle at all; it does not retire A51-L.
- This is cheaper and more discriminating than the former omnibus witness: later React, exchange, rivalry, and lifecycle claims depend on the child/report shape established here and must not be pre-scoped through that unknown.

## Acceptance Criteria

```text
✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · production PTY boot — starts the child through existing startSession, observes real Brunch/Pi startup chrome and an editable prompt in the rendered viewport, and never supplies launchInteractive.

✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · ordinary turn — sends one user prompt with tui-driver controls, observes the deterministic assistant response in the rendered viewport, and reads that exact user/assistant exchange from the sole canonical Pi JSONL.

✓ src/app/__tests__/brunch-tui.test.ts · provider substitution boundary — a supplied deterministic provider backend reaches the sealed runtime factory without changing normal production defaults or bypassing launchPiInteractive.

✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · bounded cleanup — exits with Ctrl-D, confirms the PTY driver is no longer live, removes its scratch session, and leaves no second session JSONL or writer-lock directory for the target.

✓ existing inner contract tracer — the accepted injected-boundary semantic/writer assertions remain green; this slice extends rather than rewrites them.

✓ npm run verify:full — required because the slice changes the production TUI composition seam and its slow witness.
```

## Invariants preserved

- D39-L keeps the real Pi `InteractiveMode`, sealed Brunch profile, and Pi editor — guarded by: rendered PTY markers plus existing `src/app/__tests__/brunch-tui.test.ts`. **Stop the line** if the child uses Pi RPC, a line client, or a synthetic TUI.
- I64-L still acquires writer authority before Pi runtime construction and releases after disposal — guarded by: existing writer-guard tests and the PTY cleanup assertion. **Stop the line** if the test deletes a live lock to make cleanup pass.
- I65-L keeps JSONL as durable truth — guarded by: exact JSONL readback; PTY output is evidence of presentation, not a second store.
- Existing `src/dev/tui-driver/**` remains the sole PTY surface — guarded by: the witness imports its public functions and adds no sibling driver.

## Verification Approach

- Inner: provider-substitution composition contract — proves deterministic backend injection reaches the production runtime factory without replacing the default TUI launcher.
- Middle: existing PTY driver + rendered-screen + JSONL differential — proves real product entry, editor interaction, and durable ordinary-turn truth.
- Outer: none for this slice; FE-1321 owns the colleague walkthrough after companion convergence, exchanges, authority rivals, and lifecycle transfer are built.

## Cross-cutting obligations

- Reuse the exact production `runBrunchTui` and default `launchPiInteractive`; test code may choose activation and provider backend but must not supply a replacement launcher.
- Reuse `src/dev/tui-driver/**`; do not add a new PTY or terminal automation surface.
- Keep any child report minimal and test-owned: sidecar URL, durable target, and readiness only; no event mirror or alternate session truth.
- Keep canonical `/rpc` semantic-only and `/rpc/driver` transitional; this slice does not modify either transport.
- Do not begin companion React, structured ask, `/brunch:consult`, rival-process, or standalone-reopen work in this slice.

## Sequential boundary

The remaining frontier obligations are deliberately **not scoped yet**:

```text
PTY production boot (this card)
→ companion React semantic convergence + fresh JSONL differential
→ structured ask + /brunch:consult + brunch.elicitation_style
→ same-target rival refusal + concurrent companion busy
→ normal TUI shutdown + standalone reopen/subsequent turn
→ colleague walkthrough resolves A51-L
```

The child entry and evidence channel established here determine the cheapest honest shape of the next card. Re-run `ln-scope` after this card lands; do not treat this list as five prepared cards.

## Expected touched paths (tentative)

```text
src/app/
├── brunch-tui.ts                                             ?  narrow provider-backend passthrough only if required
└── __tests__/
    ├── brunch-tui.test.ts                                    ?  composition contract if production passthrough is added
    ├── session-runtime-contract-tracer.slow.test.ts           ~
    ├── session-runtime-contract-tracer-child.ts               +
    └── session-runtime-contract-tracer-support.ts             +
memory/cards/shared-session-host-tracer--production-attachment.md ~
memory/PLAN.md                                                ?  progress pointer after build only
```
