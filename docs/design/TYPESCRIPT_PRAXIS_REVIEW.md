# TypeScript Praxis Review

Date: 2026-04-09

## Scope

Read-only review of the TypeScript codebase, guided by the `refs-typescript-praxis` skill.

Primary focus areas:

- `src/server`
- `src/shared`
- `src/client/workspace`
- `src/client/mutations`
- key route files that consume shared types

Praxis categories applied:

- Modeling Data Shapes
- Modules and API Surface
- Type System Sharp Edges
- Naming and Documentation

## Executive Summary

The biggest TypeScript problem in this codebase is not syntax-level style drift; it is boundary drift. Several client/server and JSON boundaries are typed by assertion rather than by an explicit shared contract plus runtime proof. That weakens the exact places where TypeScript should be buying the most confidence.

After that, the main recurring issues are:

1. optional-property shapes that blur distinct states
2. exported functions that rely on inference instead of explicit boundary signatures
3. snapshot/view-model types left mutable even though the code treats them as immutable
4. repeated inline `type` imports instead of top-level `import type`

## Findings

1. **Transport and API contracts are asserted rather than modeled** — category: model — impact: high

   The shared API layer is derived from server implementation signatures instead of from an explicit transport contract. `src/shared/api-types.ts:1-7` imports server functions and re-exports `ReturnType<typeof ...>` aliases as the client-facing API model. That makes the implementation the schema: a server refactor can silently reshape the client contract even when the transport payload was supposed to stay stable.

   The same pattern continues at runtime boundaries. `src/client/workspace/workspace-loader.ts:8-15` and `src/client/mutations/client-mutation.ts:17-19,30-55` parse JSON and immediately cast the result with `as T` / `as MutationErrorResponse`. Those casts do not prove anything about the payload; they only suppress uncertainty. The result is a boundary that looks typed in editor tooling but is not actually defended.

   Suggested action: define explicit shared DTO types or Zod schemas at the transport boundary, validate there, and let the client consume those validated contracts instead of inferring them from server function return types.

2. **Several domain and event shapes encode state through optional fields instead of explicit variants** — category: model — impact: medium

   The praxis guidance explicitly warns against using optional properties when the caller should make an explicit presence decision. This repo has a few recurring cases where omission stands in for a real state distinction.

   Examples:

   - `src/server/core.ts:26-35` defines `TurnWithOptions` with `options?`, even though `loadActivePathWithOptions()` always supplies `options`.
   - `src/server/turn-response.ts:4-8` defines `ProjectedTurnResponse.freeText?: string`, which leaves absence ambiguous rather than explicit.
   - `src/client/mutations/workspace-mutations.ts:19-24,31-54` uses optional `positions` and `freeText` fields to encode mutually meaningful response modes.
   - `src/client/workspace/workspace-data.ts:15-20,65-71` accepts `{ type: string; data?: unknown }` for incoming data parts instead of a discriminated union keyed by `type`.

   These are all small individually, but together they create a “bag of optionals” style where consumers need defensive branching even when the real domain states are narrower.

   Suggested action: prefer discriminated unions for multi-mode payloads, and use `T | undefined` only when the caller should make presence explicit instead of relying on property omission.

3. **Top-level exported functions still hide important module contracts behind inference** — category: modules — impact: medium

   The praxis guidance recommends explicit return types on top-level module functions so the boundary stays legible to both humans and tools. This repo still has several exported functions whose signatures stop at parameters and leave the return shape implicit.

   Representative examples:

   - `src/server/app.ts:36-233` — `createApp`
   - `src/server/interview.ts:58-123` — `persistStructuredQuestion`, `createAskQuestionTool`, `createInterviewerAgent`
   - `src/server/core.ts:63-68` — `getProjectState`
   - `src/client/mutations/project-mutations.ts:6-25` — `useCreateProjectMutation`
   - `src/client/workspace/workspace-controller-core.ts:263-269` — `findTurnOptionByPosition`, `findTurnOptionsByPositions`

   This is not a runtime bug by itself, but it makes module surfaces harder to scan and easier to widen accidentally during refactors.

   Suggested action: add explicit return types to exported non-component functions, especially factory functions, hooks, server entrypoints, and API helpers.

4. **Immutable snapshots and view-models are modeled as mutable objects** — category: model — impact: medium

   The praxis guidance recommends `readonly` by default for object properties, especially when mutation is not part of the design. Many of the codebase’s snapshot and view-model types are computed once and then treated as immutable, but their types do not express that.

   Clear examples:

   - `src/client/workspace/workspace-controller-core.ts:14-61` — workspace durable state, pending-question view model, and controller view state
   - `src/client/workspace/workspace-controller.ts:19-52` — controller state interfaces returned from the hook
   - `src/shared/knowledge.ts:19-26` — `KnowledgeKindRegistryEntry`
   - `src/client/workspace/workspace-loader.ts:3-6` — loader snapshot shape

   Leaving these mutable means accidental writes still type-check, even though the code treats these objects as read-mostly snapshots.

   Suggested action: add `readonly` to snapshot/view-model interfaces first, then widen only where mutation is actually intentional.

5. **Type-only imports are inconsistent with the repo’s stated import hygiene** — category: modules — impact: low

   The praxis guidance prefers top-level `import type` over inline `import { type ... }` so the erased intent stays obvious across environments. I found this inline form repeated across the repo, for example:

   - `src/shared/chat.ts:1`
   - `src/server/db.ts:2-12`
   - `src/server/interview.ts:11`
   - `src/client/routes/InterviewWorkspace.tsx:24`
   - `src/client/workspace/workspace-controller.ts:3,9`

   This is the lowest-severity item in the review, but it is widespread enough to be worth normalizing. A quick search currently finds 17 inline `type` import sites under `src/`.

   Suggested action: switch these to top-level `import type` whenever the imported symbol is type-only.

## Watchlist

- `src/server/core.ts:38-56` and `src/server/app.ts:176-183` use a manual `throw`/`catch` path to model a missing project. Per the praxis throwing guidance, this is a good candidate for an explicit result type or a typed lookup outcome when that code is next touched.
- `src/server/db.ts` has many `as` assertions around Drizzle results. Some of that is library friction rather than local design failure, but it is still a place to push for narrower helper APIs so the assertions do not spread further.

## Recommended Order Of Attack

1. Replace implementation-derived API aliases with explicit shared transport contracts plus runtime validation.
2. Collapse optional-heavy request and event shapes into narrower unions or explicit `T | undefined` fields.
3. Add explicit return types to exported functions during the same pass.
4. Normalize `readonly` and `import type` opportunistically once the higher-risk boundary work is in flight.
