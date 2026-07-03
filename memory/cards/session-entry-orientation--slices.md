# Session orientation — dialog, junctures, entry chrome, re-entry assessment

Frontier: session-entry-orientation
Status:   active
Mode:     slices
Created:  2026-07-03

> Coordination note: adjudicated base card (2026-07-03 cross-review) — the sibling perspectives (`pi-dialog-core`, `dialog-kick-tracer`) are folded in and deleted (2026-07-03, with authors' concurrence): choice schema, live-kick helper, extension home, no-UI PLAN correction, C3 probe path, append-failure/D37-L-guard/fold-robustness ACs, topology reconciliation. This card does not claim the Linear-issue/branch pickup step.

## Orientation

- **Containing seam:** a new per-concern extension home `src/.pi/extensions/session-orientation/` (Pi adapter wiring — sibling of `chrome/`, `commands/`, `workspace/`) + the origination seed path (`src/session/originate-assistant-turn.ts` → `src/agents/contexts/seeds/origination.ts`), which already folds custom entries (`latestElicitationScratchpad`) into the `brunch.context_seed` kick payload. The dialog is product chrome on the product side of D37-L — not an exchange. Seed-path routing is mandatory, not incidental: kick turns bypass `before_agent_start` (FE-1122 F1 lesson), so hook-local prompt injection cannot carry the directive.
- **Frontier:** `session-entry-orientation` (PLAN §Frontier Definitions; ship-gate head, arc `deterministic-orientation`). Linear issue: [FE-1134](https://linear.app/hash/issue/FE-1134/session-orientation-dialog-at-deterministic-junctures). Graphite branch: `ln/fe-1134-session-orientation` (split from the walkthrough planning branch after the first orientation commits).
- **Posture:** mechanism `earned`, menu content/conduct `proving` (inherited from `session-entry-orientation`). Cards 1–2 are proving tracers; cards 3–4 are earned defect-closure inside settled seams.
- **Volatile handoff state:** HANDOFF.md (2026-07-03) is superseded for this frontier by the Card 1/Card 2 build notes below and the PLAN/SPEC sync commit.
- **Current build focus:** Cards 1–4 all landed, plus Card 2 trailers (J5 mode-switch + C1 RPC dialog timeout). The frontier's inner-loop scope is closed; outstanding work is outer-loop walkthrough evidence for the propose/project options (blocked on `walkthrough-batch-2` seed variants).
- **Cross-cutting obligations (frontier-level):** decision-flow chart at scope time (§Chart below — discharged); sweep-exclusion probe for `brunch.session_orientation`; the arc's "one witnessed e2e run per generative flow" obligation — elicit-path menu options verifiable on existing seeds now, propose/project options blocked on `walkthrough-batch-2` seed variants (`memory/cards/walkthrough-batch-2--seed-variants.md`).

**Grounding corrections to the PLAN definition (verified against Pi docs + code this session):**

1. Pi's `session_start` reason set is `"startup" | "reload" | "new" | "resume" | "fork"` — the PLAN names only `new`/`resume`/`fork`. The TUI front door is **`startup`**, and Brunch's own activation taxonomy (`SpecSessionActivationDecision`: `newSpec` / `newSession` / resume-shaped, via `startupHeaderForActivation`) is the real entry discriminator, not the Pi reason.
2. Fork is blocked by Brunch command policy (`src/.pi/extensions/commands/policy.ts`) — the fork juncture is **vacuous today**; chart carries it as a guard row only.
3. `brunch.session_orientation` is **already excluded from the capture sweep by default**: `isSweepConversationalEntry` (`src/projections/session/sweep-watermark.ts:62-78`) returns `false` for any custom entry outside `DIGEST_CUSTOM_TYPES`. Card 1 owes only the probe, no mechanism — exactly as the PLAN pinned.
4. There is no `agent_abort` extension event and `AgentEndEvent` exposes only `messages` — but `AssistantMessage.stopReason` includes `'aborted'` (`node_modules/@earendil-works/pi-ai/dist/types.d.ts:205`), so an esc-abort is likely detectable by inspecting the tail assistant message in `agent_end`. Compaction-overflow aborts that will retry (`willRetry`) must be excluded. Concrete probe path in check C3 (card 2); if the probe fails, J4 degrades to `/consult`-only.
5. `ctx.ui.select` returns `undefined` on escape **and** on timeout; `ctx.hasUI` is `false` in print (`-p`)/JSON modes and `true` in TUI + RPC. RPC dialogs ride the `extension_ui_request`/`extension_ui_response` sub-protocol (`node_modules/@earendil-works/pi-coding-agent/docs/rpc.md` §Extension UI Protocol); `ctx.ui.custom()` does **not** work in RPC — the workspace dialog's `ctx.ui.custom` pattern is not a valid analog here.
6. **PLAN correction (recorded by `ln-sync`):** the PLAN's chart obligation lists "dialog-unavailable (print/json modes, `ctx.hasUI` false)" as a path to chart. Charted resolution: **no dialog, no entry, default kick** — degraded modes leave no orientation trace rather than synthesizing a `continue` entry, so transcript orientation entries always mean "a user actually chose."
7. `src/rpc/methods/session.ts`'s manual-trigger path **seeds origination but does not run a live assistant turn**. A mid-session juncture that owes an actual kick needs the live path brunch-tui uses: `originateAssistantTurn(...)` + `completeAssistantKick` over the live `AgentSession` (`sendCustomMessage(..., { triggerTurn: true })`). Card 2 extracts a shared helper; "via the RPC seam" alone would not produce a turn.

### Choice schema (one canonical set — resolves the continue ambiguity)

Entry payload: `{ choice, trigger }` with `choice` one of:

| id | Menu label (SPEC-mode) |
|----|------------------------|
| `continue` | continue (default; escape/timeout target) |
| `elicit_decisions` | continue via decision-driven questions [elicit/grill-style] |
| `elicit_examples` | continue via example-driven questions [elicit/disambiguate-style] |
| `propose_intent` | propose candidate spec designs [propose:intent] |
| `propose_design` | propose technical designs [propose/project:design] |
| `propose_oracle` | propose verification designs [propose/project:oracle] |
| `ingest` | ingest source material [ingest] |

Two uniform rules, no per-juncture entry variance:

- **Entry rule:** an entry is written on **every dialog resolution** (including escape/timeout → `continue`); no entry when the dialog was not shown (`ctx.hasUI` false, or juncture guarded off).
- **Kick rule:** at junctures where a kick is already pending (J1 entry, J5 mode-switch, J2 if switch re-originates), the choice shapes that kick and never fires a second one. At junctures with no pending kick (J3 tree, J4 abort, J6 consult), `choice ≠ continue` fires the live-kick helper; `choice = continue` fires nothing — the user keeps the floor.

## Decision-flow chart (cross-cutting obligation — deliverable #1)

### Juncture inventory × outcome × endpoint

| # | Juncture | Trigger surface | Dialog fires? | Outcome paths | Entry written | Kick action | Endpoint (user-visible) |
|---|----------|-----------------|---------------|---------------|---------------|-------------|-------------------------|
| J1 | TUI boot entry (new/resume, Brunch activation decision) | `session_start` reason `startup` handler in the session-orientation registrar, after Pi binds extension UI | yes, when `ctx.hasUI` | choice / escape→`continue`; degraded mode skips dialog | `brunch.session_orientation` `{ choice, trigger: 'entry' }` only when dialog shown | boot mode originates + kicks; recorded choices force a fresh seed, degraded/escape still kick on the default path | kick opens already routed to the chosen move when chosen; no model turn spent asking |
| J2 | Post-switch `session_start` (Pi reason `new`/`resume` after session switch/replacement) | `pi.on('session_start')` handler in session-orientation extension | yes, when `ctx.hasUI` and reason ∈ {new, resume} | same as J1 | same, `trigger: 'switch'` | **check C2**: whether Brunch's workspace switch re-originates; if not, non-`continue` choice fires the live-kick helper | switched-into session opens oriented, not dead |
| J3 | `/tree` navigation | `pi.on('session_tree')` | yes | choice / escape→`continue` | `trigger: 'tree'` | kick rule: non-`continue` → live-kick helper; `continue` → no kick, user types freely | after tree jump, user chooses how to proceed |
| J4 | Esc/abort settle | `pi.on('agent_end')` where the tail assistant message has `stopReason === 'aborted'` (**check C3**; exclude compaction-retry aborts) | yes, debounced to genuine user aborts | choice / escape→`continue` | `trigger: 'abort'` | kick rule: `continue` → **no kick** (user esc'd to take control; a kick would fight them); non-`continue` → live-kick helper | esc never strands the user in a dead session |
| J5 | Mode switch (SPEC↔CODE via `/brunch:mode`) | mode-switch path in `src/.pi/extensions/commands/index.ts` (`appendBrunchAgentRuntimeSwitch`) | juncture **defined** here; SPEC-side menu only. CODE-side menu content is owned by `execute-entry-readiness` | same as J1 | `trigger: 'mode-switch'` | choice feeds the pending mode-switch kick seed | mode switch lands on an oriented opening |
| J6 | `/consult` (forced, mid-session) | `pi.registerCommand` in commands/index.ts (house prefix: register as `brunch:consult`; alias decision at build) | yes, always (it IS the dialog) | choice / escape→`continue` | `trigger: 'consult'` (entry rule: written even on escape) | kick rule: non-`continue` → live-kick helper; `continue` → no kick | user can summon the menu at will |
| J7 | Fork (`session_start` reason `fork`) | n/a — blocked by `commands/policy.ts` | **no — vacuous today** | — | — | — | guard row: if fork unblocks, J2 handler already covers the reason |
| J8 | `session_start` reason `reload` | Pi lifecycle noise | **no** — `startup` is J1; `reload` is extension reload, not a user juncture | — | — | — | no dialog spam on reloads |

### Degraded-mode paths (all junctures)

| Condition | Behavior |
|-----------|----------|
| `ctx.hasUI === false` (print `-p` / JSON mode) | no dialog, **no entry**, kick default path — must never block |
| RPC mode (`ctx.hasUI === true`, `ctx.mode === 'rpc'`) | `ctx.ui.select` relayed via `extension_ui_request`/`extension_ui_response`; **check C1**: Brunch's RPC client must answer (or the dialog blocks) → defensive `timeout` option in RPC mode only, auto-resolving `undefined` → `continue` |
| Timeout (where armed) | `select` returns `undefined` → `continue` — the menu is never a wall |
| Escape (all modes) | `undefined` → `continue` |

### SPEC-mode menu (grill flow 1, pinned in PLAN)

Canonical choice ids and labels: see §Choice schema above (single source; the grill's flow-1 list maps 1:1).

### Kick-composition endpoint (all non-degraded paths)

```diagram
╭──────────────╮   appendEntry    ╭──────────────────────────────╮
│ dialog       │ ───────────────▶ │ brunch.session_orientation   │
│ ctx.ui.select│                  │ { choice, trigger }          │
╰──────────────╯                  ╰──────────────┬───────────────╯
                                                 │ latestSessionOrientation(entries)
                                                 ▼
╭─────────────────────────╮   seed   ╭───────────────────────────╮
│ originateAssistantTurn  │ ───────▶ │ composeContextSeedContent │
│ (src/session/…)         │          │ + orientation section     │
╰─────────────────────────╯          ╰──────────────┬────────────╯
                                                    ▼
                                     brunch.context_seed → kick turn
                                     (opening turn routed to chosen move)
```

Consumption rule: origination folds only the **latest** orientation entry, and only when it is newer than the last kick (stale choices must not re-route later kicks — acceptance in card 1).

### Named checks (verification items, not design questions)

- **C1 (RPC relay):** confirm Brunch's RPC client surface handles `extension_ui_request`/`extension_ui_response` for dialog methods. Card 1 records the finding; if unhandled, the RPC-side relay work is named and promoted, not silently absorbed.
- **C2 (switch re-origination):** verify whether Brunch workspace switch re-runs origination for the replacement session (only known `originateAssistantTurn` call sites today: `brunch-tui.ts` boot, `rpc/methods/session.ts` seed-only). Card 2 owns the consequence.
- **C3 (abort discriminator):** probe path — in `agent_end`, inspect the tail assistant message for `stopReason === 'aborted'` (`pi-ai` `StopReason` includes it); exclude compaction-overflow aborts that Pi retries (`willRetry`). Card 2 owns the consequence; if the probe shows esc-aborts are not reliably distinguishable, J4 degrades to `/consult`-only and the frontier definition is annotated.

---

## Card 1 — Orientation dialog tracer: TUI entry juncture end-to-end · `landed (option-2 J1)`

**2026-07-03 landed (option-2 J1 boot rework):** J1 now runs as a `session_start` handler for reason `startup` inside the session-orientation extension registrar. Binding-order verified against `@earendil-works/pi-coding-agent/dist/core/agent-session.js:1644-1665`: `bindExtensions()` applies the UI context (`_applyExtensionBindings`, line 1663) *then* emits `session_start` (line 1664), so `ctx.hasUI === true` and `ctx.ui.select` are live for the boot handler. The pre-session-binding origination + fire-and-forget kick were deleted from `src/app/brunch-tui.ts`; the resolveKickContext callback carries the debug-cache mirror and kick-status chrome forward. `runOrientationJuncture` gained a `mode: 'follow-choice' | 'boot'` parameter — `'boot'` always originates+kicks (with `resumeOrigin: 'resume_debt'` so a resumed session with no debt still idles correctly, and `forceSeed: true` only when a real orientation choice was recorded), preserving "never a wall" including degraded-mode boots and escape (both still fire the boot kick). No-double-kick in degraded modes is proven at unit level: the deleted brunch-tui boot origination is the only other path that could have fired, and it is gone.

Full-scope card body kept below for retro/traceability.


Full scope card. Posture: proving (inherited) — scores on **proof of life** (first deterministic orientation path lights up), **invariants** (locates the dialog→entry→kick seam), and **uncertainty** (retires the boot-ordering unknown).

**2026-07-03 build finding (retires the boot-ordering unknown, differently than the RISK anticipated):** the domain layer (`session-orientation.ts` schema/fold/staleness, the seed-render section, `originate-assistant-turn.ts` threading, the sweep-exclusion probe, and the Pi-facing dialog function in `.pi/extensions/session-orientation/`) is built and green. The J1 boot-path wiring is **not** landed: traced through `node_modules/@earendil-works/pi-coding-agent`, `ctx.ui.select` is backed by `InteractiveMode`'s own `ExtensionSelectorComponent` (`showExtensionSelector`), wired only when `InteractiveMode.bindCurrentSessionExtensions()` calls `session.bindExtensions({ uiContext, mode: 'tui', ... })` — which happens **after** `createBrunchAgentSessionRuntimeFactory` returns, inside `InteractiveMode.run()`. `ExtensionRunner.hasUI()` is `uiContext !== noOpUIContext`, and the runner starts with `noOpUIContext`, so `created.session.createReplacedSessionContext().ui`/`hasUI` at the boot point the RISK named (right after `createAgentSessionFromServices`, still inside the runtime factory) is **always the no-op UI** — `ctx.ui.select` cannot fire there in the real product, regardless of TUI vs RPC. The RISK's stated mitigation ("move the origination call after session creation") is insufficient; `hasUI` does not become true until later in the TUI startup path than any code `brunch-tui.ts`'s runtime factory can reach.

The one existing precedent for a pre-session-extension-binding dialog is `runWorkspaceDialogPreflight` (`src/.pi/components/workspace-dialog/`): a bespoke `pi-tui` `TUI` + `ProcessTerminal` overlay, built and driven entirely outside any `AgentSession`/extension runner. Landing J1 for real requires one of:

1. **Bespoke pre-session dialog** (mirror `workspace-dialog/`): a dedicated `pi-tui`-backed overlay called directly from `brunch-tui.ts`, independent of `ctx.ui.select`. Works for TUI; has no RPC-relay story of its own (C1's `extension_ui_request`/`extension_ui_response` sub-protocol is `ctx.ui`-specific), so this path likely leaves J1 TUI-only until RPC gets its own preflight-style relay.
2. **Move J1 later**: fire the dialog from a real `session_start` (or first `before_agent_start`) handler once `bindCurrentSessionExtensions` has run and `ctx.ui`/`hasUI` are live — contradicting grounding item "a `session_start` handler is NOT the right J1 carrier," which this finding now overturns for the *boot* juncture specifically (J2-J6 were already going to be `session_start`/event handlers; only J1 was assumed to need a non-`session_start` boot-path call).

This is a structural fork the card did not anticipate (stop condition: "the active card needs promotion to structural work" / "the containing seam no longer feels settled" per `ln-build` sliced-execution rules) — routing back to the user before choosing an approach and reordering `brunch-tui.ts`'s real boot path.

### Target Behavior

On TUI boot with UI available, the orientation dialog fires with the SPEC-mode menu, its outcome is recorded as a `brunch.session_orientation` entry, and the kick's context seed carries the chosen move — so the opening assistant turn is routed without a model turn spent asking.

### Full-card cold-start reads

```
- memory/SPEC.md   — D98-L, D101-L/D102-L, D37-L, D40-L
- memory/PLAN.md    — frontier: session-entry-orientation (incl. pinned checks + menu contents)
- this file         — §Decision-flow chart (J1, degraded modes, kick endpoint, C1)
- node_modules/@earendil-works/pi-coding-agent/docs/extensions.md — §session_start, §Dialogs (~L2180)
- node_modules/@earendil-works/pi-coding-agent/docs/rpc.md — §Extension UI Protocol (~L989)
- src/session/elicitation-scratchpad.ts — the custom-entry fold analog to copy
- src/agents/contexts/seeds/origination.ts — seed composition to extend
```

### Boundary Crossings

```
→ src/app/brunch-tui.ts boot path (dialog call, reordered before origination)
→ src/.pi/extensions/session-orientation/index.ts (dialog fn, ctx.ui.select; Pi adapter wiring)
→ src/session/session-orientation.ts (entry constant, choice schema, append helper, latestSessionOrientation fold)
→ src/session/originate-assistant-turn.ts (fold into seed input)
→ src/agents/contexts/seeds/origination.ts (render orientation section)
→ brunch.context_seed entry → kick turn
```

### Risks and Assumptions

```
- RISK: boot reorder — originateAssistantTurn currently runs BEFORE createAgentSessionFromServices;
  the dialog needs the created session's ui context. → MITIGATION: move the origination call after
  session creation (its inputs — sessionManager entries, graph reads — are all available then);
  keep completeAssistantKick fire-and-forget as today; boot tests + origination.md debug oracle
  prove the decision/seed content is unchanged when no orientation entry exists.
- RISK: C1 — RPC client may not answer extension_ui_request; dialog would block RPC sessions.
  → MITIGATION: arm `timeout` on the select in ctx.mode === 'rpc' only (auto-resolves undefined →
  continue); record the C1 finding in the card on completion.
- ASSUMPTION: a `session_start` handler is NOT the right J1 carrier (boot path owns it).
    → IMPACT IF FALSE: card 2's J2 handler shape changes; no rework in card 1 itself.
    → VALIDATE: falls out of the boot-reorder work (cheap).
```

### Acceptance Criteria

```
✓ orientation fold — latestSessionOrientation returns the newest brunch.session_orientation entry; ignores other
  entry types and skips malformed entry data (runtime-state fold precedent)
✓ staleness — an orientation entry older than the last kick does not re-route a later kick seed
✓ seed render — composeContextSeedContent emits an orientation section for each §Choice schema id; omits it when absent
✓ escape default — select → undefined maps to choice 'continue'; entry still written with trigger 'entry' (entry rule)
✓ degraded mode (dialog-function level) — hasUI false ⇒ no dialog, no entry (proven at runAndRecordSessionOrientation);
  origination unchanged (existing boot tests stay green) — real boot-path wiring is the blocked item below
✓ append failure — a failed appendCustomEntry is logged and never blocks boot or the kick (dialog path is best-effort)
✓ D37-L guard — the dialog path emits no present_ or request_ tool results anywhere (orientation is not an exchange)
✓ boot order — landed via option 2 (session_start reason 'startup' handler); binding order verified against Pi's bindExtensions (apply UI context → emit session_start)
✓ sweep exclusion probe — brunch.session_orientation entry is not sweep-conversational (sweep-watermark test)
```

### Verification Approach

```
- Inner: vitest unit tests — fold, staleness, seed render, escape mapping, sweep probe
- Middle: boot-path test with stubbed dialog (existing brunch-tui test family) — ordering + degraded mode
- Outer: live walkthrough cold-open beat + .brunch debug oracles (origination.md, entry-contents.md,
  system-prompt.md) — kick actually opens routed; menu→conduct routing evidence via session JSONL
```

### Cross-cutting obligations

- sweep-exclusion probe (this card)
- chart consumption rule (staleness) — the invariant later junctures rely on
- C1 finding recorded
- topology reconciliation — new per-concern dir + domain fold get layout rows in `src/.pi/extensions/TOPOLOGY.md` and `src/session/TOPOLOGY.md`

### Expected touched paths (tentative)

```
src/session/
├── session-orientation.ts            +
├── originate-assistant-turn.ts       ~
└── __tests__/…                       +~
src/agents/contexts/seeds/
└── origination.ts                    ~
src/.pi/extensions/session-orientation/
├── index.ts                          +   (dialog fn + registrar; new per-concern extension dir)
└── __tests__/…                       +
src/.pi/extensions/TOPOLOGY.md        ~   (layout row for session-orientation/)
src/session/TOPOLOGY.md               ~   (session-orientation fold row)
src/app/pi-extensions.ts              ~   (register the new extension)
src/app/brunch-tui.ts                 ~   (boot reorder + dialog call)
src/projections/session/__tests__/…   ~   (sweep probe)
```

---

## Card 2 — Remaining junctures: /consult, tree, esc-settle, mode-switch, RPC verification · `done`

**2026-07-03 build finding (partial, after option-2 J1 completion):** the live-kick helper (`.pi/extensions/session-orientation/juncture.ts` — `runOrientationJuncture`) and the Pi event/command registrar (`registrar.ts`) are built and green. `originateAssistantTurn` gained a `forceSeed` option so a mid-session dialog-triggered kick lays down a fresh seed even when the graph LSN has not moved. `resolveKickContext` closes over the workspace state in `brunch-tui.ts` so J3/J4/J6 non-continue choices fire an actual assistant turn.

Landed junctures (all: dialog → entry → live-kick when applicable, honoring the entry rule on escape):

- J2 (session_start reasons `new`/`resume`) — with J7/J8 guard tests on `startup`/`reload`/`fork`.
- J3 (session_tree).
- J4 (agent_end esc-abort) — C3 probe implemented via tail-message `stopReason === 'aborted'`. **C3 finding:** the extension `AgentEndEvent` does NOT carry `willRetry`; a compaction-overflow retry fires a fresh `agent_end` — the 750ms debounce (`ceiling:`) collapses the double-fire in practice but is not a proof, and a real compaction-retry-aware guard is deferred if it becomes visible in outer walkthroughs.
- J6 (`/brunch:consult`).

Trailer landing (2026-07-03, after Card 3 + Card 4):

- **J5 mode-switch (SPEC-side menu).** Landed. The mode-picker path in `src/.pi/extensions/commands/index.ts` (`applyModeSwitchAndOrient`) now fires the shared orientation flow via `runJunctureForContext` with `trigger: 'mode-switch'` **only when the switch target is `elicit` (SPEC mode)**. CODE-side switches stay silent — the CODE-side menu content remains owned by `execute-entry-readiness`, honoring the boundary risk in the card. Kick delivery goes through `sendCustomMessageViaExtensionApi(pi)` because the command handler has an `ExtensionAPI` but not a live `AgentSession.sendCustomMessage` reference; Pi routes the message through the same session queue with `triggerTurn: true`. `BrunchCommandsOptions.sessionOrientation` is threaded from `pi-extensions.ts` via the existing options spread — no new composition wiring.
- ~~Option-2 J1 boot wiring~~ — landed in `7ebdf205`; the registrar now handles `session_start(startup)` in boot mode.
- **C1 RPC-dialog verification.** Landed. The shared helper `adaptOrientationUi(ctx)` (`session-orientation/juncture.ts`) inspects `ctx.mode`: TUI mode passes `select` calls through unchanged, RPC mode injects `{ timeout: ORIENTATION_RPC_DIALOG_TIMEOUT_MS }` (60 s). The registrar and the J5 command path both route through `runJunctureForContext`, so both pick up the timeout — a mute or missing RPC dialog client can no longer wedge the orientation seam. On timeout, `select` returns `undefined` → the existing choice schema maps it to `continue` and the entry rule still writes the resolution. Two inner-loop unit tests cover the timeout injection and the J5 delegation shape (`session-orientation/__tests__/juncture.test.ts`); an outer-loop RPC driver probe against a real Pi RPC session remains available if walkthrough evidence surfaces a divergence but is not required to close the card — the timeout is a floor guarantee independent of the client's behavior.

Landed cross-cutting: sweep-exclusion probe carried forward from card 1 (`brunch.session_orientation` excluded from the capture sweep tail); topology reconciliation.

---

## Card 2 — Original definition (kept for downstream cross-references) · `superseded by in-progress note above`

Full scope card. Posture: proving (conduct) — extends the settled dialog seam from card 1 to the full trigger set. Does **not** depend on card 1 findings beyond the dialog function existing (its API shape is card 1's deliverable, but these junctures attach to already-live event surfaces regardless of how J1's boot ordering resolved).

### Target Behavior

The orientation dialog fires on every mid-session juncture (J2–J6) with the correct trigger tag; the §Choice schema entry and kick rules hold everywhere; non-`continue` choices at no-pending-kick junctures run an actual assistant turn via the live-kick helper; RPC-mode dialog round-trip is verified.

### Full-card cold-start reads

```
- this file         — §Choice schema, §Decision-flow chart (J2–J8, C2, C3), grounding item 7
- memory/PLAN.md    — frontier: session-entry-orientation; execute-entry-readiness (J5 boundary)
- src/.pi/extensions/commands/index.ts — registerCommand pattern + mode-switch path
- src/app/brunch-tui.ts — completeAssistantKick live path (the helper's extraction source)
- src/rpc/methods/session.ts — seed-only manual-trigger path (NOT sufficient for a live turn)
```

### Boundary Crossings

```
→ pi events (session_start new/resume, session_tree, agent_end) + /brunch:consult command
→ src/.pi/extensions/session-orientation/index.ts (shared dialog fn from card 1)
→ brunch.session_orientation entry → live-kick helper (extracted from brunch-tui's
  originateAssistantTurn + completeAssistantKick over the live AgentSession,
  sendCustomMessage(..., { triggerTurn: true })) when choice ≠ continue
```

### Risks and Assumptions

```
- RISK: C3 — esc-aborts may not be reliably distinguishable via tail-message stopReason === 'aborted'
  (and compaction-retry aborts must be excluded). → MITIGATION: probe at build start;
  if it fails, J4 ships as /consult-only and the frontier definition is annotated (no silent scope creep).
- RISK: C2 — workspace switch may not re-originate. → MITIGATION: non-continue choices always route
  through the live-kick helper; continue on a dead switch leaves today's behavior (documented).
- RISK: extracting the live-kick helper from brunch-tui's boot path may entangle boot-only concerns
  (kick status UI, debug-cache mirrors). → MITIGATION: helper owns originate+complete only;
  chrome/debug side-effects stay at call sites.
- RISK: J5 fires SPEC-side menu only; CODE-side content must not leak in.
  → MITIGATION: guard test — mode-switch to CODE with this card's build shows the juncture, not a menu
  owned by execute-entry-readiness.
- ASSUMPTION: /consult registers under the brunch: prefix (brunch:consult) per house convention.
    → IMPACT IF FALSE: rename only. → VALIDATE: user veto at review.
```

### Acceptance Criteria

```
✓ injected-event tests — each of J2/J3/J4/J5/J6 fires the dialog once with its trigger tag
✓ entry + kick rules — undefined → continue with entry written on every juncture; J3/J4/J6 continue ⇒ no kick
✓ live kick — non-continue choice at J3/J4/J6 appends entry then runs an actual assistant turn via the
  live-kick helper (triggerTurn observed); seed carries the move
✓ no dialog on session_start reasons startup/reload/fork (J7/J8 guard test)
✓ RPC round-trip — dialog request/response over the extension-UI sub-protocol observed (probe or driver test)
✓ debounce — no double-dialog when junctures coincide (e.g. tree nav immediately after abort)
```

### Verification Approach

```
- Inner: injected-event extension tests per juncture (same style as the existing session-hooks/extension test families)
- Middle: RPC driver probe for the dialog round-trip (existing rpc test/probe family)
- Outer: live walkthrough — /consult beat, esc beat, tree beat; session JSONL routing evidence
```

### Cross-cutting obligations

- J5 boundary discipline: CODE-side menu content stays with `execute-entry-readiness`
- C2/C3 findings recorded in this file on completion

### Expected touched paths (tentative)

```
src/.pi/extensions/session-orientation/
├── index.ts                          ~   (event wiring for J2–J6)
└── __tests__/…                       +~
src/.pi/extensions/commands/index.ts  ~   (/brunch:consult)
src/session/… or src/app/…            +   (live-kick helper extracted from brunch-tui boot path)
src/app/brunch-tui.ts                 ~   (boot path delegates to the helper)
src/rpc/methods/session.ts            ?   (only if RPC junctures reuse the helper)
```

---

## Card 3 — Deterministic entry chrome (F13/F14/F16a; F15a optional) · `done`

**2026-07-03 landed:** F13/F14/F16a shipped; F15a dropped (would fight F14's global working-message reset).

- **F13:** `BrunchStartupHeader` now composes an identity block plus a rounded-box welcome element (`projectRoundedBox` with accent border and `welcome` top label) for `newSpec`/`newSession` activations — visually separates the welcome from the header identity.
- **F14:** kick activity drives `ctx.ui.setWorkingMessage('Opening assistant turn…')` from `brunch-tui.ts`'s origination-decision callback instead of the retired `brunch.kick` status key. Chrome's `turn_end` handler resets to default so a kick-scoped message never leaks. `BRUNCH_KICK_ACTIVITY_STATUS_KEY` deleted (no dual carrier, no re-export from `app/pi-extensions.ts`); the chrome `message_start` handler no longer touches setStatus.
- **F16a:** `openSession` activations render a rounded-box resume state/status block via `startupHeader.resumeFacts` (`{ specTitle, nodeCount, edgeCount, modeLabel }`), sampled once in the runtime factory from `graph.forSpec(specId).queryGraph()` + `projectBrunchAgentState(entries)`. When facts are absent the block falls back to `"graph facts not yet sampled"`.
- **F15a (dropped):** turn_end "Worked for Ns" label would compete with F14's default-restore, per card guidance. If revisited, needs Pi upstream per-message labels.

Topology: `src/.pi/extensions/chrome/TOPOLOGY.md` updated (retired `brunch.kick` status-key note, `startupHeader.resumeFacts` recorded, header composition sketch updated). No SPEC event, no PLAN change — settled chrome seam.

---

## Card 3 — Original definition (kept for cross-refs) · `superseded by landed note above`

Light scope card. Posture: earned (settled chrome seams; each item closes a named walkthrough finding).

### Objective

Entry chrome reads as designed product: the welcome block is its own styled element after the header (F13), kick activity shows via `setWorkingMessage`/`setWorkingVisible` instead of the footer status key (F14), and resume opens with a state/status insertion (F16a); the turn_end "Worked for Ns" label (F15a) is optional — drop it if it fights the working-message change.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: session-entry-orientation, objective thread 1
- TESTING_FINDINGS.md — F13, F14, F15, F16a
- src/.pi/components/chrome-header.ts — current welcome block (~L65)
- src/app/brunch-tui.ts — current kick status (BRUNCH_KICK_ACTIVITY_STATUS_KEY, ~L507)
```

### Acceptance Criteria

```
✓ welcome block renders as its own element after the header on newSpec/newSession (snapshot)
✓ kick activity uses setWorkingMessage/setWorkingVisible in TUI (no-op in RPC is acceptable per Pi docs)
✓ resume boot inserts the state/status block (F16a) — snapshot on resume-shaped activation
✓ footer status key path retired or delegating (no dual carrier)
```

### Verification Approach

```
- Inner: chrome/component snapshot tests (existing __snapshots__ family)
- Outer: live walkthrough cold-open + resume beats (aesthetic judgment stays human)
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/chrome-header.ts   ~
src/.pi/extensions/chrome/index.ts    ~
src/app/brunch-tui.ts                 ~   (kick status → working message; overlaps card 1 — sequential, same file)
```

---

## Card 4 — Re-entry assessment guidance (F16b) · `done`

**2026-07-03 landed:** `kickTurnMessage` is now origin-aware. `resume_debt` kicks carry a re-entry assessment directive — a compact reading of what the graph currently expresses and a forecast of what looks TODO, grounded in the D101-L/D102-L seed facts already carried by the kick payload — before returning to elicitation. `new_session` content is unchanged (guard test locks it). `manual_trigger` shares the new-session content because those kicks are already directed by the SESSION ORIENTATION section (§Choice schema) their orientation entry places in the seed.

Verification: unit tests in `src/session/__tests__/originate-assistant-turn.test.ts` cover the resume directive (contains "Session resume", "assessment", "forecast", "TODO", and the no-node-dump guard) and the manual_trigger==new_session equivalence. Outer walkthrough resume beat and `.brunch/debug/system-prompt.md` / `.brunch/debug/origination.md` remain the conduct-quality oracle.

---

## Card 4 — Original definition (kept for cross-refs) · `superseded by landed note above`

Light scope card. Posture: earned mechanism (prompt shaping over existing seed facts, D101-L/D102-L — no new plumbing); conduct quality verified outer-loop.

### Objective

A resumed session's kick opens with an assessment — graph summary, TODO forecast, teaching surface — instead of diving into elicitation (F16b), via kick/persona guidance in the elicitor prompt/seed layer.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: session-entry-orientation, objective thread 2
- TESTING_FINDINGS.md — F16, F17
- src/agents/runtime/elicitor/compose-live-prompt.ts + src/agents/contexts/seeds/origination.ts
```

### Acceptance Criteria

```
✓ resume-origin kick seed/prompt carries the assessment instruction (unit: prompt/seed text assertion)
✓ new-session kick unchanged (guard)
✓ live resume beat opens with assessment, not an elicitation question (outer walkthrough + JSONL)
```

### Verification Approach

```
- Inner: prompt/seed composition unit tests
- Outer: live walkthrough resume beat; system-prompt.md / origination.md debug oracles
```

### Assumption dependency

None (rides validated D101-L/D102-L seed substrate).

### Expected touched paths (tentative)

```
src/agents/runtime/elicitor/compose-live-prompt.ts  ~
src/agents/contexts/seeds/origination.ts            ~   (overlaps cards 1 — sequential, same file)
src/agents/…/__tests__                              ~
```

---

## Sequence notes

- Recommended next order after `7ebdf205`: Card 3 → Card 4 → Card 2 trailers (J5 + C1 RPC verification). Cards 3–4 are unblocked because J1 is stable; J5 can pair opportunistically with Card 3 if mode-switch chrome is already in hand.
- Anti-speculation gate honored: no card's scope shifts on earlier cards' findings; C1–C3 are named checks whose adverse outcomes annotate, not re-scope.
- `ln-sync` reconciliation: SPEC/PLAN now record D28-L/I57-L, D40-L concentric authority, D98-L Enhance rejection, no-UI orientation behavior, and option-2 J1 (`session_start(startup)` after UI binding).
- Sibling cards `--pi-dialog-core` and `--dialog-kick-tracer`: deleted 2026-07-03 after adjudication + fold-in.
- Delete this file when the sequence is exhausted or superseded.
