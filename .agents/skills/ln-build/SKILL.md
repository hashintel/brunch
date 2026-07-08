---
name: ln-build
description: "Implement one scoped work unit using TDD red-green-refactor: a vertical slice card or one row of a sweep ledger. Use when a scope file is ready to build."
argument-hint: "[scope file path under memory/cards/, an inline scope card, or a trivial direct-fix request]"
---

# Ln Build

Implement **one** scoped unit: the next vertical card, or the next required row in a sweep ledger. Red-green-refactor still governs, but **red** means the smallest oracle proving this scoped unit is not closed. One cycle, no scope creep.

## Input

A scope file under `memory/cards/`, an inline scope card from `ln-scope`, or a trivial direct-fix request: $ARGUMENTS

Extract: target behavior / objective, acceptance criteria, verification approach, cold-start reads, and (when present) expected touched paths and **Invariants preserved**. Invariants-preserved entries are standing obligations for the whole build, not a final checklist item: when one is guarded by an existing test, that test must run un-skipped throughout; when one is ambient (guarded only by the old code's behavior), prefer moving the carrying code over rewriting it, and diff any rewrite against the original branch-by-branch before trusting it. A red on a stop-the-line invariant is a respec signal — route back, do not adjust the fixture.

Treat the selected scope file as the next execution artifact inside its containing `memory/PLAN.md` frontier item (or, for dev/tooling/docs work, the named category prefix). The frontier item is the plan-level work item and Linear/branch unit; the scope file is just the current execution step inside it — a slice, slice sequence, or sweep. Unless `ln-plan` has already split the frontier into separate items, do **not** infer a new Linear issue or Graphite branch from scope-file granularity; multiple consecutive scope files may land on the same branch.

### Selecting a scope file

`ln-build` uses a **hybrid selection policy** for choosing which scope file in `memory/cards/` to consume:

1. **Explicit path argument wins.** If $ARGUMENTS names a scope file path (e.g. `memory/cards/live-graph-observer--observer-loop.md`), consume that file.
2. **Single active file → pick.** If $ARGUMENTS does not name a file but exactly one file under `memory/cards/` exists with `Status: active` for the current frontier (or current dev/tooling concern), consume that file and announce the choice.
3. **Otherwise → ask.** Use `tool-ask-question` to list every active scope file with a one-line summary of its next-ready card, and let the user pick.

Never scan or pick by mtime, alphabetical order, or directory-listing heuristics. Selection is either explicit (1, 2) or user-confirmed (3).

### Inside a scope file

Once a file is selected, work the next card marked `next` (or the first unfinished card in file order if status markers are absent). If that card is already satisfied on the current branch, do **not** manufacture a no-op build commit; verify the acceptance criteria, mark the card `done` or `dropped` as appropriate, reconcile, and either continue to the next ready card in the same file or route back to `ln-scope` if no build remains.

If the selected file is `Mode: sweep`, it holds a row ledger rather than cards — follow the [Sweep execution mode](#sweep-execution-mode) loop below instead of card-based selection.

Re-enter before red.

If this is a fresh thread or an unfamiliar area, reload:

1. `memory/SPEC.md`
2. `memory/PLAN.md`
3. `HANDOFF.md` if present
4. `docs/archive/PLAN_HISTORY.md` only if the frontier or touched area is still unclear

Let the card's **Cold-start reads** block scope this reload — resolve the specific decision/invariant ids and frontier it names. The numbered list above is the fallback when the card omits Cold-start reads or you need broader orientation. If the card's Cold-start reads turn out to be incomplete or stale (an id it names no longer exists, or you needed a doc it did not list), that is a scope defect — note it and route back through `ln-scope` rather than silently working around it.

Write a 2-4 bullet orientation note naming the containing seam, the frontier item (or dev/tooling concern), any manual verification debt, and the main open risk.
Also name any frontier-level cross-cutting obligations the slice inherits (for example shared mutation-authority rules, side-task/event-substrate semantics, or verification-layer commitments).

If the request is a direct fix and you cannot name the containing seam or whether it is settled, stop and route through `ln-scope` first.

Do not invent new planning docs, scratch histories, or alternate memory locations while building. Durable state reconciles back into `memory/SPEC.md` and `memory/PLAN.md`; temporary support artifacts stay in `HANDOFF.md`, the active scope file under `memory/cards/`, or `memory/REFACTOR.md` only while they are still live.

## Sliced execution mode

When a scope file is `Mode: slices`, `ln-build` may execute its prepared cards in sequence within that one file instead of routing back to the user after every commit. Load [`references/sliced-execution.md`](references/sliced-execution.md) for the loop shape, stop conditions, and the Stale-downstream invalidation re-orient.

## Sweep execution mode

When a scope file is `Mode: sweep` (see [`ln-scope`](../ln-scope/SKILL.md) §Sweep scope files), it holds a closed enumerated ledger rather than a sequence of cards, and the build loop is row-driven. Load [`references/sweep-execution.md`](references/sweep-execution.md) for the row loop and sweep-specific rules; reload [`../ln-plan/references/coverage.md`](../ln-plan/references/coverage.md) before taking a row.

## Red

For `Mode: single` / `slices`, use normal tracer-bullet TDD: one failing behavioral test → minimum code to pass → next failing behavioral test. For bugfixes or subtle seam changes, prefer one high-leverage regression test. For trivial maintenance or doc-only work, tests may be unnecessary.

For `Mode: sweep`, use closure-driven TDD: one failing row/property oracle → make that row/property conform → green. The oracle may be a test, grep guard, lint/import rule, schema check, fixture diff, golden assertion, or small enumerator script. It must fail because the required row is open, not because the harness is broken.

Test through the public interface — capability that survives internal refactoring — not internals (mocked collaborators, asserted private call order, direct storage reads).

Don't batch speculative tests then batch implementation: in slice mode each new test responds to what the last cycle taught you; in sweep mode each closure oracle proves the next row rather than widening the ledger.

Run the relevant checks. Confirm failures are meaningful. If the card or row is already green before any code change, treat that as evidence the queue item is already satisfied or stale — not as permission to create a ceremonial red/green cycle.

Un-skipping an existing test is a legitimate red: when the card's acceptance binds to a currently-skipped suite, re-enabling it *is* the failing oracle.

## Green

Write the minimum coherent code to pass. Build inside-out: functional core first, thin I/O shell second, then end-to-end wiring.

Honor the repo's pre-release posture: if the current schema, fixture shape, dummy data, or terminology is wrong for the model, change it and regenerate dependent artifacts rather than preserving accidental compatibility. Delete obsolete paths in the same slice when they are inside the active seam.

No speculative abstractions. Only extract when two concrete cases force it. Do not anticipate later tests or build shape-only scaffolding; let the current behavioral test pull the interface into existence.

Take the laziest rung that holds before writing custom code: stdlib → native platform feature → already-installed dependency → one line → the minimum that works. When two rungs tie, take the higher (less code) — but never the option that is flimsier on edge cases; lazy means less code, not a weaker algorithm. The floor is never negotiable: do not simplify away trust-boundary validation, data-loss handling, security, accessibility, or anything explicitly requested. Mark a deliberate shortcut with a `ceiling:` comment naming the ceiling and upgrade path (see `AGENTS.md` §simplification ceilings).

When the code introduces, restates, or widens a type — or decides where to validate untrusted input — reach for the owner before re-deriving the shape. Load `expert-typescript-typing` (import → infer → project → declare only at a real semantic boundary; one state space, one owner) and its companion `expert-runtime-boundaries` (validate where uncertainty enters, then carry that trust downstream with types). Do not fork a type the schema, library, or domain already owns.

Do not delete comment-rich empty source files as cleanup unless the current card names them or the deletion proof in `AGENTS.md` §intentional topology stubs is satisfied. Passing import/build checks is insufficient proof; ask the user when the topology intent is unclear.

The card's Expected touched paths are tentative, not binding. If the build needs to diverge — a path you didn't anticipate, a file the work doesn't actually need — proceed and note the divergence briefly when updating the card's status. Significant divergence (touching new directories or seams not declared) is a signal to pause and re-check the overlap-as-independence-test against other active scope files for the same frontier.

## Refactor

With tests green, improve names, boundaries, and obvious local structure. Do not widen scope.

Refactor only while green. Keep the tests pinned to the public behavior so they protect the slice while allowing internals to move. If refactoring reveals that the test is coupled to implementation, fix the test seam before trusting it.

## Verify and commit

Run the project's verification harness. All checks must pass. If the card proved already satisfied and no code or canonical-state change was needed, do not create an empty commit.

**Green must not be manufactured by disabling oracles.** Never `.skip` / `.todo` a test (or narrow a test glob) to get the gate green. If a test genuinely must be parked, it needs an adjacent comment naming the reason and the re-enable trigger, plus an explicit line in the completion report — and parking a test that guards a card leaf or preserved invariant means the card is **not done**, whatever the gate says. Compare the suite's skipped-test count against the parent commit; an unexplained increase is a red flag you report, not a detail you omit.

**Completion is leaf-by-leaf, not vibes-level.** Before marking a card `done`, walk its Acceptance Criteria (and Invariants preserved, when present) and confirm each leaf against its named oracle. A one-line "done, verify green" against a multi-leaf card is the failure mode this rule exists to prevent: the gate proves the code compiles and current tests pass; only the leaf walk proves the card.

The completion report uses this shape — a table, not prose highlights (prose invites the compression this rule exists to resist), captured **before** the consumed scope file is deleted, since deletion destroys the checklist a reviewer would diff against:

```md
| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| [leaf text, abbreviated] | met / met-with-divergence / dropped | [oracle: test name, command output, or file:line] |
```

- **met-with-divergence** names what diverged and why. Writing or changing a test that pins behavior *contradicting* a card leaf is a divergence declaration by definition — surface it; a greener suite must not quietly renegotiate the card.
- **dropped** is loud and leaves the card open.
- Walk oracle-less obligations (naming comments, doc updates, deliberate-narrowing markers) **first** — the gate cannot catch those, so they are the leaves most likely to silently drop.
- End the report with the skipped-test-count delta vs the parent commit.

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
- [ ] Did this complete the **last member frontier of an initiative (arc)** in `memory/PLAN.md` §Initiatives?
- [ ] Did this change the topology of a directory that owns a `TOPOLOGY.md` (moved/renamed/retired files, changed dependency direction, completed or invalidated a migration note, or shipped a state previously described as pending)?

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
   - **Arc completion:** if this build completed the **last member frontier of an initiative (arc)** in `§Initiatives`, run that arc's **done-definition before** marking the arc done — including reconciling co-located topology files and discharging any standing-obligation residue scoped to the arc (the residue that no future frontier would otherwise touch). Mark the arc `✓ done` only once the done-definition actually holds; if residue remains, the arc stays `◐ active` with the residue named.

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

5. **Topology files** (when the topology question is `yes`)
   - update the `TOPOLOGY.md` of every touched directory that owns one — ownership statement, layout sketch, dependency-direction assertion, and migration notes
   - if a SPEC decision cited by the topology file was renumbered or retired during reconciliation, repair the citation in the same commit
   - if a directory the build retires owned a `TOPOLOGY.md`, delete the topology file with the directory
   - if a new directory introduced by this slice will be a long-lived seam (multiple files, named in SPEC, or imported by other layers), draft a minimal topology file following the shape in `AGENTS.md` §topology files — do not speculate; describe what exists

When uncertain between merge and add, add. When uncertain between update and no-op, update.

If uncertain whether the seam is actually settled, promote — do not silently keep the work light.

Before finishing reconciliation, perform a quick cross-skill check: if a later agent read only `memory/SPEC.md`, `memory/PLAN.md`, the touched frontier definition, and the touched directory READMEs, would they miss a durable design choice or verification commitment that this build changed or relied on? If yes, reconcile it before stopping.

### Retire derivative artifacts

After reconciliation, garbage-collect exhausted temporary files instead of leaving breadcrumbs or tombstones, but deletion is **per-file and narrowly scoped**.

Scope-file lifecycle under `memory/cards/`:

- Delete the **specific scope file just consumed** when all its cards are `done` or `dropped` and no further build remains. Use a literal path: `git rm memory/cards/<frontier-id>--<slug>.md` (or `rm` if untracked). Never bulk-delete the directory or operate on `memory/cards/*` with globs.
- If only some cards in the file are `done` and others remain `next` or `in progress`, leave the file in place with statuses updated.
- If the sequence became `stale` mid-build, leave the file in place with `Status: superseded` at the header so `ln-scope` / `ln-sync` can decide whether to rewrite or delete on the next pass.
- Other active scope files under `memory/cards/` for the same frontier (independent concerns) are out of scope for this build's cleanup. Do not touch them.

Other volatile artifacts are **review-before-delete**, not automatic cleanup:

- `HANDOFF.md` — delete only when it contains no unfinished transfer state and no future-context inventory that is not already captured in `memory/SPEC.md`, `memory/PLAN.md`, an active scope file, or a stable design memo.
- `memory/REFACTOR.md` — delete only when every listed refactor step is done/dropped and no future sequence depends on it.
- Provisional docs outside `memory/` (for example `docs/**/provisional*.md`, handoff plans, spike plans, or exploration inventories) — do **not** delete during `ln-build` cleanup unless the user explicitly asks or you first prove that all remaining future-facing inventory has been absorbed elsewhere. If only the current card is done but the artifact still contains later affordances, open questions, or scoping input, update it instead of deleting it.

Before deleting any file, name the file, state why no future agent would need it, and prefer asking the user when uncertain. For source files whose only runtime content is `export {}` plus comments, read the comments as design payload and apply `AGENTS.md` §intentional topology stubs before proposing deletion. Do not create archive copies, numbered handoffs, or completion-pointer files.

## Routing

If sliced execution mode is active and no stop condition fired, continue to the next card in the active scope file instead of routing back to the user yet.

Otherwise, after verification and any necessary promotion updates, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target       | Why |
| --- | ---------------- | ------------ | --- |
| 1   | Scope next item  | `ln-scope`   | More frontier work remains or no prepared scope file exists |
| 2   | Review the code  | `ln-review`  | Assess quality after an implementation burst |
| 3   | Revise spec      | `ln-spec`    | The build changed durable architecture |
| 4   | Revise plan      | `ln-plan`    | The frontier or priorities changed |
| 5   | Back to triage   | `ln-consult` | Direction needs reassessment |

Recommended: **1** if more work remains and there is no active scope file, **2** after multiple consecutive builds.
