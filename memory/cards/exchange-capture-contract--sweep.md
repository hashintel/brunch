# Exchange-outcome capture contract sweep

Frontier: exchange-capture-contract
Status:   active
Mode:     sweep
Created:  2026-07-03

Posture: earned (inherited from exchange-capture-contract). This is a closure sweep over already-landed structured-exchange seams: the work locks outcome interpretation into a closed ledger, conduct guidance, and exchange-proof probes rather than adding capture machinery.

## Orientation

- Containing seam: capture-ingest throughline over transcript-native structured exchanges, with `request_response` terminal results as the durable response surface.
- Frontier: `exchange-capture-contract` / FE-1135. This branch owns the authoritative outcome ledger that `present-digest` and orientation/ingest guidance can cite.
- Handoff state: ephemeral `/tmp/brunch-ship-gate-handoffs/FE-1135-capture-contract.md` says no `capture_*` receipts, no outcome-span annotations, no `mutate_graph` exchange-linkage provenance params, and no FE-1134 implementation edits except the named sweep-exclusion row if restack reveals drift.
- Main risk: accidentally turning conduct guidance into new deterministic capture infrastructure. Closure here means better contract/readers/probes, not a new product carrier.

## Sweep preflight

### Boundary

In scope:

- terminal request outcomes from `src/exchanges/schemas/request.ts`: `answered`, `cancelled`, `unavailable`
- review terminal decisions: `approve`, `request_changes`, `reject`
- proposal-chain read rules for `present_review_set`, `present_candidates`, and the planned `present_digest`
- sweep-window filter facts in `src/projections/session/sweep-watermark.ts` only where the contract needs a pinned filter behavior
- agent-readable conduct homes: `src/agents/skills/{ingest,map,elicit}/` and `src/agents/references/readiness-bands.md`
- result-honesty checks where accepted review-set persistence must clearly state final persisted graph codes

Out of scope:

- no `capture_*` transcript/tool-result family
- no machine-readable outcome-span annotation in the sweep projection
- no new `mutate_graph` provenance/linkage param
- no new observer/auditor queue or submit-path LLM extraction
- no `present_digest` implementation; its digest-specific rows are tripwired for FE-1136

### Classification

Buildable-now. The required inventory is derivable from existing schemas, D28-L/I57-L, D80-L–D82-L, D101-L, D106-L–D108-L, and the live sweep-window projection. `present_digest` materialization rows are deferred/tripwired because the exchange kind lands in FE-1136.

### Aggregate DoD

Every required (`●`) row is `have` or `built`; every row has either a code/test/probe witness or an explicit deferred tripwire. No row may close by adding a new deterministic capture carrier forbidden above.

## Cold-start reads

```
- memory/SPEC.md   — D80-L, D81-L, D82-L, D28-L/I57-L, D50-L/I33-L, D101-L/I56-L, D106-L, D107-L, D108-L
- memory/PLAN.md   — frontier: exchange-capture-contract; dependencies on present-digest and session-entry-orientation
- /tmp/brunch-ship-gate-handoffs/FE-1135-capture-contract.md — ephemeral branch handoff and no-go list
- src/projections/session/sweep-watermark.ts — request terminal inclusion, present/capture exclusion gap, watermark trigger
- src/exchanges/schemas/request.ts — outcome key and review-decision source of truth; note request_choice cancelled/unavailable metadata wart
- src/exchanges/recovery.ts — read-side incomplete-exchange recovery over exchange ids / `prev` / `curr` / `next` metadata
- src/agents/contexts/data-model/graph/commit-result.ts — existing graph mutation receipt contract
- src/agents/references/readiness-bands.md — advisory arbitrary-source capture rule
- src/agents/skills/ingest/SKILL.md, src/agents/skills/map/SKILL.md, src/agents/skills/elicit/SKILL.md — live conduct homes
- src/agents/skills/map/references/routing.md — shared route-by-confidence/conflict guidance
- src/agents/skills/propose/SKILL.md, src/agents/skills/project/SKILL.md — existing present_candidates recognition-only conduct
```

## Decision-flow chart

```text
exchange outcome
├── request_answer / request_choice / request_choices
│   ├── answered
│   │   ├── direct free text / comment -> direct user material; eligible for normal capture by confidence
│   │   └── listed option echo -> selected answer only; non-selected offered options are not capture payload
│   ├── cancelled
│   │   └── no offered payload; create scratchpad obligation if the unanswered prompt still matters
│   └── unavailable
│       └── no offered payload; re-ask / scratchpad only if material
└── request_review over a proposal chain
    ├── approve
    │   └── accepted terminal payload only; commit/read the final accepted proposal, not prior offers
    ├── request_changes
    │   └── no proposal payload captured; comment is direct user material; successor proposal supersedes prior
    ├── reject
    │   └── offer is dead; do not demote it to scratchpad as a live obligation
    ├── cancelled
    │   └── no proposal payload; scratchpad obligation if unresolved intent still matters
    └── unavailable
        └── no proposal payload; re-ask / scratchpad only if material

proposal chain position
├── standalone non-proposal request -> answer/comment is ordinary user material
├── superseded prior offer          -> transcript history only
├── accepted terminal offer         -> only offer payload eligible for proposal-chain capture/projection
├── rejected terminal offer         -> dead offer
└── cancelled/unavailable terminal  -> no offer payload; possible scratchpad/re-ask obligation
```

Span rule: the offer span is offer-scoped. Direct user free text and comments are never swallowed by the tuple span; they route through the normal D81-L confidence gradient.

## Ledger

Legend: `have` = already witnessed in code/docs; `partial` = exists but needs this sweep to lock it; `spec` = designed, unbuilt in this sweep; `built` = closed by this scope. `●` rows count toward DoD; `○` rows are deferred/tripwired.

| Row | Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CC-01 | Answered free-text request captures only the answer/comment as direct user material, never the surrounding offer text. | built | ● | earned | conduct guidance + exchange-proof probe | Witness: `src/agents/skills/ingest/SKILL.md` names `answered.text` as the only direct payload; `src/probes/__tests__/exchange-capture-contract-proof.test.ts` pins an answered request with tempting unconfirmed offer text outside the request details. |
| CC-02 | Answered choice/choices requests treat selected choice(s) and required comment as response material; non-selected option echo is render context, not capture payload. | built | ● | earned | conduct guidance + D106-L reference probe | Witness: `src/agents/skills/ingest/SKILL.md` names selected `choice`/`choices` + `comment` as response material and leaves non-selected `answered.options` as render echo; `src/probes/__tests__/exchange-capture-contract-proof.test.ts` pins single/multi-select echoes containing an unselected option. |
| CC-03 | Cancelled ordinary requests demote the unresolved prompt to scratchpad obligation, not graph truth. | built | ● | earned | ingest/elicit guidance + exchange-proof probe | Witness: `src/agents/skills/ingest/SKILL.md` says cancelled ordinary requests carry no answer/choice/option/offer payload and use an `open` scratchpad obligation when the ask still matters; `src/probes/__tests__/exchange-capture-contract-proof.test.ts` pins cancelled answer/choice/choices details with no `answered` payload and guards scratchpad dispositions as `open | resolved`. |
| CC-04 | Unavailable ordinary requests contribute no answer payload and only produce re-ask/scratchpad material when the missing response remains relevant. | built | ● | earned | ingest/elicit guidance + schema-row probe | Witness: `src/agents/skills/ingest/SKILL.md` says unavailable ordinary requests carry no response payload and are neither refusal nor accepted content; `src/probes/__tests__/exchange-capture-contract-proof.test.ts` pins unavailable answer/choice/choices details with required messages and no `answered` payload. |
| CC-05 | Approved review-set terminal consumes the final accepted proposal payload only and routes persistence through `acceptReviewSet`. | partial | ● | earned | RPC/probe + SPEC cross-check | Inputs: D27-L, D28-L, D107-L, `session.submitExchangeResponse`. Oracle: approve transcript/RPC readback shows accepted terminal and persisted graph result only. |
| CC-06 | Review `request_changes` captures no prior proposal payload; the comment is direct user material and the successor proposal is the next offer. | spec | ● | earned | D108-L recovery-seam probe | Inputs: review decision schema, read-side exchange recovery, and successor/supersession evidence where present. `request.ts` has outcome branches only; chain metadata is the `tool_meta.prev/curr/next` family plus exchange ids, not an outcome field. Oracle: request-changes → regenerated offer → approve reads only the approved successor. |
| CC-07 | Review `reject` kills the offer rather than demoting it to scratchpad. | spec | ● | earned | conduct guidance + exchange-proof probe | Inputs: review decision schema, D81-L gradient. Oracle: rejected proposal produces no graph commit and no scratchpad obligation that preserves the rejected offer as live. |
| CC-08 | Cancelled proposal chains contribute no offer payload; only unresolved intent may become scratchpad. | spec | ● | earned | conduct guidance + exchange-proof probe | Inputs: cancelled review terminal + D28-L/I57-L. Oracle: cancelled review-set/candidate chain does not leak proposal nodes/edges/candidates into capture. |
| CC-09 | Superseded prior proposal entries stay transcript history; projection/capture consume only the accepted terminal payload. | partial | ● | earned | SPEC I57-L + chain probe | Inputs: D28-L/I57-L, existing review-set successor pattern. Oracle: regenerated proposal chain with two priors and one approval reads only terminal payload. |
| CC-10 | `present_candidates` accepted terminal is recognition/fan-in material, not graph truth; non-picked candidates remain offer history. | spec | ● | earned | propose/project/map conduct guidance + exchange-proof probe | Inputs: D96-L/I51-L and request choice option echo. `propose` and `project` already state recognition-only conduct; this row ensures map/routing does not reinterpret the picked candidate as committed graph truth. Oracle: candidate pick does not write graph truth and only informs subsequent map/review conduct. |
| CC-11 | Accepted `present_digest` terminal maps source-derived material as advisory unless harmonized/settled. | spec | ○ | earned | FE-1136 (`present-digest`) | Tripwire: wait for `present_digest` schema/tool. Inputs will be D82-L, D99-L, readiness-bands §Arbitrary Source Capture. This row does not block FE-1135 DoD. |
| CC-12 | Sweep trigger remains per-turn/watermark-shaped: request terminal toolResults and user/assistant messages are sweepable; present offers are not. | partial | ● | earned | `src/projections/session/sweep-watermark.test.ts` | Tests pin `request_answer` inclusion, user/assistant messages, digest custom entries, and `worldUpdate`/`read_graph`/`bash` exclusion. Unpinned: `present_*` **and** `capture_*` toolResult exclusion (both fall out of the `request_` prefix test by omission; only `bash` stands in). Add one unit row pinning that exclusion; the filter is prefix-only and outcome-blind by design — do not add outcome discrimination. |
| CC-13 | Orientation-entry sweep exclusion stays closed by FE-1134 evidence unless restack reveals drift. | have | ● | earned | FE-1134 shared probe | Do not edit FE-1134 orientation implementation from this branch unless the branch is restacked and the exclusion row no longer holds. |
| CC-14 | The five governing invariants are stated in the live model-facing homes that perform capture/ingest/elicitation. | spec | ● | earned | `src/agents/skills/{ingest,map,elicit}/` + `map/references/routing.md` | Oracle: skill/routing text names cancel→scratchpad, reject→dead, accepted-terminal-only, offer-scoped spans, and per-turn watermark trigger without redefining graph ontology. `routing.md` is the shared conduct home for confidence/conflict routing and already carries the ancestor rule that rejected review material stays out of active graph material. |
| CC-15 | `acceptReviewSet` result honesty makes final persisted codes clear enough for the reader that observes approval. | spec | ● | earned | `formatRequestReview` render change + result-honesty test | Inputs: D107-L, `CommandExecutor.acceptReviewSet`, `session.submitExchangeResponse` result, `formatMutateGraphResult`. Gap confirmed at scope time: `acceptReviewSet` returns `lsn` + `createdNodes` (ref → code) but only the RPC envelope carries them; the model-facing render (`formatRequestReview` via the structured-exchange loop) states decision + comment only — no reader states the codes. Per PLAN grill note the render must state them (mirror `formatMutateGraphResult`'s `ref → code` shape). Oracle: approval transcript text states final persisted codes. |
| CC-16 | No forbidden carrier is introduced while closing the sweep. | spec | ● | earned | architecture/no-go audit | Oracle: grep/code review shows no `capture_*` receipt, no outcome-span annotation, and no exchange-linkage provenance param added to `mutate_graph`. |

## Suggested build order

1. Close the conduct homes (CC-01–CC-04, CC-07–CC-08, CC-10, CC-14) with concise skill/reference guidance.
2. Add or adapt focused exchange-proof probes over deterministic/RPC session examples for proposal-chain terminals (CC-05–CC-09) without adding product capture machinery.
3. Pin only missing deterministic facts with unit tests (CC-12, CC-15); do not expand unit coverage for conduct-only claims.
4. Audit the no-go carrier row (CC-16) and flip rows to `built` / `have` as evidence lands.
5. Leave CC-11 deferred for FE-1136 and note the handoff dependency.

## Acceptance criteria

```
✓ ledger closed — every ● row is have/built and CC-11 remains explicitly ○ tripwired to FE-1136
✓ conduct guidance — ingest/map/elicit (and readiness-bands if touched) state the five governing invariants at the point the model reads them
✓ proposal-chain probes — approve/request_changes/reject/cancel/supersession outcomes are witnessed by exchange-proof probes against deterministic/RPC transcript seams
✓ sweep-window facts — request terminal inclusion, present-offer exclusion, and per-turn watermark trigger remain covered; new unit rows only where an unpinned filter fact is found
✓ result honesty — accepted review-set approval states final persisted codes through an existing or newly pinned reader
✓ no forbidden machinery — no capture_* receipts, outcome-span annotations, or mutate_graph exchange-linkage params added
```

## Verification approach

- Inner: targeted vitest rows for deterministic filter/result facts only (`sweep-watermark.test.ts`, request/RPC render-honesty tests if needed).
- Middle: exchange-proof probes model the deterministic/RPC exchange terminal shapes and inspect the resulting transcript/graph readback.
- Outer: conduct review of skill guidance against the five invariants; `npm run verify` before commit.

## Cross-cutting obligations

- Capture remains foreground elicitor conduct under D80-L, not a submit-path product extraction pass.
- Direct user free text remains separately capturable under D81-L; offer-span demotion must not erase it.
- Supersession reads terminal accepted payload only; priors remain transcript history.
- Scratchpad is non-authoritative (D101-L/I56-L); it carries obligations/dispositions, never graph truth.
- Future `present_digest` must cite this ledger rather than reopening outcome vocabulary.

## Expected touched paths (tentative)

```
memory/cards/
└── exchange-capture-contract--sweep.md          ~
src/agents/skills/
├── ingest/SKILL.md                              ~
├── map/SKILL.md                                 ~
├── map/references/routing.md                    ~
└── elicit/SKILL.md                              ~
src/agents/references/
└── readiness-bands.md                           ?   (only if digest/advisory wording needs the canonical home)
src/exchanges/
├── schemas/request.ts                           ?   (only if the request_choice metadata wart is intentionally addressed)
└── recovery.ts                                  ?   (read-only unless recovery probe needs fixture helpers)
src/projections/session/
└── sweep-watermark.test.ts                      ~
src/session/structured-exchange-loop/
└── accepted-response.ts                         ?   (likely if approval transcript text must include persisted codes)
src/agents/contexts/exchanges/
├── request-response/review.ts                   ~
└── __tests__/request-response.test.ts           ~
src/rpc/
└── __tests__/handlers.test.ts                   ?   (likely home for accepted review-set persisted-code readback)
src/probes/
├── exchange-capture-contract*.ts                ?   (probe harness or focused report, if existing proof shape is reused)
├── deterministic-exchange-script.ts             ?   (likely reuse/read for exchange-proof precedent)
├── structured-exchange-rpc-proof.ts             ?   (likely reuse/read for exchange-proof precedent)
└── __tests__/exchange-capture-contract*.test.ts ?
.fixtures/runs/
└── exchange-capture-contract/                   ?   (promoted probe evidence only; normalize paths)
```
