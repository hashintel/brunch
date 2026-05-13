# SPEC Restructure Plan

> Status: proposed one-off workflow doc.
> Created: 2026-05-13.
> Purpose: capture the intended cleanup for `memory/SPEC.md` before splitting this work into a separate branch / PR. Delete this file after the restructure is completed or explicitly abandoned.

## Goal

Make `memory/SPEC.md` lighter, more structurally resistant to branch conflicts, and clearer about what belongs in the live architecture register versus historical/product-embedded truth.

The cleanup should preserve durable product/architecture authority while retiring rows that are already fully embedded in code, tests, or design docs.

## Diagnosis

`memory/SPEC.md` now mixes several kinds of truth in one long mutable document:

1. **Stable product contract** — concept, non-goals, durable product requirements.
2. **Live uncertainty** — assumptions still awaiting validation or still shaping frontier work.
3. **Current architectural guardrails** — decisions and invariants that actively constrain near-term work.
4. **Historical embedded decisions** — shipped seams whose rationale is now code/test/design-doc truth.
5. **Future direction** — semantic/generative/agent/provider trajectories not yet productized.
6. **Verification policy and coverage** — useful, but partly over-detailed as implementation/test history.

This creates churn because ordinary feature work edits the same numbered tables/sections, and because sequential IDs (`Requirement N`, `A##`, `D###`, `I###`) are collision-prone across branches.

## Desired document shape

Target structure, to be refined during the cleanup:

```md
# Brunch v2 — Spec Elicitation Tool

## Product Contract
### Concept
### Constraints & Non-goals
### Capability Requirements
#### Runtime & persistence
#### Interview workflow
#### Knowledge / intent graph
#### Review & export
#### Workspace / graph UI
#### Provider / agent substrate

## Live Architecture Register
### Open Assumptions
### Active Decisions
### Critical Invariants

## Future Direction Register
### Semantic / generative substrate
### Agent capability substrate
### Provider / workspace hardening

## Interaction Stream Model
[keep if still actively useful, but compress or move details to design docs]

## Layout Architecture
[compress; move design-level detail out if it is no longer needed as SPEC authority]

## Lexicon

## Verification Design
```

Principles:

- Separate **stable product contract** from **live architecture register** from **future direction**.
- Keep `SPEC.md` as the authority for active constraints, not as the full archive of how each seam was built.
- Prefer short guardrails plus links to design docs over long design-doc-scale paragraphs.
- Do not renumber surviving tracked IDs unless the cleanup explicitly adopts a new ID scheme.
- Leave concise retirement comments for removed ID ranges when useful.

## Assessment pass

Classify each tracked row before editing:

| Classification | Meaning | Action |
| --- | --- | --- |
| keep live | Still unresolved or actively constrains near-term work | Keep, possibly tighten wording |
| compress / merge | Overlaps another row or carries too much rationale | Merge into one active guardrail |
| retire embedded | Fully shipped and now protected by code/tests/design docs | Remove from live table; optionally note retired IDs in an HTML comment |
| move rationale | Valuable context but too detailed for SPEC | Keep a short SPEC guardrail and point to design doc |
| future direction | Not current product contract but shapes frontier work | Move under Future Direction Register or ensure PLAN owns it |

### Assumptions to inspect first

Strong candidates:

- `A82`, `A83` — already validated; likely retire from live assumptions unless still needed as FE-701 constraints.

Possible embedded/product-fact candidates:

- `A51`, `A53`, `A54`, `A55` — workspace turn-card / activity / frontier projection assumptions may now be product facts or invariants.
- `A59`, `A60`, `A63` — prompt/question/header assumptions may be embedded or lower-priority watch items.
- `A64` — query invalidation may have become a concrete architectural decision/invariant if already built.
- `A66`–`A70` — graph/relation assumptions should be checked against shipped graph view and FE-700 direction.
- `A71`–`A73`, `A77`–`A81`, `A84`–`A91`, `A93` — likely still live future/semantic/generative assumptions; may move to Future Direction Register.

### Decisions to inspect first

Potential merge/compression clusters:

- Runtime / stream / workflow cluster:
  - `D22`, `D89`, `D93`, `D94`, `D95`, `D96`, `D110`, `D112`, `D113`, `D116`, `D121`, `D123`, `D114`
  - Goal: compress overlapping turn-centered stream, projected controls, lifecycle, observer backlog, route/query ownership, and continuous workspace guardrails.

- Graph / side-chat / semantic mutation cluster:
  - `D80`, `D125`, `D134`, `D135`, `D136`, `D137`, `D138`, `D144`, `D145`, `D146`, `D149`, `D150`, `D152`
  - Goal: keep current semantic direction and active changeset/reconciliation guardrails; retire or compress older side-chat/revisit wording superseded by multi-chat + reconciliation docs.

- Prompt/context / agent capability cluster:
  - `D139`, `D140`, `D141`, `D142`, `D143`, `D147`
  - Goal: keep concise active guardrails for prompt/context substrate and Brunch-owned mutation surface; move implementation boundary detail to design docs where possible.

- Candidate/scenario strategy cluster:
  - `D126`, `D127`, `D148`, `D151`
  - Goal: separate current product contract from future strategy/proposal direction.

- Provider/workspace hardening cluster:
  - `D130`, `D131`, `D132`, `D133`
  - Goal: likely keep as active near-term frontier constraints; wording can be shorter.

### Invariants to inspect first

Keep only critical seam-level invariants live.

Candidates to compress or retire:

- Rows that primarily enumerate test filenames or implementation history rather than a reusable invariant.
- Older invariants whose protected behavior is fully covered by a broader newer invariant.
- Planned invariants for not-yet-built future work should be checked against `memory/PLAN.md`; if they only describe future acceptance criteria, PLAN may be the better home until implemented.

Likely keep live:

- Distribution/runtime startup invariants (`I4`, `I100`).
- Boundary/schema invariants (`I17`, `I48`, `I54`).
- Workflow/turn/lifecycle invariants (`I24`, `I72`, `I87`, `I104`, `I105`, `I108`, `I110`).
- Current frontier invariants for provider/gitignore/agent/changing semantic substrate (`I106` onward), if they still correspond to active PLAN frontier items.

## Rewrite pass

1. Create a branch specifically for SPEC restructuring.
2. Read `memory/SPEC.md`, `memory/PLAN.md`, and current design docs named by SPEC rows.
3. Classify rows using the assessment table above.
4. Rewrite `SPEC.md` into the target structure.
5. Preserve cross-reference integrity:
   - `PLAN.md` frontier definitions still point at surviving SPEC requirements/assumptions/decisions/invariants.
   - Retired IDs are not referenced by live PLAN frontier definitions unless intentionally historical.
   - Design docs carry detailed rationale that SPEC no longer repeats.
6. Run link/reference checks if available, then `npm run fix` and `npm run verify` before PR.

## Output expectations

The completed PR should include:

- `memory/SPEC.md` rewritten / pruned.
- Any necessary small updates to `memory/PLAN.md` traceability references caused by retired/merged SPEC rows.
- Optional updates to `ln-spec` / `ln-sync` instructions **only if** the restructure changes the intended SPEC shape.
- Deletion of this `memory/SPEC_RESTRUCTURE.md` file once its plan has been executed or superseded.

## Non-goals

- Do not change product behavior.
- Do not add new requirements just because there is a new section for them.
- Do not migrate to a structured generated spec registry in this pass; that remains `structured-development-spec-registry` horizon work.
- Do not rewrite design docs unless a SPEC row is moved there and the target doc needs a small anchor.
- Do not renumber surviving IDs casually.

## Open design questions for the restructure branch

1. Should requirements remain a single numbered sequence, or should they become grouped stable IDs by capability area?
2. Should assumptions/decisions/invariants stay as global tables/lists, or be grouped by subsystem to reduce edit conflicts?
3. Should validated assumptions be removed immediately, or retained for one release window with a retirement note?
4. How much of Interaction Stream Model and Layout Architecture still belongs in SPEC versus `docs/design/CONVERSATIONAL_WORKSPACE_RUNTIME.md` and related design docs?
5. Should future direction rows live in SPEC at all, or should SPEC only link to PLAN frontier definitions and design docs for unbuilt future work?
