# Behavioral Kernels — Reusable Interviewer Machinery

> Status: **working design proposal**.
> Date: 2026-05-07.
> Scope: the **product-layer** behavioral-kernel typology — what a kernel is, the proposed v0.1 ontology of fifteen kernels grouped into five super-families, signal-phrase routing, kernel-card structure, contrastive question patterns, composition examples, and the interviewer workflow that activates kernels.
>
> This document is the canonical reference for the FE-702 frontier item ("Generative prompt probes before UI") in `memory/PLAN.md` insofar as that item names behavioral kernels as one probe target. It expands the `Recommended shape:` of that item with the full kernel taxonomy that is too long to live inside the plan.
>
> Source synthesis: [`INTENT_SPEC_EVOLUTION.md`](./INTENT_SPEC_EVOLUTION.md) §7–8. Where this document overlaps, it supersedes the synthesis as the structured reference.
>
> Companion: [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md). Kernels suggest *what kind* of question to ask; the intent graph defines *what their answers become*. Kernels emit the typed claims and edges that the intent graph stores.
>
> Layer note: this is the **product layer**.

## Why this note exists

Brunch's interviewer today asks questions that are organized by phase (grounding / design / requirements review / criteria review) but not by **the behavioral shape of the software being specified**. Two features as different as "permissions for shared documents" and "offline Kanban editing" can produce wildly different correctness questions, but the current interviewer treats them through the same phase-templated prompts.

The behavioral-kernel direction is to give the interviewer a layer of *recognition* between the user's domain and the next question:

- The **domain** is what the user is building (Kanban, billing, document sharing, calendar scheduling).
- The **kernel** is a reusable family of correctness questions and emitted artifacts.
- A domain composes multiple kernels.
- The interviewer should infer which kernels are latent in a feature and ask the diagnostic, contrastive questions for those kernels — not every possible requirements question.

This document specifies the kernel taxonomy, the per-kernel structure, the routing signals, and the interviewer workflow that activates kernels.

## What is a kernel?

> A **kernel** is a reusable family of questions that exposes one class of latent requirement and maps answers into progressively checkable artifacts.

Two related but distinct senses of "kernel" appear in adjacent literature:

- **Midspiral's technical kernel** — a generic verified module parameterized by a domain. Model + Action + Apply + Invariant, with the proof obligation `Inv(model) ∧ Valid(action, model) ⇒ Inv(Apply(model, action))`. Reusable state-management or proof machinery.
- **Brunch's elicitation kernel** (this document) — reusable question-and-artifact machinery parameterized by a user's feature. The questions surface latent correctness concerns; the answers emit the weakest useful checkable artifact.

The two are related: an elicitation kernel often produces the kind of artifact a technical kernel could check. But the elicitation kernel's primary product is **typed claims and edges in the intent graph**, not verified code.

### What a kernel is not

- **A kernel is not a domain.** "Kanban", "subscription billing", "document sharing", and "calendar scheduling" are domains. Each domain composes several kernels.
- **A kernel is not a phase.** Brunch's four phases (grounding / design / requirements review / criteria review) describe the workflow shape; a kernel describes the correctness shape. Multiple kernels can be active in any single phase.
- **A kernel is not a template.** A template produces the same question every time. A kernel produces *contrastive* questions whose specific shape is generated from the user's domain context.
- **A kernel is not user-facing formalism.** The user does not see "we're activating the Containment kernel now"; they see a question. The kernel is **hidden interviewer machinery**.

## The v0.1 kernel ontology

Fifteen kernels, grouped into five super-families. The list is provisional — the test is whether each kernel produces a distinct class of high-value questions and a distinct class of emitted artifacts.

### Super-families

```diagram
╭───────────────────────────────╮  What exists?
│ Structural correctness        │  ╭── Identity & reference
│                               │──┤── Containment & topology
│                               │  ╰── Validation & normalization
╰───────────────────────────────╯

╭───────────────────────────────╮  What can happen?
│ Behavioral correctness        │  ╭── State & lifecycle
│                               │──┤── Temporal history
│                               │  ╰── Optimization & preference
╰───────────────────────────────╯

╭───────────────────────────────╮  Who or what can act?
│ Multi-actor correctness       │  ╭── Authority & capability
│                               │──┤
│                               │  ╰── Concurrency & collaboration
╰───────────────────────────────╯

╭───────────────────────────────╮  What must stay consistent operationally?
│ System correctness            │  ╭── Transactions & atomicity
│                               │──┤── Resource accounting
│                               │  ├── Derived data & views
│                               │  ├── External effects
│                               │  ╰── Error & recovery
╰───────────────────────────────╯

╭───────────────────────────────╮  How does this survive time, change, scrutiny?
│ Evolution & accountability    │  ╭── Change & migration
│                               │──┤
│                               │  ╰── Observability & evidence
╰───────────────────────────────╯
```

### Full kernel table

| # | Kernel | Super-family | Interview focus | Artifact shape |
| --- | --- | --- | --- | --- |
| 1 | **Identity & reference** | Structural | What exists, how it is identified, what can point to it | Entity model, reference invariant |
| 2 | **Containment & topology** | Structural | Parent / child, membership, ordering, graph constraints | Tree, list, or graph invariant |
| 3 | **Validation & normalization** | Structural | Valid inputs, canonical forms, equivalence | Validator / parser contract |
| 4 | **State & lifecycle** | Behavioral | States, transitions, terminality | State machine |
| 5 | **Temporal history** | Behavioral | Undo, audit, monotonicity, expiration | History / timeline invariant |
| 6 | **Optimization & preference** | Behavioral | Best valid outcome, tie-breaking | Objective or ranking relation |
| 7 | **Authority & capability** | Multi-actor | Who may do what, delegation, revocation | Authorization predicate |
| 8 | **Concurrency & collaboration** | Multi-actor | Conflicts, stale actions, merge / rebase | Conflict-resolution semantics |
| 9 | **Transactions & atomicity** | System | All-or-nothing multi-object updates | Transaction invariant |
| 10 | **Resource accounting** | System | Balances, quotas, conservation, capacity | Conservation / bounds invariant |
| 11 | **Derived data & views** | System | Cache, index, projection consistency | View consistency invariant |
| 12 | **Error & recovery** | System | Retry, rollback, compensation, degraded mode | Failure / recovery contract |
| 13 | **External effects** | System | APIs, queues, clocks, webhooks, side effects | Boundary / adapter contract |
| 14 | **Change & migration** | Evolution | Compatibility, legacy data, feature evolution | Migration / refinement invariant |
| 15 | **Observability & evidence** | Evolution | Logs, provenance, explanations, auditability | Trace / audit invariant |

### MECE caveats

The fifteen are "orthogonal-ish" but not strictly MECE. Real features compose them, and some pairs sit close to one another:

- **Lifecycle vs transactions.** Lifecycle asks "what states can this be in?"; transactions ask "what must be indivisible across these states?". Distinct, but they often need to be thought about together.
- **Error & recovery vs transactionality.** Recovery covers compensation when you cannot roll back the external world; transactionality assumes you can. The distinction matters most at the External-effects boundary.
- **Optimization vs preference.** Optimization is "best valid outcome"; preference can also surface as a tie-break inside lifecycle (which transition wins?) or authority (which capability wins?). It's a kernel because it produces a different artifact (an objective or ranking relation).

Treat the v0.1 list as a working ontology. Some kernels may merge after transcript probes show they don't produce distinct question classes.

## Composition — domains as kernel mixes

A domain is a mix of kernels with weights. Three worked examples:

### Offline Kanban editing

```diagram
╭──────────────────────╮      ╭──────────────────────╮
│ State & lifecycle    │      │ Containment & topology│
│ (cards move through  │      │ (cards belong to      │
│  workflow states)    │      │  columns and          │
╰──────────────────────╯      │  positions)           │
                              ╰──────────────────────╯
╭──────────────────────╮      ╭──────────────────────╮
│ Concurrency &        │      │ Resource accounting  │
│ collaboration        │      │ (WIP limits bound    │
│ (stale moves need    │      │  column capacity)    │
│  merge / reject /    │      ╰──────────────────────╯
│  rebase semantics)   │
╰──────────────────────╯      ╭──────────────────────╮
                              │ Temporal history     │
╭──────────────────────╮      │ (undo, redo, event   │
│ Derived data & views │      │  ordering)           │
│ (column counts and   │      ╰──────────────────────╯
│  filters must agree  │
│  with source state)  │
╰──────────────────────╯
```

> **Kanban is not one kernel. It is a composition of kernels.**

### Role-based document sharing

Identity & reference (users, documents, share grants) · Authority & capability (who may read / edit / share) · Containment & topology (folders, nested sharing inheritance) · Authority over time (revocation, delegation lifetime) · Observability & evidence (audit log of access) · Change & migration (legacy ACLs).

### Subscription billing

Resource accounting (balances, quotas, prorations) · State & lifecycle (subscription states: trial, active, past-due, cancelled) · Transactions & atomicity (charge + receipt + entitlement update as one) · External effects (Stripe / payment gateway boundary) · Error & recovery (failed charges, retry, dunning) · Temporal history (audit trail, refunds, reversals).

The point: when the user says "we're building Kanban" the interviewer should not begin with "Please describe the requirements." It should begin with "**What behavioral kernels are latent in this feature?**" and activate the relevant ones.

## Signal-phrase routing

The interviewer infers active kernels from signal phrases in the user's language. A starter routing table:

| Signal phrase / pattern in user input | Activate kernels |
| --- | --- |
| "states", "transitions", "moves to", "becomes", "lifecycle" | State & lifecycle |
| "belongs to", "parent", "child", "folder", "list", "ordering" | Containment & topology |
| "id", "reference", "links to", "points at", "uniqueness" | Identity & reference |
| "valid", "invalid", "format", "canonical", "normalize" | Validation & normalization |
| "may", "can", "permission", "role", "share", "access", "delegate" | Authority & capability |
| "two users", "concurrent", "offline", "stale", "merge", "conflict" | Concurrency & collaboration |
| "all or nothing", "atomically", "either-both-or-neither" | Transactions & atomicity |
| "balance", "quota", "limit", "capacity", "available", "remaining" | Resource accounting |
| "show", "count", "list", "filter", "sync", "cached", "projected" | Derived data & views |
| "retry", "fail", "rollback", "recover", "compensate", "degrade" | Error & recovery |
| "API", "webhook", "queue", "external", "send to", "callback" | External effects |
| "undo", "redo", "audit", "history", "expire", "trail" | Temporal history |
| "best", "preferred", "rank", "tie-break", "optimal" | Optimization & preference |
| "migrate", "legacy", "upgrade", "compatibility", "old format" | Change & migration |
| "explain why", "trace", "log", "evidence", "audit" | Observability & evidence |

Kernel activation is multi-label: one user sentence can activate three kernels. The interviewer should keep the active set small (perhaps the top three by signal strength) so questions stay focused.

## Kernel cards

Each kernel becomes a reusable spec-interview module — a **kernel card** — with a fixed structure.

### Template

```
Kernel: <Name>

Detects:
  <Signals that indicate this kernel is latent.>

Goal:
  <What class of correctness questions this kernel surfaces.>

Questions:
  <Contrastive question patterns the interviewer can adapt.>

Artifacts:
  <Typed intent-graph items this kernel emits when answers come back.>

Proof obligations:
  <Properties a stronger checkability tier could enforce.>

Example tests:
  <Concrete test or example shapes that witness the artifacts.>
```

### Worked example — Containment & topology

```
Kernel: Containment & Topology

Detects:
  parent / child relations, lists, folders, graphs, ordered collections

Goal:
  discover structural invariants that must hold across mutations
  (add, move, delete, reorder)

Questions:
  - Can an item have multiple parents?
  - Can cycles exist?
  - Does order matter?
  - Are duplicates allowed?
  - What happens to children when a parent is deleted?
  - Can an item move between parents? Does that change its identity?

Artifacts:
  - entity-relationship sketch
  - acyclicity invariant (if no cycles)
  - unique-parent invariant (if single-parent)
  - ordering invariant (if order matters)
  - deletion cascade policy

Proof obligations:
  - add preserves topology
  - move preserves topology
  - delete preserves topology
  - reorder preserves topology

Example tests:
  - moving an item between parents removes it from the old parent
  - deleting a parent does (or does not) delete its children
  - attempting to create a cycle is rejected
```

The artifact list maps directly into the [Intent Graph Semantics](./INTENT_GRAPH_SEMANTICS.md) ontology: kernel artifacts become typed `invariant` items (with `state`, `transition`, `data_integrity` subtypes), `criterion` items, and `example` items, linked by typed edges.

### What a first kernel-card implementation needs

- **Detection signals** — the routing-table phrases that tell the interviewer to activate this kernel.
- **Question templates** — contrastive question shapes parameterized by domain context.
- **Artifact schema** — the typed claims and edges this kernel emits.
- **Validators** — checks that the emitted artifacts are well-formed for the kernel's contract.

The first cut should be machine-readable enough that the interviewer can load a kernel card and use it without freehanded prompt drift.

## Contrastive questions

Kernel questions should usually be contrastive, not open-ended.

### Poor shape — open-ended

```
How should permissions work?
```

This invites a 200-word essay that may or may not contain the answer the kernel actually needs.

### Better shape — contrastive

```
If Alice shares a folder with Bob, and then a document is added to that
folder later, should Bob automatically get access to the new document?

  A. Yes, permissions inherit dynamically.
  B. No, sharing applies only to current contents.
  C. It depends on the document type — let me explain.
```

The user's answer is a single classification. The kernel emits the corresponding invariant or constraint immediately. Follow-up questions branch off the chosen option.

### Another worked example — Concurrency & collaboration

```
Alice and Bob are both viewing a Kanban board offline. Alice moves card C
from "In Progress" to "Done". Bob, on his offline device, also moves card C
— but he moves it from "In Progress" to "Blocked". They both reconnect.
What should happen?

  A. Last-writer-wins. Whichever sync arrives second overwrites.
  B. First-writer-wins. The second sync is rejected with a conflict.
  C. Both moves are surfaced as a conflict; the user must resolve.
  D. Bob's "Blocked" wins because it represents new information that
     Alice didn't have when she moved to "Done".
```

This is the **TiCoder move generalized beyond tests**: the interviewer generates cases where plausible interpretations diverge, then asks the user to classify them. The output is a typed claim plus durable evidence (the case becomes an `example` item linked to the resulting `invariant` or `decision`).

## The interviewer workflow

The interviewer activates kernels through a six-step loop:

```diagram
╭──────────────────╮
│ 1. Describe      │  User describes the feature ("we're building offline
│    the feature   │     Kanban editing for distributed teams")
╰────────┬─────────╯
         ▼
╭──────────────────╮
│ 2. Identify      │  Match signal phrases to kernels. Activate top N
│    kernels       │     (e.g. State & lifecycle, Concurrency, Containment,
╰────────┬─────────╯     Resource accounting)
         ▼
╭──────────────────╮
│ 3. Generate      │  For each active kernel, generate contrastive scenarios
│    contrastive   │     parameterized by the user's domain context
│    scenarios     │
╰────────┬─────────╯
         ▼
╭──────────────────╮
│ 4. User          │  User picks A/B/C/D, or explains a fifth option
│    classifies    │
╰────────┬─────────╯
         ▼
╭──────────────────╮
│ 5. Emit          │  Convert classifications into typed claims + edges:
│    artifacts     │     invariants, examples, criteria, decisions, with
╰────────┬─────────╯     edges back to the goal / context that motivated them
         ▼
╭──────────────────╮
│ 6. Escalate      │  If the artifact warrants stronger checkability,
│    to formal     │     emit the proof obligation and mark the claim
│    verification  │     as proof_candidate. Most claims won't reach this.
│    if useful     │
╰──────────────────╯
```

Step 6 is the bridge to formal verification, but it is **the compilation target, not the user interface**. The user did not opt into formal methods; the user answered some contrastive questions, and the kernel knew which checkability tier was appropriate for their answers.

## Worked example — project deletion

User asks: "When a project is deleted, should its tasks be deleted, archived, or moved?"

Signals activate: **Identity & reference** (tasks reference projects), **Containment & topology** (tasks belong to projects), **Temporal history** (audit trail of deletion), **Authority & capability** (who can delete a project).

Contrastive question pack:

```
A project is deleted. Its tasks…

  A. are deleted along with it.
  B. are archived and remain readable but not editable.
  C. are moved to a "no project" pool.
  D. block the deletion until the user reassigns or deletes them.
```

If the user picks B:

- Emit `invariant` (data_integrity subtype): "Deleted projects retain a tombstone reference; their archived tasks remain queryable."
- Emit `criterion` (test subtype): "Deleting a project transitions its tasks to status=archived; tasks remain visible in archived view."
- Emit `example` (positive subtype): the worked scenario above with chosen option B.
- Emit `example` (negative subtype): option A, marked `counterexample_for` the chosen invariant.

The graph now carries the decision *and* its rejected alternatives, the invariant the decision introduces, the criterion that witnesses it, and a positive plus negative example — all from a single contrastive question.

## Contrast with template-driven prompts

| Approach | Question source | Output |
| --- | --- | --- |
| **Template-driven** (today) | Phase + section template | Free-text answer that the observer must classify |
| **Topology-driven** (planned) | Graph gaps in [Intent Graph Semantics](./INTENT_GRAPH_SEMANTICS.md) | Question targeting a specific item or edge |
| **Kernel-driven** (this doc) | Active kernels + domain context | Contrastive question that emits typed artifacts directly |

The three are complementary, not competing. Template-driven keeps the conversation moving when no kernel is clearly active. Topology-driven fills graph gaps. Kernel-driven turns rich domain context into checkable artifacts. The interviewer should be able to switch among them based on signal.

## Probe targets for FE-702

`memory/PLAN.md` item 4 names two behavioral kernels for the first probe — `state/lifecycle` and either `authority/provenance` or `containment/topology`. This document expands those to the full set, but the probe order should still start small:

1. **State & lifecycle** — the most universally applicable kernel; almost every feature has a lifecycle.
2. **Containment & topology** — the second most universal; almost every feature has structure.
3. **Authority & capability** — the highest-value kernel for collaborative or multi-tenant features.

These three cover most of what a first interviewer prototype would need to demonstrate the kernel approach. The remaining twelve can be added incrementally as scenarios warrant.

For each probe, the scenario substrate ([`INTENT_SPEC_EVOLUTION.md`](./INTENT_SPEC_EVOLUTION.md) §Persistence; `memory/SPEC.md` Requirements 40, 41) should capture: rendered prompt, kernel context pack, model/provider settings, raw output, structured parse status, and qualitative review notes — the same artifact shape FE-698 already captures.

## Open questions

- **Are 15 kernels distinct enough?** Some may merge after transcript probes (Optimization & preference may collapse into Authority & capability or State & lifecycle in practice).
- **What should a first kernel-card implementation include?** Detection signals, question templates, artifact schema, validators — or all of these? Some can be deferred.
- **Kernel ordering within an interview.** When three kernels are active, which questions get asked first? Likely "structural before behavioral before multi-actor before evolution," but worth probing.
- **Cross-kernel composition.** When two kernels would emit overlapping invariants, who deduplicates? Likely the observer + relation-policy registry, but the kernel card should declare expected overlaps.
- **Kernel-aware criterion generation.** Should criteria reviews be kernel-aware? A "Containment" criterion should look different from an "Authority" criterion — different test shapes, different witness strengths.
- **User-visible kernel labels.** Today's interviewer is generic; if the user opts in, should the interviewer say "I'm asking you about how this lifecycle behaves" to make the kernel structure visible? Could improve trust at the cost of leaking implementation detail.
- **Domain libraries.** Should we ship pre-baked kernel mixes for common domains (Kanban, sharing, billing) so that a user starting with "I'm building Kanban" gets the right kernels active by default?

## References

- [`INTENT_SPEC_EVOLUTION.md`](./INTENT_SPEC_EVOLUTION.md) §7 (Behavioral pattern elicitation) and §8 (Kernel typology) — source synthesis.
- [`INTENT_GRAPH_SEMANTICS.md`](./INTENT_GRAPH_SEMANTICS.md) — the typed graph that kernel artifacts populate.
- `memory/SPEC.md` Requirement 40 (prompt/context engineering names "behavioral kernels" as a context-pack consumer); Lexicon entries for `behavioral kernel`, `progressive checkability`, `context pack`.
- `memory/PLAN.md` item 4 (FE-702) — the active probe item this document expands.
- Midspiral kernel concept (technical proof kernel) — referenced as adjacent literature, not the same construct.
- TiCoder — referenced as the source of the contrastive-question move that kernels generalize.
