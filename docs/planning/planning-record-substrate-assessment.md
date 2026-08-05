# Planning record substrate assessment

Status: historical design assessment; Brunch migration prescription **not adopted**
Date: 2026-08-03
Reconciled: 2026-08-05

> This note records an assessment of candidate substrates for hierarchical
> `spec -> plan -> task` records. Its proposal to replace
> [`memory/PLAN.md`](../../memory/PLAN.md) as the canonical queue and
> progressively split [`memory/SPEC.md`](../../memory/SPEC.md) was not adopted.
> Do not use the proposal below as migration direction.

## Current authority

Brunch retains the repository workflow defined by [`AGENTS.md`](../../AGENTS.md):

- `memory/SPEC.md` owns what and why;
- `memory/PLAN.md` owns sequencing and plan-level frontier definitions;
- Linear tracks each plan-level frontier;
- Graphite represents frontier dependencies as stacked branches;
- `memory/cards/` holds temporary scope files, not a second queue; and
- co-located `src/**/TOPOLOGY.md` files own current materialized topology.

That ownership model supersedes this assessment's proposed team-first migration.
Changing it requires a new explicit planning decision.

## Question assessed

The assessment asked how hierarchical planning records could reduce merge
pressure under parallel human and agent work. It compared:

| Option | Best at | Main weakness for Brunch |
| --- | --- | --- |
| [`tk`](https://github.com/h2oai/tk) | Git-local, one-file-per-record state | Sparse model and new house conventions |
| [`beans`](https://github.com/henriquebastos/beans) | Open graph semantics | Journal-based Git sync remains a hotspot |
| [`git-issues`](https://steviee.github.io/git-issues/) | Git-native issue files | Sequential IDs and weak hierarchy |
| [`fp`](https://fp.dev/docs/) | Rich agent workflow and extensions | Planning state is not repo-first |
| [`linear` CLI](https://github.com/schpet/linear-cli) | Shared coordination without queue-file conflicts | Queue state does not branch with code |

The 2026-08-03 recommendation favored a team-first hybrid: repository-local
design truth with mutable execution coordination in Linear. That observation
informed the adopted frontier-level Linear/Graphite workflow, but the stronger
proposal to demote PLAN or split SPEC did not become Brunch architecture.

## Durable observations

The assessment surfaced useful pressures that remain valid:

1. Unrelated work should prefer unrelated records.
2. Same-record collisions should be explicit rather than silently interleaved.
3. Stable design truth and mutable coordination have different churn profiles.
4. Small scope files reduce merge blast radius when they remain temporary and
   subordinate to one canonical plan.
5. Tracker IDs, branch names, and canonical document paths should cross-link
   through stable identifiers.

These are design observations, not authorization to create another planning
store or relocate current authority.

## Historical proposal — unadopted

The original proposal would have:

1. moved mutable frontier and task queueing primarily into Linear;
2. treated `memory/PLAN.md` as a shrinking compatibility surface;
3. split initiative-specific material out of `memory/SPEC.md`; and
4. replaced hand-maintained rollups with tracker projections.

Brunch did not adopt those steps. PLAN remains the canonical answer to “what is
next,” while Linear and Graphite track the plan-level frontier units it names.
This section is retained only to explain the alternative that was considered.

## Re-entry rule

Revisit the substrate only through a new PLAN frontier that explicitly changes
the authority matrix above. Tool adoption, tracker convenience, or merge
pressure alone does not silently supersede current repository authority.
