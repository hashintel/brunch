# Tool-schema convergence — closure ledger

Frontier: tool-schema-convergence
Status:   active
Mode:     sweep
Created:  2026-07-10

Posture: earned (inherited from `tool-schema-convergence`)
Classification: buildable-now

## Orientation

- The load-bearing layer is every Brunch-authored tool schema that can reach a provider through a foreground, dev, executor, or sealed child session.
- FE-1163 has implemented the shared adapter across the layer, but the 2026-07-10 `ln-review` → `ln-witness` audit found that the closure evidence does not yet match the 51-tool inventory or the original schema-preservation promises.
- There is no `HANDOFF.md`; `.pi/prompts/scope-build-loop.md` is unrelated protected untracked work and must remain untouched.
- Main risk: tests can stay green while an omitted registrar/child tool bypasses the adapter or a generated schema changes meaning relative to its pre-sweep form.

## Boundary

**In:** 51 Brunch-authored provider-facing tool surfaces under `src/.pi/extensions/**`:

- exchanges 4
- dev query 2
- graph 2
- context 3
- elicitation scratchpad 2
- reconciliation 2
- executor 32
- web 2
- subagents 2 (`subagent`, sealed-child `write_worktree_file`)

**Out:** Pi-owned built-in schemas (`read`, `grep`, `find`, `ls`) and non-provider-facing RPC, web-query, and graph-command schemas.

Source-of-truth inventory inputs are the actual production registrars collected by `collectProductTools(...)` plus the sealed child catalog from `createSubagentToolCatalog(...)`; foreground allowlists alone are not inventory authority.

## Aggregate DoD

Every required (`●`) row is `have` or `built`, and all of the following hold:

- both legacy adapters remain deleted;
- every one of the 51 in-boundary tool surfaces has shared-adapter provenance and passes the named provider constraints;
- meaningful provider-facing schema structure is unchanged from the pre-sweep form for every family whose authoring representation changed;
- `toolParameters(...)` rejects top-level unions and non-object roots while preserving legal nested unions;
- `npm run verify` passes;
- `memory/PLAN.md`, SPEC D118-L/I60-L, and `src/.pi/extensions/TOPOLOGY.md` describe the evidence actually established; then this ledger is deleted.

## Rows

Status vocabulary: `have` (closed before this closeout) · `partial` (implementation exists, closure oracle incomplete) · `built` (closed in this push).

| # | Capability | Status | Req | Fill | Owner / next | Source inputs and closure oracle |
|---|---|---|---|---|---|---|
| 1 | `shared-adapter` — one Zod/TypeBox adapter, legacy adapters retired, named provider constraints enforced | built | ● | earned | `src/.pi/extensions/shared/tool-schema.ts`; `src/.pi/extensions/__tests__/tool-schema.test.ts` | Existing union/provenance tests plus counterexamples proving `z.string()` and `Type.String()` roots fail loudly; legal Zod/TypeBox objects and nested unions stay green. |
| 2 | `exchanges-family` — 4 schemas | built | ● | earned | exchange schema/extension tests | Recover the pre-sweep emitted schemas and compare a normalized semantic projection against current output; do not recompute expected output through the current adapter. |
| 3 | `dev-mode-family` — 2 schemas | built | ● | earned | dev query tests | Same semantic pre/post differential; existing draft-2020-12 tuple checks remain green. |
| 4 | `graph-family` — 2 schemas | built | ● | earned | graph schema tests | Differential covers root/object shape, required fields, properties, enum/union structure, descriptions, and `additionalProperties` where present; graph/DB TypeBox ownership remains canonical. |
| 5 | `context-family` — 3 schemas | partial | ● | earned | context tool tests | Same semantic pre/post differential for the literal→TypeBox rewrite. |
| 6 | `scratchpad-family` — 2 schemas | partial | ● | earned | scratchpad tool tests | Same semantic pre/post differential for the literal→TypeBox rewrite. |
| 7 | `reconciliation-family` — 2 schemas | partial | ● | earned | reconciliation tool tests | Same semantic pre/post differential, preserving the legal nested target union. |
| 8 | `executor-family` — 32 schemas | partial | ● | earned | registry closure test | Pure TypeBox relinks retain their emitted shape; the aggregate oracle must include both artifact tools omitted by the current 48-tool allowlist projection. |
| 9 | `web-tools-family` — 2 schemas | partial | ● | earned | web-tool tests | Same semantic pre/post differential for the literal→TypeBox rewrite. |
| 10 | `subagents-family` — 2 schemas | partial | ● | earned | subagent catalog + registry closure test | Aggregate provenance/legality oracle includes sealed-child `write_worktree_file`, not only foreground `subagent`. |
| 11 | `registry-legality-oracle` — exact closed inventory across foreground, executor, dev, and sealed-child surfaces | partial | ● | earned | `src/.pi/extensions/__tests__/registry.test.ts` plus subagent catalog coverage | Derive from production registrars/catalogs; assert the exact 51-member boundary after excluding Pi-owned built-ins; every member has adapter provenance and passes legality. Adding/removing a tool must force an inventory decision. |
| 12 | `pi-readonly-reregistrations` — upstream-owned schemas | have | ○ | earned | Pi upgrade tripwire | Deferred by boundary; keep excluded explicitly. |
| 13 | `exchanges-blank-carriers` | have | ● | earned | present/request schema tests | Existing counterexamples reject blank/whitespace candidate rubric, option, and answered-echo carriers. |

## Semantic differential rule

The preservation oracle compares **meaningful JSON Schema structure**, not serialization noise. It must include at least root type, property names, required sets, nested alternatives, enum/const values, descriptions, defaults, and `additionalProperties` where present. `$schema` metadata and key ordering may be normalized when they do not alter provider/model meaning.

Baseline expectations must be recovered from the pre-conversion branch state and persisted in a reviewable form. A test that computes both actual and expected values with the current `toolParameters(...)` implementation does not satisfy this row.

## Accepted blind spot

No static adapter can prove compatibility with every present or future provider dialect. Revisit the provider-constraint set when an allowlisted provider/model changes, a live provider rejects a schema, or Brunch deliberately adopts another provider-specific JSON Schema feature. D118-L/I60-L should name the constraints Brunch enforces rather than imply universal dialect compatibility.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                   ~
├── SPEC.md                                                   ?
└── cards/tool-schema-convergence--ledger.md                  - at verified exhaustion
src/.pi/extensions/
├── TOPOLOGY.md                                               ?
├── shared/tool-schema.ts                                     ~
├── __tests__/
│   ├── tool-schema.test.ts                                   ~
│   └── registry.test.ts                                      ~
├── __tests__/subagents.test.ts                               ?
├── __tests__/dev-mode-{session,introspect}-query.test.ts     ?
├── __tests__/exchanges-extension.test.ts                     ?
└── <family tests or normalized schema-baseline fixture>      ?
src/exchanges/schemas/__tests__/{present,request}.test.ts      unchanged unless the row-13 oracle needs repair
```

## Stop conditions

- Stop and route to `ln-oracles` if meaningful schema equivalence cannot be separated from serialization noise without inventing a broad new snapshot framework.
- Stop and route to `ln-plan` if the production-derived inventory is not the closed 51-member layer described above or more than one genuinely new capability row appears.
- Do not widen into general provider-dialect conformance or live-provider walkthrough work; the accepted blind spot names that trigger.
