# Exchange lexicon cleanup

Frontier: live-graph-observer | n/a
Status:   active
Mode:     chain
Created:  2026-06-03

## Orientation

- Containing seam: `session/` owns transcript-derived exchange projections and structured-exchange loop helpers; `rpc/` exposes them through `session.*` product methods; docs/memory own the canonical lexicon.
- Frontier item: `live-graph-observer` (FE-795). This is branch-local lexicon hardening after the RPC/session split and before tying off the observer frontier.
- Volatile handoff/build state: the builder extracted `src/session/structured-exchange-loop.ts`, but active code/docs still teach the retired phrase `elicitation exchange` in places where the canonical term should be `structured exchange` or simply `exchange`.
- Main open risk: doing a mechanical global replace that blurs two concepts. Use **structured exchange** for typed transcript tuples / pending exchange payloads; use **exchange** or **session exchange** for the generic prompt-response span projection used by capture and history.
- Cross-cutting obligations: preserve D12-L/D13-L/D37-L transcript truth, D19-L/D49-L session RPC vocabulary, D52-L topology README accuracy, and the rule that archived history may remain historical.

## Naming map for this chain

```pseudo
canonical terms:
  structured exchange
    = typed present_* / request_* / future capture_* toolResult tuple
    = pending structured UI surface exposed by session.pendingExchange

  exchange / session exchange
    = generic transcript-derived prompt-side + response-side span
    = capture/audit unit keyed by prompt/response entry ranges

retire from active code/docs:
  elicitation exchange
  ElicitationExchange*
  *ElicitationExchange*
  PendingElicitationExchange*
```

Suggested code target names:

```pseudo
src/session/elicitation-exchange.ts          -> src/session/exchange-projection.ts
ElicitationExchange                          -> SessionExchange
ElicitationExchangeProjection                -> SessionExchangeProjection
projectElicitationExchanges                  -> projectSessionExchanges
projectLinearElicitationExchangeProjection   -> projectLinearSessionExchangeProjection
loadLinearElicitationExchangeProjection      -> loadLinearSessionExchangeProjection
PendingElicitationExchange                   -> PendingStructuredExchange
PendingElicitationExchangeSchema             -> PendingStructuredExchangeSchema
nextDeterministicElicitationExchange         -> nextDeterministicStructuredExchange
projectPendingElicitationExchange            -> projectPendingStructuredExchange
```

If a builder finds a stronger name during implementation, keep the two-concept split above and update the card in-place before widening the rename.

## Card 1 — done — Rename active session exchange symbols

### Target Behavior

Active source code and tests no longer use `elicitation exchange` names for session exchange projections or pending structured exchanges.

### Boundary Crossings

```pseudo
→ session transcript entries / Brunch session envelope
→ session/exchange projection helpers
→ session/structured-exchange-loop helpers
→ rpc/methods/session.ts adapter
→ session.* JSON-RPC responses and tests
```

### Risks and Assumptions

- RISK: the rename hides a behavioral change in transcript projection.
  → MITIGATION: keep assertions behavior-identical; only rename symbols/files/descriptions unless a test exposes genuine drift.
- RISK: `structured exchange` gets used for the generic capture span and erases the distinction between typed tuples and prompt-response ranges.
  → MITIGATION: apply the naming map above: `structured exchange` for typed present/request payloads; `exchange` / `session exchange` for generic spans.
- RISK: imports from the old file path linger because TypeScript paths still resolve in built artifacts.
  → MITIGATION: grep active `src/` after the rename; delete the old file, do not re-export aliases.
- ASSUMPTION: no external public API imports `src/session/elicitation-exchange.ts` directly.
    → IMPACT IF FALSE: a compatibility alias would be tempting, but Brunch is pre-release/free-rewrite; update call sites instead.
    → VALIDATE: repo-wide `rg` for old path/symbol names after tests pass.

### Tracer-bullet check

- Invariants: preserves D13-L capture projection behavior while making the source topology and lexicon teach the same concepts as D37-L/D49-L.
- Test surface: existing session and RPC tests remain the behavior oracle; the diff should be mostly rename plus import/description updates.

### Acceptance Criteria

✓ File rename — `src/session/elicitation-exchange.ts` and its test are renamed to an exchange/session-exchange projection name, with no compatibility re-export file left behind.
✓ Symbol rename — active exported types/functions no longer contain `ElicitationExchange` or `Elicitation` when they mean exchange projection.
✓ Structured pending rename — `PendingElicitationExchange*`, `nextDeterministicElicitationExchange`, and `projectPendingElicitationExchange` become `PendingStructuredExchange*`, `nextDeterministicStructuredExchange`, and `projectPendingStructuredExchange` or equivalent.
✓ RPC text — `src/rpc/methods/session.ts` descriptions/errors/tests say `exchange`, `pending exchange`, or `structured exchange`, not `elicitation exchange`.
✓ No active source drift — `rg "elicitation[- ]exchange|ElicitationExchange|PendingElicitationExchange" src` returns no matches.

### Verification Approach

- Inner: `npm test -- src/session/exchange-projection.test.ts src/session/structured-exchange-loop.test.ts src/rpc/handlers.test.ts src/rpc/web-host.test.ts` — proves renamed helpers and public RPC behavior.
- Inner: `rg "elicitation[- ]exchange|ElicitationExchange|PendingElicitationExchange" src` — proves active source lexicon cleanup.
- Inner: `npm run fix` on touched files.

### Cross-cutting obligations

- Do not rename public RPC methods: `session.exchanges`, `session.pendingExchange`, and `session.submitExchangeResponse` are canonical.
- Do not add aliases for old internal names.
- Keep transcript-display debug projection retired from product RPC.

### Expected touched paths (tentative)

```pseudo
src/rpc/
├── handlers.test.ts                  ~
└── methods/
    └── session.ts                    ~
src/session/
├── README.md                         ~
├── elicitation-exchange.ts           -
├── elicitation-exchange.test.ts      -
├── exchange-projection.ts            +
├── exchange-projection.test.ts       +
├── structured-exchange-loop.ts       ~
├── structured-exchange-loop.test.ts  ~
└── workspace-session-coordinator.test.ts ~
src/README.md                         ~
```

## Card 2 — next — Reconcile active docs to exchange vocabulary

### Target Behavior

Active canonical docs use `structured exchange` or `exchange` according to the naming map, and no active documentation teaches `elicitation exchange` as a current concept.

### Boundary Crossings

```pseudo
→ memory/SPEC.md lexicon / decisions / invariants
→ docs/architecture active evidence memos
→ src/**/README.md topology docs
→ source names from Card 1
```

### Risks and Assumptions

- RISK: existing dirty canonical-doc edits are accidentally overwritten.
  → MITIGATION: start with `git status --short`; preserve the current uncommitted sync edits in `memory/SPEC.md`, `memory/PLAN.md`, and active docs while editing only lexicon lines.
- RISK: archived history is rewritten and loses historical accuracy.
  → MITIGATION: exclude `docs/archive/**` and `HANDOFF.md` unless explicitly refreshing/deleting handoff state.
- RISK: `structured exchange` is over-applied to observer/auditor job keys that are really generic prompt/response spans.
  → MITIGATION: use `exchange entry range`, `session exchange`, or `exchange-keyed` for capture/audit units.

### Tracer-bullet check

- Invariants: reconciles D12-L/D13-L/D37-L/D49-L language after source rename so future builders do not revive the old term.
- Uncertainty: none; this is a canonical lexicon cleanup under a settled decision set.

### Acceptance Criteria

✓ `memory/SPEC.md` — active decisions, assumptions, invariants, lexicon, and verification sections no longer use `elicitation exchange` / `elicitation-exchange`; replacements preserve the structured-vs-generic distinction.
✓ Active docs — `docs/architecture/pi-seam-extensions.md` and `docs/architecture/pi-ui-extension-patterns.md` no longer use the retired phrase except as historical context if explicitly marked historical.
✓ Topology docs — `src/README.md` and `src/session/README.md` match the new file/module names from Card 1.
✓ No active-doc drift — `rg "elicitation[- ]exchange|ElicitationExchange|PendingElicitationExchange" memory docs src --glob '!docs/archive/**' --glob '!HANDOFF.md'` returns no matches.
✓ Historical exceptions — `src/rpc/README.md` may still list `session.elicitationExchanges` only in the explicit absent-name list.

### Verification Approach

- Inner: grep oracle above — proves active lexicon cleanup.
- Inner: `git diff --check -- <touched-docs>` — proves doc edits have no whitespace damage.
- Inner: repeat focused tests from Card 1 if source imports/descriptions were touched again.

### Cross-cutting obligations

- Preserve canonical docs as source of truth; do not create a side glossary.
- Keep archived docs historical; do not mutate `docs/archive/**` for current lexicon cleanup.
- Keep HANDOFF volatile; do not commit it unless the user explicitly asks.

### Expected touched paths (tentative)

```pseudo
memory/
└── SPEC.md                                      ~
docs/architecture/
├── pi-seam-extensions.md                       ~
└── pi-ui-extension-patterns.md                 ~
src/
├── README.md                                   ~
└── session/
    └── README.md                               ~
```
