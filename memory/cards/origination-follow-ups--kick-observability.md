# Kick Observability and Wording Chain

Frontier: origination-follow-ups (FE-852 residue)
Status:   active
Mode:     chain
Created:  2026-06-12

## Orientation

- Seam: assistant-turn origination — `src/session/originate-assistant-turn.ts` + `start-assistant-turn.ts` own the decision; the kick-completion choreography (guard + `sendCustomMessage(kickTurnMessage, { triggerTurn })` + error handling) is currently embedded in `src/app/brunch-tui.ts`.
- Source: 2026-06-12 `ln-induct` silent-skip findings 1–4, reconciled into `memory/PLAN.md` §origination-follow-ups (c). Build is **deferred until this stack merges to `next`** (user decision 2026-06-12); cards authored on `ln/fe-858-above-the-line`.
- Verified during scoping: the RPC `session.triggerExchange` site (`src/rpc/methods/session.ts`) intentionally seeds without kicking — no live AgentSession exists in that transport (documented inline). There is exactly **one** kick-completion site. Induct finding 4 ("two sites, drift unchecked") is resolved benign; the repair is extraction, not unification.
- Verified during scoping: `StartAssistantTurnDecision` already carries idle reasons (`explicit_freestyle` | `no_unresolved_debt`) — computed, then discarded. Card 2 threads existing data. Note `explicit_freestyle` is a third silent-skip path beyond the induct's two.
- Main risk: the resume-kick intermittency root cause is suspected (model-availability guard), not proven. Card 2 **is** the diagnostic; no fix card is pre-scoped on top of its findings (chain anti-speculation gate).
- Adjacent, explicitly out: the TUI pending-action indicator (demo-polish grab-bag) — it will consume Card 1/2's outcome observable later; no `src/web` or chrome-layout work here.

Posture: proving (inherited from FE-852 residue). Card-level: Card 1 earned · Card 2 proving · Card 3 earned.

## Dependency Sketch

```text
Card 1  kick-completion seam + outcome sink      [earned: canonicalize the choreography]
  └─> Card 2  decision/outcome observables       [proving: retires the "why no kick" unknown]
Card 3  kickTurnMessage wording + lock           [earned: independent of 1–2]
```

## Card 1 — Extract the kick-completion seam with an outcome sink

### Target Behavior

The kick-completion choreography lives in one session-owned function whose every exit (fired, skipped-with-reason, failed) is reported through an injected outcome sink — and the TUI's sink routes failures to a TUI-visible channel instead of `console.error`.

### Full-card cold-start reads

```
- memory/SPEC.md   — D76-L, D77-L, D78-L (revised 2026-06-12); I45-L, I46-L, I47-L
- memory/PLAN.md    — frontier: origination-follow-ups (c); demo-polish grab-bag (pending indicator = future consumer)
- src/session/README.md — origination seam ownership
- src/session/originate-assistant-turn.ts — module docstring (current choreography contract)
```

### Boundary Crossings

```
→ src/app/brunch-tui.ts (launch path: decision already made, AgentSession just created)
→ src/session/<kick-completion seam> (guard + fire + outcome classification)
→ outcome sink (caller-supplied; TUI implementation surfaces failures visibly)
```

### Risks and Assumptions

```
- RISK: moving the model-availability guard into session/ could couple session/ to
  the services/modelRegistry type → MITIGATION: inject availability as a boolean or
  thunk; the seam owns classification, not service access.
- ASSUMPTION: pi's setStatus (SPEC §Chrome surface evolution, status-keys seam) or an
  equivalent TUI-visible channel is reachable from the launch path for the failure sink.
    → IMPACT IF FALSE: failure surfacing degrades to debug-cache-only; card still lands.
    → VALIDATE: during build, one look at chrome extension wiring in brunch-tui.ts.
```

### Posture check (earned)

Closes: the app-embedded, error-swallowing choreography (canonicalizes one seam; deletes the inline `void …catch(console.error)` block). Materializes: the outcome sink that Card 2 and the demo-polish indicator consume.

### Acceptance Criteria

```
✓ completion seam unit tests — fired / skipped(no_model) / skipped(idle: reason) / failed(error)
  each produce exactly one sink report carrying origin and reason
✓ brunch-tui launch test — TUI sink routes failure to a TUI-visible channel; no
  console.error in the kick path
✓ RPC site unchanged — triggerExchange remains seed-only; a comment names the seam it
  would use if its transport ever gains a live session
```

### Verification Approach

```
- Inner: vitest unit tests on the completion seam (faux session double asserting
  sendCustomMessage/triggerTurn calls and sink reports)
- Middle: existing tier-2 boot suites stay green (kick behavior unchanged for the
  fired path)
```

### Cross-cutting obligations

```
- D77-L: this seam writes no continuity; seed remains origination's only append
- I46-L/I47-L: kick stays a custom transcript entry, never a fabricated user message
- Provider-legality rule (src/session/README.md): no new entry shapes
```

### Expected touched paths (tentative)

```
src/session/
├── originate-assistant-turn.ts        ~  (or sibling kick-completion module +)
├── originate-assistant-turn.test.ts   ~
src/app/
├── brunch-tui.ts                      ~
└── brunch-tui.test.ts                 ~
src/rpc/methods/session.ts             ~  (comment only)
```

## Card 2 — Origination decision and kick outcome become observable

### Target Behavior

After any session boot or manual trigger, the origination decision (action, origin, idle reason) and the kick outcome (fired / skipped why / failed how) are inspectable — always in the dev debug cache, and product-visibly when the outcome is a skip or failure — so a silent resume has a named reason.

### Full-card cold-start reads

```
- memory/SPEC.md   — D71-L (debug cache, BRUNCH_DEV gating), D77-L, D78-L; I47-L
- memory/PLAN.md    — frontier: origination-follow-ups (c) — the three named suspects
- Card 1 of this file — the outcome sink this card persists/surfaces
```

### Boundary Crossings

```
→ outcome sink (Card 1)
→ .brunch/debug/ cache writer (dev-gated, existing introspection seam)
→ TUI status surface (skip/failure only; product-visible)
```

### Risks and Assumptions

```
- RISK: the intermittency reproduces from a cause outside the three suspects →
  MITIGATION: acceptable; the observable narrows the next diagnosis either way.
- ASSUMPTION: the model-availability guard is the prime suspect (unauthenticated/
  slow-auth resume).
    → IMPACT IF FALSE: no rework — this card's value is the named reason, not the guess.
    → VALIDATE: this card IS the validation (resume with auth absent/slow; read the record).
```

### Posture check (proving)

Uncertainty axis: retires the "resume kick silently doesn't fire and nobody can say why" unknown by making every skip path carry a named, persisted reason. Proof of life: first product-visible signal for a skipped origination.

### Acceptance Criteria

```
✓ debug-cache record test — boot under BRUNCH_DEV writes one origination record per
  launch: {action, origin, reason?, outcome}
✓ skip visibility test — no-model launch surfaces a product-visible "kick skipped:
  no model available" signal (not console)
✓ idle-reason coverage — no_unresolved_debt and explicit_freestyle resumes each
  produce records naming their reason
✓ fired-path silence — a successful kick adds no user-facing noise (record only)
```

### Verification Approach

```
- Inner: unit tests on record shape and sink → cache/status routing
- Middle: tier-2 boot scaffold gains origination-record assertions for the
  new_session / resume-debt / no-debt / no-model matrix
- Outer: manual — resume the workbench session with auth removed; confirm the named
  skip reason appears (the original repro attempt, now observable)
```

### Cross-cutting obligations

```
- BRUNCH_DEV gating (D71-L): full records are dev-surface; the product-visible part
  is the skip/failure signal only
- Introspection observes, never shapes behavior (D69-L posture): records must not
  alter the decision path
```

### Expected touched paths (tentative)

```
src/session/
├── originate-assistant-turn.ts        ~
└── originate-assistant-turn.test.ts   ~
src/app/
├── brunch-tui.ts                      ~
└── brunch-tui.test.ts                 ~
src/dev/tier-2-scaffold.test.ts        ~
src/.pi/extensions/introspection/      ~?  (debug-cache append helper reuse)
```

## Card 3 — kickTurnMessage wording per revised D78-L, locked

### Objective

Rewrite the kick content to match revised D78-L — the assistant opens live from the seeded context and ranked gaps; no "structured exchange offer was just presented" claim — and lock the wording under an oracle per the graduated provider-visible-text lens.

### Light-card cold-start reads

```
- memory/SPEC.md   — D78-L (revised 2026-06-12), D49-L
- memory/PLAN.md    — frontier: origination-follow-ups (a); renderer-golden-coverage
                      agent-tool render anchor (entry-copy surfaces)
- .agents/skills/ln-review SKILL.md §Contract integrity — provider-visible-text lens
  (graduated 2026-06-12): repair = wording oracle + decision traceability
```

### Acceptance Criteria

```
✓ content rewrite — kick message instructs: open in your own words from the seeded
  workspace/spec/graph context, grounded in the ranked gaps; zero reference to a
  presented offer or "the offered question"
✓ wording lock — a co-located assertion (inline golden) locks the content string;
  a comment tags it with D78-L so future revisions sweep it
✓ manual walkthrough — fresh seeded boot produces an assistant opening consistent
  with the new copy (user-observed, per the wording-pass requirement)
```

### Verification Approach

```
- Inner: unit assertion locking the content + origin-variant details
- Outer: manual walkthrough on a seeded workbench (alpha-grounding workbench flow)
```

### Cross-cutting obligations

```
- Entry-copy ledger: renderer-golden-coverage Card 1 will add this surface as a
  ledger row; this card's lock is the wording oracle that row records
```

### Assumption dependency

None — D78-L is revised and locked; this card materializes its copy.

### Expected touched paths (tentative)

```
src/session/
├── originate-assistant-turn.ts        ~
└── originate-assistant-turn.test.ts   ~
```
