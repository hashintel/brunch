# Origination-native elicitation: retire the canned exchange, enrich the seed, migrate the guidance

Frontier: origination-native-elicitation
Status:   active
Mode:     chain
Created:  2026-06-12

Posture: earned (inherited — design settled by the 2026-06-12 walkthrough + grill; SPEC already revised)

Cards are independent (no inter-card finding dependencies); order is by
demo-risk: retire first (removes the conflicting behavior), enrich second
(completes the no-tool-call opening), guidance third (opening quality).

Shared design facts (settled, not to re-litigate):

- D78-L revised 2026-06-12: seed = workspace + spec + **full graph overview**
  (no truncation; "ultra compact" renderer mode is a *named later refinement*,
  not this frontier) + ranked-gap framing; kick → assistant-authored opening.
- D49-L revised: `session.triggerExchange` is a kick surface; pending
  exchanges exist only when the assistant created one.
- D37-L untouched: `present_*`/`request_*` machinery stays canonical for
  LLM-driven exchanges; provider-legal synthetic pairs remain the rule for
  any probe-land synthetic tuples.
- Origination entries stay `display: false` (hidden from TUI, in LLM context):
  the user sees only assistant thinking + first question.

---

## Card 1 — retire the canned exchange from origination (full card)

Status: next

### Target Behavior

A kicked session's opening transcript contains no product-fabricated
`present_*` exchange: origination seeds and kicks only, the assistant authors
the opening, and the deterministic exchange generator lives in probe/dev land
solely as R24 permutation-evidence machinery.

### Full-card cold-start reads

```
- memory/SPEC.md   — D78-L + D49-L (both revised 2026-06-12), D37-L, I46-L; R24 (§87)
- memory/PLAN.md   — frontier: origination-native-elicitation
- src/session/originate-assistant-turn.ts — the minting call (nextDeterministicStructuredExchange + presentExchangeMessages append)
- src/session/structured-exchange-loop.ts — generator + presentExchangeMessages (relocation candidates)
- src/rpc/methods/session.ts — triggerExchange handler (expects an exchange or fails -32002; contract flips per revised D49-L)
- src/probes/public-rpc-parity-proof.ts — the R24 consumer the relocated generator must keep serving
- src/dev/tier-2-harness.test.ts — origination-kick-live oracle rows asserting presentToolResults length 1 (flip to 0-fabricated)
```

### Boundary Crossings

```
→ originateAssistantTurn (stop minting; decision + seed + kick unchanged)
→ session.triggerExchange RPC (kick surface; pending state only from assistant-created exchanges)
→ probe-land (generator + synthetic pair helpers relocate or re-home for parity evidence)
→ Tier-2 oracle + RPC handlers tests (canned-exchange flows replaced by fixture-driven exchanges)
```

### Risks and Assumptions

```
- RISK: web/demo flows that polled triggerExchange for a canned exchange now get idle/no-exchange
  → MITIGATION: per the demo cut, web is an observer of the TUI session; pendingExchange surfaces
    LLM-created exchanges; name any web breakage to the demo-polish lane rather than re-minting
- RISK: R24 parity probe loses its generator
  → MITIGATION: relocate (not delete) nextDeterministicStructuredExchange + the synthetic pair
    helpers to probe/dev ownership; the probe keeps running; product imports nothing from it
- RISK: kick-debt classification shifts (no present_* tail after kick before assistant reply)
  → MITIGATION: crash-after-kick reboot now has tail brunch.kick (custom_message, not continuity-only)
    → messageRecord undefined → idle; assert explicitly in the reboot row; if product judgment says
    re-kick is wanted there, that is a deliberate follow-up, not this card
- ASSUMPTION: existing exchange projections/RPC handlers work unchanged over LLM-driven exchanges
    → IMPACT IF FALSE: projection gaps surface in the reworked handlers tests; stop and reconcile
    → VALIDATE: fixture-driven exchange tests (synthetic pairs as fixtures) replace canned flows
```

### Posture check (earned)

Closes the architecture conflict; deletes a superseded behavior; locks in the
revised D78-L/D49-L contracts as oracle assertions. Bigger-step license: one
named seam (origination + its RPC surface), closure target named, touched
paths declared.

### Acceptance Criteria

```
✓ originateAssistantTurn appends seed entries only; no present_*/toolCall fabrication anywhere in product origination
✓ deterministic generator + synthetic pair helpers live under probe/dev ownership; public-rpc-parity probe still runs green
✓ session.triggerExchange: kick semantics; returns pending only for assistant-created exchanges; no -32002 on legitimate idle
✓ Tier-2 product-originated oracle reshaped: opening transcript has 0 fabricated present_*; kick fires; payload carries seed content
✓ crash-after-kick reboot behavior asserted explicitly (idle; documented)
✓ RPC handlers exchange tests run over fixture-driven exchanges, not canned minting
✓ I46-L coverage cell + src/session/README.md updated to the new opening shape
```

### Verification Approach

```
- Inner: origination unit tests (seed-only appends; decision unchanged)
- Middle: reshaped Tier-2 oracle; parity probe run; reworked handlers tests
- Outer: walkthrough — user sees thinking + first question only
```

### Expected touched paths (tentative)

```
src/session/
├── originate-assistant-turn.ts      ~
├── originate-assistant-turn.test.ts ~
├── structured-exchange-loop.ts      ~   (generator/pair helpers move out or re-home)
└── README.md                        ~
src/probes/                          ~   (generator home + parity probe import)
src/rpc/methods/session.ts           ~
src/rpc/handlers.test.ts             ~
src/dev/tier-2-harness.test.ts       ~
memory/SPEC.md                       ~   (I46-L coverage cell)
```

---

## Card 2 — content-rich seed: workspace + spec + full graph overview (full card)

Status: next

### Target Behavior

The kick turn's provider payload contains the workspace overview, spec
overview, and the full graph overview (same node/edge render `read_graph`
emits — codes, titles, edges) plus ranked-gap framing, so the model can form
its first question with zero tool calls.

### Full-card cold-start reads

```
- memory/SPEC.md   — D78-L (revised seed payload), D75-L, D76-L, I45-L (seed advances watermark)
- src/session/context-seed.ts — composeContextSeedContent (current: kind composition + top-5 gaps)
- src/.pi/extensions/graph/index.ts formatGraphOverview / src/renderers/graph — the canonical overview render to reuse (one renderer, no duplicate)
- src/renderers/workspace/workspace-context.ts — pull-side workspace render to reuse
```

### Risks and Assumptions

```
- RISK: duplicate render logic between seed and read_graph
  → MITIGATION: one canonical overview renderer; both consume it (note ownership: renderers/)
- RISK: very large graphs make very large seeds
  → ACCEPTED by user decision 2026-06-12: no truncation; conciseness is a later renderer
    refinement ("ultra compact" mode) — record as named deferral, do not implement
- ASSUMPTION: watermark semantics unchanged (seed still names snapshot LSN in details)
    → VALIDATE: existing I45 rows stay green
```

### Posture check (earned)

Materializes the revised D78-L seed payload; canonicalizes the overview
render as a single shared renderer.

### Acceptance Criteria

```
✓ seed content includes: workspace overview (specs/sessions), spec header, full node list with codes/kinds/titles, edge list, ranked-gap framing
✓ render comes from the same canonical renderer read_graph uses (no second dialect)
✓ Tier-2 oracle: kick payload contains node codes (e.g. [G1], [CTX1]) and an edge line — provably tool-call-free context
✓ I45–I47 rows green unchanged
✓ "ultra compact" renderer mode recorded as a named deferral (PLAN frontier note), not built
```

### Verification Approach

```
- Inner: composeContextSeedContent unit tests over seeded fixtures (content includes nodes/edges/workspace lines)
- Middle: Tier-2 payload assertion; outer: walkthrough — first question with no read_graph call
```

### Expected touched paths (tentative)

```
src/session/context-seed.ts            ~
src/session/context-seed.test.ts       ~
src/renderers/ or src/.pi/extensions/graph/  ~?  (renderer canonicalization)
src/app/brunch-tui.ts                  ~?  (workspace overview reads into seed assembly)
src/dev/tier-2-harness.test.ts         ~
```

---

## Card 3 — elicitor guidance: situating ground + live exchange tools (light card)

Status: next

### Objective

The elicitor prompt guidance covers the retired offer's pragmatic ground —
situate the work (new-from-scratch / existing codebase / relates to prior
spec) early when unestablished — and instructs authoring structured offers
via live `present_*`/`request_*` tool calls; prompt goldens regenerate.

### Light-card cold-start reads

```
- memory/SPEC.md  — D78-L (guidance migration sentence), D37-L (exchange tools), D75-L (gap rubrics)
- src/.pi/agents/ + src/.pi/extensions/system-prompts/ — elicitor prompt composition
- src/.pi/agents/previews.test.ts — goldens (npm run test:prompts:update)
```

### Acceptance Criteria

```
✓ elicitor guidance names the situating question family as early elicitation ground (tips, not a script)
✓ guidance instructs using present_*/request_* tools for structured offers (the TUI answer affordance the canned path never had)
✓ goldens regenerated and reviewed; no other prompt surface drifts
```

### Verification Approach

```
- Inner: npm run test:prompts (golden diff review)
- Outer: walkthrough — opening question quality + the model using request_* for answers (tracked, not gated)
```

### Assumption dependency

None — guidance is additive; behavior quality is outer-loop fitness.

### Expected touched paths (tentative)

```
src/.pi/agents/                ~   (elicitor prompt bodies + goldens)
src/.pi/extensions/system-prompts/ ~?
```
