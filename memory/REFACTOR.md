## Problem Statement

The structured-exchange schema lock removed one legacy model and fixed the review-set payload name drift, but it did not make schema drift structurally hard. The implementation still has multiple semantic construction paths: some tools hand-build details inline, some route through projectors, `tool_meta` is defined both centrally and per-detail variant, the session pending-exchange shape still has a separate TypeBox schema, and a proof-era `structured_exchange.result` model remains terminal in session projection.

Current shape:

```pseudo
graph current
  schemas/shared
    -> header schemas
    -> tool_meta unions
  schemas/present
    -> duplicate present tool_meta objects
    -> mixed display bases
    -> review-set payload lock
    -> candidate payload lock
  schemas/request
    -> duplicate request tool_meta objects
    -> repeated outcome unions per request tool
  schemas/capture
    -> duplicate capture tool_meta objects
  active Pi tools
    -> TypeBox param schemas
    -> some inline details construction
    -> some projector-backed details construction
  projectors
    -> present_question
    -> present_review_set
    -> request_review
    -> mostly topology stubs for the rest
  session loop
    -> TypeBox pending-exchange schema
    -> canonical present details parser
  session projection
    -> canonical present/request tuple closure
    -> legacy structured_exchange.result terminal path
  editor fallback / old proof path
    -> legacy result details
```

The developer-facing problem is not that any one file is huge. The problem is that the codebase now says "Zod is canonical" while still letting feature code construct transcript details by hand. That is the exact condition that allowed the review-set drift.

## Solution

Make semantic schemas unrepresentable outside one canonical Zod layer. Zod should own both transcript `toolResult.details` and structured-exchange tool parameter schemas, exporting JSON Schema with `z.toJSONSchema(...)` where Pi needs a JSON-schema-shaped parameter contract. If Pi's `defineTool` TypeScript generic requires TypeBox's `TSchema`, quarantine that as one narrow adapter/cast at registration time rather than keeping TypeBox schemas in every tool file. Deepen `structured-exchange/project` from topology stubs into the sole place active tools call to produce Zod-validated details. Compose all details schemas from reusable schema atoms instead of duplicating `tool_meta` and outcome variants.

Desired shape:

```pseudo
graph desired
  schemas/shared
    -> schema/version literals
    -> header base
    -> display bases
    -> per-tool tool_meta atoms
    -> terminal outcome helpers
  schemas/present
    -> present variants composed from shared atoms
    -> review-set nodes/edges payload
    -> candidate rubric payload
  schemas/request
    -> request variants composed from shared atoms + outcome helper
  schemas/capture
    -> capture variants composed from shared atoms
  tool params
    -> Zod-authored params
    -> JSON Schema export for Pi registration
    -> optional single Pi schema adapter if TypeScript requires TSchema
  projectors
    -> one active-tool projector per present/request tool
    -> Zod parse at construction boundary
    -> durable detail objects returned to tools/session helpers
  active Pi tools
    -> Pi UI and params only
    -> call projectors + formatters
    -> no structured-exchange details literals
  session loop
    -> pending projection derived from canonical details
    -> no TypeBox semantic pending schema for structured-exchange details
  session projection
    -> canonical present/request/capture tuple handling
    -> no legacy structured_exchange.result terminal path
```

Alternatives considered:

- Keep TypeBox for Pi params and Zod for transcript details. Rejected as the target state: it preserves two schema authoring vocabularies inside the same structured-exchange seam and keeps inviting drift. TypeBox may survive only as a single Pi-typing adapter if direct Zod JSON Schema registration proves mechanically impossible.
- Add broad Zod-to-TypeBox codegen. Rejected unless forced by Pi runtime constraints. The simpler move is Zod source + `z.toJSONSchema(...)`; if TypeScript needs help, isolate one adapter rather than generating a parallel TypeBox schema tree.
- Keep the legacy `structured_exchange.result` model as a compatibility bridge. Rejected unless a build step proves a boundary cannot be updated atomically. The repo posture is free-rewrite, and the old model is internal/proof-era, not an external persisted migration contract.
- Put all details construction in `.pi` tools. Rejected because it keeps feature semantics in adapter shells and leaves session/RPC helpers with no canonical construction API.

## Commits

1. Add characterization/source-boundary tests that fail on hand-built structured-exchange details outside the canonical projector/schema layer and fail on new TypeBox schema authoring inside the structured-exchange seam.
2. Prove the Pi tool-parameter boundary with one active tool: author its params in Zod, pass `z.toJSONSchema(...)` into tool registration if Pi accepts it, or introduce one tiny Pi-schema adapter if the type boundary requires it.
3. Convert the remaining active structured-exchange tool parameter schemas from TypeBox to Zod-authored params, deleting the per-tool TypeBox imports.
4. Refactor the Zod schema layer to define shared header, display, tool-metadata, terminal-outcome, and parameter atoms once, then compose present/request/capture variants from those atoms.
5. Finish projector coverage for every active present/request tool so each tool has one canonical function that normalizes input, constructs details, and validates through the Zod schema before returning.
6. Move active tool implementations onto the projector/formatter path so Pi extension files own only UI collection and tool registration behavior, with params supplied from canonical Zod schema exports.
7. Replace the session pending-exchange TypeBox schema with a projection derived from canonical present/request details, keeping any public RPC response validation separate from transcript details validation.
8. Retire the proof-era `structured_exchange.result` model and editor-fallback result path, updating probe/session tests to use canonical present/request details or explicit legacy-free fixture helpers.
9. Tighten the source-boundary tests and schema README after the moves so future commits cannot reintroduce inline details construction, duplicate `tool_meta`, TypeBox semantic schemas, or scattered Pi-schema adapters.
10. Reconcile SPEC/PLAN coverage only after the refactor is actually complete, correcting any overclaimed "schema lock complete" language if residue remains.

## Decisions

- Modules modified: structured-exchange schema layer, structured-exchange projectors/formatters, Pi structured-exchange adapters, session exchange projection, pending-exchange recovery, legacy structured-exchange result helpers, and probe/session tests that still use the old result shape.
- Interface changes: active tools keep their external Pi parameter interface unless a parameter name itself duplicates details semantics; transcript `toolResult.details` stay on canonical `schema` / `v` / snake_case shapes.
- Architectural decision: Zod schemas plus projector functions become the structured-exchange semantic boundary for both tool params and tool result details; any Pi `TSchema` accommodation is a single adapter boundary, not per-tool TypeBox authoring.
- Schema decision: `tool_meta` atoms are single-source and reused by detail variants; request terminal outcomes are generated through one outcome composition pattern; `z.toJSONSchema(...)` is the JSON Schema export path.
- Topology READMEs touched: none expected unless implementation moves files between directories; if the refactor introduces a new long-lived tool-params module or retires a documented topology stub, update the owning README in the same commit.

## Testing Decisions

- Good tests here are behavior and boundary tests: emitted tool results parse through canonical schemas; generated tool parameter JSON Schemas register with Pi and preserve existing tool-call behavior; session projection closes only canonical tuples; pending recovery reconstructs current pending exchanges from canonical present details; source assertions catch new parallel schema/detail sources.
- Existing useful coverage: structured-exchange schema parse/export tests, structured-exchange present/request tool tests, session exchange projection tests, structured-exchange loop tests, public RPC parity proof tests, and ordering proof tests.
- First safety move is characterization because current tests allow direct details construction, scattered TypeBox schemas, and legacy result terminal handling to pass.
- The refactor should keep `npm run verify` green after every commit. File-scoped tests can run during inner-loop steps, but the gate remains the full verify script before committing each slice.

## Out of Scope

- Approval-to-`acceptReviewSet` product wiring.
- Real `project-graph` LLM proposal probes.
- Changing the designed payload fields for `present_candidates` or `present_review_set`.
- Implementing currently unwired `present_candidates` or `capture_*` runtime tools beyond keeping their canonical schemas coherent.
- Web UI polish or new public RPC methods.
- Generic schema-codegen infrastructure beyond direct Zod `z.toJSONSchema(...)` exports and, only if forced, one narrow Pi schema adapter.
