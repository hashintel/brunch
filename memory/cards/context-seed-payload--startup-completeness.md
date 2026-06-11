# Context seed payload: startup completeness

Frontier: context-seed-payload (FE-857)
Status:   active
Mode:     single
Created:  2026-06-11

Posture: earned (inherited from `context-seed-payload`)

Demo block 2 of the lower line, shared branch `ln/fe-852-below-the-line`.

## Card — seed entry carries real content; startup proven end-to-end (full card)

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

### Carrier note (the card's one design commitment)

The seed upgrades from `appendCustomEntry` to `appendCustomMessageEntry`
(content + `details` carrying `{specId, snapshotLsn}`-equivalent data). This
**is** the I47-L-compliant shape: still a Brunch custom transcript entry the
D43-L projection reconstructs — not prompt-only injection. Other continuity
entries (`worldUpdate`, mentions, lifecycle) stay on the ledger-only carrier;
their provider visibility is named adjacent work, **not** this card.

### Risks and Assumptions

```
- RISK: changing the seed's entry shape breaks the watermark projection / dedupe
  (classifier and projection key on customType + data)
  → MITIGATION: keep customType 'brunch.context_seed'; classifier/projection updated to read
    the message-entry shape; all existing I45–I47 Tier-2 rows must stay green unmodified in intent
    (mechanical assertion updates only if entry-shape reads change)
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
✓ carrier — seed lands as a custom message entry, customType 'brunch.context_seed', content
  provider-visible, data/details still carrying the snapshot LSN for the watermark projection
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
- Adjacent work named, not done: provider visibility for `worldUpdate`/other
  continuity notices; workspace-overview/cwd-inventory payload additions.

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
