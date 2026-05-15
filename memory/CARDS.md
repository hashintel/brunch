# Cards — intent-graph-semantics

Temporary execution queue for the `intent-graph-semantics` frontier on `ln/fe-700-intent-graph-semantics`. Delete or replace when exhausted/superseded.

## Orientation

- **Containing seam:** intent graph semantics, especially `src/server/knowledge-relationship-policy.ts`, graph relationship projection, cascade/reconciliation impact, and future context snapshot builders.
- **Frontier item:** `intent-graph-semantics` / FE-700.
- **Current branch:** `ln/fe-700-intent-graph-semantics`.
- **Main risk:** raw `knowledge_edge.from_item_id` / `to_item_id` direction currently does too much semantic work; relation policy must own validation, endpoint-relative labels, snapshot buckets, and change impact before broader ontology expansion.

## Recommended agent mode

Use **surveyor/scaffolder first, then backfiller threads**, not concurrent worktrees.

- Do **not** ask multiple builders to write code in the same checkout at the same time.
- A surveyor/scaffolder should take Card 1 and establish the exported relation-policy API.
- After Card 1 lands, separate follow-up threads can each receive a complete brief for Card 2 or Card 3, but they should run serially against the current branch state unless you explicitly create isolation another way.
- If you want apparent parallelism without worktrees, make one thread read-only: have it review/scout fixtures, API shape, or tests while the active builder owns writes.
- Avoid Card 4+ until Cards 1–3 reveal whether edge metadata or schema changes are needed.

---

## Card 1 — Relation-policy registry scaffold

**Status:** done
**Weight:** full scope card

### Target Behavior

Existing intent-edge validation is preserved while a richer relation-policy registry exposes endpoint-relative labels, snapshot buckets, and source/target change-impact behavior for every current edge relation.

### Boundary Crossings

```text
→ shared persisted edge relation vocabulary (`EdgeRelation`)
→ server relation-policy module
→ observer / route validation callers
→ cascade/context-facing tests
```

### Risks and Assumptions

- RISK: Renaming the policy seam breaks observer and graph-edit validation unexpectedly → MITIGATION: preserve `supportsKnowledgeRelationship()` as a compatibility export over the richer policy until callers are migrated.
- RISK: Endpoint-relative labels accidentally imply a universal upstream/downstream direction → MITIGATION: test mixed-direction relations (`constrains`, `depends_on`/`assumes` semantics, `verifies`) from both endpoints.
- ASSUMPTION: Current relation enum is sufficient for the first policy scaffold → VALIDATE: relation-policy tests cover all existing `EdgeRelation` values; new relation kinds wait for later ontology expansion.

### Acceptance Criteria

- ✓ `knowledge-relationship-policy.test.ts` — every current relation has a policy row with validation source/target kinds, source/target labels, snapshot bucket behavior, and source/target change behavior.
- ✓ `knowledge-relationship-policy.test.ts` — `supportsKnowledgeRelationship()` preserves current allow/deny behavior for representative existing cases.
- ✓ `knowledge-relationship-policy.test.ts` — endpoint rendering distinguishes source and target perspective without string-reversing raw relation names.
- ✓ `knowledge-relationship-policy.test.ts` — change-impact lookup returns an explicit policy result for both endpoint-change directions.

### Verification Approach

- Inner: focused unit tests — prove the registry is exhaustive, current validation behavior is preserved, and endpoint-relative semantics are explicit.
- Middle: existing observer/graph route tests — prove current callers still work through the compatibility export.
- Outer: not required for this slice.

---

## Card 2 — Read-only intent neighborhood snapshot projection

**Status:** next
**Weight:** full scope card

### Target Behavior

A read-only context-snapshot builder can summarize selected intent items and their relation-policy-bucketed neighborhoods without mutating chat, turn, or graph state.

### Boundary Crossings

```text
→ DB graph read model (`knowledge_item`, `knowledge_edge`, `reconciliation_need` where useful)
→ relation-policy registry from Card 1
→ context-pack / snapshot builder module
→ structured JSON assertions and selected golden rendering
```

### Risks and Assumptions

- RISK: Snapshot builders overfit exact prose too early → MITIGATION: assert structured JSON shape/ids/buckets first, keep only selected golden renderings.
- RISK: Builder accidentally creates chat-context authority → MITIGATION: keep this slice read-only; no chat handles, no turn persistence, no hidden context table.
- ASSUMPTION: Immediate, dependencies, dependents, evidence, and reconciliation modes can be represented over current graph rows plus relation policy → VALIDATE: fixture tests for at least immediate/dependencies/dependents; evidence/reconciliation may be sparse when current relation vocabulary lacks examples/invariants.

### Acceptance Criteria

- ✓ `context-snapshot.test.ts` — item snapshots include requested item ids, kind/reference metadata, content/rationale, and relation-policy-rendered edge groups.
- ✓ `context-snapshot.test.ts` — neighborhood modes produce distinct dependency/dependent groupings from the same mixed-direction graph fixture.
- ✓ `context-snapshot.test.ts` — economic whole-graph snapshot returns compact grouped graph data without creating item handles or requiring chat state.
- ✓ selected golden fixture — rendered snapshot remains reviewable while structured assertions carry the correctness burden.

### Verification Approach

- Inner: focused unit/integration tests over seeded in-memory DB graph fixtures.
- Middle: structured snapshot assertions + selected golden rendering.
- Outer: later manual review when chat runtime consumes artifacts.

---

## Card 3 — Cascade impact uses relation policy

**Status:** queued; independent of Card 2, but write serially unless isolated
**Weight:** full scope card

### Target Behavior

Hard-impact edit cascade consults relation-policy endpoint-change behavior instead of deriving reconciliation impact from relation name or raw edge direction.

### Boundary Crossings

```text
→ edit route / cascade producer
→ relation-policy registry from Card 1
→ reconciliation_need creation
→ existing side-chat/reconciliation tests
```

### Risks and Assumptions

- RISK: Current tests encode the old raw-direction assumption → MITIGATION: update fixtures to name changed endpoint and expected affected endpoint explicitly.
- RISK: Policy change alters user-visible reconciliation counts → MITIGATION: preserve conservative behavior for ambiguous current relations unless policy says no reconciliation.
- ASSUMPTION: No schema change is needed; relation policy can compute impact from composite edge coordinates and changed item id → VALIDATE: tests cover both source-changed and target-changed variants.

### Acceptance Criteria

- ✓ `cascade-producer.test.ts` — source-change and target-change behavior is driven by relation policy for every current relation.
- ✓ `edit-route.test.ts` / reconciliation tests — hard edits open needs for the policy-affected endpoint(s), not merely for raw incident-edge neighbors.
- ✓ compatibility assertion — existing dense-fixture cascade remains conservative where policy keeps current behavior.

### Verification Approach

- Inner: focused cascade policy unit tests and edit-route integration tests.
- Middle: existing reconciliation classifier/context tests remain green.
- Outer: manual dense cascade walkthrough deferred to reconciliation-runtime work.

---

## Later candidates — do not pre-build yet

These likely remain in FE-700 but should be scoped after Cards 1–3 land:

1. Ontology registry expansion for `invariant` and `example`, including subtypes and reference prefixes.
2. Observer prompt/parser enrichment for examples, counterexamples, invariants, and stricter decisions.
3. Negative relations and edge metadata (`family`, `support`, `status`, `rationale`, provenance), coordinated with FE-701 if stable edge identity becomes necessary.
