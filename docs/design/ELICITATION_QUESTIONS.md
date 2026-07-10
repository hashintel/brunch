# Elicitation Question Catalog

Companion to the node-kind taxonomy in [`src/graph/schema/nodes.ts`](../../src/graph/schema/nodes.ts)
(SPEC D56-L) and [`ELICITATION_LENSES.md`](ELICITATION_LENSES.md). Rationale and texture, not
authority — `memory/SPEC.md` remains the canonical register (D56-L, D65-L).

> **Drift notice (2026-06-24) — content refresh deferred into `elicitor-generate` (FE-1059).**
> The catalog's *thesis* is durable (the node kind is the closed ontology; questions are the
> open, projectable layer inside a kind), and it is exactly the canonical heuristic-rendering the
> generate/capture skills must cite under D97-L. But its surface has drifted against the
> post-FE-1052 ontology and must not be read as current on these points:
> - **Kind names:** `validation_method` → `vv_method`, `obligation` → `vv_obligation` (D87-L).
> - **Missing kinds:** `story`, `unknown` (intent), `entity`, `sketch` (design) (D87-L).
> - **Bands:** this doc uses three bands (grounding → elicitation → commitment); the live model
>   is **four** — `grounding`, `elicitation`, `projection`, `commitment` — derived by
>   `bandsForKind` (D64-L/D94-L), and the per-kind band table it implies was deleted.
>
> A full content refresh is intentionally **not** done here; it is folded into a further
> `elicitor-generate` design pass so the catalog is reworked *as* a D97-L canonical-rendering
> surface alongside the generate skill, not patched piecemeal. See `memory/PLAN.md` →
> `elicitor-generate` deferred follow-ons.

## What this is — and what it is not

This is a **priming catalog for the elicitor agent**, organized by graph node kind. Each row
is phrased as a question, but the questions are **examples, not a schema**. The agent does not
read them off a list; it **projects from the general to the specific** according to its current
strategy (lens), the spec's grounding density, and what the user just said.

The load-bearing idea from the thread that produced this doc:

> **The node kind is the closed ontology. Questions are the open, projectable layer *inside* a kind.**

"Who is it for" and "who are the stakeholders" are both `thesis` questions — not two new types.
Adding more questions never adds ontology; it adds priming for an existing kind. A session
elicitation scratchpad item is therefore a **situated question** (an obligation with a
disposition, plus optional rationale/meta — see `src/session/elicitation-scratchpad.ts`),
not an entry in a persisted parallel "typology" vocabulary; the graph node kinds it serves
stay in the closed ontology, not on the item schema.

Every intent kind already ships a canonical **source-question** (SPEC D56-L) — the abstract
driver, not a literal question to parrot, but a heuristic for what kind of material the node
captures. This catalog expands each driver into a fan of facets and example phrasings.

### Three guardrails

1. **Examples, not enum.** Nothing here is a closed set or a stored value. These prime
   projection; they are not persisted as gap names or domain content.
2. **Anti-shadowing.** The catalog lives in prompt/heuristic space. A gap row stores the
   *projected* question and the kind it refers to — never the catalog text, never domain content.
3. **Band-gated.** The `band` on each kind (grounding → elicitation → commitment) sequences when
   its questions become live. Grounding intent questions open a spec; structural, reasoning,
   oracle, design, and plan questions activate as readiness advances.

The four-anchor "grounding bundle" in ELICITATION_LENSES (Domain / Protagonist / Pain-pull /
Constraint) is the same idea seen at lower resolution: those anchors are facets of `context`,
`thesis`, `goal`, and `constraint`. This catalog generalizes them back onto the kind layer so
there is **one ontology**, not two.

---

## Intent plane · basic (grounding band — opens the spec)

### `goal` — value or outcome claim
*Source question:* **What outcome are we after?**
*Activating concepts:* outcomes-over-output, jobs-to-be-done, value proposition, payoff, North-Star metric.

| What it may answer | Example question forms |
| --- | --- |
| the win / desired outcome | What's the win? What does success unlock? What outcome are we chasing? |
| the job it's hired to do | What job does the user hire this to do? What were they doing before? |
| value created | What's the payoff? What's better once this ships? Who benefits and how? |
| the measure of value | What would tell us it worked? What number should move? |

### `thesis` — position or bet claim
*Source question:* **Who is this for, and why?**
*Activating concepts:* stakeholders, target user / persona, unique value proposition (UVP), positioning, "the bet", problem statement, jobs-to-be-done audience.

| What it may answer | Example question forms |
| --- | --- |
| whom it's for | Who is the primary user? Who is it *not* for? |
| who the stakeholders are | Who are the stakeholders? Who else is affected, funds it, or signs off? |
| stakeholder beliefs / needs | What does each stakeholder believe they need? Where do they disagree? |
| why we're doing it | Why now? What pull or pain makes this worth doing? |
| what we think it accomplishes | What do we believe it changes for these people? |
| what we think the UVP is | What's the unique value here vs alternatives? Why this and not the obvious substitute? |

### `term` — naming commitment
*Source question:* **What do we mean when we say X?**
*Activating concepts:* **ubiquitous language** (DDD), glossary, bounded-context vocabulary, conceptual integrity, lexicon (see `memory/SPEC.md` §Lexicon).

| What it may answer | Example question forms |
| --- | --- |
| canonical definitions | What exactly do we mean by «key word»? |
| jargon to pin down | Is there domain jargon a newcomer wouldn't know? |
| one-word-two-meanings | Are we using one word for two things (or two words for one)? |
| naming commitments | What should we *always* call this, so we stop drifting? |

### `context` — descriptive claim
*Source question:* **What is true about the world this lives in?**
*Activating concepts:* domain, environment, situation of use, deployment topology, platform, ecosystem, integration surface, the system it replaces.

| What it may answer | Example question forms |
| --- | --- |
| what kind of thing it is | What kind of thing is this — a CLI, a service, a library, a UI? |
| where / when it's used | When and where is it used? Under what conditions? |
| local / remote / both | Does it run locally, remotely, or both? Where does the work happen? |
| connectivity | Does it use the internet? Offline-capable? |
| integrations | What external systems must it talk to? What does it read or write? |
| what it replaces / sits beside | What does this replace? What already exists in this space? |
| platform / environment | What platform, runtime, or environment does it live in? |

---

## Intent plane · structural (elicitation / commitment bands)

### `requirement` — obligation claim
*Source question:* **What must the system do?**
*Activating concepts:* capabilities, user stories, functional requirements, MVP / walking skeleton, must-have vs nice-to-have.

| What it may answer | Example question forms |
| --- | --- |
| core capabilities | What must it do? What's the core capability it can't ship without? |
| priority split | What's must-have vs nice-to-have? What's the smallest useful version? |
| observable behavior | From the outside, what should a user be able to do? |

### `assumption` — uncertainty claim
*Source question:* **What might be false?**
*Activating concepts:* risks, hypotheses, leap-of-faith assumptions (Lean Startup), unknowns, "what we're betting on".

| What it may answer | Example question forms |
| --- | --- |
| open bets | What are we assuming that we haven't verified? |
| fragility | What could shift under us and break the plan? |
| dependencies on belief | What has to be true for this to work? |

### `constraint` — boundary claim
*Source question:* **What does this rule out?**
*Activating concepts:* non-functional requirements (NFRs), guardrails, budget / time / regulatory / technical limits, non-goals, fixed technology basis.

| What it may answer | Example question forms |
| --- | --- |
| fixed technical basis | Is the tech stack / language / framework already decided? What's locked? |
| budget & schedule | What's the deadline or budget? |
| scale / data envelope | What volume, latency, or data size must it handle? |
| regulatory / policy | Any compliance, privacy, or policy limits? |
| non-goals | What is this explicitly *not*? What's off the table? |

### `invariant` — preservation claim
*Source question:* **What must never be broken?**
*Activating concepts:* safety properties, security guarantees, data integrity, "always holds".

| What it may answer | Example question forms |
| --- | --- |
| must-always-hold | What must always be true, no matter what? |
| safety / security | What would be catastrophic if violated? |
| integrity rules | What data or state must never be corrupted? |

---

## Intent plane · reasoning

### `decision` — choice claim
*Source question:* **What did we pick among real alternatives?**
*Activating concepts:* trade-offs, architecture decision records (ADRs), reversibility (one-way vs two-way doors).

| What it may answer | Example question forms |
| --- | --- |
| the chosen option | What did we pick, and why over the alternatives? |
| rejected options | What did we rule out? Why? |
| reversibility | Is this reversible, or a one-way door? |

### `criterion` — oracle claim
*Source question:* **How will we judge that it holds?**
*Activating concepts:* acceptance criteria, definition of done, success metrics, oracles.

| What it may answer | Example question forms |
| --- | --- |
| acceptance | How do we know it's good enough? What's the acceptance bar? |
| definition of done | When is this "done"? |
| measurable success | What would we measure to confirm it? |

### `example` — witness or disambiguator claim
*Source question:* **What concrete case would settle this?**
*Activating concepts:* edge cases, counter-examples, behavioral kernels (see [BEHAVIORAL_KERNELS.md](BEHAVIORAL_KERNELS.md)), Given-When-Then, contrastive disambiguation.

| What it may answer | Example question forms |
| --- | --- |
| illustrative case | Can you give a concrete example? |
| edge / tricky case | What's a case at the boundary that's easy to get wrong? |
| counter-example | What's a case that should *fail* or be rejected? |
| disambiguator | Here are two readings — which one do you mean? |

---

## Other planes (band-gated; activate later)

These follow the same pattern; depth here is intentionally lighter because they open after the
intent grounding is in place.

### Oracle plane — *how we know*
`check`, `validation_method`, `evidence`, `obligation`.
*Activating concepts:* verification, tests, proof, audit trail.

| Kind | Example question forms |
| --- | --- |
| `check` | How is this verified? What test or gate proves it? |
| `validation_method` | What method establishes the criterion holds? |
| `evidence` | What artifact shows it's true (a run, a measurement)? |
| `obligation` | What ongoing obligation does this create? |

### Design plane — *how it's shaped*
`module`, `interface`.
*Activating concepts:* deep modules / information hiding (Ousterhout, Parnas), seams, API surface.

| Kind | Example question forms |
| --- | --- |
| `module` | What are the parts? How does it decompose? What does each part hide? |
| `interface` | Where's the boundary? What's the contract across it? |

### Plan plane — *how it's sequenced*
`milestone`, `frontier`.
*Activating concepts:* walking skeleton, tracer-bullet slices, sequencing, risk retirement. The plan plane stops at the reviewed `scope` handoff; buildable slicing is downstream execution state, not a plan node (D103-L/D118-L).

| Kind | Example question forms |
| --- | --- |
| `milestone` | What's the phase boundary? What bundle must be true to advance? |
| `frontier` | What's the next named unit of work? What's the thinnest end-to-end path it should establish? |

---

## How the agent uses this

```diagram
╭──────────────────────────────────────────────────────────────╮
│ projection loop (one step of generalized capture)             │
│                                                                │
│ 1. read open gaps + grounding density for THIS spec           │
│ 2. pick a node kind whose source-question is under-answered    │
│ 3. project: bind the kind's facets to what's already known     │
│    (domain X + protagonist Y  →  a concrete, situated question) │
│ 4. add/update a session scratchpad item: ⟨question, refersTo: kind, …⟩ │
│ 5. NEVER mint a new kind/typology to hold a question —          │
│    attach to the nearest existing kind                          │
╰──────────────────────────────────────────────────────────────╯
```

"Expand then contract" is native to this shape: **expand** = project many situated questions;
**contract** = every one of them refers to a single existing node kind. The catalog grows by
brainstorming more facets and phrasings; the ontology never grows.
