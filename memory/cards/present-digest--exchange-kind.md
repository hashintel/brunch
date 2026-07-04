# `present_digest` — digest exchange kind end to end

Frontier: present-digest
Status:   active
Mode:     slices
Created:  2026-07-04

Consolidates `present-digest--exchange-throughline-pi-scope.md` (2026-07-03, superseded) per the
overlap-as-independence-test — its test homes, dispatch coverage, and routing/receipt checks are
absorbed below.

## Orientation

- **Containing seam:** the structured-exchange family — `src/exchanges/` (schemas/projections/recovery, D108-L), `src/agents/contexts/exchanges/` (model-facing formatters), `src/.pi/extensions/exchanges/` (tool registration/render), with the sweep read at `src/projections/session/sweep-watermark.ts`.
- **Frontier:** `present-digest` (FE-1136), arc `capture-ingest-throughline`, branch `ln/fe-1136-present-digest` stacked on the closed `exchange-capture-contract` (FE-1135). This frontier owes the FE-1135 residuals: the live regeneration-chain probe and the digest supersession/cancel probes (SPEC I57-L, formerly sweep row CC-11).
- **Posture:** proving (inherited from present-digest) — the payload shape (prose abstract + analysis/recommendation, no graph material) and the sweep-read semantics are designed but unwitnessed.
- **Main open risk:** the D106-L terminal echo is the *only* sweep-visible digest carrier (`isSweepConversationalEntry` excludes `present_*` toolResults and includes `request_*` terminals) — if echoing large abstracts becomes real size pressure, the frontier's named fallback (keep a sweepable custom entry) reopens a two-carrier shape that PLAN rejects by default. Card 1 proves the echo; the card-4 walkthrough is the size-pressure check.
- **Cross-cutting obligations (frontier-level):** the five FE-1135 governing invariants (cancel-demotes / reject-kills / accepted-terminal-only / offer-scoped spans / per-turn trigger) are the digest's read rules; I20-L/I51-L (digest is not a review set, carries and commits no graph material); one-carrier-per-fact (D101-L pattern → `DIGEST_CUSTOM_TYPES` retires); extend the closed `exchange-rendering` inventory only via the family-completeness mechanism; dual-audience content discipline (D104-L).

## Sequence discipline

All cards stay inside `present-digest`; later cards' scopes are fixed by the decision-flow chart
and I57-L/D28-L, not by card-1 implementation findings. If card 1 forces a different payload kind
than a prose digest with no graph material, or new response vocabulary, stop the sequence and
route through `ln-spec` / `ln-plan` before continuing.

## Decision-flow chart (ship-gate obligation)

Digest lifecycle — every path and endpoint, with the sweep consequence at each terminal:

```pseudo
state-machine digest-lifecycle:
  [ingest: raw/large source]
    -> present_digest(exchange_id, abstract, analysis/recommendation)   # offer; present_* toolResult NEVER swept
    -> request_response(exchange_id)                                    # single-terminal invariant (recovery.ts)

  request_response outcomes:
    answered.approve
      -> terminal echoes the accepted abstract (D106-L)
      -> sweep reads the echo ONLY (accepted-terminal-only, I57-L)
      -> following map step routes by confidence/conflict
         (readiness-bands §Arbitrary Source Capture):
           reviewed not harmonized -> advisory graph item
           harmonized and accepted -> settled graph item
           low confidence          -> scratchpad obligation
           conflict                -> reconciliation_need
         receipt honesty already carried by formatMutateGraphResult
    answered.request_changes (comment required)
      -> comment = direct user material (capturable)
      -> model regenerates: NEW present_digest offer, same conversational
         chain (D28-L; linkage is conduct + tool_meta prev/curr/next —
         no schema supersession field)
      -> loop ×N; only the eventual accepted terminal feeds sweep;
         priors stay JSONL history
    answered.reject
      -> offer dead (invariant 2); no scratchpad demotion, nothing swept
    cancelled
      -> no offer payload contributes (invariant 1); ceiling = optional
         `open` scratchpad obligation to re-ask
    unavailable
      -> no payload; not refusal; re-ask or scratchpad obligation only
         if the digest still matters

  pending (offer with no terminal yet)
    -> findIncompleteStructuredExchangePresents recovers it;
       continuation stays request_response
  raw digested source
    -> never a sweep carrier at any endpoint (background artifact)
```

Endpoint audit: accept→map (four routing destinations), request-changes loop, reject, cancel, unavailable, pending-recovery — all charted; no endpoint lacks a card row below.

---

## Card 1 — `present_digest` tracer: kind, terminal echo, render family member, grant · `done` · full card

### Target Behavior

An assistant-authored digest offer resolves through a `present_digest` → `request_response` exchange on the live tool path, with the accepted terminal echoing the accepted abstract.

### Full-card cold-start reads

```
- memory/SPEC.md   — D28-L, D37-L, D38-L, D104-L, D105-L, D106-L, D107-L, D108-L; I20-L, I51-L, I57-L; D50-L/I33-L (capture_* reserved)
- memory/PLAN.md    — frontier: present-digest (shape, scope, named fallback)
- HANDOFF.md        — FE-1135 residuals + the request_choice schema wart to avoid
- src/exchanges/TOPOLOGY.md + src/exchanges/schemas/TOPOLOGY.md — consolidation layout, details grammar, tool-meta rules
- src/.pi/extensions/exchanges/TOPOLOGY.md — registration/renderResult ownership, single-terminal invariant
- docs/archive/PLAN_HISTORY.md §exchange-capture-contract — the five governing invariants
```

### Boundary Crossings

```
→ elicitor grant (src/agents/runtime/elicitor/active-tools.ts)
→ tool registration + request_response dispatch (src/.pi/extensions/exchanges/)
→ schema + params + detail projection (src/exchanges/schemas/, src/exchanges/projections/)
→ pending-present recovery (src/exchanges/recovery.ts)
→ model-facing formatter (src/agents/contexts/exchanges/)
→ TUI render (D104-L Markdown pass-through) + dev:components preview entry
```

### Risks and Assumptions

```
- RISK: echoing a large accepted abstract in the terminal toolResult creates real size pressure
  → MITIGATION: build the echo (PLAN rejects the two-carrier fallback by default); card 4's live
    walkthrough with genuinely large source is the pressure test; if untenable, stop the sequence
    and route to ln-plan — do not quietly keep DIGEST_CUSTOM_TYPES alive
- RISK: digest payload grows review-set-shaped by smuggling graph nodes/edges/command material
  → MITIGATION: schema permits prose digest facets only; params tests REJECT graph-material-looking
    fields, not just accept prose (I20-L, I51-L)
- RISK: renderer duplicates formatter logic → MITIGATION: formatter is the designed surface;
  renderer stays Markdown pass-through per D104-L
- ASSUMPTION: the existing review terminal vocabulary (approve | request_changes | reject) suffices;
  the digest needs only a `prev: present_digest` tool_meta variant (request_choice's two-`prev`
  precedent) plus a digest answered payload carrying the abstract echo — zero new response vocabulary
    → IMPACT IF FALSE: new response vocabulary = durable grammar change → stop, route ln-spec
    → VALIDATE: schema unit tests + formatter snapshots in this card
- ASSUMPTION: the existing review-source UI collection path serves digest decisions without a new
  collector component
    → IMPACT IF FALSE: exchange-answering-chrome may need an additional surface before digest is
      live-usable; transcript path unaffected
    → VALIDATE: extension dispatch test drives approve / request_changes / reject / cancel /
      unavailable over a pending digest
- ASSUMPTION: chain linkage stays conversational (tool_meta prev/curr/next only), matching the
  review-set regeneration precedent — no schema supersession field
    → IMPACT IF FALSE: schema + recovery change; blast radius = card 3's probes
    → VALIDATE: card 3's supersession probe is the cheapest proof
```

### Posture check

Proving. Scores on **proof of life** (new end-to-end exchange path: grant → tool → schema → terminal → formatter → render — a tracer on production bones, not harness wiring), **invariants** (locates the no-graph-material boundary and terminal self-containment before sweep semantics depend on them), and **uncertainty** (retires the unwitnessed payload/echo shape — the frontier's stated proving core). No spike is cheaper than landing this.

### Acceptance Criteria

```
✓ schemas/__tests__/present — zPresentDigestDetails parses offer branch with tool_meta
  curr: present_digest / next: request_response; digest carries abstract + analysis/recommendation
  markdown only — no graph refs, no draft/edge payload
✓ schemas/__tests__/params — present_digest params accept prose digest material and reject
  graph-proposal-shaped fields
✓ schemas/__tests__/request — review-from-digest terminal: answered.approve echoes the accepted
  abstract (D106-L); request_changes requires comment; reject accepts optional comment;
  cancelled/unavailable branches OMIT `next` (majority shape — not request_choice's retained-`next` wart)
✓ projections __tests__ — canonical present_digest details + digest review terminal details
  constructed from validated params without re-parsing objects just built
✓ recovery test — a pending present_digest offer is recovered with request_response continuation
✓ extension dispatch test — request_response dispatches a pending present_digest through the
  review response source for all five outcomes
✓ family-completeness — registered tool list includes PRESENT_DIGEST_TOOL; coverage row binds
  formatter + preview id + digest-tuples.md snapshot markers (# accepted, # changes requested,
  # rejected, # cancelled)
✓ render-honesty — digest formatter declares elisions per the D104-L convention; populated detail
  leaves render or appear in the declared elision list
✓ elicitor active-tools test — present_digest granted
```

### Verification Approach

```
- Inner: vitest + toMatchFileSnapshot — schema/params/projection unit tests; content snapshot family
- Middle: render-honesty invariant with declared elision list; family-completeness aggregate row;
  extension dispatch test on the live registration path
- Outer: dev:components preview entry available for human aesthetic review; walkthrough deferred
  to card 4
```

### Cross-cutting obligations

- Extend `exchange-family-completeness.test.ts`; do not reopen the closed `exchange-rendering` inventory any other way.
- Dual-audience discipline: persisted `content` is model context — concise and stable; visual work stays in the pass-through render.
- Grant flows only through the existing exchange extension/grant path (no new authority seam).
- Reconcile touched topology files: `src/exchanges/TOPOLOGY.md` (+ `schemas/TOPOLOGY.md`), `src/.pi/extensions/exchanges/TOPOLOGY.md`, `src/agents/contexts/exchanges/TOPOLOGY.md`.

### Expected touched paths (tentative)

```
src/exchanges/
├── schemas/
│   ├── shared.ts                       ~  (tool names, digest tool_meta variants)
│   ├── present.ts                      ~  (zPresentDigestDetails + union)
│   ├── request.ts                      ~  (review-from-digest branch + abstract echo)
│   ├── params.ts                       ~  (zPresentDigestParams)
│   ├── index.ts                        ~
│   ├── TOPOLOGY.md                     ~
│   └── __tests__/                      ~  (present, params, request)
├── projections/
│   ├── present-digest.ts               +
│   ├── request-response/               ~  (digest terminal details construction)
│   └── __tests__/                      ~  (present-digest +, request-digest-review +)
├── recovery.ts                         ?  (union widening should suffice)
├── __tests__/recovery.test.ts          ~
└── TOPOLOGY.md                         ~
src/agents/contexts/exchanges/
├── present-digest.ts                   +
├── request-response.ts / request-response/  ~  (review formatter digest echo)
├── __snapshots__/digest-tuples.md      +
├── __tests__/                          ~  (present-digest +, honesty +, request-response ~)
└── TOPOLOGY.md                         ~
src/.pi/extensions/exchanges/
├── present-digest.ts                   +
├── index.ts                            ~
├── request-response.ts                 ~  (pending-digest dispatch)
├── shared/review-source.ts             ?
├── pi-schema.ts                        ?
└── TOPOLOGY.md                         ~
src/.pi/extensions/__tests__/
├── exchange-family-completeness.test.ts   ~
├── exchanges-extension.test.ts            ~
└── exchanges-present-request.test.ts      ~
src/agents/runtime/elicitor/active-tools.ts (+ test)   ~
src/dev/component-preview/registry.ts                  ~
```

---

## Card 2 — Sweep single-carrier: `DIGEST_CUSTOM_TYPES` retirement · `done` · light card

### Objective

The terminal echo becomes the only sweep-visible digest carrier: the legacy custom-entry special case is deleted and the sweep window's digest facts are pinned by tests.

### Light-card cold-start reads

```
- memory/SPEC.md   — D82-L (superseded carrier), D101-L (one-carrier pattern), I57-L
- memory/PLAN.md    — frontier: present-digest (Retires); capture-ingest-throughline done-definition
- src/projections/session/sweep-watermark.ts + .test.ts — the special case and the exclusion-test family
```

### Acceptance Criteria

```
✓ sweep-watermark.test.ts — DIGEST_CUSTOM_TYPES deleted; brunch.digest / brunch.acquisition_digest /
  brunch.capture_digest custom entries are no longer force-included in the conversational tail
✓ sweep-watermark.test.ts — a present_digest offer toolResult is excluded from the tail; its
  request_* terminal is included (extends the FE-1135 present_*/capture_* exclusion rows)
```

### Verification Approach

```
- Inner: vitest — extend the existing sweep-window exclusion rows in sweep-watermark.test.ts
```

### Cross-cutting obligations

- One carrier for one fact: no compatibility shim, no transitional dual-read (pre-release posture).

### Assumption dependency

Depends on: card 1 landed — retiring the custom carrier before the echo tests exist would leave digest capture with no carrier at all. Scope is fixed (delete one special case + pin the window facts); no card-1 finding shifts it.

### Expected touched paths (tentative)

```
src/projections/session/
├── sweep-watermark.ts        ~  (- DIGEST_CUSTOM_TYPES)
└── sweep-watermark.test.ts   ~
```

---

## Card 3 — Supersession and cancel-chain probes (FE-1135 residuals) · `done` · light card

### Objective

Witness the I57-L read rules on the live digest seam: a regeneration chain feeds the sweep only its accepted terminal payload, and a cancelled chain contributes nothing — discharging the probes FE-1135 explicitly deferred to this branch.

### Light-card cold-start reads

```
- memory/SPEC.md   — I57-L (generalized supersession invariant + its coverage cell), D28-L
- memory/PLAN.md    — frontier: present-digest (Residuals; verification bullet)
- src/probes/__tests__/exchange-capture-contract-proof.test.ts — probe precedent + conduct-home pins
- src/projections/session/sweep-watermark.ts — the window projection under test
```

### Acceptance Criteria

```
✓ regeneration-chain probe — present_digest → request_changes → regenerated present_digest →
  approve: projectCaptureSweepWindow's tail carries the terminal echo only; prior offers are
  transcript history, never tail payload (regenerate ×2 variant included)
✓ cancel-chain probe — a cancelled digest chain contributes no offer payload to the tail; the
  only permissible residue is an optional `open` scratchpad obligation (conduct, not projection)
✓ SPEC I57-L coverage cell updated — digest chain-kind cells marked witnessed (canonical
  reconciliation, not optional)
```

### Verification Approach

```
- Inner: vitest probes over live-shaped JSONL entry fixtures (exchange-capture-contract-proof
  precedent) driving the real projectCaptureSweepWindow — no harness-injected wiring
```

### Cross-cutting obligations

- Probes must exercise the real projection entry point; a probe that re-implements the window filter proves nothing (harness-as-false-proof).
- If chain reads turn out to require an explicit link field (card 1 assumption false), stop and route to `ln-spec` — that is a SPEC-level grammar change.

### Assumption dependency

Depends on: cards 1–2 landed (mechanical shape only — probe *scope* is fixed by I57-L/D28-L).

### Expected touched paths (tentative)

```
src/probes/__tests__/present-digest-supersession-proof.test.ts  +
memory/SPEC.md                                                  ~  (I57-L coverage cell)
```

---

## Card 4 — Ingest conduct binding + advisory mapping walkthrough · `in progress` · light card

### Objective

The model knows when and how to use the digest exchange — ingest guidance binds the digest step to `present_digest`, routing/readiness references cite the exchange with advisory settlement — and the end-to-end story is observed live with an honest map receipt.

### Progress

- Inner conduct binding and executable presence pin are implemented.
- Pending before `done`: live walkthrough beat (large source → digest → request changes → accept → map advisory), including `formatMutateGraphResult` receipt check and abstract-size pressure assessment.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: present-digest (Scope: ingest-skill guidance; Verification: walkthrough beat)
- src/agents/skills/ingest/SKILL.md — digest step + structured-exchange outcome rules (the conduct home to extend)
- src/agents/skills/map/references/routing.md — routing destinations
- src/agents/references/readiness-bands.md §Arbitrary Source Capture
- docs/praxis/manual-testing.md — before the outer-loop walkthrough
```

### Acceptance Criteria

```
✓ ingest SKILL.md — the "Digest if raw/large" step presents the digest via present_digest (offer →
  review terminal), and the outcome rules cover the digest chain (accept echo, request-changes
  regeneration, reject/cancel) by extending the existing bullets — no second conduct carrier
✓ map routing.md — accepted digest material is source-derived review input routed by confidence/
  conflict, never automatic graph truth
✓ readiness-bands.md §Arbitrary Source Capture — the digest step names the exchange; accepted
  material maps advisory until harmonized (unchanged semantics, now bound to the mechanism)
✓ conduct-home presence pin — exchange-capture-contract-proof.test.ts (or its digest sibling from
  card 3) pins the digest guidance presence, same mechanism as the five invariants
✓ live walkthrough beat (human outer oracle) — paste large source → digest → request changes →
  accept → map advisory; the mutate_graph receipt states persisted graph codes + settlement
  (formatMutateGraphResult honesty); abstract-echo size pressure assessed (card 1 risk);
  observations recorded, findings routed to the frontier rather than fixed mid-walkthrough
```

### Verification Approach

```
- Inner: conduct-home presence check (executable pin); npm run check:markdown-links for reference edits
- Outer: live walkthrough beat per docs/praxis/manual-testing.md
```

### Cross-cutting obligations

- Extend the existing conduct homes (ingest/elicit/map); do not add a second carrier for digest conduct.
- Raw source stays a non-swept artifact; the digest exchange enables mapping but commits nothing itself (I51-L).

### Assumption dependency

Depends on: cards 1–3 landed (guidance names a real tool; the walkthrough exercises witnessed semantics). Guidance content is fixed by the decision-flow chart — no implementation finding changes it.

### Expected touched paths (tentative)

```
src/agents/skills/ingest/SKILL.md                                ~
src/agents/skills/map/references/routing.md                      ~
src/agents/references/readiness-bands.md                         ~
src/agents/skills/elicit/SKILL.md                                ?  (only if its capture reference names digest)
src/probes/__tests__/exchange-capture-contract-proof.test.ts     ~  (presence pin; or digest sibling)
.fixtures/runs/present-digest-walkthrough-*                      ?  (promoted evidence, if captured)
```
