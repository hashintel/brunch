---
name: ln-sync
description: "Refresh `memory/SPEC.md` and `memory/PLAN.md` in mature mode — restore canonical truth, archive retired plan history, delete stale derivative artifacts, and flag drift against code."
---

# Ln Sync

Audit and refresh the canonical documents so they stay lightweight enough for fast re-entry.

`ln-sync` is the family-wide ontology repair and garbage-collection pass. Merge equivalent facts, repair stale references, and delete exhausted derivative artifacts. Only `docs/archive/PLAN_HISTORY.md` acts as archive history.

Apply the repo's pre-release posture: optimize canonical memory for the model we now believe in, not compatibility with stale docs. Retire superseded claims, delete obsolete derivative artifacts, and tighten lexicon drift instead of preserving historical aliases in active truth.

## When to run

Prefer `ln-sync` at these moments:

- milestone boundaries
- before major refactors
- at handoff / context compaction
- when `memory/SPEC.md` or `memory/PLAN.md` feels overweight

## Document roles

| File | Authority | Keep live |
| --- | --- | --- |
| `memory/SPEC.md` | what and why | product contract, live architecture register, future direction pointers, lexicon, verification stance |
| `memory/PLAN.md` | what's next | sequencing, frontier definitions, near-horizon items, recent completions |
| `docs/archive/PLAN_HISTORY.md` | historical ledger | older completed phases and retired plan history |
| `HANDOFF.md` | derivative volatile transfer | only unfinished chat state not yet reconciled |
| `memory/cards/<frontier-id>--<slug>.md` | derivative scope files | only unfinished prepared scope cards; one file per concern; multiple files per frontier permitted for independent concerns |
| `memory/REFACTOR.md` | derivative temporary execution plan | only unfinished refactor steps |
| `src/**/TOPOLOGY.md` | canonical current-state for its subtree; SPEC decisions cite it as event+pointer, not a duplicate | ownership statement, SPEC decision references, dependency rules, layout sketch, live migration notes (see `AGENTS.md` §topology files) |

**Notation aid.** When refreshing SPEC or PLAN:

- **Preserve existing `pseudo` artifacts** (tree, chain, graph, matrix, state-machine, data-shape, lanes). Do not collapse a `pseudo` form back into prose — these are denser, more diffable, and more agent-navigable than equivalent text.
- **Consolidate prose into `pseudo` forms** when prose has grown that meets the routing criteria (see `pseudo` SKILL routing chain) — paragraph-length acceptance criteria → `tree`, hand-drawn dependency tree with cross-edges hiding in prose → `graph`, scattered comparison bullets → `matrix`.
- **Apply smell-to-switch rules** when reshaping. An artifact may have outgrown its current family (e.g. a tree whose siblings now interact → graph).
- A change that *replaces* prose with an equivalent `pseudo` artifact counts as a sync improvement, not a content edit; surface it as such in the change summary.

## Procedure

### 1. Read the current docs

If either `memory/SPEC.md` or `memory/PLAN.md` is missing, route to `ln-spec` or `ln-plan` first.

### 2. Weight check

Ask whether each file is still serving re-entry.

- If `memory/SPEC.md` is carrying embedded truths, old implementation detail, closed historical debates, or validated assumptions that no longer shape frontier work, prune it.
- If `memory/PLAN.md` is mostly completed history, collapse it to a rolling frontier and archive the rest.
- If `HANDOFF.md`, any scope file under `memory/cards/`, or `memory/REFACTOR.md` no longer carries live temporary state, delete it. For `memory/cards/`, delete per-file with literal paths — never bulk-operate on the directory.

### 3. SPEC pass — keep only live architecture

Use the mature SPEC shape as the target unless the project has an explicit alternate shape:

- **Product Contract** — concept, constraints / non-goals, grouped capability requirements.
- **Live Architecture Register** — open assumptions, active decisions, critical invariants.
- **Future Direction Register** — directional bets with PLAN/design-doc pointers.
- Compact model / architecture sections only while they still serve as SPEC authority.
- Lexicon and Verification Design.

For each item in `memory/SPEC.md`, choose one:

- **keep live** — still unresolved or still constrains future work
- **update** — wording / evidence / scope changed
- **compress / merge** — overlaps another live row or carries too much rationale
- **retire embedded** — fully shipped and now protected by code/tests/design docs
- **move rationale** — valuable context, but too detailed for SPEC; keep a short guardrail and link to a design doc
- **migrate to co-located home** — the decision's current-state body (topology, layout, dependency direction, concrete surface) is owned by a co-located `src/**/TOPOLOGY.md` (see `AGENTS.md` §topology files). Ensure that `TOPOLOGY.md` holds the state, then thin the SPEC decision to event + pointer (chosen seam, rationale, supersession, → `TOPOLOGY.md`). A decision is archivable once its current state lives in a co-located `TOPOLOGY.md` or invariant.
- **future direction** — not current product contract; move under Future Direction Register or ensure PLAN owns it
- **remove** — moot, superseded, redundant, or implementation diary

#### Keep in SPEC

- stable product contract
- constraints and non-goals
- capability requirements
- open assumptions only
- current spine decisions and durable seam-defining decisions
- critical seam-level invariants only
- future direction pointers that shape sequencing
- lexicon
- verification stance / commands / blind spots

#### Remove from SPEC

- implementation diary entries
- historical completion notes already reflected in code or tests
- micro-variant decisions / invariants that are embedded in a larger seam
- validated assumptions that no longer change future work
- detailed design-doc prose, card styling minutiae, or exhaustive test inventories
- future acceptance criteria that PLAN should own until the work is active

Validated assumptions retire by default. Promote the durable residue only when it still constrains active work: product facts go to Product Contract, architectural authority goes to Active Decisions / Critical Invariants, vocabulary goes to Lexicon, and sequencing implications go to PLAN.

Do **not** remove durable seam rationale merely because code and tests now exist. Prune micro-decisions, not the architectural spine.

When syncing from canonical design docs or from outputs previously produced by `ln-design` / `ln-oracles`, preserve translation fidelity:

- Cross-cutting subsystems or mechanisms that still shape active/next frontier work must not be reduced to lexicon-only mentions.
- Enforcement mechanics that make an invariant real must survive somewhere in the live register if dropping them would permit a superficially compliant but architecturally wrong implementation.
- Verification architecture already adopted by the project (for example replay/property/adversarial layers or fixture bootstrapping strategy) must remain visible in `memory/SPEC.md` even if `ln-oracles` has not yet elaborated the full oracle-design sections.
- Chosen design shapes from `ln-design` should collapse to the durable winner and its tradeoffs, not vanish entirely because the alternatives are no longer live.

Merge equivalent assumptions, decisions, and invariants instead of carrying parallel rows for the same seam-level fact. When rows merge or move, repair the references that point at them.

When pruning, leave concise HTML comments naming removed IDs when useful. Do not renumber survivors.

### 4. PLAN pass — restore the rolling frontier

Prefer the conflict-resistant mature shape:

- `Context`
- `Sequencing`
  - `Active`
  - `Next`
  - `Parallel / Low-conflict`
  - `Horizon`
- `Frontier Definitions`
- `Recently Completed`
- `Dependencies`

Rules:

- treat **frontier items** as the canonical plan/Linear/branch units
- treat **slices** as scoped execution units from `ln-scope` / `ln-build`, usually inside one frontier item
- edit `Sequencing` for ordering/status churn; do not move or rewrite `Frontier Definitions` merely to reorder work
- keep detailed scope-card sequences out of `memory/PLAN.md`; use scope files under `memory/cards/` for temporary slice-execution sequences and at most a lightweight pointer from the frontier definition listing active scope file path(s)
- move older completed items to `docs/archive/PLAN_HISTORY.md`
- keep only the last 2-3 completed items live
- only active / next frontier definitions need detailed acceptance or traceability
- keep dependency diagrams limited to active / next frontier ids
- keep enough `Why now / unlocks` context that a fresh thread can understand frontier ordering without reading the full archive
- do not archive handoffs, refactor plans, or sync reports
- reconcile the `## Initiatives` (arc) index if present: refresh each arc's member roster and per-member status against `Sequencing`, and **close an arc only when its done-definition actually holds** — including reconciliation of co-located topology files and discharge of any standing-obligation residue scoped to the arc. An arc whose members are all done but whose trailing topology/residue cleanup is outstanding is **not** done; keep it `◐ active` with the residue named. Retire a fully-closed arc to a one-line `Recently Completed`-style note (or drop it) rather than carrying its full block indefinitely.

### 5. Drift and ontology check

Scan recent code / commits for:

- new domain concepts not reflected in the lexicon
- durable decisions not reflected in `memory/SPEC.md`
- active work not represented in `memory/PLAN.md` sequencing or frontier definitions
- stale references between `memory/PLAN.md` and `memory/SPEC.md`, especially PLAN links to retired assumptions / decisions / invariants
- equivalent facts that should merge instead of coexisting
- coverage frontiers whose class (`buildable-now`, `evidence-gated`, `wait-gated`) no longer matches code reality or the live cards
- coverage rows missing a named owner, closure oracle, or source-of-truth inputs where the row's behavior is not otherwise self-evident
- temporary ledgers declared exhausted while a required row is still `spec` / `new` / `partial`, including rows that have merely been promoted into `PLAN`
- promoted last-open coverage rows that are sequenced behind unrelated new coverage frontiers without an explicit user reprioritization
- coverage cards whose promised derivation or legality logic cannot be justified from the source-of-truth inputs named in the card
- sweep ledgers that grew multiple `new` rows mid-flight, signaling that the inventory was not actually closed
- prepared cards in scope files under `memory/cards/` that should be retired, re-scoped, or reconciled into the next thread's live state
- stale derivative artifacts that should be deleted after reconciliation
- cross-cutting subsystems that appear only in glossary/design-doc links but are required by multiple active/next frontiers
- verification strategy that is present in canonical docs or frontier definitions but absent from `memory/SPEC.md` §Verification Design
- chosen module/API shapes or seam obligations from `ln-design` output that active frontier work still depends on
- **topology files under `src/**/` out of sync with reality**: SPEC decision IDs cited in a README that this sync just renumbered or retired; named files/modules that have moved, been renamed, or been retired; dependency-direction assertions that no longer match actual imports; layout sketches whose entries no longer match the directory's contents; migration notes describing state that has since shipped or been abandoned (see `AGENTS.md` §topology files)
- **arcs (`## Initiatives`) out of sync**: an arc marked done whose done-definition does not actually hold (outstanding topology-README reconciliation or undischarged residue); an arc roster missing a member frontier that clearly belongs to the through-line; an active multi-frontier through-line visible in the SPEC decision chain but absent from the arc index; a completed arc still carrying a full block long after closure

### 6. Garbage-collect derivative artifacts

Delete exhausted temporary artifacts after their useful state has been reconciled:

- remove stale `HANDOFF.md` files instead of preserving them as archive breadcrumbs
- remove exhausted scope files under `memory/cards/` (per-file, literal paths) instead of letting old prepared cards masquerade as live work
- remove completed `memory/REFACTOR.md` files instead of leaving completion notes or pointers
- if an ad hoc planning/status file was created with explicit permission and is now exhausted, reconcile any durable facts, then delete it unless the user asked to keep it

### 7. Report and update

Produce a concise sync report and make the edits.

```md
## Sync Report

### Pruned
- [items removed, merged, or moved and why]

### Archived
- [history moved to PLAN_HISTORY.md]

### Garbage-collected
- [temporary artifacts deleted and why]

### Drift fixed
- [concept / decision / frontier / traceability updates made]

### Coverage protocol audit
- [classification repairs, temporary-ledger contradictions, promotion/ordering fixes, or `none`]

### Retirement assessment
- [whether embedded items were sufficiently retired, or whether a stronger protocol / follow-up frontier is needed]

### Remaining live items
- [important assumptions or frontier work that still matter]
```

Before finishing, perform a cross-skill preservation check:

- If a later agent read only `memory/SPEC.md` and `memory/PLAN.md`, what durable design choices from `ln-design` would they miss?
- What verification architecture or loop-tier strategy from `ln-oracles` or canonical docs would they miss?
- What cross-cutting obligations would disappear because they are carried only by links, not by live rows or frontier definitions?
- Would they know which temporary sweep ledgers are still live, which promoted rows still keep those ledgers open, and why those rows sequence where they do?
- Do any topology files under `src/**/` still cite SPEC IDs or describe topology this sync just changed? Reconcile those READMEs as part of the sync, not as a follow-up.
- If a multi-frontier through-line exists, would they see it as an arc in `§Initiatives` with an honest done-definition, or would they have to reconstruct it from the SPEC decision chain?

If any answer is non-empty, sync is incomplete.

## Routing

After sync, present these options to the user (use `tool-ask-question`):

| #   | Label             | Target       | Why |
| --- | ----------------- | ------------ | --- |
| 1   | Scope next item   | `ln-scope`   | Docs are current and the next slice is ready |
| 2   | Revisit the plan  | `ln-plan`    | Sync changed priorities or exposed new frontier work |
| 3   | Back to triage    | `ln-consult` | Direction needs reassessment |

Recommended: **1** if the frontier is still sound, **2** if sync materially changed it.
