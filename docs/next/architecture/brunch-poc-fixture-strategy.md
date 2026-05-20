# Brunch POC — Fixture Strategy

This is a sibling document to [brunch-poc-architecture-prd.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/next/architecture/brunch-poc-architecture-prd.md) and [brunch-poc-pi-seam-extensions.md](file:///Users/lunelson/Code/hashintel/brunch-next/docs/next/architecture/brunch-poc-pi-seam-extensions.md). It captures the test-fixture and evaluation-harness strategy for the POC: a brief library, a captured-run fixture format, a three-layer assertion model, and an agent-as-user driver that exercises the JSON-RPC stdio surface end to end.

This strategy exists because two things are being remodelled at once during the POC: the data layer (intent / oracle / design / plan planes, the change log, the coherence verdict, the typed oracle entities introduced in [pi-seam-extensions §Oracle plane](file:///Users/lunelson/Code/hashintel/brunch-next/docs/next/architecture/brunch-poc-pi-seam-extensions.md#oracle-plane-typed-stub-for-the-poc)) and the elicitation product (offer envelopes, lenses, behavioral kernels per [`BEHAVIORAL_KERNELS.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/BEHAVIORAL_KERNELS.md)). Without a reproducible end-to-end test loop, regressions in either layer will be invisible until the other has compounded onto them. A captured-fixture pipeline gives the POC the feedback loop it needs to iterate the schema and the kernels in parallel.

## The shape

```diagram
                    ╭──────────────────────╮
                    │  Brief fixture       │
                    │  - product idea      │
                    │  - persona dials     │
                    │  - expected kernels  │
                    ╰──────────┬───────────╯
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
        ╭──────────────────╮      ╭──────────────────╮
        │ Agent-as-user    │      │ Human driver     │
        │ over JSON-RPC    │      │ (manual capture) │
        ╰────────┬─────────╯      ╰────────┬─────────╯
                 │                         │
                 └────────────┬────────────┘
                              ▼
              ╭────────────────────────────────╮
              │ Brunch host (TUI / RPC / Web)  │
              ╰────────────────┬───────────────╯
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ╭──────────────╮  ╭───────────────╮  ╭──────────────╮
    │ Transcript   │  │ Graph export  │  │ Coherence    │
    │ (JSONL)      │  │ (nodes,edges) │  │ verdict      │
    ╰──────┬───────╯  ╰───────┬───────╯  ╰──────┬───────╯
           │                  │                 │
           └──────────────────┼─────────────────┘
                              ▼
              ╭────────────────────────────────╮
              │  Run fixture bundle            │
              │  .brunch-fixtures/<brief-id>/  │
              │    <run-id>.jsonl              │
              │    <run-id>.graph.json         │
              │    <run-id>.coherence.json     │
              │    <run-id>.meta.json          │
              ╰────────────────────────────────╯
```

## Three assertion layers

The POC needs all three; they serve different jobs.

| Layer | What it asserts | Tolerates model drift | Best for |
| --- | --- | --- | --- |
| **Replay regression** | Exact transcript replay reproduces the golden graph | No | Pinning specific kernel-card outputs; catching regressions when schema changes |
| **Property regression** | Whatever the agent-as-user produces, structural invariants hold | Yes | Day-to-day CI; catching coherence/cascade regressions; validating the command layer doesn't admit illegal states |
| **Adversarial / generative** | Mutate brief, persona, or user answers; classify failure modes | Yes | Stress-testing kernel coverage, assumption-invalidation cascade, lens switching, cross-session continuity |

The adversarial layer should reuse the existing [`flow-generative-testing`](file:///Users/lunelson/Code/hashintel/brunch-next/.agents/skills/flow-generative-testing/SKILL.md) skill workflow rather than reinventing a probe runner.

### Property invariants — starter set

These are checkable on any run regardless of model variance. They depend on the M4 graph plane and the oracle-plane stub from pi-seam-extensions §Oracle plane.

- Every `active` requirement has at least one `validates` edge from a `Check`.
- No `Obligation` exists without a `derived_from` edge to an `Invariant` or a `formal_property` requirement.
- Every `invalidated` assumption has dependent requirements in `blocked` state, or the coherence verdict is `incoherent` with that violation explicitly surfaced.
- Every `decision` has at least one `example` of kind `positive` (the chosen option) and zero or more `negative` with `counterexample_for` edges (the rejected options).
- No orphan oracle-plane nodes (`Check` without `validates`, `Evidence` without `produces`, `Obligation` without `derived_from`).
- For every `worldUpdate` custom entry in the transcript, the named graph items have LSNs strictly greater than the session's pre-update `lastSeenLsn`.
- For every `brunch.lens_switch` and `brunch.spec_switch` entry, the session interest set is recomputed before the next agent turn.

Reconciliation-substrate invariants (depend on the reconciliation-need substrate from pi-seam-extensions):

- Every reconciliation need has a `created_at_lsn` strictly less than or equal to the current global LSN; no need carries an LSN ahead of the change log.
- Every reconciliation need of `kind = 'impasse'` references at least two graph nodes via `concerns` edges (you cannot be impassed about nothing, and the minimal contradiction has two sides).
- Every reconciliation need either has `status ∈ {open, deferred}` or carries a non-null `resolved_at_lsn` strictly greater than `created_at_lsn`.
- For every coherence verdict of `incoherent`, at least one open reconciliation need exists whose `concerns` set intersects the nodes cited by the verdict.
- No graph node remains in a derived `blocked` state across more than one turn without a corresponding open reconciliation need referencing it.

Intent-modality invariants (depend on the `framing_as` extension from pi-seam-extensions §Oracle / intent-plane subtype area):

- Every node carrying a `framing_as` value lists framings that are all members of the allowed matrix for that node's base kind. No node carries a framing outside its kind's allowed set.
- Every node carrying `authority = 'derived'` has at least one inbound edge of a relation kind whose policy is declared as authority-propagating (e.g. `refines`, `decomposes_into`). Derived authority is never free-standing.
- Every node carrying `epistemic_status = 'observed'` has at least one supporting `Evidence` node or, where the oracle plane is not yet engaged, a transcript reference recorded on the node.

The starter set should grow as the POC encounters real regressions worth pinning.

## Brief library

Briefs are short, human-readable, and curated. The run artefacts are the heavy data.

### Brief fixture format

```yaml
# .brunch-fixtures/briefs/offline-kanban.yaml
id: offline-kanban
title: Offline Kanban Editing
brief: |
  We want to build a Kanban tool that engineering teams can use offline.
  Multiple people edit the same board. Cards move through workflow states.
  Some columns have WIP limits.
persona:
  style: collaborative           # terse | verbose | collaborative | indecisive
  domain_literacy: high          # low | medium | high
  patience: medium               # affects how many follow-ups before frustration
  change_mind_probability: 0.1   # per-turn probability of revising an earlier answer
expected_kernels:
  - state_lifecycle
  - containment_topology
  - concurrency_collaboration
  - resource_accounting
  - derived_data_views
  - temporal_history
expected_entity_coverage:
  intent: [requirement, assumption, invariant, decision, example]
  oracle: [check, validation_method]
known_branch_points:
  - "What should happen on offline-edit conflict?"
known_invalidations: []
```

### Starter set (seven briefs)

| # | Brief | Active kernels (expected) | Stretches |
| --- | --- | --- | --- |
| 1 | **Offline Kanban** | State/lifecycle, containment, concurrency, resource accounting, derived data, temporal | Kernel doc's flagship; broad behavioral coverage |
| 2 | **Role-based document sharing** | Identity, authority, containment, temporal (revocation), observability, change/migration | Authority cascades; nested inheritance |
| 3 | **Subscription billing** | Resource accounting, state/lifecycle, transactions, external effects, error/recovery, temporal | Transaction + external-effects boundary; assurance-level pressure |
| 4 | **Calendar scheduling with notifications** | Concurrency (overlap), authority, external effects, error/recovery | External-effects + recovery semantics |
| 5 | **Knowledge-graph editor (meta)** | Identity, containment, change/migration, observability, validation | Brunch describing itself; sanity check on the modelling |
| 6 | **Verified sort algorithm** | Validation/normalization, formal properties only | Narrow but stretches `formal_property` requirements, `Obligation` nodes, `proof` / `model_check` validation methods, and assurance-level computation |
| 7 | **"Notion meets Linear meets Slack"** | Forces scope-boundary clarification before any kernel can engage | Adversarial; stresses offer-first interaction and scope-card affordance |

Briefs 1–3 are already worked out in [`BEHAVIORAL_KERNELS.md`](file:///Users/lunelson/Code/hashintel/brunch-next/docs/design/BEHAVIORAL_KERNELS.md); they should be the first three captured.

### Brief #7 expectations — "Notion meets Linear meets Slack"

This brief is intentionally vague and over-scoped so that the interviewer is forced to refuse forward motion until product framing crystallises. Its captured run is therefore evaluated on a different axis from briefs 1–6: its golden outcome is *scope clarification*, not kernel coverage.

Expected by termination of the run (whether the run terminates in success or in an explicit "cannot proceed" state):

- At least one `product_concept` node exists with `authority = 'stakeholder'`.
- At least one `problem` node exists with a `motivates` edge to a `product_concept`.
- At least one `persona` node exists with a `realizes` or `targeted_by` edge to a `product_concept` or `problem`.
- At least one `non_goal` exists (rendered as a constraint subtype with `framing_as = 'non_goal'`), explicitly carving out something the system will not do.
- The kernel-activation gate (`product_concept` ∧ `problem` ∧ `persona` ∧ `non_goal`) is recorded as either *met* or *not met* on the run's terminal transcript entry; if met, the interviewer must have transitioned at least one kernel from latent to active before termination.
- The change log contains at least one `brunch.lens_switch` or equivalent scope-card affordance entry, evidencing that the interviewer actively pushed back on scope rather than silently absorbing it.

A run for brief #7 that terminates with kernels active but with none of `product_concept`, `problem`, `persona`, `non_goal` present is a property-regression failure: the interviewer admitted kernel activation without satisfying the activation gate.

### Adversarial briefs (second tier)

| Brief | Targets |
| --- | --- |
| **"Changing my mind"** — persona starts with one assumption, retracts it mid-spec | Assumption-invalidation cascade end-to-end |
| **"Contradictory requirements"** — persona supplies two requirements that become mutually exclusive after a third question | Coherence detection |
| **"Long horizon"** — persona iterates over 50+ turns | Compaction-aware continuity (M9); lens switches across compaction boundaries |
| **"Cross-session paired"** — two briefs that operate on the same spec workspace and produce relevant changes for each other | `worldUpdate` interest-set filtering (M7) |

## Agent-as-user harness

The agent-as-user is a thin driver that exercises the JSON-RPC stdio surface end to end. It does three things:

1. Opens a JSON-RPC stdio connection to `brunch --mode rpc`.
2. Subscribes to the session's offer stream (`brunch.offer` custom messages per [pi-seam-extensions §4](file:///Users/lunelson/Code/hashintel/brunch-next/docs/next/architecture/brunch-poc-pi-seam-extensions.md#4-assistant--and-system-offer-first-interaction-with-multi-choice-answers)).
3. For each offer, calls an LLM with the brief, the persona dials, and the offer envelope; collects the response (`brunch.offer_response`); posts it back over RPC.

### Termination conditions

- The session emits a `spec.approved` or equivalent terminal signal.
- A configurable max-turns ceiling.
- A token-cost ceiling per run.
- A `brunch.needs_human` outcome the persona is configured not to fulfil.

### Minimal user-agent system prompt

```
You are simulating a user with this product brief:

{brief}

Personality:
- Style: {persona.style}
- Domain literacy: {persona.domain_literacy}
- Patience: {persona.patience}
- You may change your mind on prior answers with probability {persona.change_mind_probability}.

You are talking to a guided spec-elicitation tool. It will offer you
choices and questions. Respond as the user described above. Be
consistent with your prior answers unless you decide to change your mind.
If you change your mind, say so explicitly.
```

### Posture

- The user-agent has **no** access to Brunch's graph plane or transcript substrate. Its only channel into the session is the offer/response stream over JSON-RPC. This keeps the test path identical to the production interaction path.
- The user-agent is itself a single pi-coding-agent (or thinner) session in a separate process, configured to *not* discover any project context. It is not a Brunch session and does not run lens machinery.
- Runs are deterministic given the same model, temperature, brief, persona, and offers — but the entire pipeline is designed to tolerate non-determinism via the property-regression layer.

## Run fixture bundle

A captured run produces four artefacts under `.brunch-fixtures/<brief-id>/<run-id>/`:

| File | Contents |
| --- | --- |
| `<run-id>.jsonl` | The full pi JSONL session transcript including all custom entries (`brunch.offer`, `brunch.offer_response`, `brunch.lens_switch`, `brunch.spec_switch`, `brunch.kernel_activation`, `brunch.side_task_result`, `worldUpdate`) |
| `<run-id>.graph.json` | A snapshot of all spec-workspace graph planes at run termination: nodes, edges, per-entity versions, current graph LSN |
| `<run-id>.coherence.json` | Coherence verdict at termination, including per-plane status and any open violations |
| `<run-id>.meta.json` | Run metadata: brief id, persona dials, model, timestamps, total turns, total tokens, terminal reason, agent-as-user prompt hash |

The transcript is the load-bearing artefact for **replay regression**; the graph + coherence files are load-bearing for **property regression**.

## Milestone mapping

The fixture harness threads through the existing milestone ladder; it does not need its own milestone.

| Milestone | Fixture work |
| --- | --- |
| **M0** (walking skeleton + TUI) | Begin capturing briefs as YAML. Manually-driven runs at the TUI produce first JSONL captures. Briefs cost nothing to write; the longer the library, the more leverage later. |
| **M1** (mode shell: print + rpc) | Stand up the agent-as-user harness against `brunch --mode rpc`. First **replay regression** fixtures land here, asserting transcript reproduction only. Graph plane does not yet exist; assertions are transcript-shaped. |
| **M2** (JSONL session viability) | The captured transcripts *are* the JSONL session files. The fixture library's reproducibility is part of M2's evidence. |
| **M3** (web shell) | The same offer-response fixtures drive the web client through its WebSocket; free coverage of the web shell against known-good runs. |
| **M4** (graph data plane) | Graph snapshots become part of the run-fixture bundle. The first **property regression** assertions land here. |
| **M5** (agent ↔ graph) | Kernel-card outputs become observable in the graph. Briefs grow per-kernel-card coverage assertions. |
| **M6** (authority model + gated tools) | Adversarial briefs that request human-gated actions in print/RPC mode become regression fixtures for the structured-`needs_human` outcome. |
| **M7** (detection, relevance, turn-boundary reconciliation) | Cross-session paired-brief fixtures land here. The "changing my mind" adversarial brief becomes a property-regression fixture for assumption cascade. |
| **M8** (coherence as first-class) | "Contradictory requirements" adversarial brief becomes a property-regression fixture for coherence verdict emission. |
| **M9** (compaction-aware continuity) | "Long horizon" adversarial briefs land here as regression for compaction. Property assertions include "session-scoped `lastSeenLsn` survives compaction." |

## Two secondary benefits

1. **The fixture library is its own form of design pressure.** Curating briefs forces explicit articulation of what kinds of products Brunch should be able to elicit specs for. That articulation is itself a useful design artefact and feeds back into kernel-card prioritisation.
2. **The agent-as-user harness *is* a Brunch demo.** Running `brunch demo offline-kanban` produces a fully populated spec workspace and a transcript that can be replayed for stakeholders. The same harness becomes the basis for screencast and integration-test demos with zero additional work.

## Open questions

1. Whether the agent-as-user should be a pi-coding-agent session or a thinner harness (just a model client). The pi-coding-agent path gets transcript capture for free; the thinner path is cheaper to run in CI.
2. Whether briefs should be stored under `.brunch-fixtures/` in the brunch-next repo, in a sibling repository, or in `docs/next/architecture/artifacts/` alongside other captured exhibits.
3. Whether replay regression should attempt full transcript reproduction or only assert that the *graph* matches after a free-running replay. Full reproduction is brittle to model upgrades; graph-only is more durable but loses transcript-level signal.
4. Whether the agent-as-user should run with the same model as the Brunch session under test, or a deliberately different one (to surface model-dependent kernel-card behaviour).
5. Whether to surface a `brunch fixtures capture <brief-id>` and `brunch fixtures replay <brief-id> <run-id>` CLI sub-command set, or keep fixture tooling external to the Brunch binary.
6. How to handle PII or sensitive content in adversarial briefs that involve realistic-looking data. The POC's briefs are synthetic; this is a deferred concern.
