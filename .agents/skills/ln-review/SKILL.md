---
name: ln-review
description: "Audit code quality focusing on deep modules, naming, model hygiene, topographic legibility, and architectural clarity. Use after a burst of development, when codebase structure needs assessment, or to make code more agent-navigable."
argument-hint: "[area of codebase to review, or 'recent' for recently changed files]"
---

# Ln Review

Explore the codebase. Surface structural improvement opportunities. Be opinionated.

Use the repo's pre-release posture: reward conceptual clarity over compatibility scaffolding, and treat unnecessary preservation as review debt. Look for stale code, obsolete fixtures, legacy terms, and compatibility paths that should be deleted rather than protected.

Deletion guard: before recommending deletion of a source file that has no runtime exports/imports but does have explanatory comments, apply `AGENTS.md` §intentional topology stubs. Do not treat `export {}`, zero imports, or passing import/build checks as proof of false topology. A deletion finding for such a file must name the contradicted/retired SPEC/PLAN/README claim, or the implemented replacement that absorbs the documented seam; otherwise route it as an intent-verification question, not a delete recommendation.

## Input

What to review: $ARGUMENTS

If "recent" or unspecified, focus on recently modified files.

## What to look for

Read `memory/SPEC.md` first when it exists. Use its lexicon for domain terms, and treat the live architecture register as the current decision record. Read `memory/PLAN.md` for active frontier context when the reviewed area touches active or near-horizon work. If ADRs or design docs exist in the touched area, respect them as supporting context, but do not introduce ADRs or sidecar decision logs by default; durable updates reconcile through `memory/SPEC.md` / `memory/PLAN.md`.

The lenses below are sub-passes. Apply each in turn; collect findings by category as you go. Each sub-pass owns one or more finding categories (named in parentheses).

### Module depth (category: `depth`)

Apply Ousterhout's depth test: modules should have small interfaces hiding significant complexity. Modules that move together should live together — clusters of small files always used in concert are a single deep module waiting to be extracted.

Use the deletion test for suspected shallow modules: if deleting the module makes complexity vanish, it was pass-through structure; if the same complexity reappears across multiple callers, the module was earning its keep. Prefer depth as leverage/locality, not line-count ratio.

### Seams and interfaces (categories: `seam`, `coupling`)

Treat the interface as the test surface. The interface is everything callers must know to use the module correctly: types, invariants, ordering constraints, error modes, required configuration, and performance characteristics. If callers or tests must reach past the interface to verify important behavior, the module shape is probably wrong. A good seam lets tests and callers cross the same public boundary.

Apply seam discipline: one adapter usually means a hypothetical seam; two adapters make a real seam. Flag indirection introduced only for imagined future variation, especially when it spreads configuration, mocks, or ordering knowledge into callers.

When a finding here is a deepening opportunity, present it as a candidate rather than a detailed design. Name the current shallow module shape, the deepened module that might replace it, what complexity would move behind the seam, and why that would improve locality, leverage, and the test surface. Do **not** propose detailed interfaces in `ln-review`; route selected deepening candidates to `ln-design` before scoping or refactoring.

### Core/shell boundary (category: `model`)

Check the functional core / imperative shell boundary (Gary Bernhardt, "Boundaries"). Pure functions should stay pure. Flag when a pure function has acquired side effects or a growing parameter list — it has drifted into shell territory.

### Model integrity (category: `model`)

Make invalid states unrepresentable (Yaron Minsky). Split optional fields into distinct types. Use branded types for domain-distinct values.

### Oracle coverage (category: `oracle-coverage`)

If `memory/SPEC.md` §Oracle Strategy by Loop Tier exists, check whether recent work implemented the oracles declared by the relevant `memory/PLAN.md` frontier definition. If a full or light scope card is available in session context, use it as a higher-resolution slice supplement, not the primary source of truth. Look for:

- Scope card promised schema validation → is there a Zod parse in the test?
- Scope card promised differential oracle → are there golden master fixtures?
- Scope card promised round-trip oracle → is there a persist-then-query test?
- `memory/SPEC.md` §Acknowledged Blind Spots → has anything changed that should promote a blind spot to "needs an oracle now"?

Collect gaps as numbered findings (category: `oracle-coverage`).

**Notation aid.** Map test artifacts against acceptance leaves with `pseudo matrix` (coverage variant): rows = obligation leaves from a `pseudo tree` decomposition of the frontier acceptance, columns = test artifacts. Gaps surface as `.` cells; partial coverage as `~`. Compact, scannable, and the matrix itself becomes a coverage artifact reviewers can re-run.

### Lexicon alignment (category: `naming`)

If `memory/SPEC.md` exists, survey how §Lexicon terms (both method and domain) appear across:

- **Symbols**: variable names, function names, class/type names, module names
- **Comments**: inline comments, docstrings, JSDoc, type annotations
- **Files and paths**: file names, directory structure, import paths
- **Documentation**: READMEs, inline docs, config descriptions

Collect misalignments as numbered findings (category: `naming`) with the canonical term, where the deviation occurs, and what it should be. Format these so they can be passed directly to `ln-refactor`.

### Topographic legibility (category: `topography`)

The directory tree is a spatial artifact, read top-down by humans and agents during orientation — *before any file is opened*. Layout is its own design surface, peer to module depth. Three lenses fire here:

- **Topographic legibility** — a stranger should be able to *walk* the tree (not grep it) and infer the shape of the territory: what kinds of things exist, where each kind lives, and how they relate. Directory names predict the *kind* of their children; file names predict their contents.
- **Chunking budget** — siblings at one level should fit working memory (~7±2). A directory with many peer entries blows the budget; nested grouping should restore it. **Mixed grain** among siblings (a domain concept next to a utility next to a config) is the same kind of smell — peers should be peers in kind, not just in location.
- **Orientation debt / navigation tax** — the failure mode. When the tree doesn't teach, every reader pays a search cost on first contact. The cost compounds invisibly because no test, type-check, or build catches it. The signal is "a stranger had to grep to find X" or "no two readers guess the same location for a new file."

Concrete cues to look for:

- Sibling counts well above ~9 with no clear sub-grouping
- Mixed-grain siblings (e.g., one file is a domain concept, the next is a utility, the next is config)
- Deep nesting that doesn't reflect conceptual depth (folders of folders with one file each)
- Generic bucket names (`utils/`, `helpers/`, `lib/`, `misc/`, `shared/`) that hide what lives inside
- File names that don't predict contents; directory names that don't predict their children's kind
- Fractal-pattern violations: a file outgrew its boundary but stayed flat instead of getting its same-named private folder (the pattern documented in `AGENTS.md`)
- Imports that cross conceptual layers in surprising directions, hinting that the tree is *lying* about the dependency shape

Collect findings as numbered items (category: `topography`). Frame each as: what the reader sees today, what they would have to internalize to find things, and the smallest topographic move that would make the tree teach itself. Routing for coordinated layout changes goes through `ln-refactor`; a single misplaced file can be a `ln-scope` slice.

### Topology README accuracy (category: `topography`)

Directory `README.md` files under `src/**/` are canonical topology documentation (see `AGENTS.md` §topology READMEs). For each touched area, open the nearest README and check:

- **Ownership statement** still matches what the directory actually owns and does not own
- **SPEC decision IDs** cited (e.g. `D52-L`) still exist in `memory/SPEC.md` and still mean what the README implies they mean
- **Dependency-direction assertions** ("`graph/` imports from `db/`; no other layer imports `db/` directly") match the actual import graph in the touched files
- **Layout sketches** still match the directory's contents — no retired files still listed, no new files unmentioned
- **Migration notes** describe state that is still pending; shipped or abandoned migrations are stale and should retire

Collect mismatches as numbered findings. Frame each as: which README, which claim, what the code now says. Routing for coordinated README updates clusters with other topographic findings into `ln-refactor`; a single stale citation can be a `ln-scope` slice (or, if the change is mechanical, an `ln-build` direct fix).

## Output

Present findings as numbered candidates. Use the compact form for ordinary findings:

```md
## Review: [area]

1. **[Description]** — [category: depth|naming|model|coupling|seam|oracle-coverage|topography] — [impact: low|medium|high]
   [1-2 sentence explanation and suggested action]

2. ...
```

Use the deepening form when the finding is a shallow-module or weak-seam opportunity:

```md
1. **[Deepening candidate]** — [category: depth|seam|coupling|testability] — [impact: low|medium|high]
   **Files** — [modules/files involved]
   **Problem** — [why the current module shape causes friction]
   **Possible direction** — [plain English target shape; no detailed interface yet]
   **Benefits** — [locality, leverage, and test-surface improvement]
```

Recommend the highest-impact improvement.

## Routing

After presenting findings, present these options to the user (use `tool-ask-question`):

| #   | Label                      | Target        | Why                                              |
| --- | -------------------------- | ------------- | ------------------------------------------------ |
| 1   | Scope a fix                | `ln-scope`    | A finding warrants a planned slice               |
| 2   | Explore a deepening design | `ln-design`   | A selected candidate needs seam/interface design before scoping or refactoring |
| 3   | Plan a refactor            | `ln-refactor` | Multiple findings need coordinated restructuring |
| 4   | Back to triage             | `ln-consult`  | Review complete, no immediate action needed      |

Recommended: **2** if the highest-impact finding is a deepening candidate, **1** if high-impact findings are concrete fixes, **3** when multiple topographic or naming findings cluster into a single layout pass, **4** otherwise.

---
*Draws from [mattpocock/skills/improve-codebase-architecture](https://github.com/mattpocock/skills/tree/main/improve-codebase-architecture) and [theswerd/aicode/skills/self-documenting-code](https://github.com/theswerd/aicode/blob/main/skills/self-documenting-code/SKILL.md).*
