# Ontology Review Protocol

Audit of an external GPT-Pro thread on the Brunch graph ontology, prepared as a
pre-cursor to a deeper design interrogation. It records **what was discussed,
what was argued (and by whom), what was effectively decided, and what remains
open** — read against the *current* ontology as it actually stands in code and
in [`GRAPH_MODEL.md`](GRAPH_MODEL.md).

- **Source thread:** `~/Downloads/brunch-ontology-review-RECONSTRUCTED.md`
  (ChatGPT export, 2026-06-23; 9 turns).
- **Status:** working artifact, not canonical. Nothing here is a SPEC decision.
  Its job is to give the design interrogation a fixed map so we are not
  re-deriving the same arguments.
- **Motivating goal (new):** the ontology must be flexible enough to host
  multiple specification *styles/methods* — BDD, EDD, and formal-spec /
  formal-verification flows — and that flexibility is cheapest to establish
  *now*, before the cost of an ontology change rises. This goal is the lens
  against which each proposal below should ultimately be judged; it was **not**
  the frame of the GPT thread, so I flag method-fit separately under §My
  assessment.

---

## 0. Current ontology baseline (fixed reference)

So the interrogation argues against a fixed point, here is what exists *today*
(`src/graph/schema/kinds.ts`, `src/graph/policy/category-policy.ts`,
`GRAPH_MODEL.md`). The thread used an **aspirational** node/edge table that
already bakes in several proposed renames (`claim`, `vv_method`, `entity`,
`sketch`, `exclusion`, `conflict`, etc.). Those are *not* in code. The thread's
tables are proposals, not the baseline.

**Node kinds (20 total):**

- **intent (11):** `goal` G, `thesis` TH, `term` T, `context` CTX,
  `requirement` R, `assumption` A, `constraint` CON, `invariant` I,
  `decision` D, `criterion` CR, `example` EX
- **oracle (4):** `check` CH, `validation_method` VM, `evidence` EV,
  `obligation` OB
- **design (2):** `module` M, `interface` IF
- **plan (3):** `milestone` MS, `frontier` FR, `slice` SL

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

## 2. Edge-layer protocol

| # | Item | GPT argued | User position | Effective decision | Current code | Open? |
|---|------|-----------|---------------|--------------------|--------------|-------|
| E1 | `association` weakest | Demote/rename to `cross_reference`; never activate; cold edge | (not contested) | Keep concept, treat as cold/last-resort | `association` kept, symmetric, "last resort", impact `none` | **Closed-ish** — name differs, behavior matches |
| E2 | `support` overloaded | Rename → `rationale`; make non-evidential; reserve `proof`/`evidence` for truth | (not contested directly) | Tension noted, not resolved | `support` kept **with `for`/`against` stance** | **Open** — see §My assessment |
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

## 3. Node-layer protocol

| # | Item | GPT argued | User position | Effective decision | Current code | Open? |
|---|------|-----------|---------------|--------------------|--------------|-------|
| N1 | `frontier` weakest overall | Replace with `open_question`/`gap`/`issue`/`risk` | **Defended:** plan-plane mid-level between milestone/slice; composes/decomposes; could be `epic` | **Keep `frontier`** | `frontier` kept (plan plane) | **Closed** |
| N2 | `thesis` → `claim` | `claim` is operationally sharper (testable/refutable/refinable) | **Agreed it is sharper** | Lean toward `claim`, not committed | `thesis` kept; carries "what/who/why" grounding | **Open (leaning rename)** |
| N3 | `context` too broad | Keep but subtype or enforce a usefulness test | **Agreed**, already uses promotion heuristics | Keep `context` + heuristics | `context` kept + promotion heuristic table | **Closed** |
| N4 | `criterion` ambiguous | Rename → `acceptance_criterion` | **Agreed**: rename *or* strong guidance | Keep `criterion`, guide it | `criterion` (CR) + modality guidance ("how will we judge it holds") | **Closed (chose guidance)** |
| N5 | `obligation` too broad | Rename → `verification_obligation`/`proof_obligation` | (not contested) | Possibly rename | `obligation` (OB) kept | **Open (minor)** |
| N6 | Add `actor` | "Biggest missing intent node"; grounds vague requirements | (not contested) | Strong candidate | **Absent** | **Open** |
| N7 | Add `scenario` (vs replace `example`) | **Do not replace `example`** — different jobs (pattern vs instance); add `scenario` only if workflows are first-class | asked the replace question | Keep `example`; add `scenario` conditionally | `example` kept; no `scenario` | **Open (conditional)** |
| N8 | Model the "unknown" | Not an open question — an *epistemic boundary*. Model as gap status `accepted_unknown` first; optionally a projected `unknown` node | **Raised the gap**: distinct from elicitation-gap and from assumption | Represent unknowns explicitly; node form deferred | **Absent as node;** SPEC defers `risk`/`unknown` node (closely matches) | **Open — overlaps SPEC `risk`** |
| N9 | Design plane too structural | Add `entity` (data_entity); later `operation`/`state`/`event` | (took `entity`, `sketch` into table) | Add `entity`/`sketch` if needed | only `module`, `interface` | **Open** |

---

## 4. The central architectural argument (turns 5–8)

This is the spine of the thread and the part most worth carrying into the
interrogation.

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
explicit impact topology is. **Open:** column naming, and whether multi-arc
edges justify the two-table split.

---

## 5. The workbench gap (turn 9)

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
  plane" is an unrelated ontology concept. The interrogation must pick a
  non-colliding name (candidate, inquiry, scratchpad, draft-plane…).
- SPEC already has the adjacent seam: **Candidate artefacts** (pre-graph,
  agent-proposed, awaiting adjudication) are *deferred*, and the commitment
  gradient (D81-L) deliberately keeps low-confidence "noticings" **out** of
  graph truth by spawning elicitation gaps instead. GPT's proposal is
  essentially "promote the candidate-artefact seam to a typed plane."
- `provenance` as an *edge* partly conflicts with the existing posture that
  **`change_log` owns provenance/audit** and node `provenance` was retired.
  GPT's `provenance` is artifact→derived-claim lineage, which is a *different*
  relation than audit — but the naming will confuse.

**Open:** whether ongoing/inquiry work becomes (a) typed graph nodes in a new
plane, (b) flat-file docs with structured "candidate changes" blocks parsed on
demand (close to today's `memory/` + design-doc practice), or (c) the deferred
candidate-artefact substrate. This is the single largest net-new idea in the
thread and the least settled.

---

## 6. Decisions vs. open items (summary)

**Effectively decided (in-thread, consistent with current code):**

- Keep `frontier` (N1). Keep `example` alongside any `scenario` (N7). Keep
  `context` with promotion heuristics (N3). Keep `criterion` via guidance, not
  rename (N4). Store one direction, render verbs both ways (E-verbs).
- **Roles + impact-topology, not semantic/verb direction** (§4) — the thread's
  headline, already the codebase's bet.

**Leaning but uncommitted:**

- `thesis` → `claim` (N2). `obligation` → `verification_obligation` (N5).

**Genuinely open, for the interrogation:**

- Split `boundary`→`exclusion` (E3); add `conflict` (E4) and reconcile with
  `reconciliation_need.semantic_conflict`; add `refinement` (E5).
- Add `actor` (N6) and gated `participation` (E7); add `coverage` (E8).
- Model "unknown"/`risk` (N8) — node vs gap-status; reconcile with deferred
  SPEC `risk`.
- Design-plane growth: `entity`, `sketch` (N9).
- Workbench/inquiry plane + `provenance` edge + promotion flow (§5), incl. the
  name collision.
- Edge storage: column naming and whether to adopt `SemanticEdge` +
  `ImpactArc[]` (§4).
- `support` stance: keep `for`/`against`, or split rationale from evidence (E2).

---

## 7. My assessment (current ontology + the multi-method goal)

Read with the new goal — **host BDD, EDD, and formal-spec/verification styles
on one ontology** — in mind. The thread never addressed method-fit, so this is
additive.

1. **The thread validates more than it changes.** Its central conclusion is
   already the codebase's architecture. The high-value residue is the *node/edge
   additions*, not the direction model. Frame the interrogation around "which
   additions earn their place," not "how do we store direction."

2. **`conflict` (E4) is the strongest add — and it is a model-shape decision,
   not a cosmetic one.** Today contradiction is a *retrospective*
   `reconciliation_need` (`semantic_conflict`), not a *prospective* graph edge.
   BDD/EDD and especially **formal verification** want contradiction to be
   first-class and traversable (you reason *over* incompatibilities). The
   interrogation should decide cleanly: is conflict an edge (authored,
   traversable, supports "design it twice"/tension analysis) or a recon-need
   (derived, transient)? Having both is the drift risk.

3. **`criterion`/`proof`/`example` are the BDD/EDD seam and are under-specified
   for it.** BDD's Given/When/Then and EDD's example-tables map naturally onto
   `example` (instance) + `criterion` (judgment) + `proof` (witness). If
   `scenario` (N7) is added, it becomes the Gherkin-scenario carrier and the
   bridge `goal→scenario→requirement→criterion→check→evidence`. I'd treat
   `scenario` + `example`-subtyping as **the** BDD/EDD enabler and weigh it
   above `actor`.

4. **Formal verification pressures the oracle plane and "unknown".** Formal
   flows want `obligation` (proof obligation), `invariant`, and a real
   `assumption`/`unknown` distinction. N5 (`verification_obligation`), N8
   (`unknown`/`risk`), and the `proof`/`formal_proof` naming note in
   `GRAPH_MODEL.md` cluster here. If formal verification is a first-class
   target, this cluster — not actors/scenarios — is the priority. The
   interrogation should *rank the three methods* before ranking node adds,
   because they pull in different directions.

5. **`support`-with-stance (E2) is a latent inconsistency.** A `support` edge
   carrying `for`/`against` invites exactly the "treat rationale as evidence"
   drift GPT warned about, and `GRAPH_MODEL.md` already strains to separate
   `proof` vs `support`. For formal/EDD work the proof/rationale boundary must
   be crisp. Worth resolving early.

6. **The workbench/inquiry plane is real but should resist becoming a second
   graph.** Operating discipline here (local necessity, no capability-as-
   anticipation) argues for the *lightest* form that works: structured
   "candidate graph changes" blocks in flat docs + a promotion path, rather
   than a fully typed fifth plane, until there is concrete pressure. The
   deferred candidate-artefact seam is the natural home. Resolve the name
   collision regardless.

7. **Don't reopen the locked kind set casually.** D54-L/D56-L locked the kind
   enums; SPEC repeatedly defers additions (`risk`) *because* reopening is
   costly. The multi-method goal is a legitimate reason to reopen — but the
   interrogation should reopen **once, deliberately**, batching the method-driven
   adds (conflict, scenario, unknown/risk, refinement, actor) rather than
   trickling them.

---

## 8. Suggested entry points for the deeper interrogation

1. **Rank the three methods** (BDD, EDD, formal) by priority — they pull the
   ontology in different directions (§7.3–7.4).
2. **Decide conflict's substrate** (edge vs recon-need) — highest-leverage,
   model-shaping (§7.2).
3. **Decide the inquiry/speculation home** and fix the "workbench" name
   collision (§5, §7.6).
4. **Batch the kind-set reopening** if methods justify it (§7.7): candidate set
   = `claim`(rename), `scenario`, `actor`, `unknown`/`risk`, + edges `conflict`,
   `refinement`, `coverage`, `exclusion`-split, `provenance`.
5. **Resolve `support` stance** and the `proof`/`formal_proof` naming (§7.5).

---

## 9. Refined active scope (user positions, 2026-06-23)

Sections 1–8 are the neutral thread audit. This section records the user's
**authoritative narrowing** after walking through their own notes — it
supersedes the "leaning/open/deferred" dispositions above where they conflict.
Still a working artifact, not a SPEC decision; this is the frozen starting set
for the design interrogation.

### 9.1 Active near-term (carry into the interrogation)

**Edge renames** (behavior unchanged except the name):

| current | → | endpoints (role-named) | stance |
| --- | --- | --- | --- |
| `proof` | **`witness`** | oracle/evidence → claim/check | **keep `for`/`against`** |
| `support` | **`rationale`** | reasoning → claim | **keep `for`/`against`** |
| `boundary` | **`exclusion`** | boundary → subject | — |
| `association` | **`cross_reference`** | peer ↔ peer | — |

**Edge adds:** `refinement` (generality → specificity) — present reader is
formal refinement (abstract model ⊑ concrete implementation), distinct from
`realization`. `coverage` was considered here but is now **deferred** (§9.5):
it never cleared the present-reader bar.

**Node renames / recodes:** `thesis` → `claim`; `validation_method` →
`vv_method`; `obligation` → `vv_obligation`; `criterion` recode → `AC`.

**Node adds:** `unknown` (UNK, intent plane); `entity` (ENT) and `sketch`
(SKT) on the design plane — both intentional, in.

### 9.2 The `evidence`/`witness` naming resolution (N-collision)

Renaming the *edge* `proof` → `evidence` would collide with the existing
`evidence` **node** kind. Resolution: **name the edge `witness`, keep the node
`evidence`.** The relation reads as a verb (`X witnesses claim Y`, rendered as
`proves`/`refutes`/`falsifies`); the node stays the natural noun for the oracle
artifact. So `proof` (edge) → `witness`; `evidence` (node) is unchanged. This
is *not* the GPT proposal of `proof → evidence`; that path is rejected for the
collision.

### 9.3 Stance is preserved

`for`/`against` stays on `witness` and `rationale` — i.e. **no behavioral
change from current code**, where `proof`/`support` already require stance. The
stance-less `EdgeArg` sketch in the user's notes was an oversimplification, not
an intended loss; `rationale` may still be `against`. This closes E2's
"drop-against" reading: stance is kept; only the proof/rationale *name*
boundary (witness = evidential, rationale = motivational) carries the
separation.

### 9.4 Conditional

- **`commit` plane.** Introduce **only if** it earns its keep by disambiguating
  *commitments* (`requirement`) and *projections* (`criterion`/AC) from
  `intent`. Decision test: does real query/projection code need the plane
  boundary, or does the kind alone suffice? Checkable against actual read paths
  during the interrogation. Not committed.

### 9.5 Deferred (named, not now)

- Nodes: `actor`, `scenario` (intent plane).
- Edges: `conflict`, `participation`, `coverage`.
- The `bench` / speculation plane (MEM/HYP/IMP and the promotion flow).

Consequence: with `conflict` deferred, **contradiction stays in
`reconciliation_need.semantic_conflict`** — no authored conflict edge for now.
`participation` was gated on `actor` anyway, so it follows `actor` out.

`coverage` (plan_node → intent_node) is deferred because it has **no present
reader in the main flow**: every method audited (BDD, formal) routed *around*
it, and plan→intent links are derivable today from `realization`/`composition`.
It earns its keep only when a main-flow read genuinely needs "this plan node
covers that intent node" as a *traversable* edge rather than a derived one;
re-open it then, not on a feel. (Same discipline that deferred `conflict` and
`actor`.)

### 9.6 Parked for the design interrogation

- The `source`/`target` vs `head`/`tail` storage naming and directional-impact
  encoding question (§4) — explicitly deferred to the interrogation; it is an
  internal-storage concern, not part of this kind-set narrowing.

### 9.7 Net delta vs current code

Edges: 8 → 9 (`dependency`, `witness`, `rationale`, `realization`,
`refinement`, `exclusion`, `composition`, `cross_reference`, `supersession`) —
renames plus `refinement` only; `coverage` deferred (§9.5). Nodes: +`unknown`,
+`entity`, +`sketch`, with `thesis`→`claim` and the `vv_*`/`AC` recodes.
Everything else from the thread is deferred, conditional, or parked — a
deliberately small, method-agnostic reopening rather than the full batch in
§8.4.
