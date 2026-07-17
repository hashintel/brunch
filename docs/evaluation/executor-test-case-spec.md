# Brunch Executor Pilot Test Case Specification

## Test case identity

- **Case ID:** `brunch-reconciliation-derivation-v1`
- **Title:** Derived edge-revalidation needs
- **Status:** Ready for campaign freeze
- **Repository:** `hashintel/brunch`
- **Pinned source commit:** `567707fec93091fb6858908197ca104bf73e4d5b`
- **Source commit subject:** `FE-1201: Make greenfield landing recoverable`
- **Feature source:** `memory/PLAN.md` → `reconciliation-derivation`
- **Required repository gate:** `npm run verify`

The campaign manifest must record the model, provider, permission policy, run timestamps, and SHA-256 hash of this file. If this specification changes after the first run starts, create a new case version.

## Objective

Implement the read-only first tracer for derived `edge_revalidation` reconciliation needs.

Brunch currently stores all reconciliation needs as rows authored through the command layer. One need kind, `edge_revalidation`, can instead be detected from graph state: when the upstream node of an impact-carrying edge was updated after the downstream node was last updated, that edge needs review.

The implementation must:

1. derive these signals from existing graph and category-policy data;
2. expose them alongside persisted open reconciliation needs;
3. preserve persisted behavior for the three judgment-shaped need kinds;
4. perform no graph, clock, changelog, or reconciliation-need writes.

This test intentionally stops before schema changes, acknowledgment watermarks, clearing UX, RPC/web projection, or automatic need creation.

## Existing contract

The implementation starts from these repository facts:

- Nodes and edges carry spec-local `updated_at_lsn` values.
- `EDGE_CATEGORY_METADATA` is the authority for edge direction and impact.
- `affected` identifies the downstream endpoint.
- The opposite endpoint is upstream.
- `impactKind: "none"` means the edge does not propagate an impact.
- `getOpenReconciliationNeeds(db, specId)` is the persisted open-needs read.
- `read_reconciliation_needs` is the current agent-facing read surface.
- Reconciliation need kinds are:
  - `edge_revalidation`
  - `possible_relation`
  - `possible_duplicate`
  - `semantic_conflict`
- LSN values are meaningful only within one specification.

Do not replace policy metadata with a second category switch or hard-coded direction map.

## Frozen derivation semantics

For each active, visible edge in the requested specification:

1. Read its category from `EDGE_CATEGORY_METADATA`.
2. Ignore the edge when `impactKind` is `none` or `affected` is `null`.
3. Resolve the downstream node from `affected`.
4. Resolve the upstream node as the opposite endpoint.
5. Emit a derived need when:

```text
upstream.updated_at_lsn > downstream.updated_at_lsn
```

For this tracer, `downstream.updated_at_lsn` is the acknowledgment proxy. Do not include `edge.updated_at_lsn` in this comparison.

Both `advisory` and `cascade` impact kinds participate. Node or edge settlement does not suppress derivation.

The derived signal must identify:

- need kind: `edge_revalidation`;
- target edge ID;
- provenance: `derived`;
- edge category;
- upstream node ID and LSN;
- downstream node ID and acknowledgment-proxy LSN.

The implementation may choose its internal type and module boundary, but it must not fabricate a persisted reconciliation-need ID.

## Merge behavior

The agent-facing reconciliation read must return:

- all persisted open needs of every existing kind; and
- all currently derived edge-revalidation needs.

When an open persisted `edge_revalidation` row and a derived signal target the same edge, return one entry. The persisted row wins because it carries authored reason and lifecycle data.

Every returned entry must make its provenance distinguishable as either `persisted` or `derived`.

Return entries in deterministic order:

1. target edge ID for edge targets;
2. normalized node-pair key for node-pair targets;
3. kind;
4. provenance, with persisted before derived.

Equivalent deterministic ordering is acceptable if it is documented and all reads return the same order.

## Functional requirements

### R1 — Correct direction

Derivation must use category policy, not source/target geometry alone.

- For a target-affected category such as `dependency`, source is upstream and target is downstream.
- For a source-affected category such as `witness`, target is upstream and source is downstream.

### R2 — Correct staleness rule

- Creation of both nodes and their edge in one graph commit produces no derived need.
- Updating only the upstream node produces one derived need.
- Updating only the downstream node does not produce a need.
- Updating the downstream node after the upstream update clears the derived signal under the tracer’s acknowledgment-proxy rule.
- Updating only edge rationale does not produce a need.

### R3 — Impact policy

- All non-`none` categories participate.
- `cross_reference` never produces a derived need.

### R4 — Spec isolation

The read must filter nodes, edges, and persisted needs by `spec_id`. A higher LSN in another specification must have no effect.

### R5 — Visibility

Use the repository’s active graph visibility semantics. Edges hidden because an endpoint is not part of the active visible graph must not produce derived needs.

### R6 — Read-only behavior

Running the derived read must not change:

- `graph_clock`;
- `change_log`;
- nodes;
- edges;
- `reconciliation_need`.

Repeated reads over unchanged state must return deeply equal results and leave the database byte-for-byte equivalent at the logical row level.

### R7 — Persisted compatibility

Persisted `possible_relation`, `possible_duplicate`, and `semantic_conflict` needs remain table-backed and unchanged. Existing create, resolve, and read behavior must continue to pass.

### R8 — Public surface

The derived results must be visible through `read_reconciliation_needs`, not only through a private helper or tests. Existing callers must continue to receive persisted open needs.

## Required acceptance scenarios

The external evaluator owns these checks. Executor-authored tests do not replace them.

### A1 — Quiescent graph

Create two nodes and a non-`none` edge in one command batch. Assert that no derived need is returned.

### A2 — Target-affected category

Create a `dependency` edge, then patch its source node. Assert one derived need with:

- the edge as target;
- source as upstream;
- target as downstream;
- correct LSN evidence.

### A3 — Source-affected category

Create a `witness` edge, then patch its target node. Assert one derived need with:

- the edge as target;
- target as upstream;
- source as downstream;
- correct LSN evidence.

### A4 — Downstream acknowledgment proxy

After A2, patch the downstream node. Assert that the derived signal disappears without creating, resolving, or mutating a persisted reconciliation row.

### A5 — Non-impact edge

Patch either endpoint of a `cross_reference` edge. Assert that no derived need is returned.

### A6 — Edge-only update

Patch only edge rationale. Assert that no derived need is returned.

### A7 — Mixed persisted and derived needs

Create:

- one persisted `semantic_conflict`;
- one persisted `edge_revalidation`;
- one independently derived `edge_revalidation`;
- one edge that has both persisted and derived revalidation evidence.

Assert that:

- judgment-shaped persisted needs remain;
- the independent derived need appears;
- the duplicate edge appears once;
- the persisted duplicate wins;
- provenance is visible;
- ordering is deterministic.

### A8 — Spec isolation

Create similar graph IDs or differing LSN histories in two specifications. Query each specification and assert that neither result contains evidence from the other.

### A9 — Read-only proof

Snapshot all relevant rows and the latest graph LSN, execute the read twice, and assert:

- both results are deeply equal;
- row snapshots are unchanged;
- the latest graph LSN is unchanged;
- no changelog row was added.

### A10 — Agent-facing integration

Invoke `read_reconciliation_needs` through its registered tool surface and confirm that both persisted and derived entries are represented without requiring a write or UI interaction.

### A11 — Repository gate

Run:

```sh
npm run verify
```

The command must exit successfully.

## Architecture constraints

- Reuse `EDGE_CATEGORY_METADATA` and the existing direction semantics.
- Keep the derivation in the graph read/projection layer; do not move policy into the Pi extension.
- Keep writes behind the existing command boundary.
- Do not compare LSNs across specifications.
- Do not turn the intentional `src/projections/graph/reconciliation-needs.ts` topology stub into a general web projection unless the minimal implementation genuinely requires that public seam.
- If `src/graph/queries.ts` needs splitting, retain it as the public entry point and place private implementation in its same-named subtree.
- Update the nearest `TOPOLOGY.md` only when the materialized public surface or dependency direction changes.

## Allowed change area

Expected changes are limited to:

- graph query or projection code;
- graph public exports if needed;
- the read-only `read_reconciliation_needs` composition/formatting path;
- focused tests;
- directly affected topology documentation.

Changes outside these areas require a written justification in the run assessment.

## Non-goals

Do not implement:

- a schema migration;
- a per-edge acknowledged-LSN watermark;
- persistent clearing or dismissal of derived signals;
- automatic `reconciliation_need` writes;
- retirement or migration of persisted `edge_revalidation` rows;
- RPC or web reconciliation projections;
- reconciliation UI;
- new reconciliation kinds;
- changes to edge-category policy;
- a general evaluation framework;
- unrelated cleanup or refactoring.

## Deliverables

Each implementation must include:

1. production code satisfying R1–R8;
2. focused automated tests;
3. any required public export or formatter updates;
4. topology documentation updates when required;
5. no committed campaign artifacts or generated runtime state.

## Mechanical pass/fail rule

A run is **incorrect** if any of the following is true:

- any mandatory acceptance scenario fails;
- `npm run verify` fails;
- the read mutates graph or reconciliation state;
- direction is hard-coded independently of category policy;
- cross-spec LSNs are compared;
- derived signals exist only in a private helper and are absent from `read_reconciliation_needs`;
- the implementation adds a schema migration or write-side generator;
- required persisted need behavior regresses.

Subjective code quality cannot override a mechanical failure.

## Quality assessment

After mechanical checks pass, a blinded judge should assess:

- completeness against R1–R8;
- correctness of direction and LSN reasoning;
- architectural fit with graph query, command, and policy boundaries;
- clarity of persisted-versus-derived modeling;
- maintainability and test quality;
- unnecessary scope or complexity.

Every finding must cite a requirement and a file, symbol, or test.

## Campaign protocol

Run from the pinned source commit in six fresh worktrees:

- Brunch executor: three runs;
- Claude Code: three runs.

Use the same approved specification, model, provider, budget, and permission policy where possible. Preserve the final diff, transcript/session evidence, verification output, timing, retries, and human interventions for every run.

Use this per-run manifest shape:

```json
{
  "caseId": "brunch-reconciliation-derivation-v1",
  "system": "brunch",
  "sourceCommit": "567707fec93091fb6858908197ca104bf73e4d5b",
  "specHash": "<sha256-of-this-file>",
  "model": "<model-id>",
  "provider": "<provider>",
  "permissionPolicy": "<policy-id-or-description>",
  "runId": "<run-id>",
  "startedAt": "<timestamp>",
  "completedAt": "<timestamp>",
  "humanInterventions": 0
}
```

Store unreviewed evidence under:

```text
.fixtures/scratch/executor-eval/
  brunch-reconciliation-derivation-v1/
    <system>/
      <run>/
```

Do not promote evidence to `.fixtures/runs/` until it has been reviewed.

## Campaign success criteria

The pilot supports the executor claim when:

- every Brunch run passes A1–A11;
- repeated Brunch runs produce equivalent behavior and materially equivalent module boundaries;
- Brunch quality is comparable to or better than the blinded Claude Code outputs;
- retries and failures are attributable to a specific stage and cause;
- no run requires unrecorded human intervention;
- implementation differences do not violate the frozen derivation semantics.

Correctness ranks first, process efficiency second, and source-code similarity last.
