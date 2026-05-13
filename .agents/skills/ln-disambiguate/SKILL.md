---
name: ln-disambiguate
description: "Collapse meaningful ambiguity by generating concrete divergent interpretations and asking the user to classify examples, counterexamples, edge cases, or candidate outcomes. Use when a plan/design has several plausible meanings, requirements feel vague, examples would clarify intent faster than open-ended grilling, or the user asks to disambiguate, find ambiguity, use behavioral kernels, or ask contrastive questions."
---

# Ln Disambiguate

Collapse ambiguity by asking the smallest concrete question whose answer separates plausible interpretations.

Users are often better at recognizing intent in examples than authoring abstract predicates. Do not start with “what are the requirements?” if a concrete classification would answer faster. Generate cases where plausible meanings diverge, ask the user to classify the case, and translate the answer into candidate durable conclusions.

This is an alternative entry point to `ln-grill`: use `ln-grill` when the idea needs broad Socratic pressure; use `ln-disambiguate` when the work already has enough shape that the useful move is resolving ambiguous meanings, behaviors, boundaries, or examples.

Do not create or edit planning artifacts here. Durable conclusions promote into `memory/SPEC.md` or `memory/PLAN.md` through the next routed skill.

## Grounding

If local context can resolve the ambiguity, inspect it instead of asking. Otherwise read only what helps you form precise contrasts:

1. `memory/SPEC.md` if present — lexicon, live requirements, assumptions, decisions, invariants, and verification stance.
2. `memory/PLAN.md` if the ambiguity concerns sequencing or frontier scope.
3. Relevant design docs when `memory/SPEC.md` points to them.

Use the current lexicon. If ambiguous language reveals a missing or overloaded term, name the competing meanings explicitly.

## Method

For each ambiguity:

1. **Name the ambiguous claim** — the term, behavior, boundary, decision, requirement, invariant, or criterion that has multiple plausible meanings.
2. **Generate competing interpretations** — usually 2–4. Include the boring/default interpretation, the stricter interpretation, and any interpretation likely to cause a bug if implemented silently.
3. **Find the divergence point** — the smallest concrete scenario where those interpretations produce different outcomes.
4. **Ask a contrastive question** — have the user classify the scenario or choose the expected outcome.
5. **Translate the answer** into candidate durable conclusions:
   - `decision` — a chosen option over named alternatives, with rationale.
   - `invariant` — a preservation rule that must keep holding.
   - `constraint` — a boundary or non-goal that rules out interpretations.
   - `assumption` — a material belief that remains unvalidated.
   - `example` — a concrete positive, edge-case, trace, or not-relevant case.
   - `counterexample` — a rejected case or outcome that rules out an interpretation.
   - `criterion` — an observation, test shape, or manual review that would witness the claim.
   - `unresolved ambiguity` — a named ambiguity intentionally deferred.
6. **Repeat only while it buys clarity** — stop when the remaining ambiguity is either collapsed, explicitly deferred, or ready for `ln-spec`.

Prefer one high-yield question at a time. Multiple-choice is good when options are real; forced-choice is bad when it hides a likely fifth answer. Always allow “other / depends — explain.”

## Good question shapes

Prefer concrete classification:

- “In this exact case, which outcome is correct?”
- “Is this inside or outside the commitment?”
- “Would this count as a bug?”
- “Which option should be rejected?”
- “Does this example witness the rule, contradict it, or sit outside scope?”
- “If we implemented interpretation A, what important case would break?”

Avoid broad prompts unless no contrastive case is available:

- “How should permissions work?”
- “What are all the requirements?”
- “Tell me more about edge cases.”

When asking, include your recommended answer if you have enough context, and say why. The user should be able to accept, reject, or refine your classification quickly.

## Behavioral kernels

Use kernels as hidden interviewer machinery for generating high-yield contrasts. Do not make the user learn the kernel taxonomy unless it helps them reason.

Activate at most the top 2–3 relevant kernels from language and context:

| Kernel | Looks for | Typical artifact |
| --- | --- | --- |
| Identity & reference | ids, references, links, uniqueness | entity / reference invariant |
| Containment & topology | parent/child, folders, ordering, graphs | membership / topology invariant |
| Validation & normalization | valid/invalid input, canonical forms | parser or validation contract |
| State & lifecycle | states, transitions, terminal states | state-machine invariant |
| Temporal history | undo, redo, audit, expiration | history / timeline invariant |
| Optimization & preference | best, preferred, tie-breaks | ranking or objective rule |
| Authority & capability | roles, permissions, delegation | authorization predicate |
| Concurrency & collaboration | offline, stale, conflict, merge | conflict-resolution semantics |
| Transactions & atomicity | all-or-nothing multi-object updates | transaction invariant |
| Resource accounting | balances, quotas, capacity, limits | conservation / bounds invariant |
| Derived data & views | counts, filters, projections, caches | view consistency invariant |
| Error & recovery | retry, rollback, compensation | failure / recovery contract |
| External effects | APIs, queues, webhooks, clocks | boundary / adapter contract |
| Change & migration | legacy, compatibility, upgrade | migration / refinement invariant |
| Observability & evidence | logs, traces, explanations, audit | trace / provenance invariant |

Kernel move: generate a concrete scenario where plausible policies diverge, then ask the user to classify it. The answer should become a weaker-but-useful checkable artifact: example, counterexample, invariant, criterion, or explicit ambiguity.

## Example

Instead of asking:

> How should project deletion work?

Ask:

> A project is deleted while it still has tasks. Which behavior is correct?
>
> A. Delete the tasks too.
> B. Archive the tasks and keep them readable.
> C. Move tasks to an unassigned pool.
> D. Block deletion until tasks are reassigned or deleted.
> E. Other / depends.
>
> My recommendation is B if historical traceability matters more than cleanup, because it preserves references and gives us a clear data-integrity invariant.

Then translate the answer, for example:

- decision: “Deleted projects archive their tasks rather than deleting or reassigning them.”
- invariant: “Archived tasks retain a tombstone reference to the deleted project.”
- positive example: “Deleting a project with open tasks makes those tasks archived and readable.”
- counterexample: “Tasks silently disappearing after project deletion is rejected.”
- criterion: “A deletion test verifies task archival and readable tombstone references.”

## Stop conditions

Stop when one of these is true:

- The user selected an interpretation and the durable consequences are clear.
- The ambiguity is explicitly deferred and named.
- More questioning would be generic grilling rather than ambiguity collapse.
- The next correct step is to record, plan, or scope.

## Routing

When the ambiguity pass is complete, present these options to the user. If `tool-ask-question` is available, use it; otherwise use a numbered list.

| # | Label | Target | Why |
| --- | --- | --- | --- |
| 1 | Write/update spec | `ln-spec` | Durable conclusions should enter `memory/SPEC.md` |
| 2 | Plan frontier | `ln-plan` | The meaning is clear but work needs sequencing |
| 3 | Scope one slice | `ln-scope` | One implementation slice is now obvious |
| 4 | Grill further | `ln-grill` | The ambiguity pass exposed broader design uncertainty |

Recommended: choose `ln-spec` when decisions, invariants, assumptions, lexicon, examples, or criteria changed.

## References

- `docs/design/INTENT_GRAPH_SEMANTICS.md` — typed claims, examples/counterexamples, negative edges, progressive checkability.
- `docs/design/BEHAVIORAL_KERNELS.md` — kernel taxonomy and contrastive question patterns.
- `docs/archive/design/INTENT_SPEC_EVOLUTION.md` §6 — ambiguity-targeted disambiguation.
