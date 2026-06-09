---
name: ln-judo-review
description: "Run a strict maintainability review that demands code-judo restructuring — deletions over rearrangements, not local cleanup. Use as an opinionated sibling of ln-review when a PR feels like it preserves incidental complexity, when a file is about to cross a healthy size boundary, or when spaghetti branching is creeping into existing flows."
argument-hint: "[area of codebase to review, or 'recent' for recently changed files]"
---

# Ln Judo Review

Look for **code judo**: restructurings that preserve behavior while making the implementation dramatically simpler, smaller, and more direct. Prefer paths that *delete* complexity over paths that *rearrange* it. The right reframing makes the change feel inevitable in hindsight.

This is a strict maintainability audit, not a cleanup pass. Do not stop at "this could be a bit cleaner." Do not rubber-stamp working code that leaves the codebase messier. Use the repo's pre-release posture: retire stale concepts, obsolete code paths, and compatibility scaffolding rather than protecting them.

Do not apply deletion-judo to intentional topology stubs. A comment-rich `export {}` source file may be a planned public seam / topology contract; see `AGENTS.md` §intentional topology stubs. Deleting it is a valid judo move only when the documented intent is obsolete or absorbed, not merely because the file is unused today.

## Input

What to review: $ARGUMENTS

If "recent" or unspecified, focus on recently modified files. Read `memory/SPEC.md` for current lexicon and architecture; read `memory/PLAN.md` if the area touches active frontier work.

## What to look for

Apply Ousterhout's depth test: small interfaces hiding significant complexity. Flag thin wrappers, identity abstractions, and pass-through helpers that add indirection without buying clarity — if deleting the module makes complexity vanish, it was pass-through structure.

Information hiding (Parnas): feature logic stays behind its own boundary. Flag feature-specific branches leaking into shared paths, and feature checks scattered across general-purpose modules.

Make invalid states unrepresentable (Yaron Minsky): explicit typed models over loose objects, casts, `any`/`unknown`, and silent fallbacks that paper over unclear invariants. If a branch relies on silent fallback, ask whether the boundary should be made explicit instead.

Ubiquitous language and canonical layer (Evans): logic lives where the concept already lives. Flag bespoke helpers that duplicate canonical utilities, and logic landing in the wrong package or module.

Make the change easy, then make the easy change (Beck): if the diff feels tangled, the surrounding code probably needs a small preparatory refactor first.

Boring code over magic (Hunt & Thomas): generic mechanisms that hide simple data-shape assumptions are a defect, not a feature.

Ambient-contract reliance: an invariant the code assumes but never enforces, threads, or names — uniqueness keys that silently last-win, dedups that drop kept data, hardcoded literals standing in for upstream provenance, persisted absolute paths/`cwd` leaking into committed fixtures, renames propagated to code/docs but not to committed fixtures or serialized artifacts, magic shape-checks instead of named predicates. The judo move is to make the contract intentional: enforce it loudly, thread the real value, or name it — not to tidy the assumption in place. (Full cue list in `ln-review` §Contract integrity.)

Functional core / imperative shell (Gary Bernhardt): when independent work is needlessly serialized, or related updates can leave state half-applied, ask whether orchestration should be separated from business logic — and whether the cleaner structure is parallel or atomic.

### Specific rules

- **1000-line threshold**: a PR that pushes a file from under 1k to over 1k lines is a presumptive blocker. Ask whether the file should be decomposed first. Waive only with a clear structural reason and visible internal organization. Modules that move together should live together — but a single sprawling file is rarely a deep module.
- **No ad-hoc branching in unrelated flows**: new conditionals, special cases, or one-off booleans bolted onto existing paths are a design problem, not a stylistic nit. Push the logic behind its own abstraction, helper, state machine, or policy object.
- **No unnecessary orchestration**: if independent work is needlessly serialized, ask for parallel execution when it also simplifies the flow. If related updates can leave state half-applied, push for an atomic structure.

### Primary question for every change

> Is there a code-judo move here that would delete whole categories of complexity — entire branches, helpers, modes, layers — rather than rearrange them?

If yes, name it. Do not settle for a cleaner version of the same messy idea when a much simpler idea is plausible.

**Notation aid.** When proposing a code-judo move, express it as paired `pseudo` artifacts — current shape (`tree` for module structure, `graph` for control/dependency, `chain` for call flow) → desired shape with the deleted branches, helpers, modes, or layers visibly absent. A concrete before/after pair shows whether complexity actually *vanishes* rather than relocates — which is the whole point of judo over rearrangement. Node/edge counts before vs after are honest metrics: a desired-state graph with fewer nodes and fewer edges than the current one is the artifact form of "deletions over rearrangements."

## Tone

Direct, serious, demanding. Not rude. Do not soften major maintainability issues into mild suggestions. Worked examples of the register:

- `this pushes the file past 1k lines. can we decompose this first?`
- `this adds another special-case branch into an already busy flow. can we move this behind its own abstraction?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation.`
- `this feels like feature logic leaking into a shared path. can we isolate it?`
- `this abstraction seems unnecessary. can we just keep the direct flow?`
- `why does this need a cast / optional here? can we make the boundary more explicit instead?`
- `this looks like a bespoke helper for something we already have elsewhere. can we reuse the canonical one?`
- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this refactor moves complexity around, but doesn't really delete it. is there a way to make the model itself simpler?`

## Output

Present findings as numbered candidates, prioritized in this order:

1. Structural regressions and missed code-judo opportunities
2. Spaghetti / branching complexity growth
3. Boundary, abstraction, and type-contract problems
4. File-size and decomposition concerns
5. Modularity and legibility

Prefer a small number of high-conviction comments over a long list of cosmetic nits. Use ln-review's compact form:

```md
## Judo Review: [area]

1. **[Description]** — [category: judo|depth|spaghetti|boundary|contract|file-size|naming] — [impact: low|medium|high]
   [1-2 sentence explanation and suggested action]
```

### Approval bar

Do not approve on "behavior is correct" alone. These are presumptive blockers unless the author justifies them clearly:

- a visible code-judo move was left on the table
- a file crossed the 1000-line threshold
- ad-hoc branching tangled an existing flow
- feature checks got scattered across shared code
- an unnecessary abstraction, wrapper, or cast-heavy contract added indirection
- a canonical helper got duplicated, or logic landed in the wrong layer

If any of those hold, leave explicit, actionable feedback and push for a cleaner decomposition.

## Routing

After presenting findings, present these options to the user (use `tool-ask-question`):

| #   | Label                      | Target        | Why                                              |
| --- | -------------------------- | ------------- | ------------------------------------------------ |
| 1   | Scope a fix                | `ln-scope`    | A finding warrants a planned slice               |
| 2   | Explore a deepening design | `ln-design`   | A code-judo candidate needs seam/interface design first |
| 3   | Plan a refactor            | `ln-refactor` | Multiple findings need coordinated restructuring |
| 4   | Back to triage             | `ln-consult`  | Review complete, no immediate action needed      |

Recommended: **3** if multiple structural regressions stack up, **2** if the dominant finding is a code-judo deepening candidate, **1** for a single concrete fix, **4** otherwise.

---
*Sibling of `ln-review` with a harsher posture for strict maintainability audits. Distilled from an external thermo-nuclear-code-quality-review prompt; activators aligned with the `ln-*` family vocabulary.*
