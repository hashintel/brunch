---
name: planning-pr
description: Use when about to edit `memory/PLAN.md` or `memory/SPEC.md` beyond a one-line status tick, when the user asks where a planning edit should be committed, when a rewrite would touch SPEC.md tracked-ID rows (Assumptions / Decisions / Requirements / Invariants), or after `/ln-sync` produces substantive doc changes. Encodes the convention that paragraph-level planning rewrites and any change to sequentially-numbered SPEC.md rows go on a separate planning PR off `main`, scoped to `memory/*` files only, while small in-place edits stay on the feature branch.
---

# Planning PR

`memory/PLAN.md` and `memory/SPEC.md` are single narrative documents that every active branch can rewrite. To prevent merge conflicts across parallel feature work, paragraph-level rewrites and any change to SPEC.md tracked-ID rows go on a **planning PR** off `main`, separate from feature work. Small in-place edits stay on the feature branch.

A planning PR is a deliberate serialization point: it lands on `main` first, scoped to `memory/*` files only, so downstream feature branches rebase onto a shared planning baseline rather than fighting over the same paragraphs.

## Decision rule

Threshold:

- **One line; marking an item done; typo fix** → feature branch.
- **Reorder or rewrite paragraphs** → planning PR.
- **Touch SPEC.md tracked-ID rows** (Assumptions `A##`, Decisions `D###`, Requirements `Requirement N`, Invariants `I###`) → planning PR. **Hard rule.** Sequential IDs collide on rebase across parallel branches. No exceptions.

| Change | Goes on |
| --- | --- |
| One line; marking an item done; typo fix | feature branch ✓ |
| Reorder or rewrite paragraphs in PLAN.md | planning PR ⚠ |
| Add or rewrite Recently Completed entries beyond one line | planning PR ⚠ |
| Edit dependency diagram, narrative, Active / Next sections | planning PR ⚠ |
| Rotate items into `docs/archive/PLAN_HISTORY.md` | planning PR ⚠ (alongside the related PLAN.md edits) |
| Touch SPEC.md Assumptions / Decisions / Requirements / Invariants | **planning PR — hard rule** |

When in doubt, default to a planning PR. The cost of one is low; the cost of a tangled rebase across the stack is not.

## Workflow

1. **Linear issue** — `/cli-linear`. Team `Frontend (FE)`, project `brunch`. Title frames the planning intent, not a feature. No parent issue unless explicitly named.
2. **Branch off `main`** — `/cli-graphite`. Name `<prefix>/fe-XXX-<slug>` where `<prefix>` is whatever `gt user branch-prefix` returns. Base must be `main` — **not** stacked on feature branches.
3. **Edit `memory/*` only** — `memory/PLAN.md`, `memory/SPEC.md`, optionally `memory/CARDS.md` or `memory/REFACTOR.md`, plus `docs/archive/PLAN_HISTORY.md` for rotating completions. No code, no test, no config.
4. **Verify** — `npm run verify`. For memory-only edits this is a no-op gate; it catches accidental code drift.
5. **PR** — `gh pr create --base main`. Title format `FE-XXX: <Sentence-case planning frame>`. Body has three sections:
   - `## Summary` — one paragraph naming the planning intent.
   - `## What changed` — bulleted file-level changes.
   - `## Intent` — state explicitly that this is a planning/scope merge point so downstream stacks rebase onto it.
6. **Merge to `main` first** — before stacking implementation branches on top. The convention's whole purpose is that downstream branches rebase onto a clean planning baseline rather than fight over the same paragraphs.
7. **Restack downstream** — `gt restack` open feature branches onto the new `main` baseline. Conflicts should be near-zero because the planning PR already absorbed the narrative reconciliation.

## Anti-patterns

- **Editing SPEC.md tracked rows on a feature branch.** Sequential IDs are unforgiving on rebase. Hard rule, no exceptions.
- **Bundling planning rewrites into a feature PR.** Drifts reviewer scope; rebase friction propagates downstream. The only acceptable bleed is a one-line "marking FE-XXX done" entry for the work that branch ships.
- **Stacking the planning PR on top of the feature stack.** Inverts the convention. Planning PR must land first so others rebase onto it.
- **Mixing code edits with planning edits in one commit on the planning branch.** Keep planning PRs trivially reviewable: only `memory/*` and `docs/archive/PLAN_HISTORY.md`.
- **Skipping the Linear issue because "it's just doc work".** Planning PRs are tracked work — they show up as the merge points downstream branches depend on.

## Common entry points

- After `/ln-sync` produces substantive edits — route here before committing them.
- The user asks "where do I put this?" / "should this be its own PR?" while editing `memory/*`.
- The user mentions merge conflicts on `memory/PLAN.md` or `memory/SPEC.md`.
- About to add a new `D###` decision, `A##` assumption, `Requirement N`, or `I###` invariant.
- The user is about to start a new major frontier area whose shape needs SPEC.md / PLAN.md updates before implementation begins — the planning PR establishes that baseline before any implementation branches stack on it.

## Applying the threshold (worked example)

A `/ln-sync` produces: narrative rewrite + Active promotion + two new Next items + two new Recently Completed entries + dependency-diagram fix + three archived completions. SPEC.md unchanged.

- Volume crosses the "reorder paragraphs" threshold → planning PR.
- SPEC.md unchanged → no hard-rule trigger, but the volume alone is enough.
- Action: separate branch off `main`, scoped to `memory/PLAN.md` + `docs/archive/PLAN_HISTORY.md`. Open feature branches keep their code diffs and gain only a one-line Recently-Completed bleed if appropriate.

## Relationship to other skills

- `/ln-sync` produces the edits; `planning-pr` handles where they get committed.
- `/cli-linear` creates the tracking issue.
- `/cli-graphite` creates the branch and submits the PR.
- Per `CLAUDE.md`, regular frontier-item branches follow the same Linear + Graphite flow but stack on each other; planning PRs deliberately do not stack — they sit off `main`.
