# Temporary Review Notes — Remaining `src/server/` Structuring Findings

Captured from the `src/server/` structure review after the `db.ts` extraction was completed. This is a temporary working note, not canonical architecture truth; reconcile durable decisions back into `memory/SPEC.md` / `memory/PLAN.md` if selected for implementation.

## Already addressed in this thread

- `db.ts` now acts as a public persistence facade over private `src/server/db/*-store.ts` modules:
  - `annotation-store.ts`
  - `edit-impact-store.ts`
  - `entity-projection-store.ts`
  - `intent-graph-store.ts`
  - `reconciliation-store.ts`
  - `review-materialization-store.ts`
  - `specification-store.ts`
  - `workflow-store.ts`

## Remaining findings

1. **`app.ts` is both route registry and workflow orchestrator** — category: depth / seam — impact: high
   - **Files:** `src/server/app.ts`, `*-route.ts`, `chat-route-transition.ts`, `turn-response-transition.ts`, `phase-intent-runtime.ts`
   - **Problem:** `app.ts` still wires Express routes, parses params, maps errors, manages observer capture concurrency, validates AI SDK messages, runs chat transitions, streams interviewer output, persists artifacts, and registers unrelated route families. Some route families have their own `*-route.ts` handlers while specification/chat routes remain inline.
   - **Possible direction:** Keep `createApp` as the public composition root, but move route families and shared request/error helpers behind `src/server/app/*` private modules. The chat streaming route likely deserves its own route module because it is already a substantial imperative shell.
   - **Benefit:** Clearer HTTP ownership, smaller composition root, easier addition of provider/setup/gitignore routes, and less risk that route-local concerns become global `app.ts` state.

2. **The capability adapter is not yet a clean adapter over product operations** — category: seam / coupling — impact: medium-high
   - **Files:** `src/server/capabilities.ts`, `agent-jsonl.ts`, `capability-registry.ts`, `chat-route-transition.ts`, `turn-response-transition.ts`, `core.ts`, `schema.ts`
   - **Problem:** SPEC/PLAN describe the agent capability CLI as an adapter over Brunch-owned capability contracts, but `capabilities.ts` still imports workflow transitions, core functions, DB helpers, and schema directly. That makes the agent path a parallel orchestration surface rather than a thin transport adapter.
   - **Possible direction:** Split `capabilities.ts` into a public root plus `capabilities/*` private handlers. Route selected capability implementations through named application operations that are also usable by HTTP routes, with JSONL remaining protocol glue.
   - **Benefit:** Prevents agent paths from bypassing server-owned mutation semantics and makes future MCP / external harness adapters safer.

3. **Provider/model construction is scattered across server shells** — category: seam / model — impact: medium
   - **Files:** `src/server/side-chat-route.ts`, `src/server/reconciliation-agent.ts`, likely interviewer / observer construction paths.
   - **Problem:** Direct `@ai-sdk/anthropic` imports and env reads remain in route/agent modules. SPEC names an **AI runtime provider** seam and says interviewer/observer model creation should not encode direct provider imports or environment-variable reads as product truth.
   - **Possible direction:** When `first-run-provider-setup` starts, make provider/model resolution a real server subsystem rather than patching each caller independently.
   - **Benefit:** One credential/model precedence story, less duplicated provider knowledge, and a cleaner path to OpenRouter/provider-neutral routing.

4. **Lexicon drift still makes server ownership harder to read** — category: naming — impact: medium
   - **Canonical terms:** `specification`, `intent graph`, `intent item`, `intent edge`, `changeset/change`.
   - **Remaining deviations:**
     - Many tests and some helpers still use `project` variables for specification rows, e.g. `const project = createSpecification(...)`, `project.id`.
     - `createLegacyKickoffTurnForTesting(db, projectId)` takes a specification id and should prefer `specificationId` if retained.
     - API/path/function names still expose `knowledge-items` / `knowledge-edges`; persistence compatibility is acknowledged, but new server structure should prefer intent terminology at module boundaries.
     - CLI/help/test vocabulary still contains historical `patch` wording; SPEC says `changeset/change` supersedes patch vocabulary.
   - **Possible direction:** Run a targeted naming refactor once active semantic-schema work decides how aggressively to rename public API paths vs internal implementation.

5. **Legacy test scaffolding preserves old workflow rows** — category: model / naming — impact: medium
   - **Files:** `src/server/test-support/legacy-control-rows.ts`, usages in `app.test.ts`, `core.test.ts`
   - **Problem:** The product is pre-release and SPEC says projection-only control cards are current truth, but tests still keep `createLegacyKickoffTurnForTesting` to fabricate older durable kickoff rows. It may be useful as regression coverage, but currently reads like supported compatibility.
   - **Possible direction:** Either delete the legacy-path tests if no longer product-relevant, or quarantine them under an explicit legacy regression area with a narrow purpose.

6. **Test files still mirror some of the flat spread** — category: testability / coupling — impact: medium
   - **Files:** especially `src/server/app.test.ts`, `src/server/db.test.ts`, plus many top-level `*.test.ts`.
   - **Problem:** The persistence implementation is now split, but the largest tests still exercise many seams through broad files. This makes it harder to tell which subsystem owns an invariant.
   - **Possible direction:** As further modules are deepened, move or split tests around the public seams: route-family tests near route-family modules, store tests by semantic store, capability adapter tests around the adapter seam.

## Suggested next refactor candidates

1. `app.ts` private route modules — highest remaining structural payoff.
2. `capabilities.ts` public root + private handlers — important for FE-705 / future adapter safety.
3. Provider/model resolver seam — best handled under `first-run-provider-setup` rather than as a pure structure cleanup.
