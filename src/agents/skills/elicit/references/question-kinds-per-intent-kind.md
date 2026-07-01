# Intent Kind to Question Kind Mapping

This is a **priming catalog**, organized by graph node kind. The questions are **examples, not a schema**. You must **project from the general to the specific**. The catalog grows by brainstorming more facets and phrasings; the ontology never grows.

> **The node kind is the closed ontology. Questions are the open, projectable layer *inside* a kind.**

Read [`../../../references/readiness-bands.md`](../../../references/readiness-bands.md) for canonical readiness-band terminology and the per-kind latest-expected-band table. Read [`../../../references/data-model.md`](../../../references/data-model.md) for the per-kind source-question. This file owns only the open phrasing/facet catalog below.


Usage:

```diagram
╭──────────────────────────────────────────────────────────────────╮
│ projection loop (one step of generalized capture)                │
│                                                                  │
│ 1. read open gaps + grounding density for THIS spec              │
│ 2. pick a node kind whose source-question is under-answered      │
│ 3. project: bind the kind's facets to what's already known       │
│    (domain X + protagonist Y  →  a concrete, situated question) │
│ 4. emit as an elicitation_gap: ⟨question, refersTo: kind, …⟩    │
│ 5. NEVER mint a new kind/typology to hold a question             │
│    attach to the nearest existing kind                           │
╰──────────────────────────────────────────────────────────────────╯
```

| Kind          | Code | Claim modality              | Query lens |
| ------------- | ---- | --------------------------- | ---------- |
| `goal`        | G    | value / outcome             | basic      |
| `thesis`      | TH   | position / bet              | basic      |
| `context`     | CTX  | known / given               | basic      |
| `story`       | ST   | feature / scenario          | basic      |
| `term`        | T    | domain language             | basic      |
| `unknown`     | UNK  | known-unknown               | structural |
| `assumption`  | A    | deferred-falsifiable belief | structural |
| `constraint`  | CON  | boundary                    | structural |
| `invariant`   | INV  | preservation                | structural |
| `requirement` | REQ  | obligation                  | structural |
| `decision`    | D    | choice                      | reasoning  |
| `criterion`   | AC   | oracle                      | reasoning  |
| `example`     | EX   | witness / disambiguator     | reasoning  |

## Basic Lens (grounding band — opens the spec)

### `goal` —
*Activating concepts:* outcomes-over-output, jobs-to-be-done, value proposition, payoff, North-Star metric.

| What it may answer        | Example question forms                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| the win / desired outcome | What's the win? What does success unlock? What outcome are we chasing?  |
| the job it's hired to do  | What job does the user hire this to do? What were they doing before?    |
| value created             | What's the payoff? What's better once this ships? Who benefits and how? |
| the measure of value      | What would tell us it worked? What number should move?                  |

### `thesis` 
*Activating concepts:* stakeholders, target user / persona, unique value proposition (UVP), positioning, "the bet", problem statement, jobs-to-be-done audience.

| What it may answer            | Example question forms                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| whom it's for                 | Who is the primary user? Who is it *not* for?                                          |
| who the stakeholders are      | Who are the stakeholders? Who else is affected, funds it, or signs off?                |
| stakeholder beliefs / needs   | What does each stakeholder believe they need? Where do they disagree?                  |
| why we're doing it            | Why now? What pull or pain makes this worth doing?                                     |
| what we think it accomplishes | What do we believe it changes for these people?                                        |
| what we think the UVP is      | What's the unique value here vs alternatives? Why this and not the obvious substitute? |

### `term` 
*Activating concepts:* **ubiquitous language** (DDD), glossary, bounded-context vocabulary, conceptual integrity, lexicon (see `memory/SPEC.md` §Lexicon).

| What it may answer    | Example question forms                                       |
| --------------------- | ------------------------------------------------------------ |
| canonical definitions | What exactly do we mean by «key word»?                       |
| jargon to pin down    | Is there domain jargon a newcomer wouldn't know?             |
| one-word-two-meanings | Are we using one word for two things (or two words for one)? |
| naming commitments    | What should we *always* call this, so we stop drifting?      |

### `context` 
*Activating concepts:* domain, environment, situation of use, deployment topology, platform, ecosystem, integration surface, the system it replaces.

| What it may answer             | Example question forms                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| what kind of thing it is       | What kind of thing is this — a CLI, a service, a library, a UI?     |
| where / when it's used         | When and where is it used? Under what conditions?                   |
| local / remote / both          | Does it run locally, remotely, or both? Where does the work happen? |
| connectivity                   | Does it use the internet? Offline-capable?                          |
| integrations                   | What external systems must it talk to? What does it read or write?  |
| what it replaces / sits beside | What does this replace? What already exists in this space?          |
| platform / environment         | What platform, runtime, or environment does it live in?             |

---

## Structural Lens (elicitation / commitment bands)

### `requirement` 
*Activating concepts:* capabilities, user stories, functional requirements, MVP / walking skeleton, must-have vs nice-to-have.

| What it may answer  | Example question forms                                                |
| ------------------- | --------------------------------------------------------------------- |
| core capabilities   | What must it do? What's the core capability it can't ship without?    |
| priority split      | What's must-have vs nice-to-have? What's the smallest useful version? |
| observable behavior | From the outside, what should a user be able to do?                   |

### `assumption` 
*Activating concepts:* risks, hypotheses, leap-of-faith assumptions (Lean Startup), unknowns, "what we're betting on".

| What it may answer     | Example question forms                         |
| ---------------------- | ---------------------------------------------- |
| open bets              | What are we assuming that we haven't verified? |
| fragility              | What could shift under us and break the plan?  |
| dependencies on belief | What has to be true for this to work?          |

### `constraint` 
*Activating concepts:* non-functional requirements (NFRs), guardrails, budget / time / regulatory / technical limits, non-goals, fixed technology basis.

| What it may answer    | Example question forms                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| fixed technical basis | Is the tech stack / language / framework already decided? What's locked? |
| budget & schedule     | What's the deadline or budget?                                           |
| scale / data envelope | What volume, latency, or data size must it handle?                       |
| regulatory / policy   | Any compliance, privacy, or policy limits?                               |
| non-goals             | What is this explicitly *not*? What's off the table?                     |

### `invariant` 
*Activating concepts:* safety properties, security guarantees, data integrity, "always holds".

| What it may answer | Example question forms                      |
| ------------------ | ------------------------------------------- |
| must-always-hold   | What must always be true, no matter what?   |
| safety / security  | What would be catastrophic if violated?     |
| integrity rules    | What data or state must never be corrupted? |

---

## Reasoning Lens

### `decision` 
*Activating concepts:* trade-offs, architecture decision records (ADRs), reversibility (one-way vs two-way doors).

| What it may answer | Example question forms                           |
| ------------------ | ------------------------------------------------ |
| the chosen option  | What did we pick, and why over the alternatives? |
| rejected options   | What did we rule out? Why?                       |
| reversibility      | Is this reversible, or a one-way door?           |

### `criterion` 
*Activating concepts:* acceptance criteria, definition of done, success metrics, oracles.

| What it may answer | Example question forms                                      |
| ------------------ | ----------------------------------------------------------- |
| acceptance         | How do we know it's good enough? What's the acceptance bar? |
| definition of done | When is this "done"?                                        |
| measurable success | What would we measure to confirm it?                        |

### `example` 
*Activating concepts:* edge cases, counter-examples, behavioral kernels (see [BEHAVIORAL_KERNELS.md](../../../../../docs/design/BEHAVIORAL_KERNELS.md)), Given-When-Then, contrastive disambiguation.

| What it may answer | Example question forms                                  |
| ------------------ | ------------------------------------------------------- |
| illustrative case  | Can you give a concrete example?                        |
| edge / tricky case | What's a case at the boundary that's easy to get wrong? |
| counter-example    | What's a case that should *fail* or be rejected?        |
| disambiguator      | Here are two readings — which one do you mean?          |
