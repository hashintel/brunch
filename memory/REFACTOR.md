# FE-1216 control-plane closure refactor

## Problem Statement

The branch closes important control-plane seams, but several closure oracles are self-fulfilling or duplicated, one retired eager-context concept survives as test-only code, and canonical documentation still describes pre-closure state. The result passes verification while overstating what the tests prove and preserving concepts the earned frontier intended to delete.

### Current

```text
control-plane closure
├── resource invocation proof
│   ├── hand-written expected resource table
│   ├── fabricated advertised/read/provider-visible events
│   └── report assertion against the same table
├── context seeds
│   ├── live workspace snapshot renderer
│   └── test-only graph/lens renderer from the retired eager path
├── assurance contract
│   ├── hand-written subset of live skills
│   └── unguarded prospective-evidence wording elsewhere
├── control ownership
│   ├── session topology table
│   ├── runtime topology table
│   └── prose-regex test over both tables
└── canonical state
    ├── completed PLAN frontier
    ├── pending/planned SPEC statuses
    └── stale topology and tree inventory entries
```

## Solution

Delete the synthetic proof and the dead eager-context remainder, then make the surviving contracts read from production-owned surfaces. Keep one behavioral control-ownership oracle and make each topology home describe only the state it owns. Reconcile canonical status only after the implementation and tests tell one story.

### Desired

```text
control-plane closure
├── resource observability
│   └── production recorder -> persisted events -> report projection
├── context seeds
│   └── live workspace/background snapshot renderer
├── assurance contract
│   └── canonical live-skill inventory -> one semantic rule
├── control ownership
│   ├── behavioral ownership oracle
│   └── one canonical table with narrow topology pointers
└── canonical state
    └── SPEC + PLAN + topology + tree inventory agree that closure landed
```

## Commits

1. [done] Add a production-wired characterization that carries a composed prompt and recorded resource read through the real trajectory recorder into the report projection.
2. [done] Delete the self-fulfilling resource-invocation harness and retain only independently sourced expectations that the production characterization can falsify.
3. [done] Delete the unused graph/lens seed renderer and its tests, and reconcile the owning seed topology and generated tree inventory in the same commit.
4. [done] Make assurance guidance validation derive from the canonical live-skill inventory and replace the remaining prospective-evidence wording with observation/check language.
5. Remove prose-regex enforcement and duplicate control-ownership documentation; keep behavioral assertions and one canonical ownership table with narrow pointers from the other owner.
6. Delete exhausted subagent deferrals and mark the control-ingress decision and invariant as materialized/covered so SPEC, PLAN, and topology describe the landed state.

## Decisions

- The trajectory recorder and report projection remain the sole observability path; no second capture contract or production IR is introduced.
- Deterministic tests prove instrumentation integrity, not that an LLM chose to read a resource. Agent-conduct evidence remains owned by controlled provider trajectories and the downstream capture falsifier.
- The reusable context-seed surface retains only renderers with production callers.
- Assurance semantics apply across the canonical live skill inventory rather than a test-owned subset.
- Control ownership is proved behaviorally; topology documentation is orientation, not a regex-parsed runtime contract.
- No schema, persistence, provider-carrier, or public API shape changes.
- Topology homes for context seeds, elicitor runtime, session control, and subagents are updated or thinned in the same commit as the state they describe.

## Testing Decisions

- A good trajectory test enters through the production recorder, persists the emitted events, and projects the report; its expected requirement list must not generate the observed events.
- Existing recorder secrecy/correlation tests and report active-branch tests remain prior art and should be reused rather than wrapped in another fixture framework.
- Context deletion is guarded by production-caller search, focused seed tests, and the routine build/type gate.
- Assurance tests consume the live registry and reject prospective-evidence language across the whole advertised surface.
- Control tests exercise posture origination, active-branch style projection, and prompt agenda behavior without reading Markdown files.
- Run focused tests after each commit and `npm run verify` before deleting this refactor plan.

## Out of Scope

- Changing provider carrier framing or prompt replacement semantics.
- Adding resource-read enforcement to normal product runs.
- Running the capture-ledger experiment or changing its intervention.
- Reviewer-agent behavior, review rendering, graph schema, migrations, or historical fixture regeneration.
- Restacking or submitting the Graphite branch.
