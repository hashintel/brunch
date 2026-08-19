# Planning record substrate assessment

Status: working assessment and design note
Date: 2026-08-03

> This note assesses candidate substrates for hierarchical `spec -> plan -> task`
> records under Brunch's current collaboration constraints. It is not a second
> plan and it does not supersede [`memory/SPEC.md`](../../memory/SPEC.md) or
> [`memory/PLAN.md`](../../memory/PLAN.md) by itself. Its output is a design
> recommendation about where durable truth, mutable queue state, and execution
> notes should live so multi-human + multi-agent work stops colliding on the
> same few files.

## Executive summary

Brunch's current `memory/` shape is fragile because it concentrates both stable
design truth and fast-moving work-queue state into two shared hotspot files:

- [`memory/SPEC.md`](../../memory/SPEC.md) — 971 lines in the 2026-08-03 audit,
  with 173 historical touches.
- [`memory/PLAN.md`](../../memory/PLAN.md) — 275 lines in the same audit, with
  188 historical touches.

The best available move is not merely "pick a better tracker." The real design
requirement is:

> unrelated work should touch unrelated records; same-record collisions should
> be loud and explicit instead of silently interleaving inside one large shared
> document.

The assessed options sort into three families:

| Option | Best at | Main weakness against Brunch's current need |
| --- | --- | --- |
| [`tk`](https://github.com/h2oai/tk) | Git-local, one-file-per-record planning/task state | Sparse model; would need local conventions for richer spec/planning semantics |
| [`beans`](https://github.com/henriquebastos/beans) | Open agent-oriented graph semantics | Git sync goes through a hot journal, not one file per record |
| [`git-issues`](https://steviee.github.io/git-issues/) | Git-native issue files and agent workflow | Sequential IDs and weaker hierarchy than the current need |
| [`fp`](https://fp.dev/docs/) | Richest agent workflow and extension model | Issue state is local-first but not repo-first |
| [`linear` CLI](https://github.com/schpet/linear-cli) | Shared team coordination with no Git merge conflicts on queue state | Queue state no longer branches with the code by default |

For the original comparison criteria (`git` reviewability, worktree safety,
branch/checkouts, low-conflict collaboration), the recommendations are:

1. **Best pure git-first substrate:** `tk`
2. **Best open graph/workflow substrate:** `beans`
3. **Best team-first hybrid for Brunch specifically:** local spec docs + Linear
4. **Not recommended for this requirement:** `git-issues` and `fp`

For Brunch itself, the best near-term move is probably **not** a full tracker
replacement. The repo is already invested in local docs and already uses
Linear/Graphite discipline at the frontier level. The least disruptive and most
conflict-reducing design is therefore a **hybrid**:

- keep durable spec/design truth in repo-local markdown;
- move mutable frontier/task queueing into a tracker with better collaboration
  semantics;
- stop treating [`memory/PLAN.md`](../../memory/PLAN.md) as the live shared queue;
- progressively split [`memory/SPEC.md`](../../memory/SPEC.md) into smaller
  initiative- or frontier-scoped source files.

Two hybrid shapes are credible:

1. **Git-first hybrid:** local specs + `tk` for frontier/task execution.
2. **Team-first hybrid:** local specs + Linear for frontier/task execution.

Given Brunch's existing Linear discipline and multi-human collaboration, the
team-first hybrid is the strongest default for this repo. The git-first hybrid
is still the better answer for smaller or more solitary repos that want tracker
state to branch with the code.

## Current pressure in `memory/`

The 2026-08-03 audit of [`memory/`](../../memory/) surfaced a structural problem,
not merely a process problem.

### What is currently hot

- [`memory/SPEC.md`](../../memory/SPEC.md) carries global doctrine, live
  architecture decisions, current-state pointers, verification posture, and
  future-direction residue.
- [`memory/PLAN.md`](../../memory/PLAN.md) carries active sequencing,
  dependencies, frontier definitions, and live status churn.
- [`memory/cards/`](../../memory/cards/) already has a better conflict shape:
  smaller, topic-local files with lower blast radius.

### Failure modes of the current shape

1. **Shared hotspot edits.** Two people working on unrelated frontiers can still
   collide because both must touch the same queue file.
2. **Narrative truth and mutable queue state are conflated.** Stable design
   claims and rapidly changing assignment/ordering/status churn coexist in one
   place.
3. **Derived views are hand-maintained.** Sequencing summaries, active lists,
   and near-horizon order are curated manually rather than projected from a more
   local substrate.
4. **Large-file merges are semantically risky.** Even when Git merges cleanly,
   the resulting prose can reflect two incompatible edits whose contradiction is
   not obvious.

### Positive signal already present

The files in [`memory/cards/`](../../memory/cards/) demonstrate the shape that
scales better:

- one record per file;
- focused ownership;
- explicit local context;
- limited merge blast radius.

The redesign should make more of the planning substrate look like that.

## Evaluation criteria

The options below are judged by the properties Brunch actually needs.

### 1. Merge locality

If two unrelated changes create or update separate records, they should land in
separate files or separate tracker entities. A good system makes same-record
conflicts loud, not hidden.

### 2. Worktree and checkout behavior

The workflow needs to survive stacked branches, parallel worktrees, and
different checkouts without ambiguous ownership.

### 3. Hierarchy semantics

Brunch needs at least three conceptual layers:

- durable spec / initiative truth;
- plan / frontier / major subproblem;
- execution task / slice / evidence beat.

### 4. Agent usability

The substrate should support agent-driven decomposition, pickup, updating, and
status inspection without excessive bespoke glue.

### 5. Compatibility with repo-local docs

Some projects already have strong local design docs. The ideal solution should
let those remain authoritative without forcing a second speculative doctrine.

### 6. Team collaboration

The system should make it hard for two collaborators to clobber each other,
whether they are humans, agents, or one of each.

### 7. Extensibility and hackability

If the model is imperfect, can we extend it by configuration, wrappers, or a
small amount of code rather than a platform rewrite?

## Assessed options

## `tk`

### Strengths

- One markdown file per ticket under `.tickets/` gives strong merge locality.
- Short random IDs avoid the sequential-ID collision problem.
- Parent/child hierarchy plus dependency edges are enough to model
  `spec -> frontier -> task` with conventions.
- The entire state rides with the branch and checkout because the records are
  ordinary files.
- It is small enough to understand and adapt quickly.

### Weaknesses

- The schema is sparse and fixed.
- There is no first-class spec ontology; richer meaning must come from naming,
  layout, and wrapper conventions.
- There is no built-in collaboration or notification layer beyond Git itself.

### Assessment

`tk` is the best pure git-first choice because it optimizes the property Brunch
currently lacks most: **record-local merges**. It does not have the richest
model, but its failure mode is good. Two unrelated tasks usually become two
different files.

### Best fit

- solo or mostly-solo projects;
- agent-heavy repos that want tracker state to branch with the code;
- teams willing to encode a thin house convention on top of a simple substrate.

## `beans`

### Strengths

- Strongest open semantic model of the evaluated tools.
- Clean distinction between parent/child hierarchy and blocking dependencies.
- Transitive ready-work computation is valuable for agents.
- Claim/release is a pragmatic multi-agent coordination primitive.
- Custom bean types mean `spec`, `plan`, and `task` can be explicit.

### Weaknesses

- Live state is SQLite; Git sync goes through a committed JSONL journal.
- The journal is a collaboration hotspot compared with one-file-per-record
  systems.
- Extensibility is mostly in-source rather than via plugins.

### Assessment

`beans` is the best option if semantic quality matters more than Git merge
topology. Its graph model is notably better than `tk`, but the journal-based
Git story is weaker for the exact problem Brunch is trying to reduce.

### Best fit

- local-first teams who want a richer agent/task graph;
- repos comfortable treating Git as journal transport rather than as the direct
  record surface;
- teams willing to own a small Python substrate.

## `git-issues`

### Strengths

- Files live directly in `.issues/` and move with the code.
- Agent-friendly `next`, `claim`, `done`, relation sync, and JSON output.
- Good for ordinary issue tracking with dependency links.

### Weaknesses

- Sequential integer IDs are a poor fit for parallel branch-local issue creation.
- Hierarchy is weaker than the current `spec -> plan -> task` need.
- Relation symmetry means one conceptual change can touch multiple files.

### Assessment

`git-issues` is well aligned with Git, but less well aligned with the actual
hierarchical planning problem. It improves over the current monolithic docs in
some ways, yet it still leaves Brunch with awkward hierarchy and branch-creation
conflict pressure.

### Best fit

- repos that want lightweight git-native issues rather than a planning system.

## `fp`

### Strengths

- Richest agent workflow of the evaluated tools.
- Comments, context loading, commit/diff association, review UI, and a real
  extension model are substantial advantages.
- Strong customization surface via TypeScript lifecycle extensions.

### Weaknesses

- Issue state is local-first but not repo-first.
- The public source linked from the docs exposes integrations and skills, not
  the core issue engine.
- Planning state is therefore less inspectable and less naturally code-reviewed
  than file-native solutions.

### Assessment

`fp` is the most capable product, but it is not the best answer to the specific
question "how do we keep hierarchical planning records merge-friendly inside
Git?" It is a stronger answer to "how do we give agents a better workflow tool?"

### Best fit

- teams optimizing for agent UX over Git-native planning state;
- repos comfortable with planning data living outside the code tree.

## Linear CLI

### Relevant capabilities

The installed CLI already exposes the surfaces needed for a serious planning
basis:

- `linear initiative *`
- `linear project *`
- `linear milestone *`
- `linear issue create --parent ...`
- `linear issue relation add <issue> blocked-by|blocks|related|duplicate <other>`
- `linear issue comment *`
- `linear document *`
- branch-aware helpers such as `linear issue id`, `linear issue start`, and
  `linear issue pull-request`

### Strengths

- Shared state lives outside Git, so plan/task updates do not produce merge
  conflicts in the repo.
- Parent issues and issue relations are enough for a frontier/task graph.
- Initiatives, projects, and milestones give multiple hierarchy levels.
- The CLI is scriptable and already part of Brunch's operating discipline.
- Multi-human collaboration, assignee visibility, and notification behavior are
  already solved by the platform.

### Weaknesses

- Queue state does not branch with the code. A feature branch does not
  automatically carry an alternate plan state.
- Local spec/design truth can drift from Linear if the ownership boundary is not
  explicit.
- Linear Documents are collaborative, but they are not Git-reviewed repo-local
  files.

### Assessment

Linear is the strongest out-of-band answer if the main pain is **shared mutable
queue state** rather than **branch-local planning state**. It removes Git merge
conflicts by moving the queue elsewhere, and Brunch already has established FE /
Graphite / Linear conventions.

The trade is important: you are no longer asking Git to represent the current
task graph. For Brunch, that is probably acceptable for frontier/task execution.
It is much less acceptable for canonical design truth.

### Best fit

- multi-human teams already using Linear;
- repos that want repo-local specs but shared cloud-backed planning/execution;
- teams that value collaboration hygiene over branch-native plan divergence.

## Recommendation matrix

| Situation | Best fit | Why |
| --- | --- | --- |
| Need tracker state to branch with the code | `tk` | One file per record; Git remains the source of truth |
| Need the richest open graph semantics | `beans` | Better task/dependency model than the others |
| Need the best agent workflow product | `fp` | Strongest workflow and extension surface |
| Need a low-conflict team queue with current Brunch conventions | Linear hybrid | Avoids repo merge conflicts on mutable queue state |

For Brunch specifically, the default recommendation is:

> keep local docs for durable truth; move shared frontier/task queueing further
> into Linear; stop treating `PLAN.md` as the canonical live queue; progressively
> split `SPEC.md` into smaller local documents.

## Design rules that matter more than tool choice

These rules hold whether the repo chooses `tk`, Linear, or something else.

### 1. Separate stable truth from mutable queue state

Stable design truth and rapidly changing status/order/assignment should not live
in the same file or the same record.

### 2. Use one file per durable concept when staying local

If a spec or architecture note remains repo-local, it should be scoped to one
initiative, frontier, or other narrow durable concept. Monoliths accumulate
semantic merge risk even when task tracking moves elsewhere.

### 3. Prefer derived overviews to hand-maintained rollups

Human overviews are useful, but they should be projected from local records or
tracker entities whenever possible. The more often people edit the overview, the
hotter it becomes.

### 4. Keep branch-local scratch separate from shared canon

Execution notes, private experiments, or branch-local checkpoints can live in
cards, comments, or scratch files. They should not force edits to the shared
global queue.

### 5. Cross-link with stable IDs

Whatever the substrate, every durable spec and every mutable frontier/task item
should have a stable cross-reference:

- spec doc path or local ID
- tracker ID (`TK-...`, `FE-...`, etc.)
- branch/PR reference where applicable

### 6. Prefer loud collisions to silent interleaving

The goal is not zero conflicts. The goal is that when two collaborators do touch
the same record, the conflict is obvious and semantically local.

## Hybrid design A — Git-first (`tk` + local specs)

This is the right design for repos that want Git to remain the planning
substrate.

### Shape

```diagram
┌─────────────────────────────┐
│ Repo-local spec docs        │
│ one file per initiative     │
└──────────────┬──────────────┘
               │ references
               ▼
┌─────────────────────────────┐
│ .tickets/                   │
│ epic/feature/task records   │
│ parent + deps + notes       │
└──────────────┬──────────────┘
               │ drives
               ▼
┌─────────────────────────────┐
│ Branch / worktree execution │
│ commits, PRs, evidence      │
└─────────────────────────────┘
```

### Proposed mapping

- spec doc = local markdown file under a split spec directory
- `tk` epic = frontier / major execution package
- `tk` feature or task = slice, evidence beat, or implementation unit
- `parent` = decomposition
- `deps` = blocking order

### Advantages

- best Git merge locality;
- plan state branches naturally with the code;
- task graph is inspectable in PRs;
- no external system is required.

### Costs

- conventions must carry more meaning than the raw tool model;
- team-level discovery/notification is weaker than Linear;
- no existing Brunch operating discipline is built around `tk` today.

### Best use

- smaller repos;
- more solo or agent-centric work;
- teams that explicitly want planning state in the commit graph.

## Hybrid design B — Team-first (Linear + local specs)

This is the strongest default for Brunch.

### Shape

```diagram
┌─────────────────────────────┐
│ Repo-local spec docs        │
│ one file per initiative     │
│ canonical design truth      │
└──────────────┬──────────────┘
               │ referenced from issue bodies
               ▼
┌─────────────────────────────┐
│ Linear                      │
│ initiative / milestone /    │
│ parent issue / child issue  │
│ relations / comments        │
└──────────────┬──────────────┘
               │ drives
               ▼
┌─────────────────────────────┐
│ Branch / worktree execution │
│ Graphite stacks, PRs, runs  │
└─────────────────────────────┘
```

### Proposed ownership split

- local markdown spec doc = canonical design truth
- Linear initiative / project / milestone = program-level grouping
- parent issue = frontier item
- child issue = execution task or evidence beat
- Linear comments = progress log, checkpoints, links to evidence
- local cards = branch-local scratch or scoped working notes, not shared queue

### Why this fits Brunch

- Brunch already requires a Linear issue per frontier item in
  [`AGENTS.md`](../../AGENTS.md).
- The repo already uses Graphite branch conventions tied to those issues.
- The mutable queue can leave Git without sacrificing canonical repo-local spec
  docs.
- Collaboration conflicts move from opaque markdown merges to explicit tracker
  updates.

### Costs

- plan state is no longer branch-native;
- a discipline boundary must prevent drift between docs and tracker;
- some current `PLAN.md` affordances must move into tracker fields, comments, or
  derived scripts.

### Recommended Brunch mapping

- keep [`memory/POSTURE.md`](../../memory/POSTURE.md) as repo-level posture;
- keep a reduced repo-level architectural register, but progressively split
  large initiative-specific material out of [`memory/SPEC.md`](../../memory/SPEC.md);
- stop using [`memory/PLAN.md`](../../memory/PLAN.md) as the canonical mutable
  queue;
- treat new frontier items as Linear parent issues with explicit child issues
  for tasks/evidence when collaboration pressure warrants them;
- keep cards only where a branch-local execution note genuinely helps.

## Why a full Linear migration is not the same as the hybrid

Brunch should not simply move everything into Linear.

### Why not

- Canonical design truth benefits from Git review, nearby code context, and
  branch-local experimentation.
- Large narrative specs and architecture notes belong with the codebase.
- Linear Documents are useful, but they do not replace repo-local source of
  truth for this project's current working style.

### Use Linear for

- mutable shared queue state;
- ownership and assignment;
- parent/child task trees;
- dependencies and blocking;
- progress commentary;
- cross-human coordination.

### Keep local markdown for

- durable spec/design reasoning;
- architecture contracts;
- product lexicon and invariants;
- repo-reviewed proposals.

## Proposed migration direction for Brunch

This is a design direction, not an immediate rewrite order.

### Phase 1 — stop growing the hotspot

1. Treat [`memory/PLAN.md`](../../memory/PLAN.md) as a shrinking compatibility
   surface rather than the forever queue.
2. Put new mutable frontier/task coordination primarily in Linear.
3. Avoid adding fresh branch- or assignee-churn to global local docs unless it
   is truly canonical doctrine.

### Phase 2 — split durable truth by scope

1. Identify initiative- or frontier-scoped regions of
   [`memory/SPEC.md`](../../memory/SPEC.md) that can become smaller local docs.
2. Keep only cross-cutting doctrine, lexicon, and stable architecture register
   content in the repo-global file.
3. Prefer one durable concept per file.

### Phase 3 — make rollups thinner or derived

1. Replace hand-maintained active queue summaries with tracker projections or
   lighter index files.
2. Keep local overview docs descriptive and low-churn.
3. Ensure the shared tracker, not a hand-edited monolith, answers "what is next"
   and "who owns this right now".

## Final recommendation

For Brunch, the best default answer is:

> **team-first hybrid:** repo-local spec/design docs for durable truth, Linear
> for mutable frontier/task execution, and progressive splitting of the current
> monolithic memory files.

For other repos, the decision rule is simpler:

- if the plan state itself must branch with the code, choose `tk`;
- if the team already lives in Linear and wants fewer collisions immediately,
  choose the Linear hybrid;
- if richer graph semantics matter more than Git merge topology, choose
  `beans`.

The main conclusion is therefore not that Brunch picked the wrong tracker. It is
that **global planning monoliths are the wrong shape for collaborative,
multi-worktree agentic development**. Any replacement should first fix that
shape.
