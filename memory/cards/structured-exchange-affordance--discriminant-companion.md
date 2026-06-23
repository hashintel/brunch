# Discriminant-companion contract: teach the companion at the boundary

Frontier: structured-exchange-affordance
Status:   active
Mode:     slices
Created:  2026-06-23

> Decision (user, 2026-06-23): branch scope widened to carry the whole
> **discriminant-companion contract** lens, not just the exchange surface. These
> are the `ln-induct` findings (4) + (5) plus the design-doc Gap 2 (piece 3),
> kept on one branch (no sub-branching). The unifying lens: *a tool param carries
> an enforced discriminant (`kind` / `mode`) whose legal companion shape is
> validated only downstream, never taught or derived at the point of choice — so
> the model authors blind and burns a turn on a `STRUCTURAL_ILLEGAL` retry (or, in
> the silent variant, gets an empty slice and never learns it called wrong).*
>
> **In-repo fix templates (this is naming a contract, not a rewrite):**
> `create_edge`'s role-named-per-`category` union (`tool-schemas.ts`) already
> teaches its companion structurally; `update_elicitation_gaps` already fails
> **loud** with per-field diagnostics. Both live next to the offenders.
>
> Slice order is dependency-first: Slice 1 establishes the single typed-detail
> owner (highest confidence, central write tool); Slice 2 reuses the
> name-it-at-the-boundary move on the review-set payload; Slice 3 closes the
> silent `read_graph` variant.

## Full-card cold-start reads

```
- memory/SPEC.md   — D54-L (per-kind detail contract), I37-L (detail validation), D27-L/I17-L (review-set payload), I35-L (read_graph shapes)
- memory/PLAN.md    — frontier: structured-exchange-affordance (Parallel / Low-conflict); pieces (3)/(4)/(5) + the ln-review graduation
- docs/design/STRUCTURED_EXCHANGE_COLLAPSE.md — §"Adjacent gaps" Gap 2 (review-set nested payload = piece 3)
- src/graph/README.md — graph schema ownership + observed-read-shape ledger
- src/graph/command-executor/README.md (if present) / command-validation.ts — the runtime detail validator (diagnostic owner)
```

---

## Slice 1 — typed/described per-kind `detail` at the `mutate_graph` boundary (piece 4 · HIGH) — done

### Target Behavior

The `mutate_graph` `create_node` `detail` param advertises its per-kind shape in
the tool JSON schema (`decision` → `{chosen_option, rejected[], rationale}`,
`term` → `{definition, aliases?}`, all other kinds → omit), instead of
`Type.Unknown()`, with the per-kind contract owned in one place that both the
boundary schema and the `CommandExecutor` validator reference.

### Full-card cold-start reads

```
- memory/SPEC.md   — D54-L, I37-L
- src/graph/schema/nodes.ts — NodeDetail (DecisionDetail | TermDetail), currently TYPE-ONLY
- src/graph/command-executor/command-validation.ts — validateDecisionDetail / validateTermDetail (runtime diagnostic owner)
- src/.pi/extensions/graph/tool-schemas.ts — MutateNodeSchema.detail = Type.Unknown() (the offender)
- src/rpc/methods/dev-graph.ts — detail: Type.Unknown() x2 (the mirror)
```

### Boundary Crossings

```
→ graph/schema/nodes.ts (NodeDetail: promote the type-only union to a single runtime-checkable owner, or co-locate a per-kind detail schema beside it)
→ graph/command-executor/command-validation.ts (validators consume the shared owner; diagnostic shape + STRUCTURAL_ILLEGAL behavior unchanged)
→ .pi/extensions/graph/tool-schemas.ts (MutateNodeSchema.detail: Type.Unknown() -> per-kind described/typed shape)
→ src/rpc/methods/dev-graph.ts (both detail: Type.Unknown() mirrors -> same shape)
```

### Risks and Assumptions

```
- RISK: converting the hand-rolled validator to a schema changes the Diagnostic[] shape the agent self-corrects against
    → MITIGATION: keep command-validation.ts as the runtime diagnostic owner; the boundary only needs to TEACH the shape (typed/`describe`d), referencing the same NodeDetail source. Do not replace the diagnostic-producing validator unless the schema reproduces identical field-level diagnostics.
- RISK: the tool-schema layer must stay drizzle-free and is TypeBox (`Type.*`), not Zod (tool-schemas.ts header)
    → MITIGATION: express the per-kind detail in the same schema library the surrounding MutateNodeSchema already uses; do not import the graph runtime validator into the adapter.
- ASSUMPTION: `decision`/`term` are the only detail-bearing kinds (KINDS_REQUIRING_DETAIL).
    → IMPACT IF FALSE: schema undercounts kinds. → VALIDATE: KINDS_REQUIRING_DETAIL is the single source; derive from it.
    → [→ memory/SPEC.md D54-L]
```

### Posture check

Earned closure: materializes a contract the codebase already half-owns
(`NodeDetail` type + the imperative validator) into one named boundary-advertised
owner, deleting three `Type.Unknown()` expressions of the same shape. Closure
target: no `mutate_graph`/`dev-graph` `detail` param is `Unknown`; the per-kind
shape has exactly one source consumed by validator + boundary.

### Acceptance Criteria

```
✓ tool-schema test — mutate_graph create_node detail JSON schema exposes decision/term per-kind shapes (not an opaque Unknown)
✓ command-executor.test.ts detail suite stays green — required/prohibited/unknown-field diagnostics byte-equivalent
✓ no Type.Unknown() remains for detail in tool-schemas.ts or dev-graph.ts
✓ single-owner check — decision/term detail shape is defined once and referenced by both the validator and the boundary schema(s)
```

### Verification Approach

```
- Inner: vitest targeted (command-executor detail tests, graph tool-schema/adapter tests) + oxlint on touched files
- Middle: existing propose-graph/dev-graph adapter tests stay green (boundary parse still accepts valid detail, rejects malformed)
```

### Cross-cutting obligations

```
- D52-L: the tool-schema adapter stays drizzle-free; taxonomy/detail ownership lives in graph/schema, adapters are consumers (D73-L direction)
- I37-L: per-kind required/prohibited/unknown-field validation behavior is preserved exactly
```

### Expected touched paths (tentative)

```
src/graph/schema/nodes.ts                              ~
src/graph/command-executor/command-validation.ts       ~
src/.pi/extensions/graph/tool-schemas.ts               ~
src/rpc/methods/dev-graph.ts                            ~
src/graph/__tests__/command-executor.test.ts           ? (only if diagnostic assertions move)
src/.pi/extensions/graph/__tests__/*                    ? (tool-schema shape assertion)
```

### Result

Done 2026-06-23. `src/graph/schema/nodes.ts` now owns the decision/term detail
JSON schemas and the detail-bearing kind list; `CommandExecutor` validation
consumes that owner while preserving its diagnostics; `mutate_graph` and
`dev.graph.mutateGraph` create-node schemas now require the decision/term detail
companions and reject `detail` for non-detail-bearing create-node kinds. The
shape assertions landed in `src/graph/__tests__/mutate-graph-edge-schema.test.ts`
rather than a `.pi/extensions/graph/__tests__` file because that existing test
already covers both the agent and dev-RPC graph mutation schemas.

---

## Slice 2 — describe the review-set nested payload at the boundary (piece 3) — done

### Objective

`present_review_set.payload` advertises its nested shape (`lens`,
`epistemicStatus`, `grounding {summary, support[]}`, `pitch {title, narrative}`,
`entityDrafts[]`, `edgeDrafts[]`) at the param boundary, so the model authors a
structurally valid review set instead of guessing nested fields and failing in
the deep validator. The deep shape stays owned by
`validateReviewSetPayloadShape` in `src/graph/review-set.ts` (single owner) — the
boundary only teaches it.

### Light-card cold-start reads

```
- memory/SPEC.md   — D27-L, I17-L (epistemic_status + grounding/support coverage)
- src/.pi/extensions/exchanges/schemas/params.ts — zPresentReviewSetParams.payload = z.looseObject({ schemaVersion: z.literal(1) }) (the boundary stopgap from 64fe9a41)
- src/graph/review-set.ts — validateReviewSetPayloadShape (the deep validator / single owner)
- docs/design/STRUCTURED_EXCHANGE_COLLAPSE.md §"Gap 2"
```

### Acceptance Criteria

```
✓ present_review_set payload schema describes/types the nested grounding/pitch/epistemicStatus/entityDrafts/edgeDrafts shape (no longer only schemaVersion: 1)
✓ the deep validator in graph/review-set.ts remains the single shape owner (boundary references/derives, does not fork a second nested model)
✓ existing present_review_set boundary regression tests (JSON-string reject, mutate_graph-shape reject, structural_illegal) stay green
✓ a missing/malformed nested field (e.g. grounding as string, missing epistemicStatus) is teachable from the schema and still fails loud
```

### Verification Approach

```
- Inner: vitest targeted (structured-exchange-present-request review-set cases, graph review-set validator tests)
```

### Assumption dependency

`Depends on: D27-L` — review-set payload shape is settled (validated already by `graph/review-set.ts`); this slice only surfaces it at the boundary.

### Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/schemas/params.ts         ~
src/graph/review-set.ts                                 ? (export the shape if the boundary derives from it)
src/.pi/__tests__/structured-exchange-present-request.test.ts  ? (assert described shape)
```

### Result

Done 2026-06-23. `src/graph/review-set.ts` now owns the
`present_review_set.payload` boundary-teaching schema beside the deep diagnostic
validator. `zPresentReviewSetParams` imports that owner, so the Pi tool parameter
schema advertises the nested `lens`, `epistemicStatus`, `grounding`, `pitch`,
`entityDrafts`, and role-named `edgeDrafts` shape while preserving the existing
STRUCTURAL_ILLEGAL dry-run path for missing required proposal fields. Regression
coverage landed in `src/.pi/__tests__/structured-exchange-schemas.test.ts` and
`src/.pi/__tests__/structured-exchange-present-request.test.ts`; topology/current
state was refreshed in the graph and structured-exchange schema READMEs plus
SPEC I17/I23/I26.

---

## Slice 3 — close the silent `read_graph` mode↔companion coupling (piece 5 · lower) — next

### Objective

`read_graph` no longer silently returns an empty slice when a `mode`'s required
companion fields are absent/malformed: either the param schema is a per-`mode`
discriminated union (companion required by construction) or the adapter emits a
loud diagnostic naming the missing companion — matching the
`update_elicitation_gaps` loud-diagnostic template rather than the current
flat-all-optional schema.

### Light-card cold-start reads

```
- memory/SPEC.md   — I35-L (read_graph multi-shape reads)
- src/.pi/extensions/graph/tool-schemas.ts — ReadGraphParams (flat: mode + all companions optional; "unknown ... produce an empty slice")
- src/.pi/extensions/graph/command-adapter.ts — read_graph dispatch (where the empty slice originates)
- src/.pi/extensions/elicitation/index.ts — UpdateElicitationGapsParams loud-diagnostic template
```

### Acceptance Criteria

```
✓ a neighborhood call without nodeCode (and related without anchorCodes) fails loud / is unrepresentable, not a silent empty slice
✓ valid per-mode calls (overview / neighborhood / list_by_kind / list_by_band / related) still succeed unchanged
✓ the chosen mechanism (per-mode union OR loud diagnostic) is named once; empty-for-empty-filter behavior for list modes is intentional and documented, not conflated with malformed-call
```

### Verification Approach

```
- Inner: vitest targeted (read_graph adapter/shape tests); add a malformed-mode regression
```

### Assumption dependency

`None` — read_graph read shapes are observed/ledgered (`src/graph/README.md`, `observed-shapes-coverage.test.ts`); this hardens the param boundary only.

### Expected touched paths (tentative)

```
src/.pi/extensions/graph/tool-schemas.ts               ~
src/.pi/extensions/graph/command-adapter.ts            ~
src/.pi/extensions/graph/__tests__/*                   ~ (malformed-mode regression)
```

---

## Reconciliation step (not a build slice) — graduate the lens

After Slice 1 lands (the second recurrence of "opaque companion to an enforced
discriminant" — review-set `64fe9a41` was the first), propose adding the lens to
`ln-review` §Contract integrity (manual edit, user-gated per `ln-induct` step 6):

> **opaque companion to an enforced discriminant** — cue: a param typed
> `Unknown` / `z.unknown` / `z.record(_, z.unknown)` next to an enforced
> `kind`/`type`/`mode` enum whose real per-discriminant shape lives only in a
> downstream validator. Repair: name it at the boundary (typed/`describe`d), or
> give it one owner the boundary and validator share.

Cross-link `fixture-vs-real-audit` (PLAN) — it names the same `z.unknown()` /
`Type.Unknown()` sites from the untested-against-real angle.
