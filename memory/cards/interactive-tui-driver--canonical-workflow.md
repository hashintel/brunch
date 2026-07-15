# Canonical interactive TUI driver tracer

Frontier: interactive-tui-driver
Status:   done
Mode:     single
Created:  2026-07-15

Posture: proving (inherited from `interactive-tui-driver`)

## Orientation

- Containing seam: `src/dev/**` owns Brunch-only feedback loops; `src/dev/tui-driver.ts` is the current Expect/FIFO PTY + headless-xterm fallback.
- Frontier: `interactive-tui-driver` ([FE-1206](https://linear.app/hash/issue/FE-1206/canonical-interactive-tui-driver-for-agents-and-human-takeover)) is an independent tooling tracer, not product runtime.
- Volatile handoff state: none (`HANDOFF.md` is absent); the worktree started clean on `ln/fe-1206-interactive-tui-driver`.
- Main risk: `pi-interactive-shell`'s advertised PTY fidelity and takeover behavior may not survive Brunch's Pi 0.80.x line, the actual arm64 macOS host, nested TUI use, or sandbox constraints.

Frontier obligations carried here: preserve the existing driver until replacement equivalence is witnessed; keep dependencies dev-only; bound model-visible output; keep raw artifacts under gitignored `.fixtures/scratch/`; record manual findings with an owned disposition.

## Target Behavior

Agents and humans have one witnessed priority order for controlling Brunch TUIs without widening the shipped runtime.

## Cold-start reads

- `memory/SPEC.md` — D39-L, D42-L, D68-L–D71-L; I42-L; Verification Design §Development Feedback Loops
- `memory/PLAN.md` — frontier `interactive-tui-driver`
- `docs/praxis/manual-testing.md` — setup, sandbox fallback, artifact rules, and findings-ledger discipline
- `src/dev/TOPOLOGY.md` — feedback-loop ownership and dependency posture
- `src/dev/README.md` — current developer front door
- `src/dev/tui-driver.ts`, `src/dev/tui-driver/**`, `src/dev/__tests__/tui-driver.test.ts` — current fallback contract and oracles
- Upstream candidate at the tested revision — `pi-interactive-shell` README/package manifest and its pinned `zigpty` package/release metadata

## Boundary Crossings

```text
agent command
→ selected dev-only TUI driver
→ PTY + terminal-state reconstruction
→ component preview or seeded Brunch TUI
→ bounded viewport/status evidence
→ agent assertion and deterministic teardown

human keystroke
→ observable candidate overlay takeover
→ explicit return-to-agent control
→ bounded agent-visible result
```

## Risks and Assumptions

- RISK: installing the candidate through normal Pi package discovery would contaminate Brunch's sealed or ambient profile → MITIGATION: evaluate through an isolated temporary Pi home/config or project-local dev harness; do not add it to Brunch's extension bundle.
- RISK: the `zigpty` prebuild is absent or incompatible on the actual `darwin-arm64` host → MITIGATION: make install/import/spawn a fail-fast health check and record the exact package/platform result before any adoption work.
- RISK: nested terminal overlays can look alive while screen reads, input, or teardown are wrong → MITIGATION: require screen-state assertions, named input actions, resize evidence, exit status, and no-live-child cleanup for both tracers.
- RISK: raw logs or pasted credentials leak into evidence/model context → MITIGATION: use synthetic inputs only, keep raw PTY output under `.fixtures/scratch/`, and expose only bounded viewports/summaries.
- ASSUMPTION: one workflow can cover both component-preview and seeded-product sessions, with the existing driver retained as a documented sandbox fallback.
  → IMPACT IF FALSE: the frontier must name a deliberate two-tier priority order rather than claiming one universal driver; no second custom PTY stack is justified.
  → VALIDATE: execute both tracers and the sandbox run before changing canonical guidance.
- ASSUMPTION: `pi-interactive-shell` can be evaluated without becoming a shipped dependency or ambient Brunch extension.
  → IMPACT IF FALSE: reject adoption and retain/augment the in-repo driver.
  → VALIDATE: inspect package placement and the release build/runtime graph after the candidate health check.

No live `memory/SPEC.md` assumption is changed; these are frontier-local tooling hypotheses.

## Posture Check

This tracer scores on all three proving axes:

- **Proof of life:** one candidate workflow drives both the isolated component-preview and seeded Brunch TUI paths.
- **Invariant:** it locks the dev-only/product-runtime boundary, bounded-output rule, fallback trigger, and deterministic cleanup contract.
- **Uncertainty:** it decides whether the external overlay actually earns priority over the proven Expect/xterm fallback on the team's host and sandbox.

A separate spike would duplicate the candidate health check without landing the canonical workflow. Keep the comparison and decision in this tracer.

## Temporary Capability Matrix

Update every cell with measured evidence during the build. `claim` means upstream documentation only and does not satisfy closure. Distill the final priority/fallback decision into the canonical docs, then delete this scope file when the frontier is exhausted.

| Capability | Existing Expect/xterm driver | `pi-interactive-shell` over `zigpty` | Evidence / verdict |
| --- | --- | --- | --- |
| Real PTY fidelity | Expect PTY drove both real TUIs | zigpty PTY drove both real TUIs | both met; candidate preferred on capable host |
| xterm/VT screen reconstruction | coherent captured viewports + 8/8 tests | coherent user-observed overlay viewports | both met |
| Text input | synthetic Brunch input accepted | user reports text accepted | both met |
| Named-key input | named key accepted in both tracers | user reports named keys accepted | both met |
| Bracketed/multiline paste | unsupported by line protocol | user procedure confirmed operation | candidate-only capability |
| Wait/assert | measured substring wait + timeout tests | bounded status/viewport query observed | both applicable; fallback has explicit wait |
| Resize | unsupported by current CLI | both viewports remained coherent through resize | candidate required when resize is owed |
| Bounded model-visible output | measured viewport / bounded log tail | bounded query result observed | both met |
| Cancellation and cleanup | cancellation, stopped→removed, empty list; 8/8 tests | killed/queried final; no residual child/session | both met |
| Human observation/takeover/return | unsupported | user took over with ordinary key and returned via `Ctrl+G` | candidate-only capability |
| Sandbox viability | drove both tracers despite sandbox | blocked before execution by `tsx` IPC `listen EPERM` | fallback wins in constrained sandbox |
| Scratch/artifact hygiene | gitignored named-session evidence | isolated temporary Pi profile; no committed logs | both met |
| Pi 0.80.x compatibility | not applicable | user-witnessed with Pi 0.80.x | candidate met |
| `darwin-arm64` prebuild/import/spawn | system Expect dependency | 0.1.6 prebuild present; user-witnessed import/spawn | candidate met on measured host |
| `zigpty ^0.1.6` vs current 0.2.x consequence | not applicable | declared `^0.1.6`, resolved `0.1.6`; upstream `0.2.1` | health-check version changes; no direct integration |

## Acceptance Criteria

- ✓ **candidate health report (`.fixtures/scratch/tui-driver-comparison/<run-id>/summary.md`)** — records exact Pi, `pi-interactive-shell`, `zigpty`, Node, OS, and architecture versions plus install/import/spawn results; distinguishes the candidate's `zigpty ^0.1.6` dependency from the current 0.2.x release line.
- ✓ **capability matrix + captured viewport evidence** — every matrix row has measured evidence for both applicable candidates, an explicit unsupported/not-applicable result where appropriate, and a verdict; README claims alone never count as evidence.
- ✓ **component-preview tracer (`npm run dev:components -- tui-lab`)** — the selected workflow proves launch → visible-screen assertion → variant/input action → runtime resize → clean exit, with textual viewports and exit/cleanup facts captured under scratch.
- ✓ **seeded-Brunch tracer (`npm run seed -- --seed workspace-alpha-grounding/base --reset` plus `npm run dev-cli`)** — the same selected workflow proves launch → visible-state assertion → named-key/text interaction → cancellation → teardown, with no live child/session residue.
- ✓ **existing fallback suite (`npm run test -- src/dev/__tests__/tui-driver.test.ts`)** — protocol, VT reconstruction, wait timeout, liveness, fail-fast control writes, and teardown remain green until any replacement decision is fully witnessed.
- ✓ **runtime-boundary check (`npm run build` plus package/build inspection)** — no candidate PTY package or extension enters Brunch's shipped dependency/extension surface solely for testing.
- ✓ **manual overlay witness (user-observed session)** — where the host permits it, a human watches, takes control, returns control to the agent, and confirms the viewport remains coherent; any finding is fixed, promoted, or retired in `TESTING_FINDINGS.md`.
- ✓ **sandbox fallback witness** — one run under the constrained agent environment proves the documented fallback activates when a socket-backed/overlay workflow is unavailable and still tears down deterministically.
- ✓ **documentation consistency (`npm run check:markdown-links` and review)** — `docs/praxis/manual-testing.md`, `src/dev/README.md`, and `src/dev/TOPOLOGY.md` name one priority order, health check, exact launch/interaction commands, fallback trigger, cleanup procedure, takeover behavior, artifact bounds, and platform ceiling; superseded guidance is removed.

## Invariants Preserved

- Dev-only tooling does not widen Brunch's sealed Pi profile or published runtime — guarded by: I42-L tests/build exclusions and the build/package inspection above.
- The existing Expect/xterm driver remains usable until equivalence is proven — guarded by: `src/dev/__tests__/tui-driver.test.ts` plus the sandbox fallback witness.
- Workbench state and raw PTY logs remain ephemeral, gitignored evidence — guarded by: `.gitignore`, scratch-path assertions/inspection, and `docs/praxis/manual-testing.md`.
- No secrets or credentials enter automatic summaries or committed evidence — guarded by: synthetic tracer inputs and human review before any evidence promotion.

## Completion Evidence

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| candidate health report | met | `.fixtures/scratch/tui-driver-comparison/2026-07-15T1308/summary.md` |
| capability matrix + viewports | met-with-divergence | matrix above; candidate detail is explicitly user-reported because sandbox execution was blocked, not fabricated machine output |
| component-preview tracer | met | fallback viewport artifact + user-reported candidate launch/input/resize/cleanup |
| seeded-Brunch tracer | met | fallback launch/interacted/list artifacts + user-reported candidate launch/input/resize/cleanup |
| existing fallback suite | met | coordinator rerun: `npm run test -- src/dev/__tests__/tui-driver.test.ts`, 8/8 passed |
| runtime boundary | met | no package/profile code changed; `npm run build` in final gate |
| manual overlay witness | met | user-reported isolated Pi 0.80.x witness: takeover, `Ctrl+G` return, coherent resize, final status, no residue, no finding |
| sandbox fallback witness | met | fallback scratch artifacts; candidate blocked at `tsx` IPC socket; empty driver list after cleanup |
| documentation consistency | met | `docs/praxis/manual-testing.md`, `src/dev/README.md`, `src/dev/TOPOLOGY.md`; final link check/gate |
| dev-only runtime invariant | met | temporary `-e npm:` workflow; no manifest or sealed-profile addition |
| fallback remains usable | met | 8/8 tests and both sandbox tracers |
| ephemeral artifact invariant | met | evidence remains under gitignored `.fixtures/scratch/` |
| no-secret invariant | met | synthetic input only; summary contains bounded facts and labels the human report |

Skipped-test-count delta vs parent: 0 (no tests changed or skipped).

## Verification Approach

- Inner: focused Vitest contracts plus `npm run fix` — preserve current protocol/screen/liveness behavior and cover any project-owned adapter or health-check code.
- Middle: two scripted real-PTY tracers plus a capability matrix — prove screen interpretation, input, resize, bounded output, exit status, and cleanup against actual processes.
- Outer: one user-observed overlay takeover/return session and one constrained-sandbox fallback run — judge shared control and operational fallback behavior that unit tests cannot establish.

## Cross-cutting Obligations

- Use only dev-scoped, removable package/config additions; direct `zigpty` integration is allowed only after a demonstrated extension gap.
- Keep raw artifacts in `.fixtures/scratch/`; promote nothing without review and path normalization.
- Prefer measured behavior over upstream marketing, especially for platform support and current `zigpty` compatibility.
- Do not add a generic PTY abstraction or second custom stack for optionality.
- If candidate results invalidate the frontier's one-workflow premise, revise `memory/PLAN.md` before broadening implementation.

## Expected Touched Paths (Tentative)

```text
memory/
├── PLAN.md                                                   ~
└── cards/interactive-tui-driver--canonical-workflow.md       ~ then - on closure
src/dev/
├── tui-driver.ts                                             ?
├── tui-driver/                                               ?
├── __tests__/tui-driver.test.ts                              ?
├── README.md                                                 ~
└── TOPOLOGY.md                                               ~
docs/praxis/manual-testing.md                                 ~
TESTING_FINDINGS.md                                           ?
package.json                                                  ? dev-only if adoption earns it
package-lock.json                                             ? dev-only if adoption earns it
.fixtures/scratch/tui-driver-comparison/                      + gitignored runtime evidence only
```
