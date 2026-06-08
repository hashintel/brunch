---
name: ln-build
description: "Implement one scoped slice using TDD red-green-refactor. Use when ready to write code for a defined slice of work, or when the user wants test-driven development."
argument-hint: "[scope file path under memory/cards/, an inline scope card, or a trivial direct-fix request]"
---

# Ln Build

Implement **one** scope card. Beck's red-green-refactor, one cycle, no scope creep.

## Input

A scope file under `memory/cards/`, an inline scope card from `ln-scope`, or a trivial direct-fix request: $ARGUMENTS

Extract: target behavior / objective, acceptance criteria, verification approach, and (when present) expected touched paths.

Treat the scope card as the next implementation slice inside its containing `memory/PLAN.md` frontier item (or, for dev/tooling/docs work, the named category prefix). The frontier item is the plan-level work item and Linear/branch unit; the scope-card slice is just the current execution step inside it. Unless `ln-plan` has already split the frontier into separate items, do **not** infer a new Linear issue or Graphite branch from scope-card granularity; multiple consecutive slices may land on the same branch — including slices that live in separate scope files but share a frontier.

### Selecting a scope file

`ln-build` uses a **hybrid selection policy** for choosing which scope file in `memory/cards/` to consume:

1. **Explicit path argument wins.** If $ARGUMENTS names a scope file path (e.g. `memory/cards/live-graph-observer--observer-loop.md`), consume that file.
2. **Single active file → pick.** If $ARGUMENTS does not name a file but exactly one file under `memory/cards/` exists with `Status: active` for the current frontier (or current dev/tooling concern), consume that file and announce the choice.
3. **Otherwise → ask.** Use `tool-ask-question` to list every active scope file with a one-line summary of its next-ready card, and let the user pick.

Never scan or pick by mtime, alphabetical order, or directory-listing heuristics. Selection is either explicit (1, 2) or user-confirmed (3).

### Inside a scope file

Once a file is selected, work the next card marked `next` (or the first unfinished card in file order if status markers are absent). If that card is already satisfied on the current branch, do **not** manufacture a no-op build commit; verify the acceptance criteria, mark the card `done` or `dropped` as appropriate, reconcile, and either continue to the next ready card in the same file or route back to `ln-scope` if no build remains.

If the selected file is `Mode: coverage`, it holds a row ledger rather than cards — follow the [Coverage execution mode](#coverage-execution-mode) loop below instead of card-based selection.

Re-enter before red.

If this is a fresh thread or an unfamiliar area, reload:

1. `memory/SPEC.md`
2. `memory/PLAN.md`
3. `HANDOFF.md` if present
4. `docs/archive/PLAN_HISTORY.md` only if the frontier or touched area is still unclear

Write a 2-4 bullet orientation note naming the containing seam, the frontier item (or dev/tooling concern), any manual verification debt, and the main open risk.
Also name any frontier-level cross-cutting obligations the slice inherits (for example shared mutation-authority rules, side-task/event-substrate semantics, or verification-layer commitments).

If the request is a direct fix and you cannot name the containing seam or whether it is settled, stop and route through `ln-scope` first.

Do not invent new planning docs, scratch histories, or alternate memory locations while building. Durable state reconciles back into `memory/SPEC.md` and `memory/PLAN.md`; temporary support artifacts stay in `HANDOFF.md`, the active scope file under `memory/cards/`, or `memory/REFACTOR.md` only while they are still live.

## Serial execution mode

When a scope file is `Mode: chain` and holds several prepared cards, `ln-build` may execute them in sequence within that one file instead of routing back through the user after every commit.

Loop shape:

1. take the next ready card in the active scope file
2. **re-orient checkpoint** — before starting, verify the card's premise still holds in light of what the previous card just taught you (see Stale-downstream invalidation below)
3. decide whether it is still a real build target or is already satisfied / stale on the current branch
4. if it is real work, run red → green → refactor
5. run the verification harness
6. reconcile canonical state and update the card's status in the scope file
7. commit only if the card produced a real card-sized change
8. continue only if no stop condition fires

Stop the serial loop immediately when any of these becomes true:

- verification fails
- the active card needs promotion to structural work
- the containing seam no longer feels settled
- a manual outer-loop verification step is now required before proceeding
- `memory/SPEC.md` or `memory/PLAN.md` needs non-trivial revision before the next card
- the remaining cards in the file are no longer obviously valid (see below)
- the user asked to pause or review between cards
- context is getting fragile enough that handoff is safer than continuing

### Stale-downstream invalidation

Even when `ln-scope` honored the hard anti-speculation gate (no card's scope was *expected* to depend on earlier-card findings), implementation can still surprise you. Between each card in a chain, perform this explicit re-orient:

- read the next card's Target Behavior, Acceptance Criteria, and Expected touched paths
- ask: **does this card's premise still hold after what I just learned in the previous card?**
  - Did the previous build change a path, name, or interface that this card references?
  - Did the previous build retire or invalidate an assumption this card relies on?
  - Did the previous build shift the seam such that this card's boundary crossings no longer match reality?
- if any answer is yes, mark this card and every remaining card in the file as `stale` and stop the serial loop. Route back to `ln-scope` for the rest of the chain.

Never silently continue past a stale-downstream signal. Never silently delete a stale chain before a replacement exists.

## Coverage execution mode

When a scope file is `Mode: coverage` (see [`ln-scope`](../ln-scope/SKILL.md) §Coverage scope files), it holds a closed enumerated ledger of one capability layer rather than a sequence of full cards. The build loop is row-driven:

Before taking a row, reload [`../ln-plan/references/coverage.md`](../ln-plan/references/coverage.md) if you have not read it in this thread.

1. take the next open required (`●`) row — one whose Status is `spec`, `new`, or `partial`
2. **coverage re-orient checkpoint** — verify the row still fits the declared layer boundary, that its named owner is still the right owner, and that its promised behavior is derivable from the row's source-of-truth inputs. If any of those fail, stop and route back through `ln-scope` / `ln-plan`
3. build it under the **fill mode declared in that row** (`proving` → tracer that retires the row's unknown; `earned` → land and lock the settled capability). A `new` row needs its micro-decision resolved (`ln-disambiguate` / `ln-spec`) before it can be built
4. run red → green → refactor and the verification harness for that row
5. flip the row's Status to `built` in the ledger and reconcile canonical state
6. commit the row-sized change
7. continue until **no `●` row remains in `spec` / `new` / `partial`** — that aggregate DoD, not any single row, completes the coverage frontier

The chain stop conditions and Stale-downstream re-orient apply per row. Coverage-specific rules:

- **Do not add rows as you go** except to record a genuinely-missing capability (Status `new`, one-line justification). The ledger is a closed list; filling it never means "do everything that rhymes" (global `AGENTS.md` §completionist sprawl).
- **One new row maximum.** If implementation discovers a second new row or a new sub-seam, the inventory was not actually closed; stop and route back through `ln-plan`.
- **A row that grows past ledger-row size** spawns its own `single` scope file; replace the row's Owner / next cell with a pointer rather than fattening the ledger.
- **Do not silently change frontier class.** If the row turns out to be evidence-gated or wait-gated rather than buildable-now, stop and reconcile the classification instead of forcing a ceremonial build.
- **Do not launder ownership.** If the build wants to move single-owner logic into a shared layer (or pull shared logic back into a single owner), stop and re-scope the row explicitly rather than smuggling a topology decision through coverage execution.

## Red

Translate acceptance criteria into failing tests when the change benefits from them. For bugfixes or subtle seam changes, prefer one high-leverage regression test. For trivial maintenance or doc-only work, tests may be unnecessary.

Test behavior through public interfaces, not implementation details. A good test describes what capability exists and would survive internal refactoring. Avoid tests that mock internal collaborators, assert private call order, or inspect storage directly when the public interface can prove the behavior.

Do not horizontal-slice TDD. Never write a batch of imagined tests first and then a batch of implementation. Use tracer bullets: one failing behavioral test → minimum code to pass → next failing behavioral test. Each new test should respond to what the previous cycle taught you.

Run the relevant checks. Confirm failures are meaningful. If the card is already green before any code change, treat that as evidence the queue item is already satisfied or stale — not as permission to create a ceremonial red/green cycle.

## Green

Write the minimum coherent code to pass. Build inside-out: functional core first, thin I/O shell second, then end-to-end wiring.

Honor the repo's pre-release posture: if the current schema, fixture shape, dummy data, or terminology is wrong for the model, change it and regenerate dependent artifacts rather than preserving accidental compatibility. Delete obsolete paths in the same slice when they are inside the active seam.

No speculative abstractions. Only extract when two concrete cases force it. Do not anticipate later tests or build shape-only scaffolding; let the current behavioral test pull the interface into existence.

Do not delete comment-rich empty source files as cleanup unless the current card names them or the deletion proof in `AGENTS.md` §intentional topology stubs is satisfied. Passing import/build checks is insufficient proof; ask the user when the topology intent is unclear.

The card's Expected touched paths are tentative, not binding. If the build needs to diverge — a path you didn't anticipate, a file the work doesn't actually need — proceed and note the divergence briefly when updating the card's status. Significant divergence (touching new directories or seams not declared) is a signal to pause and re-check the overlap-as-independence-test against other active scope files for the same frontier.

## Refactor

With tests green, improve names, boundaries, and obvious local structure. Do not widen scope.

Refactor only while green. Keep the tests pinned to the public behavior so they protect the slice while allowing internals to move. If refactoring reveals that the test is coupled to implementation, fix the test seam before trusting it.

## Verify and commit

Run the project's verification harness. All checks must pass. If the card proved already satisfied and no code or canonical-state change was needed, do not create an empty commit.

## Canonical reconciliation (mandatory)

After verification, reconcile canonical state every time. The reconciliation may end in a no-op, but skipping it is not allowed.

**Notation aid.** When the reconciliation records slice acceptance breakdowns, module sketches, call/dependency shapes, or schema-shaped invariants into canonical docs, use `pseudo` forms (`tree` for obligation decomposition; `chain` for call graphs; `graph` for cross-module relations; `data-shape` for sketched schemas). Preserve any `pseudo` artifacts already present in SPEC/PLAN — do not collapse them back into prose.

Traceability depth is **conditional**, not automatic.

After the build lands and verification passes, ask:

- [ ] Did this establish or change a seam / boundary?
- [ ] Did this make or reverse a non-trivial design decision?
- [ ] Did this retire or create an assumption?
- [ ] Did this establish a new seam-level invariant?
- [ ] Did this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Did this change the topology of a directory that owns a `README.md` (moved/renamed/retired files, changed dependency direction, completed or invalidated a migration note, or shipped a state previously described as pending)?

### If all answers are no

- Mark the containing frontier done in `memory/PLAN.md` **if the build completed the frontier item**, usually by updating `Sequencing` / frontier status rather than moving definition blocks
- Update `Recently Completed` if the plan uses it
- Do **not** add new SPEC/PLAN bookkeeping just because a slice happened
- If the slice was non-trivial, required manual verification, or leaves residual risk that matters beyond the current session, record it in the containing frontier definition or a terse `Recently Completed` entry only when it affects frontier-level re-entry
- If the slice touched a named cross-cutting obligation but did not change it, preserve or refresh that obligation in the touched frontier definition instead of assuming traceability links are enough context

### If any answer is yes

Update only the touched traceability items.

#### Same-item tests

- **Same assumption** = same boundary/component + same unresolved claim
- **Same decision** = same seam/boundary + same chosen alternative
- **Same invariant** = same seam/boundary + same rule template + same proved decision(s)

#### Update rules

1. **PLAN**
   - Mark the frontier item done if this slice completed it
   - If the change closes, blocks, or unblocks a frontier item, reflect that in `Sequencing`, the affected `Frontier Definitions` entry, or `Recently Completed`
   - If the build changed a frontier-level cross-cutting obligation, update the affected frontier definition explicitly; do not hide the change behind bare traceability IDs
   - Do not mirror detailed slice/card history into `memory/PLAN.md`; cards live in the scope file under `memory/cards/`. At most, the frontier definition may carry a lightweight `Current execution pointer` listing active scope file path(s).

2. **Assumptions**
   - evidence answered it → update to `validated` or `invalidated`
   - same assumption exists locally → merge/update
   - new unresolved belief that would change future work if false → add

3. **Decisions**
   - existing decision merely implemented → no-op
   - same decision, wider rationale/scope → update
   - genuinely new alternative chosen at a seam → add

4. **Invariants**
   - no new protecting oracle/test → no-op
   - same seam-level invariant gained coverage → update
   - genuinely independent seam/rule/proof → add

5. **Topology READMEs** (when the topology question is `yes`)
   - update the `README.md` of every touched directory that owns one — ownership statement, layout sketch, dependency-direction assertion, and migration notes
   - if a SPEC decision cited by the README was renumbered or retired during reconciliation, repair the citation in the same commit
   - if a directory the build retires owned a README, delete the README with the directory
   - if a new directory introduced by this slice will be a long-lived seam (multiple files, named in SPEC, or imported by other layers), draft a minimal topology README following the shape in `AGENTS.md` §topology READMEs — do not speculate; describe what exists

When uncertain between merge and add, add. When uncertain between update and no-op, update.

If uncertain whether the seam is actually settled, promote — do not silently keep the work light.

Before finishing reconciliation, perform a quick cross-skill check: if a later agent read only `memory/SPEC.md`, `memory/PLAN.md`, the touched frontier definition, and the touched directory READMEs, would they miss a durable design choice or verification commitment that this build changed or relied on? If yes, reconcile it before stopping.

### Retire derivative artifacts

After reconciliation, garbage-collect exhausted temporary files instead of leaving breadcrumbs or tombstones, but deletion is **per-file and narrowly scoped**.

Scope-file lifecycle under `memory/cards/`:

- Delete the **specific scope file just consumed** when all its cards are `done` or `dropped` and no further build remains. Use a literal path: `git rm memory/cards/<frontier-id>--<slug>.md` (or `rm` if untracked). Never bulk-delete the directory or operate on `memory/cards/*` with globs.
- If only some cards in the file are `done` and others remain `next` or `in progress`, leave the file in place with statuses updated.
- If the chain became `stale` mid-build, leave the file in place with `Status: superseded` at the header so `ln-scope` / `ln-sync` can decide whether to rewrite or delete on the next pass.
- Other active scope files under `memory/cards/` for the same frontier (independent concerns) are out of scope for this build's cleanup. Do not touch them.

Other volatile artifacts are **review-before-delete**, not automatic cleanup:

- `HANDOFF.md` — delete only when it contains no unfinished transfer state and no future-context inventory that is not already captured in `memory/SPEC.md`, `memory/PLAN.md`, an active scope file, or a stable design memo.
- `memory/REFACTOR.md` — delete only when every listed refactor step is done/dropped and no future sequence depends on it.
- Provisional docs outside `memory/` (for example `docs/**/provisional*.md`, handoff plans, spike plans, or exploration inventories) — do **not** delete during `ln-build` cleanup unless the user explicitly asks or you first prove that all remaining future-facing inventory has been absorbed elsewhere. If only the current card is done but the artifact still contains later affordances, open questions, or scoping input, update it instead of deleting it.

Before deleting any file, name the file, state why no future agent would need it, and prefer asking the user when uncertain. For source files whose only runtime content is `export {}` plus comments, read the comments as design payload and apply `AGENTS.md` §intentional topology stubs before proposing deletion. Do not create archive copies, numbered handoffs, or completion-pointer files.

## Routing

If serial execution mode is active and no stop condition fired, continue to the next card in the active scope file instead of routing back to the user yet.

Otherwise, after verification and any necessary promotion updates, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target       | Why |
| --- | ---------------- | ------------ | --- |
| 1   | Scope next item  | `ln-scope`   | More frontier work remains or no prepared scope file exists |
| 2   | Review the code  | `ln-review`  | Assess quality after an implementation burst |
| 3   | Revise spec      | `ln-spec`    | The build changed durable architecture |
| 4   | Revise plan      | `ln-plan`    | The frontier or priorities changed |
| 5   | Back to triage   | `ln-consult` | Direction needs reassessment |

Recommended: **1** if more work remains and there is no active scope file, **2** after multiple consecutive builds.
