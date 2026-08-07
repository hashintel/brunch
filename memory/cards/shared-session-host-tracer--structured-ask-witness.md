# Structured ask and TUI-only interaction over the production TUI PTY

Frontier: shared-session-host-tracer
Status:   active
Mode:     single
Created:  2026-08-07

## Orientation

- **Containing seam.** The normal-TUI runtime composition (`runBrunchTui` → real Pi `InteractiveMode` → web sidecar → companion React), locked by D141-L. Two witnesses already run this composition end to end through one shared PTY choreography module (`src/app/__tests__/session-runtime-contract-pty-journey.ts`) and one child entry (`session-runtime-contract-tracer-child.ts`): the boot/turn/cleanup tracer and the companion-React convergence witness.
- **Frontier item.** `shared-session-host-tracer` (FE-1321), branch `ln/fe-1321-shared-session-host-tracer`. This card is a slice inside that frontier — no new Linear issue, no new branch. The remaining limbs after this one are rival refusal and TUI-shutdown/standalone-reopen, in that order.
- **Volatile state.** Working tree clean at `921f9c4b9`. PLAN records `Live scope files: none` for this frontier; this card supersedes that line.
- **Main open risk.** The ask extension resolves its collector by a **UI-first ladder**: `ctx.hasUI && ctx.ui.custom` wins before the `LiveAskOpener` branch is ever consulted (`src/.pi/extensions/exchanges/ask.ts:205,235,261,385`). In a real TUI, `hasUI` is true, so an extension-owned structured ask **never registers in the live ask registry**, the TUI adapter's `asks.subscribe` never fires, and companion React currently receives **no `ask_opened` delta at all**. D125-L's registry is a *no-UI* contract by construction. This slice's production change exists to close exactly that gap.
- **Cross-cutting obligations inherited from the frontier.** Canonical `/rpc` stays semantic-only and `/rpc/driver` stays transitional (neither contract changes here); `src/dev/tui-driver/**` remains the sole PTY surface; one shared child entry with a minimal readiness report; no detachable TUI, remote terminal protocol, or second truth store; new test support modules stay under `src/**/__tests__/**`.

**Posture: proving (inherited from `shared-session-host-tracer`).**

## Scope weight

**Full scope card.** It widens the `LiveAskOpener` contract, establishes a seam-level answering-authority rule for the TUI composition, crosses the extension / session / rpc / web boundaries, and is the first touch in the ask-extension seam for this frontier.

## Target Behavior

Companion React stays semantically converged with the real TUI across the interactions only the TUI can drive: an extension-owned structured ask and a TUI-only product command.

## Full-card cold-start reads

```
- memory/SPEC.md   — A51-L; D116-L, D125-L, D132-L, D133-L, D141-L; I64-L, I65-L;
                     §Verification Design "Session runtime contract convergence oracle"
- memory/PLAN.md   — frontier: shared-session-host-tracer (Status, Acceptance, Dependencies `next:`)
- src/session/TOPOLOGY.md   — live ask registry / adapter ownership
- src/rpc/TOPOLOGY.md       — semantic-only `/rpc`, transitional `/rpc/driver`
- src/web/TOPOLOGY.md       — raw-event rejection, overlay + settlement refetch contract
- src/app/__tests__/session-runtime-contract-companion.slow.test.ts
                            — runtime-DOM setup, recording RPC client, convergence shape.
                              Read its header before writing any new browser witness.
- docs/praxis/manual-testing.md — §Findings ledger discipline (owner of the deferred outer question)
```

## Boundary Crossings

```
→ PTY keyboard (src/dev/tui-driver: sendText / sendKeys)
→ real Pi InteractiveMode inside the production runBrunchTui child
→ ask extension collector, UI branch (src/.pi/extensions/exchanges/ask.ts)
→ live ask registry announcement channel (src/session/live-ask-registry.ts)
→ TUI live session adapter → ask_opened LiveSessionEvent (src/session/tui-live-session-adapter.ts)
→ web sidecar semantic event frame over /rpc
→ production WebSocket RPC client (src/web/rpc-client.ts)
→ React session route: live overlay, then settlement refetch (src/web/routes/session.tsx)
→ parent-computed projectSessionPresentationFile over the sole canonical JSONL
```

## Chosen shape, and what was rejected

The gap in Orientation admits three resolutions. This card takes the middle one.

- **Rejected — settle-only convergence (no production change).** Let the ask stay invisible until `agent_settled` refetches the presentation, where the answered ask arrives as a JSONL read-back. Cheapest, but it proves nothing the landed ordinary-turn witness has not already proved, and the SPEC oracle explicitly owes the ask "observed in companion React **through target-addressed semantic deltas**". A settled read-back has no delta.
- **Chosen — observation-only announcement.** The UI collector announces the ask payload to the registry as *observed*, not *answerable*. `reader.openAsks()` lists it (so a reconnecting browser hydrates it through the existing `session.openAsks` loader path), `subscribe` fires so the adapter emits one `ask_opened`, and the collector concludes the announcement when the TUI answers. `answerer.submitAnswer` still finds no pending entry, so a browser answer attempt is refused with `ask_closed` — the existing `Ask` form already surfaces that as a visible error (`src/web/routes/session.tsx:490`), so the refusal is honest with **no** contract or UI change.
- **Rejected — genuine dual-answer.** Registering the TUI-owned ask as answerable would let a browser answer resolve the registry promise while the TUI picker is still open. Dismissing that picker from outside is not reachable: the extension holds only Pi's tool-execution `AbortSignal`, and aborting it cancels the whole turn. Dual-answer is a larger product claim that A51-L's colleague walkthrough is the right judge of, not a tracer-slice decision.

**Explicitly excluded from this slice:** an ownership marker on `OpenAsk` (e.g. `owner: 'tui'` / `answerable: false`) so the companion could render a TUI-owned ask read-only. It is defensible, but it ripples through `zOpenAsk`, the `SessionPresentationEntry` ask variant, the overlay reducer, and the `Ask` component for a UX polish the oracle does not require. The honest-refusal leaf below covers the correctness half; the presentation half is deferred to the colleague walkthrough (see Verification Approach).

**On the retired planning chain's `/brunch:consult` + `brunch.elicitation_style`:** both are **in**, as the TUI-only product interaction. Committing a style through the orientation juncture appends a `brunch.elicitation_style` custom entry to the session branch (`src/.pi/extensions/session-orientation/index.ts:178` → `appendElicitationStyleEntry`), which lands in the canonical JSONL and has no browser affordance whatsoever — precisely the "TUI-only product interaction" the oracle owes. The presentation projector ignores `custom` entries, so convergence is a real assertion (both sides must drop it identically) rather than a tautology.

## Risks and Assumptions

```
- RISK: the `ask` tool may not be in the active tool set for the faux-driven Specify turn, so the
  queued fauxToolCall never executes.
    → MITIGATION: the child boots the full production extension set, so `ask` is registered; confirm
      activation in the red phase. If the product gates `ask` out of the default Specify turn, report
      that as a finding — do NOT paper over it with the probe-only `pi.setActiveTools(['ask'])` trick
      from src/probes/structured-exchange-ordering-proof.ts:193, which would make the witness prove a
      configuration no user has.

- RISK: `/brunch:consult` may be nondeterministic under a PTY — the juncture can fire a kick that
  consumes a queued faux response, and the menu has its own timing.
    → MITIGATION: fall back to committing a style at the boot chooser (Enter instead of Esc), which
      writes the same `brunch.elicitation_style` entry. Add a separate `commitModeChoice` helper to the
      journey module; leave `dismissModeChooser` untouched so the two landed witnesses keep their path.

- RISK: declaring the jsdom vitest-environment docblock anywhere in the new file — even in prose —
  switches Vite to its client transform, which rewrites the tui-driver's
  `new URL('./driver.exp', import.meta.url)` and breaks the PTY spawn.
    → MITIGATION: copy the runtime-DOM approach from the companion witness verbatim
      (`builtinEnvironments.jsdom.setup` + dynamic import of RTL and `src/web/app.tsx`). Do not name the
      directive anywhere in the new file, including comments.

- RISK: widening the child's faux responses to emit a tool call could change what the two landed
  witnesses see.
    → MITIGATION: keep the responders content-addressed and add a distinct ask-trigger prompt constant;
      the existing ordinary-turn prompt must keep returning `TRACER_PROBE_REPLY`. Both landed slow tests
      are acceptance leaves below.

- RISK: announced-but-unanswerable asks could mislead a headless driver reading `session.openAsks`.
    → MITIGATION: announcement fires only on the `hasUI` collector branch. Standalone web is headless,
      so nothing announces there; pin that with an inner test and keep the standalone contract suites
      green (named in Invariants preserved).

- ASSUMPTION: for the TUI composition, companion React observing a TUI-owned ask (browser watches, TUI
  answers) is the product-correct semantic, rather than dual-answer authority.
    → IMPACT IF FALSE: the answering-authority design changes; `OpenAsk`/`zOpenAsk` gain an ownership or
      answerability field, the cutover's semantic-contract sweep rows shift, and the picker-dismissal
      mechanism becomes upstream Pi work. Blast radius: this card plus `shared-session-host-cutover`
      rows; the rival and reopen slices are unaffected.
    → VALIDATE: the honest-refusal acceptance leaf here, then A51-L's colleague walkthrough.
    → → memory/SPEC.md §Assumptions A51-L
```

## Posture check

Proving posture; the slice scores on all three axes.

- **Proof of life:** first live structured-exchange path from a real TUI ask to a companion browser.
- **Invariants:** locates the answering-authority seam for the TUI composition — one writable runtime (I64-L) now also means one answering authority per open ask, proved by refusal rather than by the absence of a UI affordance.
- **Uncertainty:** advances A51-L's open companion-sufficiency claim onto the interaction class the ordinary-turn witness could not reach.

The slice is already shaped as the proof: if the announcement design is wrong, the witness goes red at the `ask_opened` leaf or at the refusal leaf. No spike is warranted.

## Acceptance Criteria

Inner leaves:

```
✓ src/session/__tests__/live-ask-registry.test.ts — an announced ask is listed by `reader.openAsks()`,
  reports `stateOf` as `open`, notifies `subscribe` listeners once, and is refused by
  `answerer.submitAnswer` with `no_pending_exchange`; concluding it removes it from `openAsks()`.
✓ src/session/__tests__/live-ask-registry.test.ts — announcement does not disturb the existing
  `opener.openAsk` rendezvous: a headless ask still registers as pending and answers normally.
✓ src/.pi/extensions/__tests__/ask-headless-discovery.test.ts — with a `hasUI: true` custom-editor ctx
  the ask announces, resolves from the TUI editor, and concludes, never creating an answerable pending
  entry; with `hasUI: false` the existing headless registration path is byte-for-byte unchanged.
✓ src/session/__tests__/tui-live-session-adapter.test.ts — an announced ask emits exactly one
  target-addressed `ask_opened` delta carrying the announced payload.
```

Middle leaves — new witness `src/app/__tests__/session-runtime-contract-structured-ask.slow.test.ts`,
one PTY + browser journey feeding every leaf:

```
✓ ask delta — the companion receives an `ask_opened` `brunch.liveSessionEvent` whose target equals the
  durable `(specId, sessionId)` and whose payload carries the exact exchangeId and question body.
✓ semantic-only transport — no `brunch.sessionEvent` frame reaches the companion; every notification is
  `brunch.liveSessionEvent` or `brunch.updated`.
✓ live render — the companion renders the open ask question while the TUI picker is still on screen.
✓ single answering authority — a browser `session.answerExchange` on the TUI-owned ask returns
  `ask_closed`, and the answer that lands in canonical truth is the one typed into the TUI.
✓ settled convergence — at `agent_settled` the rendered transcript equals a parent-computed fresh
  `projectSessionPresentationFile`, including the answered-ask read-back with the TUI-supplied answer,
  with equal entry counts (no overlay residue).
✓ TUI-only interaction — after a style is committed through the orientation juncture, the canonical
  JSONL contains a `brunch.elicitation_style` custom entry, and the companion's rendered transcript
  still equals a fresh projection across it.
✓ journey cleanup — Ctrl-D exits within the bounded wait and the per-target writer lock is gone.
```

Regression leaves:

```
✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts — stays green (child widening safe).
✓ src/app/__tests__/session-runtime-contract-companion.slow.test.ts — stays green (journey module safe).
✓ npm run test — default suite green.
✓ npm run test:slow:core — the three PTY witnesses green in the slow lane.
✓ npm run check — lint, format, konsistent, markdown links, skills, promoted-run-paths clean.
```

## Invariants preserved

```
- Canonical `/rpc` carries semantic events only; no raw Pi frame reaches a browser — guarded by: the
  semantic-only-transport leaf here and the same leaf in session-runtime-contract-companion.slow.test.ts.
- `src/dev/tui-driver/**` is the sole PTY surface; no witness adds a second spawn/expect path — guarded
  by: reuse of session-runtime-contract-pty-journey.ts (no new spawn appears in the touched paths).
- One child entry, not a per-witness fork; its report stays sidecar URL + readiness only — guarded by:
  the touched-path manifest containing no new child file, and the child's own header contract.
- Standalone-web headless ask discovery and answering are unchanged — guarded by:
  src/rpc/__tests__/headless-ask-discovery.contract.test.ts, src/rpc/__tests__/session-open-asks.test.ts,
  and src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts.
- `dismissModeChooser` keeps its current behavior for the two landed witnesses — guarded by: both landed
  slow tests, named as regression leaves above.
- STOP-THE-LINE — I64-L writer-lock release on interactive quit. A red on the cleanup leaf is a respec
  signal, not a fixture to update: it means a normal Ctrl-D can again strand the target for every later
  TUI and standalone-web process. Guarded by: the cleanup leaf in all three PTY witnesses and the
  synchronous `process.on('exit')` release in brunch-tui.ts.
```

## Verification Approach

```
- Inner: contract unit tests — registry announcement lifecycle, ask-collector ladder branching,
  adapter delta emission. Proves the announcement channel is observe-only and mode-correct.
- Middle: production PTY + real-WebSocket + real-React witness in the slow lane. Proves the whole
  target-addressed semantic path from a TUI-owned ask to a converged browser transcript.
- Outer: A51-L's colleague walkthrough, owned by frontier `shared-session-host-tracer` (see its
  Verification line in memory/PLAN.md). It carries two deferred questions from this slice: (1) whether a
  companion answer form on a TUI-owned ask is confusing enough to warrant the excluded ownership marker,
  and (2) whether observation-without-answering is sufficient companion value. Re-entry trigger: the
  walkthrough session itself, which is a precondition of retiring A51-L. Record both in
  TESTING_FINDINGS.md per docs/praxis/manual-testing.md §Findings ledger discipline if the walkthrough
  does not immediately follow this card.
```

## Cross-cutting obligations

```
- Canonical `/rpc` stays semantic-only; `/rpc/driver` stays transitional. Neither contract changes here.
- `src/dev/tui-driver/**` remains the sole PTY surface in the repo.
- One shared PTY choreography module and one child entry; extend, never fork.
- No detachable TUI, remote terminal protocol, or second truth store is introduced.
- New test support modules stay under `src/**/__tests__/**` so the build excludes them.
- Do not name the jsdom vitest-environment directive anywhere in the new witness file.
- Reconcile canonical docs before tie-off: SPEC's convergence-oracle paragraph and the I64-L/I65-L/A51-L
  evidence lines, D141-L's status column, and PLAN's frontier Status, `Live scope files`, and
  Dependencies `next:` pointer.
```

## Expected touched paths (tentative)

```text
src/session/
├── live-ask-registry.ts                                        ~
├── tui-live-session-adapter.ts                                 ?   (only if announce needs its own channel)
├── TOPOLOGY.md                                                 ?   (registry ownership statement)
└── __tests__/
    ├── live-ask-registry.test.ts                               ~
    └── tui-live-session-adapter.test.ts                        ~
src/.pi/extensions/
├── exchanges/ask.ts                                            ~
└── __tests__/ask-headless-discovery.test.ts                    ~
src/app/__tests__/
├── session-runtime-contract-pty-journey.ts                     ~
├── session-runtime-contract-tracer-support.ts                  ~
├── session-runtime-contract-tracer-child.ts                    ~
└── session-runtime-contract-structured-ask.slow.test.ts        +
memory/
├── SPEC.md                                                     ~
├── PLAN.md                                                     ~
└── cards/shared-session-host-tracer--structured-ask-witness.md -   (delete when exhausted)
```

`src/app/brunch-tui.ts` and `src/app/pi-extensions.ts` are deliberately **absent**. The announcement is
added to the `LiveAskOpener` interface itself, so `brunch-tui.ts:636`'s `context.liveExchange.opener`
and `pi-extensions.ts:240`'s `liveExchange?: LiveAskOpener` both keep working untouched. Keep it that
way — it is what makes this card write-disjoint from the queued `capture-ledger-tracer` card, which
declares `src/app/brunch-tui.ts` and `src/app/__tests__/brunch-tui.test.ts` as primary write targets.

## Overlap test

Checked against all six other active scope files. Manifests are disjoint:

| Scope file | Primary write area | Overlap |
| --- | --- | --- |
| `capture-ledger-tracer--conduct-falsifier.md` | `src/agents/**`, `src/dev/**`, `src/app/brunch-tui.ts` | none — see note above |
| `execution-comparison-tracer--brunch-oracle-smoke.md` | `testing/execution-comparisons/**`, `src/dev/execution-comparison/**` | none |
| `greenfield-secure-drop-demo--mission-and-witness.md` | `testing/comparisons/missions/**` | none |
| `tooling--conditional-comparison-gate.md` | `.github/workflows/**`, `scripts/**` | none |
| `walkthrough-remediation-2--consolidated-outer-checkpoint.md` | `TESTING_FINDINGS.md`, `testing/walkthroughs/**` | none |
| `walkthrough-remediation-2--provider-conduct-evidence.md` | `src/probes/**` | none |

`memory/SPEC.md` and `memory/PLAN.md` appear in several manifests, but those are canonical documents
reconciled at tie-off, not contended implementation targets.

## Sequential boundary

Do **not** widen this card into the rival-refusal or TUI-shutdown/standalone-reopen limbs. Both need the
same `session-runtime-contract-pty-journey.ts` as a primary write target, so by the overlap test they are
not independent of this card and must follow it sequentially on the same branch.
