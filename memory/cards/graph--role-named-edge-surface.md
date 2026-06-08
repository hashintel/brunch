# Role-named edge surface for agent-authored graph mutations

Frontier: n/a (touches locked D51-L / D53-L / D27-L; see Traceability + Routing)
Status:   active
Mode:     chain
Created:  2026-06-08

## Orientation

- **Seam:** the *agent-authored edge boundary* — the two places an LLM emits an
  edge before `CommandExecutor`: the `commit_graph` Pi tool schema
  (`src/.pi/extensions/graph/tool-schemas.ts` → `command-adapter.ts`,
  D53-L) and the `project-graph` review-set proposal payload
  (`src/graph/review-set.ts`, D27-L). Both currently expose generic
  `{ category, source, target, stance?, rationale? }`.
- **Problem (this thread):** `source → target` *sounds* directional but is
  meaningless/misleading at the agent boundary. Direction is real only as
  endpoint **role** (oracle/claim, dependency/dependent, abstract/concrete, …)
  already encoded in `EDGE_CATEGORY_METADATA` (`src/graph/policy/category-policy.ts`).
  The agent must today silently remember "proof source = oracle, target =
  claim" etc. — a directionally-wrong-yet-structurally-valid error the
  executor cannot reject.
- **Decision carried in from discussion:** flip only the *agent boundary* to an
  8-variant role-named discriminated union (category/role granularity, **not**
  tuple-specific `requirement_realized_by_module` sprawl). Normalize to the
  existing `BatchEdgeInput { category, source, target }` deterministically via
  `EDGE_CATEGORY_METADATA`. **Do not** re-orient persistence to
  upstream/downstream — storage stays assertion-oriented `source/target`
  (see Non-goals).
- **Posture:** proving (no inherited frontier; settled design, low residual
  unknown — the normalizer is a few lines over an existing table). The
  load-bearing risk is drift between the union's role field names and the
  metadata table, retired by an explicit drift test (Card 1).
- **Open risk:** the change edits locked agent-edge-draft wording in D53-L /
  D27-L and `docs/design/GRAPH_MODEL.md`; that is durable reconciliation, not
  just code (handled per card + Routing).

## Cross-cutting obligations (whole chain)

- Preserve the D4-L/D20-L command boundary: agents never touch `db/`; all edge
  writes still route through `CommandExecutor.commitGraph`.
- Preserve D51-L storage contract: stored edge identity stays
  `(category, sourceId, targetId, stance)`, immutable; **no** persistence /
  schema / migration change.
- Preserve D16-L/A4-L one `{specId, lsn}` clock and I34-L all-or-nothing batch
  semantics — the union is a pre-executor translation only.
- Keep the closed category set (D51-L) the single source of relation kinds; the
  union must not become a relation catalogue.
- `EDGE_CATEGORY_METADATA` stays the **one** source of endpoint-role truth
  (its header comment already records it superseded a prior drifted split — do
  not reintroduce a parallel role map).

## Non-goals (explicit)

- **No upstream/downstream re-orientation of storage.** Rejected in discussion:
  impact direction is *undefined* for `association` (1 of 8), `direction.ts`
  already derives upstream/downstream from the metadata for the only two
  readers (`labels.ts`, `direction.ts`), and assertion orientation is what
  `change_log`, supersession acyclicity, and `labels.ts` want. Storage column
  names and `BatchEdgeInput` stay `source/target`.
- **No read DTO with `upstream/downstream`.** Deferred and likely unnecessary —
  `src/graph/projection/direction.ts` already *is* that projection. Do not add
  one in this chain.
- **No tuple-specific variants** (`criterion_proves_requirement`, …). Tuple
  phrasing stays in `edgeLabel()` (`labels.ts`). Union stays at category/role.
- **No new `link*` single-edge tools.** GRAPH_MODEL.md's `linkProof`/
  `linkDependency`/… surface stays M5/out of scope; this chain only fixes the
  two edge boundaries that ship today (`commit_graph` batch + review-set).

---

## Card 1 — `commit_graph` role-named edge union + driftless normalizer

Status: next

### Target Behavior

The `commit_graph` Pi tool accepts edges as an 8-variant role-named
discriminated union and deterministically normalizes each variant to
`BatchEdgeInput { category, source, target }` via `EDGE_CATEGORY_METADATA`,
with no change to stored edge shape.

### Boundary Crossings

```
→ LLM tool call (commit_graph params)
→ CommitEdgeSchema (TypeBox discriminated union, role-named)   [tool-schemas.ts]
→ translateCommitGraph → normalizeEdgeDraft(category, roleFields) [command-adapter.ts]
→ EDGE_CATEGORY_METADATA[category].{sourceRole,targetRole}     [category-policy.ts]
→ BatchEdgeInput { category, source, target, stance?, rationale? } (unchanged)
→ CommandExecutor.commitGraph (unchanged)
```

### The union (category/role level)

```
dependency  { dependency, dependent }
proof       { oracle, claim, stance }
support     { support, claim, stance }
realization { abstract, concrete }
boundary    { boundary, subject }
composition { whole, part }
supersession{ successor, predecessor }
association { a, b }            // peer/peer; arbitrary storage orientation
```

Normalization rule (single, table-driven): for category `C`, the field named
`EDGE_CATEGORY_METADATA[C].sourceRole` → `source`, the field named
`.targetRole` → `target`. (`association` peer/peer: map `a`→source, `b`→target.)
Each variant still carries optional `rationale`; `stance` only on
`proof`/`support`.

### Risks and Assumptions

```
- RISK: union role field names drift from EDGE_CATEGORY_METADATA roles
    → MITIGATION: drift test (acceptance ✓ below) pins every variant's two
      role field names to that category's sourceRole/targetRole; normalizer
      reads the table, never a hand-copied map.
- RISK: TypeBox discriminated-union JSON Schema is awkward for the LLM /
  Pi `defineTool` typing (D41-L: schemas must stay JSON-representable)
    → MITIGATION: use a tagged union keyed on `category` (StringEnum literal
      per variant) — plain JSON Schema oneOf; add an export/parse test that the
      params schema still satisfies the Pi `TSchema` adapter and round-trips.
- ASSUMPTION: EDGE_CATEGORY_METADATA endpoint roles are the correct agent-facing
  role vocabulary (oracle/claim, abstract/concrete, whole/part, …).
    → IMPACT IF FALSE: rename in one table + union; localized.
    → VALIDATE: matches docs/design/GRAPH_MODEL.md §Per-category policy table.
- ASSUMPTION: dev RPC (`rpc/methods/dev-graph.ts`) builds CommitGraphInput
  directly (not via the tool schema), so it is unaffected.
    → IMPACT IF FALSE: add it to touched paths at build.
    → VALIDATE: grep confirms it constructs BatchEdgeInput directly; leave as-is.
```

### Posture check (proving)

Scores on **invariants** (locks the agent-edge-draft seam to the metadata
table via a drift oracle) and **uncertainty** (retires the "agent orients
source/target wrong" failure mode named in this thread). It lights up the new
role-named path end-to-end through a real tool call. Build it.

### Acceptance Criteria

```
✓ tool-schema-edge-union — commit_graph CommitEdgeSchema is an 8-variant
   category-tagged union; submitting `{category:"proof", oracle, claim, stance}`
   normalizes to source=oracle, target=claim in the resulting BatchEdgeInput.
✓ normalizer-all-categories — for every EdgeCategory, a role-named draft
   normalizes to source/target matching EDGE_CATEGORY_METADATA sourceRole/
   targetRole (table-driven over all 8).
✓ role-name-drift-guard — a test asserts each union variant's two endpoint
   field names equal that category's {sourceRole,targetRole} (peer/peer ↔ a/b
   mapping asserted explicitly); fails if a variant or the table drifts.
✓ stance-locality — stance accepted only on proof/support variants; rejected
   (structural_illegal or schema reject) elsewhere.
✓ schema-export-roundtrip — CommitGraphParams still passes the Pi `TSchema`
   adapter / JSON-Schema export used for the tool (D41-L).
✓ commit-graph-batch-unchanged — existing commit-graph-batch executor tests
   still pass with no edits (storage path untouched).
```

### Verification Approach

```
- Inner: vitest unit — normalizer + drift table + schema parse/export.
- Middle: src/.pi/__tests__/graph-tools.test.ts — real tool registration emits
   role-named edges and persists correct source/target via CommandExecutor.
- Outer: optional — re-run a propose-graph-commit probe to confirm an LLM emits
   the role-named union (not required to land; existing A14-L probes cover the
   commit path).
```

### Cross-cutting obligations

See chain-level section. Specifically: metadata stays the single role source;
no storage/schema change; I34-L all-or-nothing preserved.

### Expected touched paths (tentative)

```
src/graph/policy/
├── category-policy.ts        ~   # + normalizeEdgeDraft / endpointForRole helper
└── category-policy.test.ts   ~   # + drift guard + all-category normalize
src/graph/index.ts            ~   # export normalizer + role types/field names
src/.pi/extensions/graph/
├── tool-schemas.ts           ~   # CommitEdgeSchema → category-tagged union
├── command-adapter.ts        ~   # translateCommitGraph uses normalizer
└── __tests__/
    └── graph-tools.test.ts   ~   # (under src/.pi/__tests__) role-named edges
src/rpc/methods/dev-graph.ts  ?   # confirm builds BatchEdgeInput directly; likely untouched
docs/design/GRAPH_MODEL.md    ~   # commitGraph example edges → role-named; reconcile §Agent-facing surface
memory/SPEC.md                ~   # D53-L wording: agent edge drafts are role-named; + invariant (see Traceability)
```

---

## Card 2 — review-set proposal edge drafts adopt the same union

Status: next (after Card 1; reuses Card 1's normalizer)

### Target Behavior

The `project-graph` review-set proposal payload carries edge drafts as the same
role-named union, and `translateReviewSetPayloadToCommitGraph` normalizes them
to `BatchEdgeInput` through Card 1's shared normalizer.

### Boundary Crossings

```
→ review-set proposal payload (LLM-authored, D27-L)
→ ReviewSetEdgeDraft union (role-named, mirrors Card 1)        [review-set.ts]
→ resolve endpoints (draftId | existingCode) per role field
→ normalizeEdgeDraft (shared, Card 1)                          [category-policy.ts]
→ BatchEdgeInput → dryRun/accept via CommandExecutor (unchanged, D27-L/I20-L)
```

### Risks and Assumptions

```
- RISK: a separate TypeBox/Zod review-set payload schema exists in
  src/.pi/extensions/exchanges/schemas/ (present_review_set / request_review)
  and must change in lockstep with the runtime shape in review-set.ts.
    → MITIGATION: at build, grep exchanges/schemas/{present,request,shared}.ts
      for the edge-draft shape; update both or confirm review-set.ts is the only
      validator. Dry-run parity (I20-L) test must still hold.
- ASSUMPTION: review-set endpoint refs ({draftId} | {existingCode}) are
  orthogonal to the role rename — only the *field names* change, not ref shape.
    → IMPACT IF FALSE: localized to resolveReviewSetEndpoint.
    → VALIDATE: ReviewSetEndpointRef stays a draftId/existingCode union.
```

### Posture check (proving)

Closure-flavored but proving: it **canonicalizes** the agent edge vocabulary
across *both* edge boundaries so the role-named union is the one way an agent
ever expresses an edge. Lands the same seam on the D27-L path; drift guard from
Card 1 extends to cover it. Build it.

### Acceptance Criteria

```
✓ review-set-edge-union — a review-set payload with role-named edge drafts
   (e.g. {category:"realization", abstract, concrete}) translates to
   BatchEdgeInput with source=abstract, target=concrete.
✓ review-set-dryrun-parity — dryRunAcceptReviewSet still rejects structurally
   illegal role-named drafts and surfaces non-reviewable diagnostics (I20-L).
✓ schema-lockstep — if an exchanges/schemas payload schema exists, it accepts
   the role-named union and rejects generic source/target; otherwise a test
   asserts review-set.ts is the sole edge-draft validator.
✓ no-generic-source-target — generic {category, source, target} edge drafts are
   rejected at both boundaries (grep/lint or schema-reject test).
```

### Verification Approach

```
- Inner: vitest — review-set translation over role-named drafts; reuse Card 1 normalizer.
- Middle: src/graph/review-set.test.ts — dry-run/accept parity, projected-code
   resolution, invalid-proposal rejection (existing suite, updated inputs).
- Outer: optional — project-graph-review-cycle probe regen if its fixture
   encodes edge drafts (check .fixtures/runs/project-graph-review-cycle/).
```

### Cross-cutting obligations

See chain-level section. Plus: preserve I20-L (only dry-run-valid proposals
surface as reviewable) and I18-L lens metadata on the payload.

### Expected touched paths (tentative)

```
src/graph/
├── review-set.ts        ~   # ReviewSetEdgeDraft → role-named union; translate via shared normalizer
└── review-set.test.ts   ~
src/.pi/extensions/exchanges/schemas/
├── present.ts           ?   # present_review_set payload edge-draft shape (confirm at build)
├── request.ts           ?   # request_review payload (confirm at build)
└── shared.ts            ?
docs/design/GRAPH_MODEL.md ~ # review-set edge-draft shape → role-named
memory/SPEC.md             ~ # D27-L wording: edge drafts role-named
```

---

## Traceability (durable reconciliation — do before/at build)

This chain edits locked decisions; reconcile canonical docs as part of landing,
not as an afterthought:

- **D53-L** — restate the `commit_graph` `edges` shape as the role-named union
  (was `{category, source, target}`); note deterministic normalization to
  stored `source/target` via `EDGE_CATEGORY_METADATA`.
- **D27-L** — restate review-set edge drafts as the role-named union (was
  `{category, source, target, stance?, rationale?}` over draftId / existingCode).
- **D51-L** — unchanged storage contract; add a sentence clarifying that
  endpoint *roles* are the agent vocabulary while `sourceId/targetId` remain the
  immutable stored geometry.
- **New invariant (propose)** — "Agents express edges only by category +
  endpoint roles; `source/target` is internal storage geometry derived
  deterministically from `EDGE_CATEGORY_METADATA`. Union role field names are
  test-pinned to that table." Tie to D51-L/D53-L/D27-L, A14-L.
- **A14-L** — the structural-legality assumption now includes role-named edge
  drafts; existing probes still cover the commit path.
- `docs/design/GRAPH_MODEL.md` §"Agent-facing command surface" + the
  `commitGraph` example — update both edge examples to role-named.

Because this is durable change to locked decisions, the strictly-correct path is
a short `ln-spec` pass (D53-L/D27-L rewording + the new invariant) and, if it
should be its own Linear issue/branch, an `ln-plan` frontier promotion per
project AGENTS.md workflow. The cards above are buildable as soon as that
reconciliation is agreed; the SPEC/doc edits are listed in each card's touched
paths so they can also be folded into the build commit if you prefer to keep it
as one move.
