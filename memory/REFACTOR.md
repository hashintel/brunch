# Refactor: web-session TS source-of-truth hardening

Temporary execution aid (ln-refactor). Delete when complete or superseded.

Scope: the web-session RPC/contract typing surface. Findings from the TS
source-of-truth review (`expert-typescript-typing`). Goal: one owner per shape,
no boundary schema drifting from the owner it re-encodes.

## Problem Statement

Several shapes on the live-session RPC surface are described more than once, and
the copies have started to disagree:

- The ask **mode** literal union is written out three times — the owning TS type,
  the zod wire schema, and the TypeBox discovery schema — and the TypeBox copy
  has already drifted (it omits `questionnaire`), so `rpc.discover` mis-describes
  a mode that flows fine at runtime.
- The standalone hosted `session.openAsks` advertises an opaque
  `AnyResultSchema` while the sidecar variant advertises the precise
  `{ openAsks }` shape — asymmetric discovery for one method name.
- `LiveSessionHostResult` is split into two union members with identical
  `{ status }` structure; the split carries no discrimination (no consumer
  branches on it) — cosmetic grouping that reads as a real distinction.
- The web router is registered as `AnyRouter`, erasing TanStack Router's route
  inference everywhere, which forces a `useLoaderData() as OpenAsksResult` cast
  (and `Number(params.*)` reassertions) at every route call site.

```pseudo
tree current (ownership of the "ask mode" union)
OpenAskMode  [owner: session/live-ask-registry]  = literal union ×5
├── zOpenAsk.mode        [rpc/live-session-contract]  = z.enum ×5   # copy
└── OpenAskSchema.mode   [rpc/methods/session-open-asks] = Type.Union ×4  # copy, DRIFTED (no questionnaire)

graph current (session.openAsks result advertising)
sidecar    -> OpenAsksResultSchema  { openAsks: [...] }   # precise
standalone -> AnyResultSchema       { any }               # opaque
client     -> openAsksResultSchema  { openAsks: [...] }   # zod, unpinned to owner
```

## Solution

One owned enumeration for ask mode; both wire schemas derive from it. One
precise result shape for `session.openAsks` on both hosts. One honest host-result
type. A concretely-registered router so route data types flow instead of being
re-asserted at use sites.

```pseudo
tree desired (ownership of the "ask mode" union)
OPEN_ASK_MODES (const tuple)  [owner: session/live-ask-registry]
├── OpenAskMode = typeof OPEN_ASK_MODES[number]        # derived
├── zOpenAsk.mode      = z.enum(OPEN_ASK_MODES)        # derived
└── OpenAskSchema.mode = Type.Union(OPEN_ASK_MODES...) # derived (drift gone)

graph desired (session.openAsks result advertising)
sidecar    -> OpenAsksResultSchema  { openAsks: [...] }
standalone -> OpenAsksResultSchema  { openAsks: [...] }   # same shape
client     -> openAsksResultSchema satisfies ZodType<{ openAsks: OpenAsk[] }>  # pinned to owner
```

## Commits

Ordered by safety; each leaves the codebase working (`npm run verify`).

1. [done] Introduce an owned `OPEN_ASK_MODES` const tuple in the live-ask registry and
   derive `OpenAskMode` from it. No behavior or type change — the union is
   identical, now single-sourced.
2. [done] Derive the zod ask-mode enum from `OPEN_ASK_MODES` in the live-session
   contract, and pin the open-asks result schema to the owned `OpenAsk` via a
   `satisfies` binding so container-shape drift fails at compile time.
3. [done] Derive the TypeBox sidecar ask-mode union from `OPEN_ASK_MODES`. This fixes
   the drifted discovery schema (adds the missing `questionnaire` mode).
4. [done] Give the standalone hosted `session.openAsks` a precise result schema equal to
   the sidecar's, replacing the opaque any-result so both hosts advertise one
   shape.
5. Collapse the host-result type from the cosmetic two-member union into one
   honest result (single object over the full status union).
6. Register the concrete router type in place of `AnyRouter`, restoring route
   param/loader/context inference; remove the now-redundant open-asks cast and
   fix any newly surfaced type errors across the web routes.

## Decisions

- **Owner of the ask-mode enumeration:** the live-ask registry (it already owns
  `OpenAskMode` and `OpenAsk`). Wire schemas (zod, TypeBox) re-encode values at
  their trust boundaries but derive the member list from the one owned tuple —
  the boundary stays, the duplicated literal list goes.
- **Do not merge the zod and TypeBox `OpenAsk` shapes into one schema.** They are
  two distinct trust boundaries in two schema libraries (client inbound vs server
  inbound/discovery); per `expert-runtime-boundaries`, per-boundary re-encoding is
  correct. Only the shared *member enumeration* is single-sourced.
- **Host-result shape:** single object over the full status union. Reconsider a
  discriminated `{ ok }` result only if a consumer begins branching success vs
  failure — none does today.
- **Router typing:** register the concrete `createRouter` return type. Largest,
  last, and isolable — if it regresses TS-check performance it can be dropped
  without affecting commits 1–5.
- No topology files are moved, renamed, or retired; no `TOPOLOGY.md` updates.
  (`src/rpc/TOPOLOGY.md` already documents the unified `{ openAsks }` result.)

## Testing Decisions

- Coverage is already sufficient for safe refactoring; no characterization pass
  needed first:
  - ask-mode owner + registry: live-ask-registry tests
  - zod contract + client validation: standalone-host contract + session-route tests
  - TypeBox sidecar shape: session-open-asks test (asserts `{ openAsks }`)
  - standalone result shape: standalone-host contract + dev real-entry tests
  - host-result: live-session-host test
  - router/route data: session-route test
- Good tests here assert **behavior at the wire/render boundary** (discovered
  method shapes, rendered/answerable asks), not schema internals. Commit 3 should
  gain/adjust one assertion witnessing that `questionnaire` now appears in the
  sidecar discovery shape (the drift this fixes).

## Out of Scope

- Unifying zod and TypeBox `OpenAsk` into a single schema library.
- Re-encoding `SessionTarget` once across the zod and TypeBox boundaries (two
  legitimate boundaries; already value-consistent at `specId >= 1`).
- Any change to the runtime ask/answer behavior, the transcript projection, or
  the sidecar-vs-standalone deployment split.
- The broader 1093-file branch diff beyond the web-session RPC/contract surface.
