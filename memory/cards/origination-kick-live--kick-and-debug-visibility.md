# Origination kick live: trigger the turn, mirror Brunch entries, label investigation

Frontier: origination-kick-live
Status:   active
Mode:     chain
Created:  2026-06-11

Posture: proving (regression of a claimed-covered seam to a real unknown:
does the product originate a turn on its own bones?)

Discovered 2026-06-11 by manual walkthrough (seeded `alpha-grounding`
workbench, real TUI): fresh session via the spec/session picker → seed entry
lands → **no kick** — pi idles awaiting user input. Root cause located:
`originateAssistantTurn` appends the seed + `present_*` opening exchange but
nothing in product code triggers the LLM turn (`session.prompt`/`triggerTurn`
have zero non-test call sites). Every Tier-2 oracle drives turns via
`harness.session.prompt(...)` — **harness-as-false-proof**. The missing
`.brunch/debug/` folder was downstream (both debug surfaces are
provider-activity-driven; no provider call → nothing written).

Below-the-line work on `ln/fe-852-below-the-line`.

---

## Card 1 — the kick actually starts the opening turn (full card)

Status: done (2026-06-11)

Landed shape: `kickTurnMessage()` in `originate-assistant-turn.ts`; trigger
fired in the runtime factory after `createAgentSessionFromServices`, guarded
on `services.modelRegistry.getAvailable().length > 0` (unauthenticated
launches idle instead of erroring); fire-and-forget because
`sendCustomMessage` + `triggerTurn` awaits the whole turn. Oracle:
`bootTier2ProductOriginatedTurn` (faux backend via the new
`BrunchAgentServicesOverride` seam on `BrunchTuiLaunchContext`) — new-spec +
picker parity + reboot idempotence + no-model-no-kick. Sibling audit: all
harness-prompt sites are content/chassis claims; two test titles overstated
lifecycle and were renamed with ownership comments. **RPC parity decision:**
`session.triggerExchange` keeps its contract — it returns the pending
exchange for the client to render and does not own an LLM turn; transport
clients drive their own turns. Divergence from card: no `session_start`
extension hook needed — the factory IS the shared post-creation seam for
both the real TUI and Tier-2 boots; the offer stays on the `present_*`
toolResult carrier (exchange projection depends on it) with `brunch.kick`
as a separate trigger message.

### Target Behavior

A fresh session launched through the real TUI (including the spec/session
picker path) produces an assistant-originated opening turn — a real provider
call carrying the seeded context — with no user input and no harness
assistance.

### Full-card cold-start reads

```
- memory/SPEC.md   — D78-L (seed-then-kick), I46-L (origination; coverage cell carries the
                     2026-06-11 false-proof honesty note), D66-L (AUTO never freestyle)
- memory/PLAN.md   — frontier: origination-kick-live
- src/session/originate-assistant-turn.ts — decision + appends; returns exchange on 'start'
- src/app/brunch-tui.ts ~L350-392 — seedAndKickAssistantTurn runs in the runtime factory
                     BEFORE createAgentSessionFromServices; the trigger must act on the live
                     AgentSession afterwards
- src/session/README.md §origination seam
- /Users/lunelson/.pi/pi-mono/packages/coding-agent/docs/extensions.md §pi.sendMessage +
  §session lifecycle — deliverAs/triggerTurn semantics; session_start { reason: "new" | "resume" }
  is the hook with the discriminator the origination decision needs
- /Users/lunelson/.pi/pi-mono/packages/coding-agent/examples/extensions/file-trigger.ts —
  the canonical sendMessage + triggerTurn:true pattern (inject custom message, idle agent responds);
  first real call site for the FE-857 out-of-band API rule
- src/rpc/methods/session.ts triggerExchange path — same choreography, different transport;
  decide whether the RPC path also owes a turn trigger or its client contract differs
```

### Boundary Crossings

```
→ runBrunchTui boot / picker decision → runtime factory (origination decision, pre-session)
→ AgentSession creation (createAgentSessionFromServices)
→ post-creation turn trigger (pi.sendMessage triggerTurn, or session-level prompt-less turn start)
→ provider call → passive capture → .brunch/debug/system-prompt.md appears
```

### Risks and Assumptions

```
- RISK: triggering with pi.sendMessage delivers a *second* content-bearing message when the
  present_* exchange is already appended — double-offer in the transcript
  → MITIGATION (preferred shape per the file-trigger.ts pattern): the opening exchange rides the
    triggering sendMessage itself instead of being pre-appended by originateAssistantTurn;
    assert exactly one present_* offer in the transcript
- RISK: the trigger races session startup (extension registration, reconciler first run)
  → MITIGATION: trigger after session_start from the owning extension/launch path; Tier-2
    restart-idempotence rows must stay green (a re-boot over the kicked session must not re-kick)
- ASSUMPTION: pi exposes a usable idle-turn trigger at the Brunch launch seam (sendMessage
  with triggerTurn:true on the live session)
    → IMPACT IF FALSE: needs a pi-side change or AgentSession.prompt with an empty/system
      carrier — stop and reconcile carrier choice against I46-L (no fabricated user entry)
    → VALIDATE: first red test = product-originated-turn oracle below
```

### Posture check (proving)

Proof of life: the first product-triggered LLM turn — the seam every demo
beat depends on. Uncertainty: retires "does origination compose with pi's
turn lifecycle at the real launch path" (the question the false-proof oracle
skipped). Invariants: locks the origination seam's completion test to a
product-driven provider call.

### Acceptance Criteria

```
✓ product-originated-turn oracle — Tier-2 boots the real TUI path over a seeded workspace and
  observes a provider call WITHOUT the harness ever calling session.prompt; the captured payload
  contains the seeded overview + gap framing (the honest version of the FE-857 claim)
✓ picker-path parity — the oracle covers the workspace-dialog decision path (continue spec →
  new session), not only direct boot
✓ exactly one present_* opening offer in the transcript; no fabricated user entry (I46-L)
✓ re-boot over the kicked session does not re-kick (existing I46/I47 idempotence rows green)
✓ resumed session at a request_*/system leaf still stays idle (no trigger fired)
✓ SPEC I46-L coverage cell updated: false-proof note replaced by the product-originated oracle
✓ bounded sibling audit — enumerate Tier-2 assertions that depend on harness-driven prompt();
  reclassify each as "content claim (fine)" or "lifecycle claim (false-proof)"; file findings
  in the card or PLAN, fix only this seam
```

### Verification Approach

```
- Inner: origination decision tests unchanged; trigger-choreography unit test (start → one trigger; idle → none)
- Middle: the product-originated-turn Tier-2 oracle (primary); full I45–I47 suite
- Outer: repeat the manual walkthrough — seeded workbench, fresh session, opening offer appears unprompted; .brunch/debug/system-prompt.md materializes
```

### Cross-cutting obligations

- I46-L: no fabricated user entry; AUTO never freestyle.
- D77-L: the reconciler remains the only continuity writer; the trigger writes no continuity.
- API rule (FE-857): reconciler seam → appendCustomMessageEntry; out-of-band → pi.sendMessage.

### Expected touched paths (tentative)

```
src/app/brunch-tui.ts                  ~   (trigger after session creation)
src/session/originate-assistant-turn.ts ~  (decision/result shape if the trigger needs it)
src/session/originate-assistant-turn.test.ts ~
src/rpc/methods/session.ts             ~?  (triggerExchange parity decision)
src/dev/tier-2-harness.ts              ~   (product-originated-turn boot mode — no harness prompt)
src/dev/tier-2-harness.test.ts         ~
memory/SPEC.md                         ~   (I46-L coverage cell honesty)
```

---

## Card 2 — `.brunch/debug/entry-contents.md`: Brunch entries visible without a provider call

Status: next

### Objective

Brunch-originated transcript entries (`brunch.*` custom + custom-message,
`worldUpdate`) are mirrored to `.brunch/debug/entry-contents.md` at the
append seam under `BRUNCH_DEV`, so seeded context and continuity notices are
observable even when no provider turn ever runs — the gap that masked card
1's defect.

### Light-card cold-start reads

```
- memory/SPEC.md  — D39-L (dev-gated, read-only), I47-L (carrier discipline — mirror, never carrier)
- src/.pi/extensions/introspection/debug-cache.ts — existing two surfaces + append helper
- src/session/prepare-next-turn.ts — appendPreparedContinuityEntry (the Brunch append choke point);
  note originate-assistant-turn and direct appendCustomEntry sites (runtime-state, binding, mention)
  and decide the hook seam: Brunch appender wrapper vs pi entry event in the introspection extension
```

### Acceptance Criteria

```
✓ with BRUNCH_DEV, appending a Brunch entry writes/appends a block to .brunch/debug/entry-contents.md
  (customType, carrier kind, rendered content or compact data projection, timestamp)
✓ works with zero provider calls — a seeded-but-unkicked session still produces the mirror
  (regression test named for today's defect)
✓ without BRUNCH_DEV: no writes, no debug dir creation
✓ mirror is observability only — no behavior, projection, or carrier change
```

### Verification Approach

```
- Inner: debug-cache unit tests (gated/ungated, both carrier kinds, append format)
- Middle: Tier-2 boot over seeded workspace asserts entry-contents.md exists before any turn
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/extensions/introspection/
├── debug-cache.ts        ~
├── index.ts              ~?  (if hooked via pi events rather than the Brunch appender)
└── README.md             ~
src/session/prepare-next-turn.ts ~?  (if hooked at the appender seam)
src/dev/tier-2-harness.test.ts   ~
```

---

## Card 3 — `setLabel` investigation: label Brunch entries for transcript legibility

Status: next (optional — timebox; drop without ceremony if value is thin)

### Objective

Decide whether labeling Brunch continuity entries via pi's recent
`ctx.setLabel(entryId, label)` (`LabelEntry`, resolved in `getTree()`)
makes seeds/worldUpdates legible in pi's transcript navigation cheaply —
and if yes, label the migrated message-carrier set ("context seed",
"world update", "side task", "reviewer"); if no, record why in the PLAN
frontier note and stop.

### Light-card cold-start reads

```
- node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts — setLabel, LabelEntry, getTree label resolution
- node_modules/@earendil-works/pi-coding-agent/docs/extensions.md — label/navigation surface (check what the TUI shows)
- src/session/prepare-next-turn.ts — the entry types to label (message-carrier set only)
```

### Acceptance Criteria

```
✓ a written decision (in this card or PLAN note): label / don't label, with the observed TUI behavior named
✓ if labeling: appended Brunch message-carrier entries get stable labels; projections/tests unaffected
  (LabelEntry is additive — assert classifier ignores type 'label')
✓ if not labeling: one-paragraph rationale recorded; no code change
```

### Verification Approach

```
- Inner: if built — label-append unit test + classifier-ignores-label test
- Outer: eyeball pi transcript navigation with labels present
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/session/prepare-next-turn.ts            ~?
src/projections/session/continuity-entry-classifier.ts ~?  (ignore-label assertion only)
```
