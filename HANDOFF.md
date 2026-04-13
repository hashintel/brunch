# Handoff — 2026-04-13

## Phase in flow

```
grill → spec ✓ → plan ✓ → [design] → [oracles] → scope → [spike] → build → review → [refactor] → sync ✓
                                                     ↑
                                              RESUME HERE
```

- **Last completed skills**: `ln-spec` (patch — D86/D87), `ln-plan` (patch — Phase 11), `ln-sync` — all done
- **Next skill**: `/ln-scope` for slice 23
- **Current skill**: `ln-handoff` (producing this document)

## Session summary

Routing redesign talkthrough → spec decisions → plan slices → sync → commit. No code changes — pure planning session.

1. **Dev talkthrough** — deep exploration of current routing (flat workspace model), data loading split (loaders vs React Query vs SSE), filesystem naming conventions, and phase/workspace semantics
2. **Routing redesign discussion** — user proposed phase-based routing with three concentric layout shells (AppLayout → ProjectLayout → ViewLayout). Confirmed TanStack Router pathless layout routes support search param validation for Chat/Graph view switching.
3. **`/ln-spec` patch** — added D86, D87; updated D9/D69/D85; added I15/I102 pending-update comments; updated lexicon and acceptance criterion 5
4. **`/ln-plan` patch** — added Phase 11 slices 23-26; integrated REFACTOR.md as slice 23a; updated dependency graph and parallelism notes
5. **`/ln-sync`** — fixed stale A40 reference (D69→D86), resolved slice 22 debt note, pruned horizon items, assessed REFACTOR.md conflict
6. **Commit** — `91c18ec`

## In-flight state (discussed but not fully captured in docs)

### Design nuances agreed in conversation

1. **Phase transition UX preference**: user confirmed option #3 — a transition prompt ("Framing complete. Continue to Elicitation?") rather than auto-navigate or stay-put. D86 captures the mechanic (close → on-success → navigate) but not the UX preference for an explicit handoff moment.

2. **Data loading pragmatics**: phase routes will NOT have their own loaders initially. They read from ProjectLayout's loader via `useLoaderData({ from: '/project/$id' })` and filter turns client-side by `turn.phase`. Per-phase server endpoints are a Horizon item. D87 says "phase route loaders load conversation turns for that phase only" — the first implementation filters, not fetches separately.

3. **Knowledge workspace dissolution rationale**: user explicitly said the knowledge view "crept in early from the original spec" and wasn't actively designed. This motivated the routing redesign — phases as routes is the user's mental model.

4. **`router.invalidate()` lease**: user considers this "a pretty big caveat" — the layout-level split buys time but won't solve it permanently. React Query granular caching is the eventual answer (Horizon item).

5. **Graph view scoping**: project-scoped by default, optionally phase-filtered. Not in conflict with nesting inside `_view/` — the phase child route can provide a phase filter while the graph defaults to showing everything.

### REFACTOR.md sequencing rationale

Entity-projection refactor compiled by another agent. Sync analysis:
- Commits 1-3 (characterization, projection extraction, relation widening) — server-side only, no conflict with slice 23
- Commits 4-6 (knowledge-surface rendering, active-path switch, test retirement) — touch workspace loaders, must land BEFORE slice 24
- Tracked as slice 23a between 23 and 24

### Phase name mapping (reference)

| Server phase | User-facing name | Route segment |
|---|---|---|
| `scope` | Framing | `/framing` |
| `design` | Elicitation | `/elicitation` |
| `requirements` | Review: Requirements | `/requirements-review` |
| `criteria` | Review: Criteria | `/acceptance-review` |

### Target file structure (reference)

```
routes/
├── __root.tsx                          ← AppLayout
├── index.tsx                           ← / (project list)
└── project/
    └── $id/
        ├── route.tsx                   ← ProjectLayout (left sidebar)
        ├── index.tsx                   ← /project/:id (summary, redirects to active phase initially)
        ├── export.tsx                  ← /project/:id/export (no ViewLayout)
        └── _view/
            ├── route.tsx               ← ViewLayout (?view=chat|graph switch)
            ├── framing.tsx             ← scope
            ├── elicitation.tsx         ← design
            ├── requirements-review.tsx ← requirements
            └── acceptance-review.tsx   ← criteria
```

### Key code locations for slice 23

- `workspace-controller.ts:68` — `useLoaderData({ from: '/project/$id' })` hardcoded route reference
- `workspace-loader.ts` — fetches both projectState and entitySnapshot in one call (needs splitting in slice 24, not 23)
- `vite.config.ts` — TanStack Router plugin config needs `routesDirectory` update for directory scanning
- `__root.tsx` — minimal div wrapper, becomes AppLayout shell
- Current route files to migrate: `project.$id.tsx`, `project_.$id.knowledge.tsx`, `project_.$id.export.tsx`

## Persisted state

### Git

- **Branch**: `ln/fe-581-e2e-manual-refine-1` (12 commits ahead of origin)
- **HEAD**: `91c18ec` — docs commit
- **Working tree**: clean

### Artifacts

| File | Status | Notes |
|---|---|---|
| `memory/SPEC.md` | Current | D86/D87 added; D9/D69/D85 updated; I15/I102 pending-update comments |
| `memory/PLAN.md` | Current | Phase 11 slices 23-26 + 23a; dependency graph updated |
| `memory/REFACTOR.md` | Current | Entity-projection commit plan; tracked as slice 23a |

### Verify status

`npm run verify` — all green. 40 test files, 296 tests, lint/fmt/typecheck/build pass.

## Resume prompt

```
Read HANDOFF.md, then memory/SPEC.md §Decisions D85, D86, D87
and memory/PLAN.md §Phase 11 slice 23. Run /ln-scope for slice 23
(directory-based routing infrastructure + layout shell scaffolding).

The SPEC decisions are committed, the plan is written — scope the
first slice for implementation. Key context: phase routes initially
all render the same InterviewWorkspace (behavior parity first,
content redistribution in slices 24-25). The current __root.tsx is
a minimal div wrapper. workspace-controller.ts:68 has a hardcoded
useLoaderData route reference that will need updating.
```

### Blockers

None. Slice 23 is unblocked and ready to scope.

### Parallel work available

Slice 23a commits 1-3 (entity-projection characterization + extraction + widening) can be run by a separate agent in parallel with slice 23 — they touch only server-side entity projection logic. See `memory/REFACTOR.md` for the commit plan.
