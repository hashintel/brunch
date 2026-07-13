# Headless ask discovery: live registry + public RPC read method

Frontier: headless-ask-discovery
Status:   active
Mode:     single
Created:  2026-07-13

Full scope card — structural (new public RPC seam + interaction-state model; A39-L validation vehicle).

Posture: proving (inherited from headless-ask-discovery). A39-L (medium, open) is the
uncertainty this slice retires: RPC discovery of open asks can replace transcript
pending-present scanning **without a second event plane**.

## Target Behavior

A headless RPC client can discover every currently-open `ask` (full question payload, mode, options, exchangeId) through a deterministic read method backed by Brunch-owned live interaction state — no transcript parsing — and answer any mode of ask through the existing broker.

## Chosen mechanism (card-level design decision, evidence-based)

Pi `0.80.6` exposes **no** pending-interactive-call primitive (no event type, no
`AgentSession` accessor — verified against `dist/*.d.ts`). Discovery is therefore
Brunch-owned: a **live ask registry** — the broker's `pending` map generalized into
observable state carrying the ask payload — read by a new public RPC method. The
"streamed session events" alternative from the PLAN bullet is rejected as the primary
mechanism (it would derive state from event parsing — a second event plane in spirit);
the existing `brunch.sessionEvent` relay MAY additionally announce registry transitions
if free, but no acceptance leaf depends on it. If build reveals discovery cannot work
without a new event plane, STOP — that falsifies A39-L; route to `ln-spec`.

## Full-card cold-start reads

```
- memory/SPEC.md   — D116-L (ask terminal, declared continuations, "pending exchange is
                     not a primitive", the projection this replaces), A39-L (the bet),
                     D37-L (details carry semantics)
- memory/PLAN.md   — frontier: headless-ask-discovery (Group 2 bullet); ALSO the
                     legacy-question-read-path-retirement definition (its "Keeps: the
                     pending-exchange scan… until headless-ask-discovery" line — this
                     slice discharges that caveat; update it at reconciliation)
- src/rpc/TOPOLOGY.md — method registry, surface gating, the two structurally-distinct
                     answer paths (broker vs submitExchangeResponse)
- src/session/TOPOLOGY.md — broker ownership (§broker, ~62–87), incl. the "broker holds
                     only free-text asks" caveat this slice removes
- src/.pi/extensions/exchanges/TOPOLOGY.md — the A39-L migration note (line ~47,
                     "unavailable until A39-L") this slice retires
```

## Boundary Crossings

```
→ ask tool open (src/.pi/extensions/exchanges/ask.ts — ALL modes, headless + interactive)
→ live ask registry (src/session/ — broker seam generalized: exchangeId + payload + state)
→ new public RPC read method (src/rpc/methods/session.ts registry entry)
→ answer leg: existing broker awaitAnswer/submitAnswer via session.answerExchange (unchanged)
→ session.pendingExchange projection re-derived from the registry (transcript scan retired)
```

## Risks and Assumptions

```
- RISK: broadening broker registration to choice/choices/review asks changes what
  `session.answerExchange` accepts (option answers, not just free text) → MITIGATION:
  the awaitAnswer/submitAnswer CONTRACT stays as-is (exchangeId → answer string/value);
  mode validation lives in the ask tool's collection path, mirroring how the TUI
  validates. If the contract itself must widen structurally, stop and reassess against
  "broker unchanged by design" (PLAN bullet) before proceeding.
- RISK: session.pendingExchange consumers (web-driver convergence tests, probes,
  brunch.test.ts) depend on scan-derived shape quirks, incl. the offer-with-declared-
  continuation pending case → MITIGATION: preserve the product-shaped response
  (D116-L allows retiring the scan while keeping the projection shape); register
  declared continuations in the registry at present-time so the offer-pending case is
  live-state-derived too. Named suites below must stay green.
- RISK: in-memory registry vs session resume — open asks do not survive a restart →
  MITIGATION: that IS the intended semantics; the state model makes it explicit
  (post-resume reads of a pre-restart exchangeId → closed/stale, never a hang).
- ASSUMPTION: A39-L — registry + read method suffices; no second event plane needed.
    → IMPACT IF FALSE: the discovery seam needs an event-plane design — a SPEC-level
      change affecting the agent-as-user campaign horizon.
    → VALIDATE: this slice IS the validation; the stop-the-line above enforces it.
    → memory/SPEC.md §Assumptions A39-L
```

## Posture check (proving)

Scores on all three axes: **proof of life** — first headless discover→answer round trip
for every ask mode; **invariants** — locates the live-interaction registry as the single
runtime source of open-ask truth (replacing transcript inference); **uncertainty** —
retires A39-L. Build it.

## Acceptance Criteria

```
✓ interaction-state model — new registry unit suite (src/session/, co-located): open →
  answered | cancelled | unavailable/closed transitions; a stale/unknown exchangeId is
  distinguishable from a live one; double-answer is idempotent (second submit reports
  no_pending, no duplicate durable effect)
✓ all ask modes registered — ask tool tests (src/.pi/extensions/__tests__/): free-text
  AND single-select/multi-select/review asks appear in the registry while open, and are
  answerable headlessly via the broker (today's `unavailable` fallback becomes
  broker-await for every mode); interactive TUI collection paths unchanged
✓ public RPC read method — src/rpc/__tests__/handlers.test.ts: new session-scoped read
  method (e.g. session.openAsks) in the method registry with params/result schemas,
  listed by rpc.discover, returning exchangeId + full D116-L question payload; correct
  surface gating per src/rpc/TOPOLOGY.md
✓ discover/answer/cancel/resume contract — deterministic middle-loop RPC test driving a
  real session: open ask → discovered → answered via session.answerExchange → discovery
  shows closed; cancelled ask (D116-L cancellation) clears; post-resume discovery is
  empty and the old exchangeId reads stale/closed
✓ transcript scan retired — session.pendingExchange derives from the registry; the
  pending-exchange path no longer imports/executes the transcript-entry scan in
  exchange-projection.ts (named check: no scan-function import remains on that path);
  response shape preserved for existing consumers
✓ consumers stay green — named suites: src/session/__tests__/structured-exchange-loop
  .test.ts, src/rpc/__tests__/handlers.test.ts, src/dev/__tests__/web-driver-streaming
  .exchange-convergence.test.ts, src/app/__tests__/brunch.test.ts, and probe
  src/probes/public-rpc-parity-proof.ts
```

## Invariants preserved

```
- Broker awaitAnswer/submitAnswer contract unchanged (PLAN: "broker unchanged by
  design") — guarded by: src/rpc/methods session-exchange-answer tests + broker suite
- session.submitExchangeResponse stays the structurally-distinct transcript-mutation
  path, never touching the broker (src/rpc/TOPOLOGY.md:24) — guarded by: existing
  handlers tests; STOP-THE-LINE if the two paths start converging
- D116-L one-shot terminal semantics: one durable toolResult carrying question+answer;
  declared continuations invoked by reference — guarded by: exchanges-present-request
  suite staying green
- Interactive TUI ask experience unchanged (rounded-box surface, cancellation hint) —
  guarded by: existing .pi/extensions exchange/component suites
```

## Verification Approach

```
- Inner: registry state-model unit tests + ask-mode registration tests + npm run fix
- Middle: the deterministic public-RPC contract test (the PLAN-named oracle): real
  session, real RPC dispatch, discover/answer/cancel/resume + stale/closed distinction
  + idempotent durable effects, no transcript parsing anywhere on the path
- Outer: no user-facing surface of its own (headless programmatic seam); the qualitative
  consumer is the agent-as-user campaign, explicitly out of scope and owned by Later
  `consequential-fact-discovery-tracer` + A39-L gating (PLAN: "do not plan past that
  horizon")
```

## Cross-cutting obligations

```
- Do NOT build agent-as-user driver scaffolding — this slice ends at the RPC contract
- Retire the A39-L "unavailable until" migration note in
  src/.pi/extensions/exchanges/TOPOLOGY.md:47 and update src/session/TOPOLOGY.md's
  broker caveat (free-text-only) — both become stale when this lands
- Update legacy-question-read-path-retirement's "Keeps: pending-exchange scan" line in
  memory/PLAN.md at reconciliation (the caveat discharges; the legacy request_* read
  retirement itself stays that frontier's work — do not absorb it)
- Reconciliation at close: A39-L → validated (or falsified → ln-spec); consider whether
  the registry seam warrants its own thin SPEC decision row naming the mechanism
```

## Expected touched paths (tentative)

```
src/session/
├── live-exchange-broker.ts               ~  (or wrapped by the registry)
├── live-ask-registry.ts (+ test)         +? (new module if broker shouldn't widen in place)
├── structured-exchange-loop/pending-exchange.ts ~
├── exchange-projection.ts                ~? (scan demoted to legacy-read-only or removed
│                                             from the pending path)
├── __tests__/                            ~+
└── TOPOLOGY.md                           ~
src/.pi/extensions/exchanges/
├── ask.ts                                ~  (all modes register + headless broker await)
└── TOPOLOGY.md                           ~  (retire A39-L note)
src/rpc/
├── methods/session.ts                    ~  (pendingExchange swap; + new read method)
├── __tests__/handlers.test.ts            ~
└── TOPOLOGY.md                           ~
src/probes/public-rpc-parity-proof.ts     ~?
memory/SPEC.md                            ~  (A39-L outcome; possible thin mechanism row)
memory/PLAN.md                            ~  (frontier status; retirement-frontier Keeps line)
```
