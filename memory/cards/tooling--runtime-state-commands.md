# Runtime state command operations

Frontier: n/a — FE-845 branch concern; uses FE-847 Tier-2 harness substrate
Status:   done
Mode:     single
Created:  2026-06-11

## Orientation

- Seam: Brunch TUI chrome + Pi extension commands over transcript-backed runtime state (`src/.pi/extensions/{commands,runtime,chrome}` → `src/session/runtime-state.ts` → `src/projections/session/*`).
- Nearby frontier: this is not yet a named `memory/PLAN.md` frontier; it is FE-845 branch work. It should build on the active lower-stack `dx-tier-2-harness` frontier (`ln/fe-847-dx-introspection-tier-2`) for real-boot/faux-turn proof rather than inventing a local fake harness.
- Volatile state: user declared Pi update suppression and new-session header recovery sufficiently done; keyboard shortcut lookup overlay and `src/.pi/components/tui-lab/` posture UI experiments are deferred for later implementation, not part of this card.
- TUI interaction model for this slice: go straight through namespaced slash commands as the first user-facing surface (`/brunch:strategy`, `/brunch:lens`, mode read/no-op). Use notifications/errors for feedback; do not introduce a custom selector/overlay yet.
- Main risk: Pi command invocation and footer render are TUI/extension-context shaped; the slice must prove the product entry path with Tier-2 real boot where feasible, not only by directly calling pure helpers.

Posture: proving (inherited from FE-845 branch concern and adjacent `dx-tier-2-harness`).

## Target Behavior

A user-invoked Brunch slash command changes the session's active transcript-backed runtime posture before the next provider turn.

## Full-card cold-start reads

- `memory/SPEC.md` — D35-L, D40-L, D39-L, D58-L, D59-L, I25-L, I38-L, I42-L
- `memory/PLAN.md` — active `dx-tier-2-harness`; FE-847 single-branch Tier-2 context; no PLAN frontier currently names FE-845 chrome-pass work
- `src/.pi/extensions/README.md` — chrome/commands/runtime extension ownership and raw `ctx.ui.*` boundary rules
- `src/session/README.md` — runtime-state ownership and runtime affordance coverage ledger
- `src/dev/README.md` — Tier-2 real boot loop and faux-provider proof surfaces
- `docs/architecture/pi-faux-provider-pattern.md` — when faux provider assertions are the right oracle

## Boundary Crossings

```pseudo
/brunch:strategy <selection> or /brunch:lens <selection>
  -> .pi/extensions/commands validates command args against runtime axis vocabulary
  -> session/runtime-state appends brunch.agent_runtime_state reason=switch, source=user
  -> projections/session/runtime-state resolves last-writer-wins posture
  -> .pi/extensions/runtime applies active-tool/prompt posture before provider request
  -> .pi/extensions/chrome footer reflects projected mode/strategy/lens
  -> Tier-2 faux provider captures the next provider payload/active tools
```

`/brunch:mode` is in scope only to stop being a misleading stub: because `elicit` is currently the only legal op mode, it may report the current mode or accept an explicit no-op `elicit`, but it must not invent future execute-mode behavior.

Custom TUI controls are explicitly out of scope. The experimental `src/.pi/components/tui-lab/` segment/chip components are promising for a follow-on posture picker or overlay, but this slice should not couple runtime authority to that exploratory UI.

## Risks and Assumptions

- RISK: The current Tier-2 helper may expose a real runtime but not a convenient command-execution helper. → MITIGATION: extend `src/dev/tier-2-harness.ts` narrowly to invoke a registered extension command through `runtime.session.extensionRunner.getCommand(...).handler(...)` or equivalent real extension-runner surface; do not build a parallel fake command runner.
- RISK: A command can append runtime state but the next provider turn may not observe it if policy/prompt hooks read stale state. → MITIGATION: assertion must include a second faux provider turn after the command and inspect the captured provider context/active tools or prompt manifest for the selected axis.
- RISK: Footer reflection is hard to assert through raw TUI rendering. → MITIGATION: keep a pure footer-line assertion via `projectBrunchChromeFooterLines` with projected `agentState`, and treat an optional TUI smoke as outer/manual rather than a blocking oracle.
- ASSUMPTION: FE-847 Tier-2 chassis is available on the lower stack and usable from this branch.
  → IMPACT IF FALSE: this card should first land the minimal missing Tier-2 helper on the FE-847 seam or route back to `ln-scope`; do not regress to ad hoc local fakes.
  → VALIDATE: run/extend `src/dev/tier-2-harness.test.ts` around one command-driven real-boot faux turn.
  → memory/SPEC.md: D68-L, A25-L, I42-L.

## Posture check

This is a proving tracer bullet:

- Proof of life: a namespaced Brunch TUI command mutates actual transcript-backed runtime state and the next faux provider call sees it.
- Invariants: D40-L stays intact — runtime state is a Pi JSONL fact, not hidden extension memory; foreground agent never emits posture switches; user/system authority appends `reason: "switch"`.
- Uncertainty retirement: validates that FE-847 Tier-2 is sufficient for FE-845 chrome/runtime operation checks without adding another test harness.

## Acceptance Criteria

```pseudo tree
runtime-state command path
├── command validation
│   ├── accepts strategy selections: auto + known strategy ids
│   ├── accepts lens selections: auto + known lens ids
│   └── rejects unknown axis values without appending a runtime-state entry
├── transcript authority
│   ├── appends brunch.agent_runtime_state with reason=switch and source=user
│   ├── preserves previous state in the switch entry
│   └── projects the new state as last-writer-wins after reload
├── product reflection
│   ├── next provider turn observes the selected posture through the real Brunch runtime hooks
│   └── footer projection renders selected mode/strategy/lens from projected runtime state
└── explicit non-scope
    ├── update suppression/header recovery remain treated as already accomplished
    ├── keyboard shortcut lookup overlay is documented as deferred, not implemented here
    └── tui-lab posture picker/overlay is deferred to a following slice
```

✓ Command tests — `/brunch:strategy propose-graph`, `/brunch:strategy auto`, `/brunch:lens intent`, and `/brunch:lens auto` append valid switch entries; invalid values notify/fail without appending.
✓ Projection/reload test — appended switch entries survive Pi JSONL reload and `projectBrunchAgentState` returns the selected strategy/lens.
✓ Tier-2 faux test — a real `runBrunchTui` boot invokes a runtime switch command, runs a subsequent faux-provider turn, and captures provider/prompt/tool posture consistent with the switch.
✓ Chrome projection test — `projectBrunchChromeFooterLines` renders the projected strategy/lens from `agentState`, not stale launch-time `chrome.runtime` fallback.
✓ No hotkeys implementation — no shortcut lookup overlay is added in this slice; if touched docs need it, note it as deferred only.

## Verification Approach

- Inner: unit tests in `src/.pi/__tests__/` and/or `src/app/brunch-tui.test.ts` over command parsing, validation, append behavior, and footer projection.
- Middle: Tier-2 real-boot faux-provider test via `src/dev/tier-2-harness.ts` / `src/dev/tier-2-harness.test.ts` proving command → transcript state → next provider turn.
- Gate: `npm run verify` before commit; during iteration, run focused tests plus `npm run fix` after meaningful edits.

## Cross-cutting obligations

- Preserve D39-L sealed profile: no ambient Pi resources, no product behavior gated on dev-only introspection, no hidden state outside the explicit extension bundle.
- Preserve D40-L: runtime-state entries are transcript-backed facts; commands are user/system authority; no agent-emitted posture switches.
- Use existing runtime legality/policy tables; do not create a second command-local vocabulary or future `execute` mode.
- Use FE-847 Tier-2/faux-provider surfaces for product-path proof; do not add a third harness or shape implementation around an injected fake path that product never runs.

## Expected touched paths (tentative)

```pseudo tree
src/.pi/extensions/commands/
├── index.ts                         ~
└── runtime-switch-command.test.ts    +?
src/.pi/__tests__/
├── operational-mode.test.ts          ~?
├── chrome.test.ts                    ~
└── extension-registry.test.ts        ~?
src/app/
└── brunch-tui.test.ts                ~?
src/dev/
├── tier-2-harness.ts                 ~?
└── tier-2-harness.test.ts            ~
src/session/
└── runtime-state.ts                  ~?
src/.pi/extensions/README.md          ~?
src/session/README.md                 ~?
```

## Promotion checklist

- [ ] Does this change a requirement? — No.
- [ ] Does this create, retire, or invalidate an assumption? — No; it validates use of Tier-2 as an oracle for this seam.
- [ ] Does this slice depend on an unvalidated high-impact assumption? — No; Tier-2 already exists enough to try, and the card names the fallback.
- [ ] Does this make or reverse a non-trivial design decision? — No; D40-L already says user/system posture switches append transcript facts.
- [ ] Does this establish a new seam-level invariant? — No; it exercises existing invariants.
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer? — No.
- [x] Does it cross more than two major seams? — Yes, intentionally; kept as a full card.
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread? — No.
- [ ] Can you not name the containing seam or current rationale from the live docs? — No.
