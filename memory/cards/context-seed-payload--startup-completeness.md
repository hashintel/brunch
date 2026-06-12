# Context seed payload: continuity carrier migration + startup completeness

Frontier: context-seed-payload (FE-857)
Status:   active
Mode:     chain
Created:  2026-06-11

Posture: earned (inherited from `context-seed-payload`)

Demo block 2 of the lower line, shared branch `ln/fe-852-below-the-line`.

Widened 2026-06-11 (user decision): pi's `appendCustomEntry` is ledger-only —
the model never sees those entries. Every continuity entry whose *intention*
is model-visible migrates to the message-entry carrier in one pass (card 1),
then the seed gains its real payload and the startup proof lands (card 2).
Card 2's design does not depend on card 1's findings — the carrier decision
is settled here; card 1 is mechanical migration.

## Carrier intention table (closed list — the migration boundary)

| customType | Intention | Carrier after card 1 |
| --- | --- | --- |
| `brunch.context_seed` | model-visible context | **message entry** |
| `worldUpdate` | model-visible staleness notice (D77-L) | **message entry** |
| `brunch.side_task_result` / `brunch.reviewer_drain` | model-visible drain results (D15-L) | **message entry** |
| `brunch.mention_staleness_hint` | model-visible re-read hint (D14-L) — row added during build; it is literally a hint *to the assistant* | **message entry** |
| `brunch.own_mutation` | watermark stamp (already visible via own toolResult) | ledger — stays |
| `brunch.mention` | D14-L per-entity read-ledger fact | ledger — stays |
| `brunch.agent_runtime_state`, session binding, lifecycle | state tracking / continuity-only non-debt | ledger — stays |

API selection rule (record for future writers): at the reconciler/guard seam
Brunch holds the raw `SessionManager` and needs deterministic pre-prompt
placement → `appendCustomMessageEntry`. `pi.sendMessage` is for out-of-band
injection with delivery semantics (steer/followUp/nextTurn) — no current
Brunch write site; use it when one appears (e.g. async mid-turn delivery).

---

## Card 1 — continuity carrier migration (full card)

Status: done (2026-06-11) — all acceptance rows met; one row added to the
migration set (`brunch.mention_staleness_hint`, justified above). Payoff
proof landed via pi's `buildSessionContext` (the provider path's own context
builder) rather than a full faux turn — same oracle strength, cheaper. No
tracked fixtures carried old-shape continuity entries; none regenerated.

### Target Behavior

Every continuity entry whose intention is model-visible (`worldUpdate`,
side-task/reviewer drains, `brunch.context_seed`) persists as a
`CustomMessageEntry` (provider-visible content + structured `details`),
while the ledger-only set is untouched — with all existing watermark,
dedupe, kick-decision, and compaction proofs still green.

### Full-card cold-start reads

```
- memory/SPEC.md   — D15-L (drains), D43-L (projection), D76-L (carriers), D77-L (reconciler/guard), I45-L–I47-L
- memory/PLAN.md   — frontier: context-seed-payload (widened scope note)
- src/session/prepare-next-turn.ts — PreparedContinuityEntry + the three migrating writers
- src/.pi/brunch-pi-extensions.ts — append sites (~L231, L246); src/app/brunch-tui.ts ~L401; src/rpc/methods/session.ts ~L536; src/dev/tier-2-harness.ts ~L177 (all append through the same prepared-entry shape)
- src/projections/session/continuity-entry-classifier.ts — classification must read both old ledger entries (existing transcripts) and new message entries
- node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts — appendCustomMessageEntry signature
```

### Boundary Crossings

```
→ prepareNextTurn / startAssistantTurn (PreparedContinuityEntry gains content + carrier kind)
→ append sites (brunch-pi-extensions, brunch-tui, rpc session, tier-2 harness)
→ sessionManager.appendCustomMessageEntry / appendCustomEntry (per intention table)
→ projections (classifier, watermark, kick-debt) read both entry shapes
```

### Risks and Assumptions

```
- RISK: projections break on the message-entry shape (data lives in `details`, content alongside)
  → MITIGATION: classifier/projection read customType + details with a shape-tolerant accessor;
    every existing I45–I47 Tier-2 row must stay green with at most mechanical accessor updates
- RISK: pre-release transcripts with old-shape entries (fixtures, workbenches)
  → MITIGATION: pre-release posture — regenerate fixtures rather than dual-shape compatibility;
    keep the read accessor tolerant only where a tracked fixture would otherwise need hand-editing
- RISK: message entries alter kick-debt classification (continuity-only entries must stay non-debt)
  → MITIGATION: explicit I46 assertion — migrated entries remain continuity-only non-debt
- ASSUMPTION: rendered content for worldUpdate/drains can be produced from existing data payloads
    → IMPACT IF FALSE: a renderer gap — small text renderers added in this card, not deferred
    → VALIDATE: first red test renders each migrating entry type from a fixture payload
```

### Posture check (earned)

- **Closes:** the intention/carrier mismatch — continuity notices that existed to
  inform the assistant but were never provider-visible.
- **Canonicalizes:** the API selection rule (reconciler seam → `appendCustomMessageEntry`;
  out-of-band → `pi.sendMessage`).
- **Locks in:** the carrier intention table above as the completion test.

### Acceptance Criteria

```
✓ worldUpdate, side_task_result, reviewer_drain, context_seed persist as CustomMessageEntry
  (content provider-visible; structured data in details; customType unchanged)
✓ ledger-only set (own_mutation, mention, runtime_state, binding, lifecycle) unchanged
✓ a Tier-2 assertion proves a worldUpdate's text appears in the captured provider payload of
  the following turn (the notice is finally *seen*)
✓ all existing I45–I47 rows green (watermark advance, dedupe, kick idempotence, compaction
  anchor) with at most mechanical shape-accessor updates
✓ migrated entries remain continuity-only non-debt for the kick decision (I46)
✓ fixtures/seeds regenerated where they carried old-shape continuity entries
```

### Verification Approach

```
- Inner: per-type render + carrier unit tests; classifier shape tests
- Middle: Tier-2 — worldUpdate-visible-to-provider assertion; full existing I45–I47 suite
- Outer: none (mechanical migration)
```

### Cross-cutting obligations

- I47-L: still custom transcript entries; D43-L projection reconstructs everything.
- D77-L: writer seam unchanged — reconciler + guard remain the only continuity writers.
- Do not migrate ledger-only entries "for symmetry" (closed list above).

### Expected touched paths (tentative)

```
src/session/
├── prepare-next-turn.ts           ~   (entry preparation: content + carrier kind)
├── prepare-next-turn.test.ts      ~
├── start-assistant-turn.ts        ~   (seed entry carrier kind; payload still LSN-only in card 1)
└── start-assistant-turn.test.ts   ~
src/projections/session/
├── continuity-entry-classifier.ts ~
└── *.test.ts                      ~
src/.pi/brunch-pi-extensions.ts    ~
src/app/brunch-tui.ts              ~
src/rpc/methods/session.ts         ~
src/dev/tier-2-harness.ts          ~
src/dev/tier-2-harness.test.ts     ~
```

---

## Card 2 — seed entry carries real content; startup proven end-to-end (full card)

Status: next

### Target Behavior

A brand-new session in a seeded workspace boots with a `brunch.context_seed`
transcript entry whose provider-visible content is the spec graph overview
plus elicitation grounding-floor framing, then kicks, and the opening
assistant turn's captured provider payload contains that seeded context.

### Full-card cold-start reads

```
- memory/SPEC.md   — D43-L (transcript projection), D75-L (grounding floor), D76-L (watermark carriers),
                     D78-L (seed-then-kick; the content half this card fills), I45-L–I47-L
- memory/PLAN.md   — frontier: context-seed-payload (acceptance + cross-cutting obligations)
- src/session/start-assistant-turn.ts — contextSeedEntries (current LSN-only payload, L46-60)
- src/.pi/brunch-pi-extensions.ts — appendCustomEntry call sites (~L231, L246: reconciler step + provider guard)
- src/projections/session/continuity-entry-classifier.ts — context_seed classification
- node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts
                   — CustomEntry (ledger-only) vs CustomMessageEntry/appendCustomMessageEntry
                     (content enters LLM context); the seed must move to the message-entry carrier
- src/graph/elicitation-driver.ts — canonical ranking for the grounding-floor framing
```

### Boundary Crossings

```
→ session boot (workspace-session-coordinator / runBrunchTui)
→ prepareNextTurn / startAssistantTurn (seed decision + payload assembly)
→ sessionManager.appendCustomMessageEntry (provider-visible transcript carrier)
→ provider payload (captured by Tier-2 harness) + watermark projection (unchanged semantics)
```

### Carrier note

The carrier migration is card 1's work; this card assumes the seed already
rides `appendCustomMessageEntry` and only fills the content: overview + gap
framing as the provider-visible text, `details` carrying the structured
`{specId, snapshotLsn}` payload.

### Risks and Assumptions

```
- RISK: payload bloats the opening context (large graphs)
  → MITIGATION: overview is compositional (counts by kind/band + spec header), not a node dump;
    grounding-floor framing is the top-ranked open gaps (small k), not the full register
- ASSUMPTION: existing projections/queries (queryGraph overview, getElicitationGaps + canonical
  ranking) suffice to assemble the payload — no new read surface
    → IMPACT IF FALSE: card grows a query/projection change; stop and reconcile (D20-L/D52-L)
    → VALIDATE: first red test assembles the payload from existing reads only
```

### Posture check (earned)

- **Closes:** the D78-L claimed-vs-shipped gap (decision text promises a seeded
  overview; implementation ships a watermark stamp).
- **Materializes:** the (a)+(d) payload decision from the 2026-06-11 grill into
  the seed assembly + render.
- **Locks in:** the seed's provider-visible carrier (custom *message* entry,
  same customType) as the completion test — proven by the Tier-2
  startup-completeness assertion.

### Acceptance Criteria

```
✓ payload assembly — seed content = spec overview (composition by kind/band from queryGraph)
  + grounding-floor framing (top-ranked open gaps via sortElicitationGapsForAsking); assembled
  from existing reads only
✓ watermark semantics unchanged — seed still advances the watermark; no redundant worldUpdate
  after a seed naming the current snapshot LSN; dedupe/idempotence across reboot (existing
  I45–I47 Tier-2 rows green)
✓ startup-completeness proof (the frontier's payoff) — Tier-2 real boot over a seeded fixture
  workspace: boot → seed entry contains overview + gap framing → kick fires → captured opening
  provider payload contains the seeded content
✓ opening offer grounding — the same proof asserts the top-ranked gap's question appears in the
  provider-visible context the opening turn ran against
✓ no new mutation path; no prompt-manifest injection; D39-L sealed profile untouched
```

### Verification Approach

```
- Inner: payload assembly/render unit tests over seeded in-memory fixtures (composition counts,
  gap framing order, empty-spec case renders honestly)
- Middle: Tier-2 bootTier2RuntimeThroughRunBrunchTui startup-completeness assertion (seed content
  + kick + gap framing in captured provider context); existing I45–I47 rows stay green
- Outer: manual BRUNCH_DEV walkthrough of opening-offer quality against a seeded workbench
  (tracked, not gated)
```

### Cross-cutting obligations

- I47-L carrier discipline: transcript entries only; D43-L projection reconstructs the seed.
- D76-L watermark carriers: seed remains a watermark-advancing carrier.
- D20-L/D52-L: reads through existing query/projection surfaces.
- Adjacent work named, not done: workspace-overview/cwd-inventory payload additions;
  any future out-of-band injection surface (`pi.sendMessage`).

### Expected touched paths (tentative)

```
src/session/
├── start-assistant-turn.ts        ~   (seed payload assembly or delegation)
├── start-assistant-turn.test.ts   ~
├── context-seed.ts                +?  (payload assembly module, if assembly outgrows the decision fn)
└── prepare-next-turn.ts           ~?
src/projections/session/
└── continuity-entry-classifier.ts ~?  (message-entry shape)
src/.pi/brunch-pi-extensions.ts    ~   (appendCustomMessageEntry for the seed path)
src/dev/tier-2-harness.test.ts     ~   (startup-completeness proof)
src/renderers/workspace/ or graph/ ~?  (render reuse for overview text)
```

### Traceability

Landing this makes D78-L true as written — SPEC reconciliation should confirm
the decision text (no rewrite expected) and may add a one-line status note.
If the carrier change forces a projection-contract change beyond mechanical
shape-reading, stop and reconcile against D43-L/D76-L before continuing.
