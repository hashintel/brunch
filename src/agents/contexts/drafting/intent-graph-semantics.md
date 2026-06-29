# Intent graph semantics

> **Status: draft, isolated, not wired.** This file lives in `src/agents/contexts/drafting/` — a scratch directory. It is **not** runtime prompt payload, is not copied into packaged agent assets, is not cited by any skill or prompt, and is imported by nothing. It exists to carry the *design reasoning* behind the Brunch intent graph in one legible place, updated to the current model.
>
> **Provenance.** This is a faithful-to-current redraft of the recovered `docs/design/INTENT_GRAPH_SEMANTICS.md` — the now-dangling companion that [`ONTOLOGY_REVIEW_PROTOCOL.md`](../../../../docs/design/ONTOLOGY_REVIEW_PROTOCOL.md) and [`BEHAVIORAL_KERNELS.md`](../../../../docs/design/BEHAVIORAL_KERNELS.md) both still link to at `./INTENT_GRAPH_SEMANTICS.md`. The original described an older nine-kind claim ontology. The model has since moved through FE-1052 (schema enum changes; `GRAPH_MODEL.md` retired) and FE-1090 (data-model-legibility: generated references + adjudication of the salvaged richness). This draft describes **today's** model accurately and preserves the original's design thinking where it still earns its keep, noting where old schema ideas were deliberately superseded rather than re-proposing dead schema as live.
>
> **Stance.** Describe the current model; preserve the reasoning; do not re-open settled verdicts as if undecided. Where the old doc proposed structure the current model rejected (kind subtypes, `checkability`/`strength` stored fields, the five-family relation taxonomy as edge kinds, `support`/`status` edge metadata), this draft maps the *intent* onto the mechanism that carries it now.

## Source of truth this draft cites, never overrides

This is reasoning prose, not authority. The canonical artifacts:

- **Generated vocabulary tables** — [`src/agents/contexts/references/graph-ontology.md`](../references/graph-ontology.md), projected by `src/graph/schema/generate-ontology-ref.ts` from [`kinds.ts`](../../../graph/schema/kinds.ts), [`nodes.ts`](../../../graph/schema/nodes.ts), and [`category-policy.ts`](../../../graph/policy/category-policy.ts) (D73-L). Regenerate with `npm run generate:ontology`; drift is caught by `npm run check:data-model`.
- **Authored authoring judgment** — [`src/agents/contexts/references/graph-authoring-heuristics.md`](../references/graph-authoring-heuristics.md): the runtime-eligible shared reference cited by `capture` and `commit-graph` (D97-L).
- **Schema leaves** — `src/graph/schema/kinds.ts` (closed enums), `nodes.ts` (`GraphNode`, detail schemas), `edges.ts` (`GraphEdge`), `reconciliation-need.ts`, `elicitation-gaps.ts`; `src/graph/policy/category-policy.ts` (edge-category metadata); `src/graph/projection/labels.ts` + `direction.ts` (anchor-relative phrasing + impact direction).
- **SPEC decisions** — D51-L (closed edge categories + ReconciliationNeed), D54-L (node shape), D55-L (provenance retired → `change_log`), D56-L (13 intent kinds, per-kind rubric, no derived category axis), D57-L (LLM-judged readiness), D61-L (spec = initiative; "claim" is an umbrella over truth-bearing kinds), D62-L (projected codes), D63-L (`basis` = approval directness), D64-L/D94-L (derived readiness bands), D65-L (elicitation_gaps), D73-L (domain owns vocabulary), D87-L/D88-L/D89-L (closure rule, `detail.form`, `spec.kind`), D97-L (cite-don't-inline), D98-L (SPEC/CODE mode-only runtime), D8-L/D29-L (reconciliation substrate).
- **Worked rationale companion** — [`ONTOLOGY_REVIEW_PROTOCOL.md`](../../../../docs/design/ONTOLOGY_REVIEW_PROTOCOL.md) §6–9 records exactly how the older ontology narrowed into the current one (the closure rule, node/edge deltas, the epistemic triad, the Gherkin validation).

When this draft and a generated table disagree, the generated table wins; this prose is stale and should be fixed.

## The framing

**A spec is a graph of typed claims.** Each node kind is a *modality* of claim — a stance toward the world — not just a section bucket. The original doc's central thesis survives intact; what changed is the partitioning. Where the old model had nine flat top-level kinds, the current model partitions the node space into **four planes** carrying **24 kinds**, and pushes method-specific structure (BDD, formal verification) down into inert `detail.form` payload rather than into the kind set (D87-L closure rule).

```pseudo
spec graph (one per spec; no cross-spec claim sharing — D61-L):
  intent plane     what / why / obligation / uncertainty / examples
  oracle plane     how claims are checked or evidenced
  design plane     how the system is shaped
  plan plane       how the work is sequenced

accepted graph truth:
  nodes  stable items: kind, basis, source, optional detail   (no status)
  edges  closed structural categories with role-named endpoints (no status)

not graph truth, adjacent substrates:
  elicitation_gaps      prospective coverage obligations  (D65-L)
  reconciliation_needs  retrospective repair obligations  (D8-L / D29-L)
  review-set drafts     candidate material awaiting human acceptance
```

The conceptual load-bearing rule, repeated throughout: **`kind` drives behavior** — readiness band (D94-L), edge legality (D51-L), and the elicitor's source-question (D56-L) all key off `kind`. `detail.form` is inert payload plus a renderer hook; it never changes what kind of graph thing a node is.

## The four planes and their kinds

Twenty-four kinds across four planes, in canonical plane order. Codes and bands are generated in [`graph-ontology.md`](../references/graph-ontology.md) (reproduced here for legibility; that file is the source of truth). A band of `—` means the kind carries no readiness band (D94-L); band-less kinds are `example`, `sketch`, `term`.

### Intent plane — what and why (13 kinds)

| Kind | Code | Modality of claim | Source-question | Bands |
| --- | --- | --- | --- | --- |
| `goal` | G | Value / outcome claim | "What outcome are we after?" | grounding |
| `thesis` | TH | Position / bet claim | "Who is this for, and why does it matter?" | grounding |
| `term` | T | Vocabulary commitment | "What do we mean by X?" | — |
| `context` | CTX | Descriptive claim | "What is true about the world this lives in?" | grounding, elicitation |
| `story` | ST | Intra-spec grouping | "What cluster of behavior does this belong to?" | elicitation |
| `unknown` | UNK | Known-unknown claim | "What can't we answer yet but must accommodate?" | elicitation |
| `requirement` | REQ | Obligation claim | "What must the system do?" | commitment |
| `assumption` | A | Deferred-falsifiable belief | "What might be false?" | elicitation |
| `constraint` | CON | Boundary claim | "What does this rule out?" | grounding, elicitation |
| `invariant` | INV | Preservation claim | "What must never be broken?" | elicitation |
| `decision` | D | Choice claim | "What did we pick among real alternatives?" | elicitation |
| `criterion` | AC | Oracle claim | "How will we judge that it holds?" | commitment |
| `example` | EX | Witness / disambiguator | "What concrete case would settle this?" | — |

What is new relative to the salvaged nine-kind doc:

- **`thesis`** (TH) — the who/what/why/for-whom framing, target user, problem theory, product bet (La Carte Blanche style, D56-L). The old doc folded this into `goal`/`context`. A goal commits the team to a target; a thesis stakes a refutable position about who the work is for and why.
- **`term`** (T) — canonical naming commitments / ubiquitous language. The old doc explicitly said `term` was *not* part of the typed-claim kind set "until a future lexicon model promotes terms into graph-addressable claim records." **That future arrived:** `term` is now a first-class, graph-addressable intent kind. It carries a required `detail` payload (`definition`, optional `aliases`) and is band-less.
- **`story`** (ST) — mid-level narrative grouping inside one spec (a Gherkin `Feature` expressed inside a single spec; ONTOLOGY_REVIEW_PROTOCOL §6.5). Adds no edge of its own — it reuses `composition` (story → requirement) and `witness` (criterion → requirement).
- **`unknown`** (UNK) — a known-unknown: a domain uncertainty not presently answerable that the spec or plan must structurally accommodate. It completes the epistemic triad (below).

`thesis` carries the conceptual weight the salvaged doc's earlier drafts wanted to assign to a renamed `claim` kind; the ONTOLOGY_REVIEW_PROTOCOL §6.2 proposed `thesis → claim`, but the code kept `thesis`. "Claim" is now an **umbrella vocabulary term** (D61-L) for the truth-bearing intent kinds (`requirement`, `assumption`, `constraint`, `invariant`, `decision`, `criterion`, `example`), not a node kind.

### Oracle plane — how we know (4 kinds)

| Kind | Code | Role | Band |
| --- | --- | --- | --- |
| `check` | CH | A concrete verification check (a test, assertion, step-def) | projection |
| `vv_method` | VV | A verification method (prover / solver / golden / probe family) | projection |
| `evidence` | E | Observed evidence | projection |
| `vv_obligation` | O | A proof / verification obligation | projection |

The salvaged doc's `criterion` subtypes (`acceptance`, `test`, `manual_review`, `runtime_check`, `proof`, `observability`) are reconstructed here as: **the intent-plane `criterion`** (the oracle *claim* — how we judge a property) plus **oracle-plane nodes** (the concrete machinery). The discrimination the subtypes carried is preserved as the intent/oracle plane boundary, not as a subtype enum. Link a concrete oracle to the claim it judges with a `witness` edge.

### Design plane — how it's shaped (4 kinds)

| Kind | Code | Role | Band |
| --- | --- | --- | --- |
| `module` | MOD | An implementation seam / module | projection |
| `interface` | API | An interface / contract surface | projection |
| `entity` | ENT | A data / domain entity | projection |
| `sketch` | SKT | An intentionally lightweight design sketch (advisory, not hardened) | — |

### Plan plane — how it's sequenced (3 kinds)

| Kind | Code | Role | Band |
| --- | --- | --- | --- |
| `milestone` | M | A bounded phase | commitment |
| `frontier` | F | The plan / tracker / branch unit | commitment |
| `slice` | S | The buildable implementation unit inside a frontier | commitment |

### Spec scope is not a node kind

`spec.kind ∈ product | feature | function` (D89-L) is an **ownership relation to the codebase**, resolved on the spec row, not in the node graph:

- `product` — the spec owns the whole codebase.
- `feature` — the spec owns a part and a cycle within a brownfield codebase.
- `function` — the spec captures (often formal) verification around a focused area.

The recurring "feature" intuition the old doc would have modeled as a kind is spec-scope leaking into the node taxonomy. `actor` and `scenario` remain deferred (ONTOLOGY_REVIEW_PROTOCOL §8).

## Why there are no subtypes

The salvaged doc gave each of `constraint`, `criterion`, `invariant`, and `example` an enum of subtypes "to keep the top-level kind set small while preserving the discriminations the LLM needs." The current model reached the same goal — a small kind set with preserved discrimination — by a **different mechanism**, and FE-1090 explicitly rejected subtype enums as a parallel ontology carrying cost. The discriminations are preserved in three places instead:

1. **The plane boundary** — what the old `criterion` subtypes split (`test`, `runtime_check`, `proof`, `observability`) now splits across `criterion` (intent oracle-claim) and the oracle-plane kinds (`check`, `vv_method`, `evidence`, `vv_obligation`).
2. **Edge structure + stance** — what the old `example` subtypes split (`positive`, `negative`) is now polarity on a `witness` edge (`stance: for | against`); `not_relevant` is an `exclusion` edge from a `constraint`/non-goal boundary.
3. **`detail.form`** — what method-specific subtypes (Gherkin, formal) carried is now inert `detail.form` payload (D88-L).

Mapping the old subtype intents onto current mechanisms:

| Old subtype intent | Current mechanism |
| --- | --- |
| `constraint.non_goal` | `constraint` node + `exclusion` edge to the excluded subject |
| `constraint.scope` / `technical` / `policy` / `resource` / `compatibility` / `environmental` | `constraint` node; the nuance lives in `title`/`body`, not a stored subtype |
| `criterion.acceptance` | `criterion` (the default reading of AC) |
| `criterion.test` / `runtime_check` | oracle-plane `check`, linked by `witness` |
| `criterion.proof` | oracle-plane `vv_obligation` / `vv_method`; `detail.form:"formal"` on the claim |
| `criterion.manual_review` | `criterion` + `vv_method` naming a reviewer rubric |
| `criterion.observability` | oracle-plane `evidence` / `check` |
| `invariant.state` / `transition` / `authority` / `provenance` / `consistency` / `security` / `data_integrity` | `invariant` node; nuance in `title`/`body`; `detail.form:"formal"` when round-tripping a prover |
| `example.positive` | `example` + `witness:for` |
| `example.negative` / counterexample | `example` + `witness:against` |
| `example.edge_case` / `trace` | `example`; the kind of case lives in wording |
| `example.not_relevant` | `example` + `exclusion` edge from a boundary `constraint` |

`invariant` being first-class (not a `constraint` subtype, as some readings of the old doc implied) is load-bearing per D56-L: its operational role differs — **invariants take `dependency` and `witness` edges; constraints take `exclusion` edges.**

## The epistemic triad: context / assumption / unknown

The old doc's `context` promotion rules implied a two-way fork between "known" and "might be false." The current model makes this a **three-way informal certainty triad** — a routing heuristic, not a stored `epistemic_status` field (ONTOLOGY_REVIEW_PROTOCOL §6.6):

- `context` — known / stipulated true for this spec.
- `assumption` — believed enough to proceed, but **deferred-falsifiable** ("what might be false").
- `unknown` — a known-unknown; explicitly not known, and the system or plan must accommodate that ignorance.

Do not launder a known-unknown into an assumption to make the graph look complete. Routing for formal work: an **axiom / given → `context` + `detail.form:"given"`** (known *and* load-bearing); load-bearing-ness comes from outgoing `dependency` edges, not from the kind. A **theorem / property → `invariant`** (a preservation claim carrying `witness` edges).

## Promotion rules

The interviewer and the capture sweep should treat the kinds as a partial lattice with explicit promotion. The most common drift is `context` — the broadest attractor — absorbing material that deserves a sharper kind. This is the authored judgment in [`graph-authoring-heuristics.md`](../references/graph-authoring-heuristics.md); reproduced here with the triad and the new kinds folded in.

| If the descriptive material… | Promote to… |
| --- | --- |
| states the desired outcome or why the work matters | `goal` or `thesis` |
| defines a term or naming commitment | `term` |
| must be true for success or safety | `requirement` or `invariant` |
| limits acceptable solutions or scope | `constraint` |
| is believed but might be materially false | `assumption` |
| is an acknowledged unknown that can't simply be answered now | `unknown` |
| chooses among alternatives with durable consequences | `decision` |
| explains how success will be judged | `criterion` or an oracle-plane node |
| gives a concrete case, trace, or counterexample | `example` |
| only helps interpretation, no stronger role yet | keep `context` |

Cross-kind pairings the old doc named, still true:

- **`requirement` ↔ `invariant`** — a requirement to *do* X often pairs with an invariant to *preserve* P across the doing of it.
- **`decision` ↔ `invariant`** — the decision captures the choice; the invariant captures the rule that must keep holding after it.
- **`assumption` retirement** — a validated assumption does not become a requirement. It becomes a `decision` (if validation forced a choice) or it is retired as confirmed `context`; dependents stop carrying the assumption dependency.

## Decision-capture criteria

Unchanged judgment, reconciled fields. A claim becomes a `decision` only if **all** hold (the old doc's five tests survive verbatim in spirit):

1. Plausible alternatives existed.
2. The choice is durable — it constrains future design, implementation, or interpretation.
3. The choice is explicit — statable as "we chose A over B/C," not as a description of current behavior.
4. At least one rejected alternative can be named.
5. There is a rationale.

**Required `detail` fields, reconciled to code** ([`nodes.ts`](../../../graph/schema/nodes.ts) `DecisionDetail`): `chosen_option`, `rejected` (≥ 1), `rationale`. The old doc also required `scope` and `consequences`; the current schema **dropped both** — put scope and downstream consequences in the node `body` or express them with edges (`exclusion` for what the decision rules out, `dependency` for what now relies on it). Do not invent decision-detail fields.

## Classification guide

When the capture sweep turns an answered turn into graph truth, a one-line rule per kind decides how to classify a span. Abstain rather than guess; speculative captures degrade graph signal and should route to an `elicitation_gap` instead.

| Kind | One-line classification rule |
| --- | --- |
| `goal` | "X so that Y" / "we want Y" — outcome, no implementation committed |
| `thesis` | "this is for X because…" — target user / problem theory / bet |
| `term` | "by X we mean…" — naming commitment |
| `context` | descriptive present-tense fact that does not commit the system |
| `story` | "this group of behavior is about…" — intra-spec cluster |
| `unknown` | "a known unknown is…" — can't answer now, must accommodate |
| `constraint` | "must not", "cannot", "out of scope", "only if" — bounds solution space |
| `assumption` | "we think", "probably", "if X is true" — material belief that could be wrong |
| `decision` | "we chose A over B because" — see decision-capture criteria |
| `requirement` | "the system shall" / "must do" — obligation |
| `invariant` | "always true", "never", "must remain" — preservation across states/transitions |
| `criterion` | "we'll know it works when", "tested by", "we'll review for" — oracle for a property |
| `example` | "for instance", "like when", "what about the case where" — concrete witness |

## Readiness bands replace phases

The old doc mapped capture to four **phases** (grounding / design / requirements review / criteria review). The current model derives a **readiness band** per kind (D64-L/D94-L via `bandsForKind`) over four bands — `grounding`, `elicitation`, `projection`, `commitment`. Bands guide questioning and projection; **they do not gate graph truth.** If the user states a later-band item early, capture it honestly with the right kind and basis.

| Band | What it gathers | Kinds (intent unless noted) |
| --- | --- | --- |
| `grounding` | the starting frame | `goal`, `thesis`, `context`, `constraint` |
| `elicitation` | the working middle | `context`, `story`, `unknown`, `assumption`, `constraint`, `invariant`, `decision` |
| `projection` | materialized structure | oracle + design plane kinds (`check`, `vv_method`, `evidence`, `vv_obligation`, `module`, `interface`, `entity`) |
| `commitment` | hardened obligations | `requirement`, `criterion`; plan plane (`milestone`, `frontier`, `slice`) |
| `—` (band-less) | always-available | `term`, `example`, `sketch` |

The conceptual shift the old doc anticipated holds: **hardening is requirements + invariants + criteria + examples**, with preservation claims and witness claims durable rather than conversational. Operationally, the runtime exposes only two modes (D98-L): **`SPEC`** runs the elicitor (the band ladder above); **`CODE`** runs the executor. The old per-phase "materialized at review acceptance" column is now the `basis` distinction (below) plus review-set acceptance.

## Edges: nine closed structural categories

The old doc proposed a **five-family relation taxonomy** with open named relations (`derived_from`, `motivated_by`, `rules_out`, `tested_by`, …). The current model (D51-L) is a **closed set of nine structural categories** with role-named endpoints and per-category policy. The named-relation dialects are retired as edge categories — do **not** use `derived_from`, `motivated_by`, `rules_out`, `counterexample_for`, or `tested_by` as categories. The category metadata is the source of truth ([`category-policy.ts`](../../../graph/policy/category-policy.ts)); reproduced for legibility:

| Category | Endpoint roles | Affected | Impact | Stance | Criteria help | Projection effect |
| --- | --- | --- | --- | --- | --- | --- |
| `dependency` | dependency → dependent | target | cascade | — | no | none |
| `witness` | oracle → claim | source | advisory | required | yes | none |
| `rationale` | support → claim | source | advisory | required | no | none |
| `realization` | abstract → concrete | target | advisory | — | no | none |
| `refinement` | abstract → concrete | target | advisory | — | no | none |
| `exclusion` | boundary → subject | target | advisory | — | no | none |
| `composition` | whole → part | source | advisory | — | no | none |
| `cross_reference` | peer → peer | — | none | — | no | none |
| `supersession` | successor → predecessor | source | advisory | — | no | hide_predecessor_from_active_context |

Stance (`for | against`) is **required** on `witness` and `rationale`, **invalid** everywhere else.

### Old families → current categories

| Old family (old relations) | Current category |
| --- | --- |
| Justification — `motivated_by`, `supports` | `rationale` (`stance: for`) |
| Justification — `derived_from` | `dependency` (reliance) or `refinement` (specialization), per intent |
| Dependency — `depends_on`, `assumes`, `requires` | `dependency` |
| Boundary — `constrains`, `excludes`, `rules_out`, `bounds_scope_of` | `exclusion` |
| Refinement — `refines`, `specializes` | `refinement` |
| Refinement — `decomposes` | `composition` |
| Verification — `verifies`, `illustrates`, `disambiguates`, `tested_by` | `witness` (`stance: for`) |
| Verification — `counterexample_for` | `witness` (`stance: against`) |
| (catch-all `related_to`) | `cross_reference` |
| (replacement lineage) | `supersession` |

### Negative knowledge is first-class

The old doc's most important insight — *intent is clarified by ruling out plausible interpretations* — survives, carried by stance and `exclusion` rather than by negative relation kinds:

```pseudo
counterexample / rejected interpretation:
  EX2: rejected review item appears in export
  witness  oracle: EX2  claim: INV4  stance: against

out-of-scope disambiguator:
  EX3: importing old local dev fixtures
  exclusion  boundary: CON2  subject: EX3
```

Prefer a concrete `example` plus `witness:against`, or an `exclusion` edge, over vague prose ("not that"). Contradiction between two accepted claims is **not** an edge: with the `conflict` edge deliberately deferred, a contradiction surfaces as a `reconciliation_need` of kind `semantic_conflict` (ONTOLOGY_REVIEW_PROTOCOL §8).

## Edge and node records: basis, not support/status

The old doc's `KnowledgeEdge` carried `support` (explicit / strong_inference / weak_candidate) and `status` (proposed / accepted / rejected / stale) plus `provenanceTurnId`. The current `GraphEdge` ([`edges.ts`](../../../graph/schema/edges.ts)) and `GraphNode` ([`nodes.ts`](../../../graph/schema/nodes.ts)) are leaner:

```ts
interface GraphEdge {
  category: EdgeCategory          // one of the nine
  sourceId, targetId: NodeId      // storage order carries NO impact meaning
  stance?: 'for' | 'against'      // required iff witness | rationale
  basis: 'explicit' | 'implicit'  // approval directness (D63-L)
  rationale?: string              // why the relation holds
  // + id, specId, createdAtLsn, updatedAtLsn
}

interface GraphNode {
  plane, kind, kindOrdinal        // kind drives behavior; code = label+ordinal (D62-L)
  title, body?
  basis: 'explicit' | 'implicit'
  source?: string                 // lightweight epistemic attribution text, not policy
  detail?: NodeDetail             // decision | term | claim-form union
  // + id, specId, createdAtLsn, updatedAtLsn
}
```

How the old fields map:

- **`support` → `basis`.** Approval *directness*, two values: `explicit` (user stated it or approved the exact item in a review set) vs `implicit` (user accepted a concept and the agent materialized the specific item without per-item review, D63-L). The old "weak_candidate" tier does **not** become graph truth at all — it routes to an `elicitation_gap` or a review-set draft.
- **`status` → absent.** Accepted nodes and edges are **present-or-absent** (no mutable `status`). `proposed` lives in review-set drafts; `rejected` is absence plus `change_log` audit; `stale` is a `reconciliation_need`, not a mutated field.
- **`provenanceTurnId` → retired.** `change_log` owns the full audit trail keyed by LSN (D55-L). Transcript-entry pointers are fragile under compaction.
- **`rationale` → kept** on edges; `source` on nodes carries free-form epistemic attribution ("stakeholder", "regulatory", "derived").

Do not re-introduce `support`, `status`, `provenanceTurnId`, `createdBy`, or per-claim `checkability`/`strength` fields.

## Node detail payloads

Two kinds carry required, non-form detail; four kinds carry the inert `detail.form` union (D88-L). Source of truth: [`nodes.ts`](../../../graph/schema/nodes.ts).

```ts
// required detail
decision: { chosen_option: string; rejected: string[] /* ≥1 */; rationale: string }
term:     { definition: string; aliases?: string[] }

// inert method payload (form-discriminated)
type ClaimForm =
  | { form: 'plain' }
  | { form: 'gherkin'; given?: string[]; when?: string[]; then: string[] /* ≥1 */ }
  | { form: 'formal';  language: string; statement: string }
  | { form: 'given';   statement: string }

requirement | criterion | invariant : form ∈ plain | gherkin | formal
context                              : form ∈ given
```

The closure rule (D87-L): a specification *method* — BDD, EDD, formal verification — earns no kind of its own. It maps onto the ontology as `spec.kind` + `detail.form` + a renderer + a heuristic-set. One shared `form` discriminant across kinds lets a lens query "all `formal`-form nodes in this spec" to round-trip a LEAN/Dafny file regardless of kind. Do **not** infer edge legality, readiness, or commitment strength from `detail.form` — it is structure plus a renderer hook only.

## Endpoint-relative labels and direction

The old doc's relation-policy registry called for storing `source_label` / `target_label` and `source_change` / `target_change` so a snapshot centered on either endpoint reads correctly and so directionality is never recovered from a verb name. The current model implements exactly this split across two projections that both read `category-policy.ts`:

- **`projection/labels.ts`** — anchor-relative phrasing. A two-tier table keyed on `(category, anchorRole, stance)` (≈18 base cells) plus a small tier-2 refinement keyed on `(category, sourceKind, targetKind)`. Renderers never leak the structural vocabulary.
- **`projection/direction.ts`** — upstream / downstream / lateral, read from the `affected` endpoint in the policy table, **not** from storage geometry. "Downstream" is the endpoint that needs reconciliation when the other changes.

Base anchor-relative labels (from [`labels.ts`](../../../graph/projection/labels.ts)):

| Category | Anchor = source | Anchor = target |
| --- | --- | --- |
| `dependency` | required by | depends on |
| `witness` | witnesses / refutes | witnessed by / challenged by |
| `rationale` | supports / argues against | motivated by / opposed by |
| `realization` | realized by | realizes |
| `refinement` | refined by | refines |
| `exclusion` | bounds | bounded by |
| `composition` | contains | part of |
| `supersession` | supersedes | superseded by |
| `cross_reference` | related to | related to |

Tier-2 refinements sharpen a few `realization` verbs by endpoint kind: requirement→module / interface→module render "implemented by" / "implements"; requirement→slice render "established by" / "establishes"; invariant→requirement render "expressed by" / "expresses".

The old doc's worry — "context packs and reconciliation never recover directionality from verb names alone" — is now an enforced invariant: directionality comes from `category` + `affected`, and labels are projections of `category` + `anchorRole` + `stance`.

## Edge-local neighborhoods are the useful context unit

The old doc's strongest practical recommendation — provide **edge-local neighborhoods**, not grouped item lists ("all goals, all requirements") — is the live rendering shape under `src/agents/contexts/graph/`. A neighborhood pack anchors on one node and groups incident edges by impact direction with policy-derived labels:

```text
anchor node
- REQ1: Stage 2 configuration-space requirement (hub anchor)

upstream nodes (3) — review anchor if these change
- depends on A1: Local-only execution assumption
- expresses INV1: No network call invariant
- bounded by CON1: No cloud dependencies constraint

downstream nodes (9) — reconcile these if anchor changes
- required by D1: Two-stage split decision {hard}
- implemented by MOD1: SQLite configuration store module
- established by S1: Persist configuration spaces slice
- witnessed by AC1: Airplane-mode acceptance criterion
- challenged by EX1: Network-outage counterexample
- motivated by CTX1: Stakeholder offline-first preference
- opposed by CTX2: Conflicting always-connected note
- part of F1: Configuration-space data frontier
- superseded by REQ2: Revised configuration-space requirement

lateral nodes (1) — cross-check with anchor if either changes
- related to G1: Offline-first product goal
```

The old doc's "dependencies / dependents / evidence / reconciliation / historical" neighborhood selectors map onto: `upstream` (premises the anchor relies on), `downstream` (impact if the anchor changes), `lateral` (`cross_reference` peers), the `criteriaHelpSignal` axis (evidence selection via `witness` edges), and `reconciliation_need` records (the reconciliation selector). The **historical** selector remains as the old doc left it — changeset-derived, not approximated from current graph order — and is not faked before a changeset ledger exists.

## Topology-driven question ranking

Once the graph carries kinds and typed edges, the interviewer ranks the next question by topology rather than template. These are ranking heuristics, not automatic writes; low-confidence material routes to an `elicitation_gap`, never to a speculative node. They complement the behavioral-kernel signal-phrase routing in [`BEHAVIORAL_KERNELS.md`](../../../../docs/design/BEHAVIORAL_KERNELS.md): kernels suggest *what kind* of question to ask; topology heuristics suggest *which item* to ask about next.

| Signal | Suggested question shape |
| --- | --- |
| High-fanout `assumption` with thin evidence | "Many claims depend on X. Validate it, or mark the risk?" |
| `requirement` / `invariant` with no `witness` path | "How will we know this holds?" |
| `criterion` not linked to the claim it judges | "Which requirement or invariant does this criterion check?" |
| Candidate `decision` lacking rejected alternatives or rationale | "What did we consider and rule out before choosing this?" |
| `exclusion`/constraints disagreeing about one subject | "These boundaries conflict. Which one wins?" |
| `goal`/`thesis` with no path into requirements, design, or plan | "What would satisfy this in the actual system?" |
| Requirement with no example and high ambiguity | "What concrete case would settle this interpretation?" |
| `unknown` blocking a design or plan edge | "Accommodate it, investigate it, or narrow scope around it?" |

This substrate is the `elicitation_gaps` register (D65-L): a flat table of prospective coverage obligations, each with a `predicate` (`presence` is structurally derivable; `field` and `coverage` are not yet supported; `manual` rides disposition), a `band`, an `importance`, and a `disposition` (`open` / `answered` / `not_applicable` / `irrelevant` / `reopened`). Structural coverage is derived from the graph at read time, not stored.

## Translation table — user phrases to kinds

The bridge between user vocabulary and the ontology. Treat these as **strong priors**, not rigid rules; the classification rule still governs the final assignment.

| User phrase pattern | Most likely route |
| --- | --- |
| "we want Y" / "X so that Y" | `goal` |
| "this is for X because…" | `thesis` |
| "by X we mean…" | `term` |
| "true about the environment / repo / domain…" | `context` (unless promotable) |
| "a known unknown is…" | `unknown` |
| "always true that…" / "should never…" / "must remain" | `invariant` |
| "valid transition from X to Y" | `invariant` (a transition-flavored one) |
| "must not" / "cannot" / "out of scope" / "we don't care about X" | `constraint` (with an `exclusion` edge for non-goals) |
| "probably" / "we think" / "if X is true" | `assumption` |
| "the system must…" | `requirement` |
| "we picked Y over Z because…" | `decision` |
| "we'll know it works when…" / "tested by" | `criterion` or an oracle-plane node |
| "for example, when…" | `example` (link `witness:for`) |
| "but what about the case where…" | `example` (edge case) |
| "we wouldn't want…" / counterexample | `example` + `witness:against`, or `constraint` |
| "another plausible interpretation is…" | `example` (a disambiguating one) |
| "module" / "API" / "entity" / "sketch" | design-plane kind |
| "test" / "proof" / "evidence" / "verification method" | oracle-plane kind |
| "milestone" / "frontier" / "slice" | plan-plane kind |

## Progressive checkability is conduct, not schema

The old doc proposed a stored `checkability` ladder and a `ClaimMetadata` record (`checkability`, `oracle`, `strength`, `validTraces`, `invalidTraces`). FE-1090 **rejected these as carrying cost**: claim-level `checkability` / `strength` / trace-list fields are not added to the schema. The *discipline* survives as **oracle conduct**, currently quarantined in the retired proposal resource at [`generate-proposal/references/oracle.md`](../../skills/_suspended/methods/generate-proposal/references/oracle.md).

The ladder is a reasoning tool, weakest sufficient artifact first:

```
human review  →  example / counterexample  →  regression / golden
              →  runtime contract  →  property / model-based rule
              →  probe / transcript  →  proof obligation
```

Emit the **weakest sufficient** artifact for the claim at hand, and express it as existing graph vocabulary (`criterion`, `check`, `vv_method`, `evidence`, `vv_obligation`, `example`, `witness` edges). The old `strength` field's honesty function ("checked on three examples" ≠ "proved for all reachable states") is preserved as a **prose disclosure** of evidence breadth and blind spots in the oracle ensemble, not as graph metadata. If a future scoped reader proves it needs evidence breadth as schema, that is a fresh decision — it is not assumed here.

## Consumers of the typed graph

What reads this ontology today, and which part each consumer leans on:

| Consumer | Leans on |
| --- | --- |
| Capture sweep (`methods/capture`) | kinds, promotion rules, `basis`, capture routes (graph truth vs gap vs reconciliation need) |
| Commit-graph (`methods/commit-graph`) | edge categories, role-named `mutate_graph` grammar, stance legality |
| Generate-proposal (`methods/generate-proposal`) | per-plane fan-out (intent / design / oracle), review-set fan-in; oracle conduct ladder |
| Review-for-gaps (`methods/review-for-gaps`) | `elicitation_gaps` predicates, topology question ranking |
| Reconciliation flow | `affected` endpoint + impact direction; `reconciliation_need` (incl. `semantic_conflict`) |
| Neighborhood / overview rendering (`contexts/graph/`) | anchor-relative labels, upstream/downstream/lateral, edge-local packs |
| Spec / plan document outputs (`contexts/spec/`, `contexts/plan/`) | kinds, bands, codes |
| Export grounding | neighborhood traversal to explain why each requirement is present |

## What this draft deliberately does not do

- It does not re-propose kind subtypes, a `conflict` edge, an `epistemic_status` field, `actor` / `scenario` kinds, the speculation/`bench` plane, or a project graph — all deferred or rejected (ONTOLOGY_REVIEW_PROTOCOL §8, FE-1090). Where the original doc leaned on them, the mapping above shows the current carrier.
- It does not add `checkability` / `strength` / `validTraces` / `invalidTraces` to any record.
- It is not wired into runtime payload and claims no skill reader. Promoting any section into `src/agents/contexts/references/` (with a named skill reader, per D97-L) would be a separate, deliberate decision.
