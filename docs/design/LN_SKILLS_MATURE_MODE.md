# `ln-*` Skills: Mature-Mode Revision

Date: 2026-04-13
Status: Design sketch — not yet implemented
Prior art: `docs/design/ln-skills-review-after-alignment.md` (2026-04-06)

## Context

The April 6 review predicted that the `ln-*` system's biggest risk was not contradiction but **over-ritualization** — ceremony creep as the project matured. After 7 more phases of real use, that prediction has been confirmed empirically:

- `SPEC.md` has undergone **five separate pruning passes** (April 3–12), consolidating 96 invariant rows into families and removing ~30 assumptions as "embedded in architecture"
- `PLAN.md` is ~360 lines, of which ~300 describe completed work. The live frontier is **4 open items**
- Most remaining work (hardening, maintenance, bounded features) doesn't fit the tracer-bullet slice model that the system defaults to
- Mandatory traceability bookkeeping on every `ln-build` exit increasingly produces entries that `ln-sync` later prunes

The system worked — it got brunch through greenfield ambiguity into a real architecture. But the same discipline is now taxing normal work.

## Diagnosis: Two Embedded Premises

### 1. Every change is architecturally significant

The mandatory traceability loop (assumptions → decisions → invariants → slices → tests) assumes each slice establishes new seams or retires uncertainty. That was true through ~Phase 5. By Phase 9+, most work is execution within settled seams.

**Symptom:** `ln-build` produces traceability entries. `ln-sync` prunes them as "embedded." Net value: zero, cost: nonzero.

### 2. One authority pair owns the whole product and timeline

SPEC.md and PLAN.md assume a single planning center with full product scope. This becomes awkward for:

- Bounded features that don't need the full decision/assumption/invariant apparatus
- Maintenance/hardening work (drizzle-kit audit, fixture hardening) forced through the tracer-bullet model
- Re-entry by a new thread that must context-load 580+ lines for a 2-hour task
- Multi-contributor scenarios with different area ownership
- Sprint-like planning where the horizon is short

## Design: Conditional Traceability

The core change is **not** adding more document types. A single archiving policy across the existing two documents is better than fragmenting authority. The change is making the traceability loop **conditional on structural significance**.

### Work classification

`ln-scope` (and by extension `ln-consult`) should classify work before applying process:

| Work type | Examples | Default process |
| --- | --- | --- |
| **Structural** | New seam, new boundary, architectural choice | Full slice: scope card → build → mandatory SPEC/PLAN traceability |
| **Bounded feature** | Add a capability within settled seams | Lightweight packet: objective, acceptance criteria, verification. Promote to SPEC/PLAN only if a durable boundary changes |
| **Hardening** | Dependency audit, fixture work, perf | Task-level: objective + acceptance. No SPEC/PLAN update unless a constraint or invariant changes |
| **Bugfix** | Regression, incorrect behavior | Fix + test. No planning ceremony |
| **Refactor** | Rename, extract, restructure | `ln-refactor` as-is (already lightweight) |

The key rule: **promote on durable change, not on every exit.**

### What "promote to SPEC/PLAN" means

Update SPEC.md only if:

- A requirement changed or was added
- A constraint or non-goal changed
- A new assumption became active (genuinely unresolved, would change future work if false)
- An assumption was retired by evidence
- A non-trivial design decision was made or reversed
- A new seam-level invariant was established

Update PLAN.md only if:

- Priorities or dependencies changed
- A roadmap item was added, removed, or reordered
- The work closes or unblocks a live frontier item

### What stays mandatory regardless of work type

- Local acceptance criteria (even if just in the commit message)
- Verification — run the gate (`npm run verify`)
- Clear routing to next step (exit routing still applies)
- `ln-handoff` when ending a session (volatile state capture is always valuable)

## Document Evolution

### SPEC.md → Live architecture register

The current shape is fine. The change is in **what stays vs what gets archived.**

**Keep in the main file:**

- Concept & goal
- Constraints & non-goals
- Requirements
- **Live** assumptions only (genuinely unresolved, would change work if false)
- **Current** decisions only (could still be revisited; not yet structural)
- **Critical seam-level invariants** only (the families, not individual branch variants)
- Lexicon
- Verification stance / oracle strategy

**Archive trigger:** When `ln-sync` finds an assumption validated, a decision embedded, or an invariant that's purely a structural property of the codebase, it should remove the row and note the removal in a prune comment — as it already does. The change is that this should happen more aggressively and earlier, not accumulate until a large sync pass.

**Goal:** SPEC.md should be readable in one pass by a new thread. If it exceeds ~150 lines of active content (excluding prune comments), it's too heavy.

### PLAN.md → Rolling frontier

Replace the current "full timeline from Phase 1" shape with:

```markdown
# Plan

## Active
<!-- Open slices/spikes, ordered by priority -->

## Next
<!-- Near-horizon items, loosely ordered -->

## Horizon
<!-- Future work, unordered -->

## Recently Completed
<!-- Last 2-3 completed items, terse summaries only.
     Older completions archived to docs/archive/PLAN_HISTORY.md -->

## Dependencies
<!-- Only active/next items -->
```

**Archive policy:** When a phase is fully complete, collapse it to a one-line entry in `docs/archive/PLAN_HISTORY.md` with a date. The active planning document should not exceed ~100 lines of content.

**Completed-slice notes:** Max 1 line in the rolling frontier. Full completion notes (if needed for handoff) go in HANDOFF.md or the archive.

## Skill-Level Changes

### ln-consult

Add work-type classification to the routing table:

```markdown
| Situation | Work type | Suggest |
| --- | --- | --- |
| New seam or boundary | structural | ln-scope (full) |
| Feature within settled seams | bounded | ln-scope (lightweight) |
| Dependency/audit/hardening | hardening | direct ln-build or task |
| Bug | bugfix | direct fix + test |
| Restructuring | refactor | ln-refactor |
| ...existing routing table entries... | | |
```

### ln-scope

Add a **scope weight** decision at the top:

- **Full scope card** (structural work): current behavior — target behavior, boundary crossings, risks/assumptions, acceptance criteria, verification approach, SPEC cross-references
- **Lightweight packet** (bounded/hardening): objective, acceptance criteria, verification approach. No mandatory SPEC cross-references. Include a promotion checklist: "does this change a requirement, assumption, decision, or invariant?" If yes → escalate to full scope

### ln-build

Change the traceability section from mandatory to conditional:

```markdown
## Traceability

**Promotion check** — did this build:
- [ ] Establish a new seam or boundary?
- [ ] Make or reverse a non-trivial design decision?
- [ ] Retire or create an assumption?
- [ ] Establish a new seam-level invariant?

If any box is checked → update SPEC.md and/or PLAN.md per the current traceability rules.
If none → mark the item done in PLAN.md (if it's there), commit, and move on.
```

### ln-sync

Change the trigger from "run periodically or when docs feel stale" to:

- **Run at milestone boundaries** (not per-slice)
- **Run before major refactors** (to ensure the register is current)
- **Run at handoff** (context preservation)
- **Run when SPEC.md exceeds ~150 active-content lines** (weight alarm)

Add the archiving step: move completed phases from PLAN.md to `docs/archive/PLAN_HISTORY.md`.

### ln-plan

When creating or updating plans, default to the rolling-frontier shape rather than the full-timeline shape. New slices go into Active or Next. Horizon stays loose.

The anti-fragmentation heuristic and epistemic horizon rules remain — those are about planning quality, not ceremony.

### ln-spec, ln-grill, ln-oracles, ln-design, ln-spike, ln-review, ln-refactor, ln-handoff

No structural changes needed. These skills are already well-calibrated:

- `ln-spec` already has patch mode for targeted updates
- `ln-grill` is pure elicitation — no document overhead
- `ln-oracles` is already optional for trivial/structural slices
- `ln-design` is already discretionary
- `ln-spike` produces knowledge, not ceremony
- `ln-review` produces findings, not document updates
- `ln-refactor` already uses temporary REFACTOR.md
- `ln-handoff` captures volatile state — always valuable

## What This Does Not Change

- The vocabulary (assumptions, decisions, invariants, slices) — it's genuinely useful
- The verification discipline — `npm run verify` gate stays mandatory
- The exit routing between skills — guided state machine is valuable
- The merge-over-add / same-item-test heuristics — still the right instinct
- The two-document model — SPEC + PLAN is sufficient; don't add more authority documents

## Migration

This is a document-shape and skill-instruction change, not a code change. Implementation:

1. Archive completed PLAN.md phases to `docs/archive/PLAN_HISTORY.md`
2. Restructure PLAN.md to the rolling-frontier shape
3. Prune SPEC.md more aggressively (one pass, not incremental)
4. Update skill files with the conditional traceability rules
5. Validate by running a bounded-feature slice through the revised flow

## Risk: When To Escalate Back To Full Mode

The conditional traceability rule has a failure mode: work that *looks* bounded but actually changes a durable boundary. Guardrails:

- The promotion checklist in `ln-scope` catches this at scoping time
- `ln-build`'s promotion check catches it at build time
- `ln-sync` at milestone boundaries catches anything that slipped through
- If a piece of work crosses >2 boundary seams or invalidates an assumption, escalate to full structural mode regardless of initial classification

## Bottom Line

The current system's rigor was the right investment for greenfield architecture formation. The project is now past that inflection point. Keep the architectural spine (vocabulary, verification, routing). Stop making every small change pay whole-product bookkeeping costs. Make traceability conditional on structural significance, and compress the planning documents to a readable active frontier.
