# Data Model

Brunch's graph is a typed graph of stable specification material. Most nodes should read as declarative claims or named artifacts, not interview prompts, scratch notes, or hidden chain-of-thought.

```pseudo
spec graph:
  intent plane     what / why / obligation / uncertainty / examples
  oracle plane     how claims are checked or evidenced
  design plane     how the system is shaped
  plan plane       how the work is sequenced

spec graph material:
  nodes: graph items with kind, basis, settlement, source, optional detail
  edges: structural categories with role-named endpoints, basis, settlement
  settled truth: graph items harmonized enough to stand as current spec truth
  advisory signal: reviewed source-derived graph items not yet harmonized
  gaps: prospective elicitation obligations, not graph truth
  reconciliation_needs: retrospective repair obligations, not graph edges
```

## Node Kinds, Roles/Modalities and Question Archetypes

> **`kind` drives behavior** — readiness evaluation, edge legality, and the elicitor's questioning strategy

Twenty-four kinds across four planes, in canonical plane order. Codes are schema-owned in [`nodes.ts`](../../graph/schema/nodes.ts); readiness-band terminology is owned by [`readiness-bands.md`](readiness-bands.md). A band of `—` means the kind carries no readiness band (D94-L); band-less kinds are `example`, `sketch`, `term`.

### Intent plane — what and why (13 kinds)

| Kind          | Code | Role / Modality             | Source-question                                  |
| ------------- | ---- | --------------------------- | ------------------------------------------------ |
| `goal`        | G    | Value / outcome claim       | "What outcome are we after?"                     |
| `thesis`      | TH   | Position / bet claim        | "Who is this for, and why does it matter?"       |
| `term`        | T    | Vocabulary commitment       | "What do we mean by X?"                          |
| `context`     | CTX  | Descriptive claim           | "What is true about the world this lives in?"    |
| `story`       | ST   | Intra-spec grouping         | "What cluster of behavior does this belong to?"  |
| `unknown`     | UNK  | Known-unknown claim         | "What can't we answer yet but must accommodate?" |
| `requirement` | REQ  | Obligation claim            | "What must the system do?"                       |
| `assumption`  | A    | Deferred-falsifiable belief | "What might be false?"                           |
| `constraint`  | CON  | Boundary claim              | "What does this rule out?"                       |
| `invariant`   | INV  | Preservation claim          | "What must never be broken?"                     |
| `decision`    | D    | Choice claim                | "What did we pick among real alternatives?"      |
| `criterion`   | AC   | Oracle claim                | "How will we judge that it holds?"               |
| `example`     | EX   | Witness / disambiguator     | "What concrete case would settle this?"          |

### Oracle plane — how we know (4 kinds)

| Kind            | Code | Role / Modality                                                 |
| --------------- | ---- | --------------------------------------------------------------- |
| `check`         | CH   | A concrete verification check (a test, assertion, step-def)     |
| `vv_method`     | VV   | A verification method (prover / solver / golden / probe family) |
| `evidence`      | E    | Observed evidence                                               |
| `vv_obligation` | O    | A proof / verification obligation                               |

### Design plane — how it's shaped (4 kinds)

| Kind        | Code | Role / Modality                                                     |
| ----------- | ---- | ------------------------------------------------------------------- |
| `module`    | MOD  | An implementation seam / module                                     |
| `interface` | API  | An interface / contract surface                                     |
| `entity`    | ENT  | A data / domain entity                                              |
| `sketch`    | SKT  | An intentionally lightweight design sketch (advisory, not hardened) |

### Plan plane — how it's sequenced (3 kinds)

| Kind        | Code | Role / Modality                                     |
| ----------- | ---- | --------------------------------------------------- |
| `milestone` | M    | A bounded phase                                     |
| `frontier`  | F    | The plan / tracker / branch unit                    |
| `scope`     | SCP  | A committed execution handoff inside one frontier   |

Runtime `slice`s are executor-derived buildable units lowered from a committed scope. They are not graph nodes and have no graph-node code.

## Edge Categories, Impact Directions and Policies

| Category        | Endpoint Roles         | Impact Direction          | Impact strength | Stance   | Criteria help? | Projection effect                    |
| --------------- | ---------------------- | ------------------------- | --------------- | -------- | -------------- | ------------------------------------ |
| dependency      | dependency, dependent  | dependency --> dependent  | cascade         | —        | no             | none                                 |
| witness         | oracle, claim          | oracle <-- claim          | advisory        | required | yes            | none                                 |
| rationale       | support, claim         | support <-- claim         | advisory        | required | no             | none                                 |
| realization     | abstract, concrete     | abstract --> concrete     | advisory        | —        | no             | none                                 |
| refinement      | general, specific      | general --> specific      | advisory        | —        | no             | none                                 |
| exclusion       | boundary, subject      | boundary --> subject      | advisory        | —        | no             | none                                 |
| composition     | whole, part            | whole <-- part            | advisory        | —        | no             | none                                 |
| cross_reference | peer, peer             | peer <--> peer            | none            | —        | no             | none                                 |
| supersession    | successor, predecessor | successor <-- predecessor | advisory        | —        | no             | hide_predecessor_from_active_context |
