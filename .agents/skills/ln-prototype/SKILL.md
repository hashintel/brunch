---
name: ln-prototype
description: "Build a clearly throwaway prototype to answer a design question before committing to production work. Use when the user wants to prototype, sanity-check a state model, try a few UI designs, make something playable, or explore logic/UI affordances before ln-spec/ln-plan/ln-scope."
argument-hint: "[prototype question or design uncertainty]"
---

# Ln Prototype

A prototype is throwaway code that answers one question. The question determines the artifact. Do not let prototype code silently become production code.

## Input

Prototype question or design uncertainty: $ARGUMENTS

Orient first:

1. Read `memory/SPEC.md` if present and use its lexicon / live invariants.
2. Read `memory/PLAN.md` if present and identify whether the prototype serves an existing frontier item.
3. Read `HANDOFF.md` if present for volatile design context.
4. Inspect nearby code only enough to place the prototype where it is understandable and runnable.

Write a 2-4 bullet orientation note naming the question, prototype branch, nearest seam/page/module, and how the answer will be captured.

## Choose the branch

Pick exactly one branch. Ask the user if ambiguous and they are present; otherwise state the assumption.

### Logic prototype

Use when the question is:

- Does this state model feel right?
- Which transitions/actions are legal?
- Does this reducer, parser, planner, or workflow rule behave coherently across examples?
- Can a human play through edge cases faster than reading a spec?

Build a tiny interactive terminal app or CLI harness around a portable logic module.

Prefer one of these shapes:

- pure reducer: `(state, action) => state`
- explicit state machine with named states and transitions
- small set of pure functions over plain data
- state-owning module/class only when ongoing internal state is the question

Keep the shell thin. The logic should not know about prompts, terminal escape codes, stdout, or UI widgets.

### UI prototype

Use when the question is:

- What should this look or feel like?
- Which layout/interaction pattern communicates the concept?
- How should a user navigate, compare, approve, recover, or inspect?

Generate several meaningfully different variants in one local route/page/screen, switchable by URL search param or a small floating switcher. Prefer adapting an existing page/route over inventing a new top-level playground.

Variants should differ in concept, not just color. Name each variant by its design bet.

## Rules for both branches

1. **Throwaway from day one.** Name files/routes with `prototype`, `scratch`, or equivalent. Add a short comment at the entry point: `PROTOTYPE — delete or absorb after verdict`.
2. **Place it near the real seam.** Keep context obvious, but do not pollute public exports unless needed to run it.
3. **One command to run.** Use the repo's task runner and document the exact command in the final report or `HANDOFF.md`.
4. **No persistence by default.** Use memory. If persistence is the question, use scratch storage clearly marked as wipeable.
5. **Skip production polish.** No comprehensive tests, error handling, abstractions, analytics, or accessibility hardening beyond what is needed to evaluate the question safely.
6. **Surface state.** After every logic action or UI variant switch, show the relevant state/inputs/outputs so the design can be judged.
7. **Do not widen scope.** A prototype answers one question; new questions become follow-up prototypes, spikes, or scope cards.

## Capture the answer

The answer is the only durable artifact. When the prototype has served its purpose, either delete it or explicitly keep it only as live volatile support.

Capture:

```md
## Prototype Verdict: [question]

**Branch:** logic | UI
**Command:** [how to run]
**What we tried:** [variants/actions/cases]
**Verdict:** [decision or remaining uncertainty]
**Absorb:** [what production code/spec/plan should inherit]
**Delete:** [prototype files/routes/storage to remove]
```

Durability rule:

- Decision changes requirements, assumptions, invariants, or lexicon → route to `ln-spec`.
- Decision changes sequencing/frontier → route to `ln-plan`.
- Decision makes one implementation slice obvious → route to `ln-scope`.
- Prototype still needs human judgment later → record volatile state in `HANDOFF.md`.

Do not create `CONTEXT.md`, ADRs, or alternate planning documents. This project's canonical docs are `memory/SPEC.md` and `memory/PLAN.md`.

## Cleanup

Before finishing, state one of:

- deleted prototype files
- kept prototype temporarily, with exact reason and deletion trigger
- absorbed prototype into production code through a scoped build

If prototype files remain, they must be visibly non-production and easy to find.

## Routing

After the verdict, present these options to the user (use `tool-ask-question`):

| #   | Label          | Target       | Why |
| --- | -------------- | ------------ | --- |
| 1   | Revise spec    | `ln-spec`    | Prototype changed durable understanding |
| 2   | Revise plan    | `ln-plan`    | Prototype changed sequencing or frontier shape |
| 3   | Scope a slice  | `ln-scope`   | Prototype answered enough to build |
| 4   | Spike instead  | `ln-spike`   | The remaining question is technical feasibility |
| 5   | Back to triage | `ln-consult` | Prototype did not settle direction |

Recommended: **3** when the prototype produced a concrete build direction; **1** when it changed the model.

---
*Adapted from [mattpocock/skills/engineering/prototype](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype).* 
