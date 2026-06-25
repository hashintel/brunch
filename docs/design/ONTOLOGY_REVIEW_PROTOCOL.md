# Ontology Review Protocol

Audit of an external GPT-Pro thread on the Brunch graph ontology, **plus the
design grill that resolved it**, prepared so the result can be spec'd, planned,
and scoped directly. It records what was discussed and argued (§1–5, historical
thread audit) and — authoritatively — **what was resolved** (§6–9), read against
the *current* ontology as it stands in code (`src/graph/schema/`,
`src/graph/policy/`) and `memory/SPEC.md`.

- **Source thread:** `~/Downloads/brunch-ontology-review-RECONSTRUCTED.md`
  (ChatGPT export, 2026-06-23; 9 turns).
- **Status (updated 2026-06-24): CONSUMED — historical rationale companion, no
  longer a pending proposal.** The resolved scope (§6–9) was propagated into
  `memory/SPEC.md` as **D87-L** (closure rule + node/edge deltas), **D88-L**
  (`detail.form` method payload), and **D89-L** (`spec.kind` ownership), and
  implemented in the **FE-1052** frontier (schema enums changed;
  `GRAPH_MODEL.md` retired). SPEC D87-L links here as the worked-validation
  record (Gherkin §6.8, formal-verification routing §6.6), so this doc is kept
  in place — but read §0/§2–3/§9 as **historical**, not current.
  - **One reversal to note:** the §6.2 `thesis → claim` rename did **not** land.
    D87-L keeps `thesis` (with `claim` as the D61-L umbrella for truth-bearing
    nodes); only `thesis`'s definition sharpened. Treat every `thesis → claim`
    line below as superseded.
  - **§0 baseline is stale by construction:** it lists the *pre*-FE-1052 kind
    set. The live kind set is `src/graph/schema/kinds.ts`.
- **Motivating goal.** The main elicitation flow — general capture of software
  specifications — is the present necessity this ontology serves. Additional
  specification *styles/methods* (BDD, EDD, formal-spec / formal-verification)
  are to be supported *on the same ontology*. The grill established the
  governing result: **these methods are validation lenses, not sources of new
  kinds.** Their vocabularies are subsets of our ontology, so a method maps as
  `spec.kind` + a `detail.form` payload + a renderer + a heuristic-set — never
  as its own node/edge kind. A method term that cannot map is a finding about
  *our* model, not a licence to add a kind.

---

## 0. Current ontology baseline (fixed reference)

So that the interrogation works against a fixed point, here is what exists
*today* (`src/graph/schema/kinds.ts`, `src/graph/schema/nodes.ts`,
`src/graph/policy/category-policy.ts`). The thread used an
**aspirational** node/edge table that already bakes in several proposed renames
(`claim`, `vv_method`, `entity`, `sketch`, `exclusion`, `conflict`, etc.). Those
are *not* in code. The thread's tables are proposals, not the baseline.

**Node kinds (20 total)** — labels are the actual `NODE_KIND_METADATA` codes:

- **intent (11):** `goal` G, `thesis` TH, `term` T, `context` CTX,
  `requirement` REQ, `assumption` A, `constraint` CON, `invariant` INV,
  `decision` D, `criterion` AC, `example` EX
- **oracle (4):** `check` CH, `validation_method` VV, `evidence` E,
  `obligation` O
- **design (2):** `module` MOD, `interface` API
- **plan (3):** `milestone` M, `frontier` F, `slice` S

**Edge categories (8):** `dependency`, `proof`, `support`, `realization`,
`boundary`, `composition`, `association`, `supersession`. `stance` (`for` /
`against`) is required iff category ∈ {`proof`, `support`}.

**Already-settled invariants the thread is partly unaware of:**

- Edges store `sourceId`/`targetId` with **role-named endpoints per category**
  (`dependency→dependent`, `oracle→claim`, `whole→part`, …). The agent-facing
  command surface is already role-named (`linkDependency`, `linkRealization`,
  …) and `mutateGraph` uses role-named edge ops — exactly the
  discriminated-union shape the user describes in turn 6.
- **Impact is already decoupled from source→target geometry.** The
  per-category policy table carries explicit *impact-on-source-change* /
  *impact-on-target-change* columns; for `proof`/`support`/`composition`/
  `supersession` the *target* is the upstream end. Directional projection
  (`upstream`/`downstream`/`lateral`, `hard`/`soft`) is derived from those
  columns, never from the arrow or the verb. Tuple-label lookup renders verbs
  from either endpoint.
- **Structured `detail` exists today only for `decision` and `term`**
  (`NodeDetail = DecisionDetail | TermDetail`); every other kind carries
  `detail` null. Extending a `form`-discriminated `detail` to the claim kinds
  is therefore new surface (see §6.4).
- `framing_as` is **retired**, absorbed by `thesis`/`term`/`constraint`/`goal`.
- Interrogatives never enter the graph; there is **no `question` kind**.
  "Open questions" live in the separate `elicitation_gaps` table.
- A durable `risk` / `unknown` node is **deferred but already named** in SPEC
  (Future Direction §Vocabulary evolution; Lexicon "Risk").

This baseline matters because the thread's single most important conclusion
(roles + impact-topology, not verb direction) is a position the codebase
**already implements**. Much of the thread is therefore *validation* of
existing bets rather than net-new direction.

---

## 1. The arc of the conversation

1. **Edge-kind critique** (turns 1–2): weakest edges, edges to add.
2. **Node-kind critique** (turns 2–3): weakest nodes, renames, additions; user
   pushes back with context (frontier, the "unknown" gap, scenario-vs-example).
3. **Full adjacency projection** (turn 4): a typed grammar of which edges
   connect which nodes, with directional verbs and verb-normalization.
4. **The central architectural argument** (turns 5–8): is "semantic direction"
   a real thing? Should `head`/`tail` storage encode impact propagation? The
   user pushes hard; GPT concedes its standard answer.
5. **The workbench gap** (turn 9): specs have no home for speculation,
   research, design-docs, sketches → propose a non-canonical workbench plane.

---

## 2. Edge-layer protocol (thread snapshot)

> **Historical.** The `Open?` column records the *thread's* state; §6 holds the
> resolved positions that supersede it.

| # | Item | GPT argued | User position | Effective decision | Current code | Open? |
|---|------|-----------|---------------|--------------------|--------------|-------|
| E1 | `association` weakest | Demote/rename to `cross_reference`; never activate; cold edge | (not contested) | Keep concept, treat as cold/last-resort | `association` kept, symmetric, "last resort", impact `none` | **Closed-ish** — name differs, behavior matches |
| E2 | `support` overloaded | Rename → `rationale`; make non-evidential; reserve `proof`/`evidence` for truth | (not contested directly) | Tension noted, not resolved | `support` kept **with `for`/`against` stance** | **Open** — see §6 |
| E3 | `boundary` overloaded | Split → `constrains` / `excludes` / `applies_under` | Later folded `exclusion` into the turn-4 table | Maybe split `exclusion` out | Single `boundary` (covers scope/constraint/exclusion) | **Open** |
| E4 | Add `conflict` | "Most important missing edge"; surfaces contradiction; blocks silent acceptance | (accepted into turn-4 table) | Add `conflict` (symmetric, severity-tagged) | **Absent.** Contradiction lives in `reconciliation_need` (`semantic_conflict`) | **Open** — node-edge vs recon-need tension |
| E5 | Add `refinement` | general→specific elaboration, distinct from `realization` | (accepted into turn-4 table) | Add `refinement` | **Absent.** Currently folded into `realization`/`composition` | **Open** |
| E6 | `proof` → `evidence` | Rename if not truly formal; keep `proof_strength` | (kept "proof"/"evidence" split in table) | Keep `proof`; possibly `evidence` | `proof` category + `evidence` node both exist | **Mostly closed** |
| E7 | Add `participation` | `actor`-centric edge; current edges under-serve actors | raised the gap; no commitment | Add iff `actor` lands | **Absent** | **Open, gated on `actor`** |
| E8 | Add `coverage` | plan→intent; avoids overloading `boundary`; the cleanest case where impact ≠ semantic phrasing | used as the worked example in the impact debate | Add iff plan nodes become central | **Absent.** Plan→artifact currently via `realization`/`composition`/`boundary` | **Open** |
| E9 | Add `provenance`/`extraction` | workbench source → derived node; distinct from `rationale` | (accepted in workbench section) | Add iff workbench plane lands | **Absent** | **Open, gated on workbench** |

**Verb normalization (turn 4):** GPT's lasting point is *store one direction,
render verbs from either end*, and several proposed verbs were inverse to the
declared roles. **This is already how the codebase works** (`edgeLabel()`
two-tier tuple-label lookup). Settled.

---

## 3. Node-layer protocol (thread snapshot)

> **Historical.** The `Open?` column records the *thread's* state; §6 holds the
> resolved positions that supersede it.

| # | Item | GPT argued | User position | Effective decision | Current code | Open? |
|---|------|-----------|---------------|--------------------|--------------|-------|
| N1 | `frontier` weakest overall | Replace with `open_question`/`gap`/`issue`/`risk` | **Defended:** plan-plane mid-level between milestone/slice; composes/decomposes; could be `epic` | **Keep `frontier`** | `frontier` kept (plan plane) | **Closed** |
| N2 | `thesis` → `claim` | `claim` is operationally sharper (testable/refutable/refinable) | **Agreed it is sharper** | Lean toward `claim`, not committed | `thesis` kept; carries "what/who/why" grounding | **Open (leaning rename)** |
| N3 | `context` too broad | Keep but subtype or enforce a usefulness test | **Agreed**, already uses promotion heuristics | Keep `context` + heuristics | `context` kept + promotion heuristic table | **Closed** |
| N4 | `criterion` ambiguous | Rename → `acceptance_criterion` | **Agreed**: rename *or* strong guidance | Keep `criterion`, guide it | `criterion` (label `AC`) + modality guidance ("how will we judge it holds") | **Closed (guidance; code already labels it AC)** |
| N5 | `obligation` too broad | Rename → `verification_obligation`/`proof_obligation` | (not contested) | Possibly rename | `obligation` (O) kept | **Open (minor)** |
| N6 | Add `actor` | "Biggest missing intent node"; grounds vague requirements | (not contested) | Strong candidate | **Absent** | **Open** |
| N7 | Add `scenario` (vs replace `example`) | **Do not replace `example`** — different jobs (pattern vs instance); add `scenario` only if workflows are first-class | asked the replace question | Keep `example`; add `scenario` conditionally | `example` kept; no `scenario` | **Open (conditional)** |
| N8 | Model the "unknown" | Not an open question — an *epistemic boundary*. Model as gap status `accepted_unknown` first; optionally a projected `unknown` node | **Raised the gap**: distinct from elicitation-gap and from assumption | Represent unknowns explicitly; node form deferred | **Absent as node;** SPEC defers `risk`/`unknown` node (closely matches) | **Open — overlaps SPEC `risk`** |
| N9 | Design plane too structural | Add `entity` (data_entity); later `operation`/`state`/`event` | (took `entity`, `sketch` into table) | Add `entity`/`sketch` if needed | only `module`, `interface` | **Open** |

---

## 4. The central architectural argument (turns 5–8)

This is the spine of the thread and the part most worth carrying into the
interrogation. **Resolved disposition: parked for the design interrogation**
(§8) — the storage-naming choice is an internal concern, not part of the
kind-set narrowing.

**The question.** Should downstream-impact be encoded in `head`/`tail` storage
direction?

**GPT's reflexive answer (turns 5–6, the "standard" reply it admits it always
gives):** No — keep `tail`/`head` as *semantic* roles; derive a separate
*impact graph*; never let storage direction carry impact. It offered a layered
model: `SemanticEdge` (role-named) → derived `ImpactArc[]` (hard/soft/none,
target node|edge|active_context).

**The user's rebuttal (turns 6–7) — the decisive move:**

- The agent never sees `head`/`tail`; it writes through a **discriminated-union,
  role-named mutation API** (`{kind:"realization"; abstraction; implementation}`).
- The reader is a tool that already groups **upstream / downstream / lateral**
  with direction-appropriate labels.
- Therefore "semantic direction" is a *false signal*: every relation is
  phrasable both ways and needs two labels anyway; verb-implied direction
  "identifies roles but provides no consistent information about the roles."
  Encoding `head`/`tail` by verb grammar is a **wasted modelling opportunity**;
  the only operationally meaningful direction is impact propagation.

**GPT's concession (turns 7–8):** Agreed. "There are semantic roles, not
semantic direction." Final position:

```
LLM writes semantic roles.
System compiles roles → impact arcs (hard/soft/none, node|edge|active_context).
Reading tool shows upstream/downstream/lateral with endpoint labels.
Reconciliation traverses impact arcs, not edge grammar.
```

It recommended, if `head`/`tail` ever mean impact, **renaming** them
(`impact_source`/`impact_target` or `from`/`to`) so future code is not tempted
to read them as grammatical/graph-theoretic direction.

**Status against current code:** **largely already true.** The codebase stores
role-named endpoints, decouples impact from geometry in the policy table, and
derives `upstream/downstream/lateral` + `hard/soft` from impact columns. The
one residual: the storage columns are literally named `sourceId`/`targetId`
and impact is *not* aligned to them — which is the exact ambiguity GPT warns
about. The open question for the interrogation is whether to (a) keep
`source/target` as pure semantic-role geometry with impact fully in the policy
table (current), (b) rename to impact-oriented columns, or (c) adopt the
two-table `SemanticEdge` + `ImpactArc[]` split (needed only if a single edge
must emit *multiple* impact arcs — e.g. edge-targeted reverse staleness, which
current policy does not model).

**Decided in-thread:** verb/semantic direction is not the carrier; roles +
explicit impact topology is. **Parked:** column naming, and whether multi-arc
edges justify the two-table split.

---

## 5. The workbench gap (turn 9)

Informs the **deferred** speculation plane (§8).

**Problem (user):** a crisp spec graph has nowhere for ongoing speculation,
research, design-docs, implementation-sketches, investigation trails to live.
Forcing them into the canonical planes causes **premature formalization** or
**graph pollution**.

**GPT's proposal:** a non-canonical **`workbench` plane**, distinct from the
canonical spec graph and from an archive:

- nodes: `memo` MEM, `proposal` PROP, `spike` SPK, `sketch` SKT, optional
  `hypothesis` HYP (or `claim` with `status: speculative`).
- one new edge: `provenance` (source artifact → derived node/edge; soft).
- lifecycle status (`scratch…promoted/rejected/archived`) + epistemic status
  (`speculative…accepted_for_now/abandoned`).
- soft-by-default impact so workbench churn never hard-invalidates canonical
  nodes.
- a **promotion flow**: `capture → structure → extract → review → promote →
  archive/source-link`, i.e. a PR-for-specs, with "candidate graph changes"
  blocks in workbench docs.

**Status against current code / SPEC:**

- **Terminology collision — flag loudly.** "Workbench" in Brunch *already
  means something else*: a launchable fixtures workspace under
  `.fixtures/workbenches/` (Lexicon "Workbench", D71-L). GPT's "workbench
  plane" is an unrelated ontology concept. A non-colliding name must be picked
  (the grill used the placeholder `bench`; candidate / inquiry / scratchpad
  also in play).
- SPEC already has the adjacent seam: **Candidate artefacts** (pre-graph,
  agent-proposed, awaiting adjudication) are *deferred*, and the commitment
  gradient (D81-L) deliberately keeps low-confidence "noticings" **out** of
  graph truth by spawning elicitation gaps instead. GPT's proposal is
  essentially "promote the candidate-artefact seam to a typed plane."
- `provenance` as an *edge* partly conflicts with the existing posture that
  **`change_log` owns provenance/audit** and node `provenance` was retired.
  GPT's `provenance` is artifact→derived-claim lineage, which is a *different*
  relation than audit — but the naming will confuse.

---

## 6. Resolved scope (authoritative)

Output of the thread **and** the design grill. Supersedes the thread-snapshot
dispositions in §2–3 wherever they differ. The deltas here are deliberately
small: the multi-method goal is satisfied by the **closure rule** (§6.1), not by
growing the kind set.

### 6.1 The closure rule — methods are validation lenses, not kinds

A specification method (BDD, EDD, formal verification) does **not** earn its own
node or edge kinds. It maps onto the existing ontology as:

```
method  =  spec.kind            (ownership/scope of the spec; §6.5)
        +  detail.form          (method-specific structured payload; §6.4)
        +  a renderer           (round-trips the graph to/from the method's text)
        +  a heuristic-set      (routing/elicitation guidance; §7)
```

A method term with no clean mapping is a **finding about our model**, not a
reason to add a kind. (Worked validations: BDD §6.8; formal verification §6.6.)

### 6.2 Node deltas

| change | kind | label | plane / band | note |
| --- | --- | --- | --- | --- |
| rename | `thesis` → `claim` | CL | intent / grounding | sharper: testable/refutable bet |
| rename | `validation_method` → `vv_method` | VV | oracle | verification *method* (prover/solver/test) |
| rename | `obligation` → `vv_obligation` | O | oracle | proof/verification obligation |
| recode | `criterion` | AC | intent / commitment | **already `AC` in code** — confirm, no change |
| add | `unknown` | UNK | intent | known-unknown; triad cousin of context/assumption (§6.6) |
| add | `entity` | ENT | design | data entity |
| add | `sketch` | SKT | design | design sketch |
| add | `story` | (TBD, e.g. ST) | intent / elicitation | intra-spec mid-level grouping (§6.5) |

**Not a node:** `feature` — it is `spec.kind` (§6.5), not a node kind. The
recurring "feature" intuition was spec-scope leaking into the node taxonomy.
`actor` and `scenario` are **deferred** (§8).

### 6.3 Edge deltas

| change | category | endpoints (role-named) | stance |
| --- | --- | --- | --- |
| rename | `proof` → `witness` | oracle/evidence → claim/check | **keep `for`/`against`** |
| rename | `support` → `rationale` | reasoning → claim | **keep `for`/`against`** |
| rename | `boundary` → `exclusion` | boundary → subject | — |
| rename | `association` → `cross_reference` | peer ↔ peer | — |
| add | `refinement` | generality → specificity | — |

`refinement`'s present reader is **formal refinement** (abstract model ⊑
concrete implementation), distinct from `realization`. `coverage`, `conflict`,
`participation` are **deferred** (§8). `story` adds **no** edge — it reuses
`composition` (story → requirement) and `witness` (criterion → requirement).

### 6.4 The `detail.form` mechanism (method payload)

Extend the existing closed `detail` pattern (today `decision`/`term` only) to
the **claim kinds** — `requirement`, `criterion`, `invariant` — with a shared,
`form`-discriminated union:

```ts
type ClaimForm =
  | { form: "plain" }
  | { form: "gherkin"; /* rule | given/when/then payload */ … }
  | { form: "formal";  /* statement, … (LEAN/Dafny round-trip) */ … }
  | { form: "given";   /* see §6.6 — axiom payload on a context node */ … };
```

Invariants:

- **`kind` drives behavior; `form` is inert payload.** Readiness band, edge
  legality, and the elicitor's source-question all key off `kind`, never
  `detail.form`. `form` adds structure + a renderer hook only.
- **One shared discriminant vocabulary across the kinds**, so a lens can query
  "all `formal`-form nodes in this spec" to render/round-trip a LEAN file
  regardless of kind.
- **`form` defaults from the active elicitation lens / `spec.kind`**,
  overridable per-node (a `function`-kind spec defaults claims to `formal`).
- `// ceiling:` method structure carried as `detail.form`, not per-method node
  kinds; promote a form to its own kind only if banding/edge-role feedback
  demands it.

### 6.5 Spec scope model (containing data model)

`feature`/`story`/scope resolve **outside** the node graph, in the record that
contains one spec's graph.

- **`spec.kind = product | feature | function`** — an *ownership relation to the
  codebase*, not a size:
  - `product` — the spec owns the whole codebase.
  - `feature` — the spec owns a part **and a cycle** within an existing
    (brownfield) codebase.
  - `function` / `library` — the spec exists to capture (often formal)
    verification around a focused area of code.
- **`story` node (§6.2)** — the intra-spec mid-level grouping (Gherkin `Feature`
  when expressed inside one spec). Intent plane, `elicitation` band.
- **Hybrid (A)+(B), both supported:** (A) intra-spec grouping via `story`; and
  (B) inter-spec links via a **project graph** (specs-as-nodes, edge vocabulary
  reused; `role: main | alt` marks the root). The project graph + `role` are
  **deferred** (§8) — no present single-spec reader, and a stored root flag is
  likely derivable from composition.
- **`readiness_band` on a spec is computed**, not stored — a rollup of node
  bands.
- **Gherkin-`Feature` duality is incidental:** it may be a `kind: feature` spec
  *or* a `story` node; same concept at two granularities. Disambiguation only —
  not a smell.

### 6.6 Epistemic triad + given/theorem routing

**Context / Assumption / Unknown** form an **informal epistemic-certainty
triad** — a *routing heuristic*, **not** a structural axis (we are **not**
promoting an `epistemic_status` field now; OQ#12 stays deferred):

- `context` — known / stipulated true.
- `assumption` — believed but **deferred-falsifiable** ("what might be false").
- `unknown` — known-unknown.

Routing:

- **axiom / given → `context` + `detail.form:"given"`** (known *and*
  load-bearing). Load-bearing-ness comes from the **edges** (a `context` node
  with outgoing `dependency` edges), not from the kind. `// ceiling:` promote to
  a dedicated `given` kind only if the stipulated-vs-ambient distinction turns
  out load-bearing for LEAN/Dafny users.
- **theorem / property → `invariant`** (preservation claim that carries
  `witness` edges). Keeping theorems as `invariant` also avoids colliding with
  the renamed `claim` (the formal word for a theorem).
- **contracts:** precondition → `constraint`; postcondition → `criterion` /
  `invariant`; both hung on an `interface` node. **No `contract` kind.**

### 6.7 `witness` / `evidence` naming + stance

- The *edge* `proof` becomes **`witness`**; the *node* `evidence` is
  **unchanged**. (Renaming the edge to `evidence` would collide with the node;
  the relation reads as a verb — `X witnesses claim Y`, rendered
  `proves`/`refutes`/`falsifies` — and the node stays the natural noun.)
- **Stance `for`/`against` is preserved** on `witness` and `rationale` — i.e.
  *no behavioral change from current code*. A counterexample is
  `witness:against`; `rationale` may still be `against`. Only the
  proof/rationale **name** boundary carries the witness=evidential vs
  rationale=motivational separation.

### 6.8 Gherkin → ontology (worked BDD validation)

| Gherkin | Ontology | Note |
| --- | --- | --- |
| `Feature` | `story` node, or a `kind: feature` spec | §6.5 duality |
| `Rule` | `requirement` (REQ) | 1 REQ → many AC |
| `Example` / `Scenario` (G/W/T block) | `criterion` (AC) | `witness(criterion → requirement)` |
| `Given` | `context` (or `assumption`) | precondition |
| `When` | *internal to the criterion* | no `action`/`event` kind for BDD |
| `Then` | `criterion` (stated) + `check` (step-def) | `realization(criterion → check)` |
| `Background` | shared `context` | grouping |
| `Scenario Outline` + `Examples` rows | `example` (EX) instances | attach via `witness:±` |
| `Tags` / `Doc String` / `Data Table` | attributes / payload | not kinds |
| counterexample | `example` + `witness:against` | stance earns its keep |

---

## 7. Heuristics surfaced (for the heuristics SoT follow-on)

Heuristics are the **method-differentiation layer** (§6.1), not ancillary. They
are currently scattered (the kind-discrimination rules in
`src/.pi/skills/methods/commit-graph/SKILL.md`, `ELICITATION_QUESTIONS.md`,
`ELICITATION_LENSES.md`, this doc); collating them into one inlinable source is a
named follow-on (§9).

```
routing:
  - axiom / given        → context + form:"given"   (known + load-bearing)
  - deferred-falsifiable → assumption                (might-be-false + depended-on)
  - known-gap            → unknown                   (known-unknown)
  - theorem / property   → invariant                 (preservation claim + witness edges)
  - load-bearing-ness    ← comes from EDGES (dependency vs support), not kind

method-as-lens (the closure rule):
  - a method = spec.kind + detail.form + renderer + heuristic-set
  - no method earns its own node/edge kind
  - a residual that cannot map = a finding about OUR model, not a new kind

gherkin → ontology:
  Feature→story | Rule→requirement | Example/GWT→criterion | Given→context
  Then-impl→check | witness(criterion→requirement,±) | counterexample→example+witness:against
```

---

## 8. Deferred, conditional, parked

**Deferred (named, not now):**

- Nodes: `actor`, `scenario` (intent).
- Edges: `conflict`, `participation`, `coverage`.
- Planes/graphs: the **speculation plane** (`bench`: MEM/HYP/IMP + promotion
  flow, §5); the **project graph** (specs-as-nodes) + `role: main | alt` (§6.5).

Consequence: with `conflict` deferred, **contradiction stays in
`reconciliation_need.semantic_conflict`** — no authored conflict edge for now.
`participation` follows `actor` out (it was gated on it). `coverage` is deferred
for lack of a present main-flow reader: every method audited routed around it,
and plan→intent links are derivable from `realization`/`composition`; re-open
only when a read needs a *traversable* plan→intent edge.

**Conditional:**

- **`commit` plane.** Introduce **only if** it earns its keep by disambiguating
  *commitments* (`requirement`) and *projections* (`criterion`/AC) from
  `intent`. Decision test: does real query/projection code need the plane
  boundary, or does the kind alone suffice? Checkable against actual read paths.

**Parked for the design interrogation:**

- The `source`/`target` vs `head`/`tail` storage naming and directional-impact
  encoding question (§4) — an internal-storage concern, not part of this
  kind-set narrowing.

**Ceilings (declared simplifications):**

- Method structure rides `detail.form`, not per-method kinds (§6.4).
- Formal givens ride `context` + `form:"given"`, not a `given` kind (§6.6).

---

## 9. Net delta + follow-ons

**Edges: 8 → 9** (`dependency`, `witness`, `rationale`, `realization`,
`refinement`, `exclusion`, `composition`, `cross_reference`, `supersession`) —
four renames plus `refinement`.

**Nodes:** +`unknown`, +`entity`, +`sketch`, +`story`; `thesis`→`claim`;
`validation_method`→`vv_method`; `obligation`→`vv_obligation`; `criterion`
confirmed at label `AC` (already current). `feature` dropped — it is
`spec.kind`.

**Containing model:** `spec.kind = product|feature|function`;
`role: main|alt` (deferred); `readiness_band` computed.

**New non-kind surface:** the `form`-discriminated `detail` union on
`requirement`/`criterion`/`invariant` (§6.4).

The kind-set reopening is small *because* the closure rule (§6.1) absorbs all
three target methods into `spec.kind` + `detail.form` + renderer + heuristics
rather than into new kinds.

**Follow-ons:**

1. **Heuristics SoT** — collate the scattered routing/elicitation heuristics
   (§7) into one inlinable source of truth for skills.
2. **`ln-spec`** — propagate this resolved scope, the deferrals, and the
   ceilings into `memory/SPEC.md` (the canonical home);
   only then does this artifact's content become SPEC truth.
