# `dev-*` vs `ln-*` Comparative Analysis

Date: 2026-04-06

## Purpose

This note captures a comparative assessment of the `dev-*` skill family in `dot-agents` against the `ln-*` rewrite in `brunch`.

It has two goals:

1. Preserve the current assessment for ongoing `ln-*` development.
2. Define a **targeted back-port set**: the parts of `ln-*` that should likely fold back into `dev-*` without importing the full heavier protocol stack.

One important exception: `dev-talkthrough` is a later addition that exists only in `dev-*`. It should be preserved as a distinct skill rather than treated as a missing `ln-*` equivalent.

## High-Level Verdict

It looks like time to consolidate, but not by replacing `dev-*` wholesale with `ln-*`.

The `ln-*` rewrite has real methodological improvements, especially around:

- updating existing planning artifacts instead of always writing from scratch
- treating uncertainty as a first-class planning input
- separating verification strategy into an explicit design activity
- tightening cross-document traceability

But `ln-*` is still visibly WIP. Some of its strongest ideas depend on a heavier document contract that does not exist in `dev-*` yet, and some files still carry local workflow assumptions or internal inconsistencies.

Recommendation: treat `ln-*` as a design branch and **selectively merge its stronger ideas back into `dev-*`**, while preserving the lighter-weight character of the `dev-*` family.

## What `ln-*` Improves

### 1. Update-aware spec and plan workflows

`ln-spec` and `ln-plan` are much better than their `dev-*` counterparts at handling living documents.

- `ln-spec` supports a clear **patch vs full pass** distinction.
- `ln-spec` treats an existing `memory/SPEC.md` as prior state to evolve, not a blank slate.
- `ln-plan` supports targeted edits and re-ordering instead of assuming a full rewrite.
- `ln-plan` explicitly retires completed work and reassesses remaining work before planning forward.

This is a meaningful improvement over the simpler `dev-spec` / `dev-plan` model.

### 2. Uncertainty-aware planning

`ln-plan` introduces two strong ideas that should probably survive consolidation:

- **Epistemic horizon**: do not plan deeper than current confidence supports.
- **Spike economics**: evaluate assumptions by fan-out, falsification cost, and decision unlock value.

This makes planning sharper than a generic slice list. It turns planning into sequencing under uncertainty rather than mere decomposition.

### 3. Better elicitation in `ln-grill`

`ln-grill` improves the `dev-grill` posture in two useful ways:

- It explicitly names anti-patterns when a design is drifting toward one.
- It sharpens lexicon formation during elicitation instead of waiting until spec-writing.

Those are good judgment upgrades and do not require a heavier protocol to be useful.

### 4. Stronger scope/build contract

`ln-build` is clearer that the canonical path is `scope -> build`, and that a raw behavior description is only acceptable when scoping would be pure ceremony.

That is a good tightening of the execution loop.

### 5. Better sync discipline

`ln-sync` is materially more mature than `dev-sync`.

Its strongest improvement is the **pruning model**:

- assumptions and decisions are not meant to accumulate forever
- tracked items can become confusion surfaces once they are embedded, moot, or superseded
- stable IDs should survive pruning; surviving records should not be renumbered

This is valuable, though it depends on a more structured document format than current `dev-*` uses.

### 6. Verification as first-class design work

`ln-oracles` is the largest genuine expansion in the rewrite.

It contributes three important ideas:

- verification strategy deserves its own skill rather than being buried in generic spec prose
- observability / reproducibility / controllability are useful diagnostic dimensions before selecting test strategy
- oracle families and loop tiers are a better framing than only saying "unit / integration / e2e"

This is the strongest conceptual addition in `ln-*`.

## Where `ln-*` Is Still WIP

### 1. The family router does not know the whole family

`ln-consult` does not route to `ln-oracles`, even though `ln-oracles` is clearly treated elsewhere as part of the core method.

That means the family's entrypoint does not fully model the family it is supposed to triage.

### 2. Handoff does not cover the full system

`ln-handoff` is still modeled around only part of the lifecycle.

Its flow sketch covers:

`grill -> spec -> plan -> scope -> [spike] -> build -> review -> [sync]`

That omits:

- `ln-design`
- `ln-refactor`
- `ln-oracles`

Its volatile-artifact checklist likewise omits these skill outputs.

### 3. Scope knows about oracles, but routing does not fully reflect that

`ln-scope` can tell the agent to run `ln-oracles` first if no oracle strategy exists, but it does not include `ln-oracles` in its routing options.

That is a real consistency gap.

### 4. Some command references are too local

`ln-spec` uses slash-command references like `/ln-grill` and `/ln-design`.

That feels tool-environment-specific rather than skill-system-generic, and would likely want normalization before broader adoption.

### 5. PRD language still lingers

`ln-grill` still says:

> Understanding is sufficient for a PRD

This is a carry-over relic, not aligned with the current `SPEC.md` / `PLAN.md` vocabulary.

### 6. The issue/branch protocol is embedded in live templates

This is the biggest reason not to import `ln-*` wholesale.

The `ln-plan` template still includes live fields for:

- `ISSUE-ID`
- `Branch`

Those are not just provenance notes; they shape output. That makes the current `ln-*` document model partly brunch-local.

## The Core Architectural Difference

The two families are not just two phrasings of the same workflow.

### `dev-*` is a lighter conversational methodology

`dev-*` relies on helpful artifacts, but the documents are comparatively loose:

- `dev-plan` creates a simple roadmap
- `dev-spec` creates a broad spec
- `dev-build` does not require systematic document maintenance after implementation

This makes it easier to use and easier to port across repos.

### `ln-*` is a governed document system

`ln-*` assumes stronger structure in `SPEC.md` and `PLAN.md`:

- numbered requirements
- stable assumption IDs
- decision supersession chains
- invariant tracking
- explicit coverage tables
- per-slice traceability
- ownership boundaries between skills

That structure is powerful when the whole family is aligned around it, but expensive when only half the system participates.

## Targeted Back-Port Set

These are the `ln-*` ideas that look worth folding back into `dev-*`.

### Safe to port soon

1. Patch/update mode for `dev-spec`
2. Patch/update mode for `dev-plan`
3. Epistemic horizon and spike economics in planning
4. Anti-pattern naming and lexicon-tightening in `dev-grill`
5. Stronger "scope card first" language in `dev-build`
6. A dedicated `dev-oracles` skill, introduced as optional hardening rather than mandatory ceremony

### Worth porting later, only if the document model grows

1. Pruning with stable IDs in `dev-sync`
2. Invariant tracking
3. Rich cross-reference integrity checks
4. Post-build traceability bookkeeping into `SPEC.md` / `PLAN.md`

These depend on a more structured artifact format. They should not be imported before the destination document model can support them cleanly.

## What Should Not Be Ported Back

### 1. Issue-tracker and branch metadata in planning artifacts

Do not port the live `ISSUE-ID` and `Branch` fields from `ln-plan` templates into `dev-*`.

Those are brunch workflow bindings, not generally reusable methodology.

### 2. Mandatory bookkeeping before the schema exists

Do not port the mandatory post-build or post-spike bookkeeping from `ln-build` / `ln-spike` until `dev-*` has a document model capable of supporting it coherently.

Otherwise the process becomes heavier without actually becoming clearer.

### 3. Renaming `ROADMAP.md` to `PLAN.md`

Do not treat this as a superficial rename.

In `ln-*`, `PLAN.md` is tied to a deeper shift in structure and traceability. The name only makes sense in the context of that broader contract.

### 4. Dropping `dev-talkthrough`

`dev-talkthrough` is a later addition in `dev-*`, not a failed or missing part of `ln-*`.

It should be preserved as a distinct outside-in explanatory skill rather than forced into the main lifecycle.

## Recommended Consolidation Strategy

### Near term

Evolve `dev-*`, do not replace it.

Recommended first ports:

1. `ln-grill` improvements into `dev-grill`
2. `ln-spec` patch/update behavior into `dev-spec`
3. `ln-plan` uncertainty-aware planning into `dev-plan`
4. `ln-build` scope-card-first behavior into `dev-build`

### Next layer

Introduce a lighter-weight `dev-oracles`:

- verification strategy as explicit work
- loop tiers and oracle families as design vocabulary
- no requirement that every slice carry the full `ln-*` oracle protocol
- no dependency on branch/issue metadata

### Only after that

If `dev-*` later adopts more structured artifacts, then revisit:

- invariant tracking
- stable IDs in assumptions / decisions
- pruning rules in sync
- cross-reference integrity checks
- richer completion bookkeeping

## Implications for Ongoing `ln-*` Development

If `ln-*` continues as a local brunch methodology, it should choose one of two directions explicitly:

### Option A: finish the governed-document model

If the intent is to keep the heavier protocol, then `ln-*` should be tightened so the whole family actually participates in it:

- add `ln-oracles` to `ln-consult`
- add `ln-oracles`, `ln-design`, and `ln-refactor` to `ln-handoff`
- fix `ln-scope` routing around oracle design
- remove PRD wording
- normalize tool-local command references

### Option B: trim back to the portable core

If the intent is to align closer to `dev-*`, then the best path is probably:

- keep the update-aware planning/spec behavior
- keep the uncertainty and verification thinking
- remove workflow-specific artifact fields from templates
- reduce mandatory bookkeeping that depends on the full traceability regime

## Working Recommendation

For consolidation work, the best default posture is:

1. Preserve `dev-talkthrough` as-is.
2. Port the high-value, low-ceremony `ln-*` improvements back into `dev-*`.
3. Do **not** import the full governed protocol unless `dev-*` intentionally grows into that stronger document system.
4. Treat `ln-oracles` as the most promising new skill to adapt, but adapt it downward into a lighter-weight form first.
