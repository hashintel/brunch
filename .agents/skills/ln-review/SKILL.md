---
name: ln-review
description: "Audit code quality focusing on deep modules, naming, model hygiene, and architectural clarity. Use after a burst of development, when codebase structure needs assessment, or to make code more agent-navigable."
argument-hint: "[area of codebase to review, or 'recent' for recently changed files]"
---

# Ln Review

Explore the codebase. Surface structural improvement opportunities. Be opinionated.

## Input

What to review: $ARGUMENTS

If "recent" or unspecified, focus on recently modified files.

## What to look for

Apply Ousterhout's depth test: modules should have small interfaces hiding significant complexity. Modules that move together should live together — clusters of small files always used in concert are a single deep module waiting to be extracted.

Check the functional core / imperative shell boundary (Gary Bernhardt, "Boundaries"). Pure functions should stay pure. Flag when a pure function has acquired side effects or a growing parameter list — it has drifted into shell territory.

Make invalid states unrepresentable (Yaron Minsky). Split optional fields into distinct types. Use branded types for domain-distinct values.

### Oracle coverage

If `memory/SPEC.md` §Oracle Strategy by Loop Tier exists, check whether recent slices implemented the oracles their persisted `memory/PLAN.md` verification approaches declare. If a scope card is available in session context, use it as a higher-resolution supplement, not the primary source of truth. Look for:

- Scope card promised schema validation → is there a Zod parse in the test?
- Scope card promised differential oracle → are there golden master fixtures?
- Scope card promised round-trip oracle → is there a persist-then-query test?
- `memory/SPEC.md` §Acknowledged Blind Spots → has anything changed that should promote a blind spot to "needs an oracle now"?

Collect gaps as numbered findings (category: `oracle-coverage`).

### Lexicon alignment

If `memory/SPEC.md` exists, survey how §Lexicon terms (both method and domain) appear across:

- **Symbols**: variable names, function names, class/type names, module names
- **Comments**: inline comments, docstrings, JSDoc, type annotations
- **Files and paths**: file names, directory structure, import paths
- **Documentation**: READMEs, inline docs, config descriptions

Collect misalignments as numbered findings (category: `naming`) with the canonical term, where the deviation occurs, and what it should be. Format these so they can be passed directly to `ln-refactor`.

## Output

Present findings as numbered candidates:

```md
## Review: [area]

1. **[Description]** — [category: depth|naming|model|coupling] — [impact: low|medium|high]
   [1-2 sentence explanation and suggested action]

2. ...
```

Recommend the highest-impact improvement.

## Routing

After presenting findings, present these options to the user (use `tool-ask-question`):

| #   | Label           | Target        | Why                                              |
| --- | --------------- | ------------- | ------------------------------------------------ |
| 1   | Scope a fix     | `ln-scope`    | A finding warrants a planned slice               |
| 2   | Plan a refactor | `ln-refactor` | Multiple findings need coordinated restructuring |
| 3   | Back to triage  | `ln-consult`  | Review complete, no immediate action needed      |

Recommended: **1** if high-impact findings exist, **3** otherwise.

---
*Draws from [mattpocock/skills/improve-codebase-architecture](https://github.com/mattpocock/skills/tree/main/improve-codebase-architecture) and [theswerd/aicode/skills/self-documenting-code](https://github.com/theswerd/aicode/blob/main/skills/self-documenting-code/SKILL.md).*
