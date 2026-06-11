# Honest Origination Closure

Frontier: kick-and-context-seeding
Status:   active
Mode:     chain
Created:  2026-06-11

## Orientation

- Seam: FE-847 origination over real boot/resume; the local helper logic exists, but the live proof still sits in skipped Tier-2 I46/I47 rows.
- Frontier: `kick-and-context-seeding`; `startAssistantTurn` and context-seed helpers landed, yet no real boot/resume oracle proves the product launch surfaces honor that logic end to end.
- Volatile state: `src/session/start-assistant-turn.test.ts` already proves local debt classification, AUTO-vs-`freestyle`, and crash-after-notice behavior; the missing closure is real boot/resume ownership.
- Main risk: the current Tier-2 harness drives a manual faux prompt; closing I46 may require a more faithful launch/resume trigger seam rather than more helper-only unit proof.
- Cross-cutting obligations: no fabricated user turns, seed entries remain Brunch custom continuity entries, debt classification ignores continuity-only entries including side-task/reviewer drains, and this frontier stays sequenced after the reconciliation closure cards that stabilize watermark carriers and compaction behavior.
- Posture: proving (inherited from `kick-and-context-seeding`)

## Card 1 - Prove new-session seed-then-kick through the real boot seam

Status: done (2026-06-11)

### Objective

A real new-session boot seeds context and starts an assistant-originated first turn before the first provider call, without fabricating any user transcript entry.

### Light-card cold-start reads

- `memory/SPEC.md` — D76-L, D78-L, I45-L, I46-L, I47-L
- `memory/PLAN.md` — frontier: `kick-and-context-seeding` (definition + Context §Turn-boundary choreography carry the edge-case list)
- `src/dev/README.md` — Tier-2 harness ownership ledger
- `src/session/README.md` — origination ownership under `start-assistant-turn.ts`

### Acceptance Criteria

✓ A real new-session boot inserts seed continuity entries before the first provider call and then starts an assistant-originated turn with no fabricated user message.

✓ The seed names the current snapshot LSN, so a redundant immediate `worldUpdate` is still suppressed under the real boot path.

✓ The corresponding skipped I46 scaffold row is live after this slice.

### Verification Approach

- Inner: keep local `start-assistant-turn` helper tests for classification logic.
- Middle: flip the new-session seed-then-kick Tier-2 scaffold row live through the real boot harness.

### Cross-cutting obligations

- This is product behavior, not a `BRUNCH_DEV` affordance.
- Keep origination behind assistant/system ownership only; never fake a user opener.

### Assumption dependency

None.

### Expected touched paths (tentative)

```text
src/dev/
├── tier-2-harness.ts ~
└── tier-2-harness.test.ts ~
src/session/
├── start-assistant-turn.ts ?
└── start-assistant-turn.test.ts ?
src/rpc/methods/
└── session.ts ?
src/app/
└── brunch-tui.ts ?
```

## Card 2 - Prove resume-debt classification and idle policy through restart/resume

### Objective

Resume boot classifies the pre-reconcile conversational debt correctly across continuity-only tails and reboot-after-notice cases, and only an explicit `freestyle` pin leaves the assistant idle.

### Light-card cold-start reads

- `memory/SPEC.md` — D66-L, D78-L, I13-L, I46-L, I47-L
- `memory/PLAN.md` — frontier: `kick-and-context-seeding`
- `memory/cards/turn-boundary-reconciliation--continuity-chain.md` — Cards 1 and 3 establish the watermark and compaction preconditions this slice assumes
- `src/session/README.md` — continuity-only taxonomy and origination seam

### Acceptance Criteria

✓ Resume classification ignores trailing continuity-only entries, including seed, `worldUpdate`, `brunch.mention*`, `brunch.session_lifecycle`, side-task drains, and reviewer drains.

✓ Crash-after-notice-before-provider still kicks when the underlying debt is unresolved, while `request_*` / system leaves remain idle.

✓ `request_*` tail classification is proven against the real exchange tool-result envelope — the fixture carries a genuine `request_*` result as the exchanges extension actually writes it (`status: 'answered' | 'cancelled' | 'unavailable'` wherever it really lives in `details`/`data`), not a hand-built message shape; this settles the PR #202 question of whether `responseStatus` in `start-assistant-turn.ts` reads the envelope where real results carry it.

✓ AUTO remains offer-first; only an explicit `freestyle` pin idles the assistant.

✓ The remaining skipped I46/I47 origination rows are live after this slice.

### Verification Approach

- Inner: preserve focused helper tests for debt classification edge cases.
- Middle: real resume/restart fixture assertions through the Tier-2 harness or session-resume seam.

### Cross-cutting obligations

- Do not fork the continuity-only taxonomy; reuse the shared classifier owned under `projections/session/`.
- Keep restart idempotence derived from transcript projection, not hidden runtime flags.

### Assumption dependency

None.

### Expected touched paths (tentative)

```text
src/dev/
├── tier-2-harness.ts ~
└── tier-2-harness.test.ts ~
src/session/
├── start-assistant-turn.ts ?
└── start-assistant-turn.test.ts ?
src/projections/session/
└── continuity-entry-classifier.ts ?
```
