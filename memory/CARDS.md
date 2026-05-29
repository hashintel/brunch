# Scope Cards — FE-744 public RPC parity artifact hardening

> Prepared by `ln-scope` for build in a separate thread. These cards are scoped slices inside the existing `pi-ui-extension-patterns` frontier / FE-744 branch. Do not create new Linear issues or Graphite branches for these cards by default.

## Orientation

- **Containing seam:** FE-744 `pi-ui-extension-patterns`, specifically the public Brunch RPC parity proof and probe-oracle artifact layer.
- **Relevant frontier item:** `pi-ui-extension-patterns` remains the branch/tracker boundary; these are follow-through hardening slices after committed `.fixtures` public-RPC parity artifacts landed in `baa08cbe`.
- **Canonicalized handoff state:** `HANDOFF.md` has been retired; durable decisions now live in `memory/SPEC.md` / `memory/PLAN.md`. Future `capture_*` ANALYSIS work is specified at the carrier/visibility level only and requires a separate `ln-design` pass before implementation.
- **Main open risk:** the new review bundle is human-legible, but its report/test witness is still too thin to prove every completed exchange is represented in both source JSONL and transcript Markdown.

## Queue discipline

- Build cards in order unless implementation reveals a reason to stop.
- Each card should be committed independently after `npm run verify` passes.
- Ordinary test runs must not mutate committed `.fixtures` outputs; committed seed bundles may be regenerated only by an explicit artifact-writing path.
- Canonical SPEC/PLAN reconciliation should be a no-op for these cards unless implementation changes the already-recorded `.fixtures` bundle shape, Brunch-semantic transcript default, or `capture_*` deferral boundary.

## Card 1 — Strengthen parity artifact witness

**Status:** done  
**Weight:** light scope card

### Objective

The public RPC parity artifact test proves that every completed exchange id in the report is present in both the persisted session JSONL and rendered transcript Markdown.

### Acceptance Criteria

✓ `src/probes/public-rpc-parity-proof.test.ts` asserts that the persisted `report.json` exchange ids exactly match the in-memory report exchange ids and contain ten unique ids.  
✓ The artifact-writing test asserts that every persisted exchange id appears in `session.jsonl`.  
✓ The artifact-writing test asserts that every persisted exchange id appears in `transcript.md`.  
✓ Ordinary `runPublicRpcParityProof()` calls without `fixtureRoot` still do not write `.fixtures` artifacts.

### Verification Approach

- Inner: `npm run test -- src/probes/public-rpc-parity-proof.test.ts` — proves the artifact bundle is witnessed through the public probe boundary.
- Inner: `npm run fix` after edits.
- Gate: `npm run verify` before committing.

### Cross-cutting obligations

- Preserve I32-L: public RPC elicitation driving must not require raw Pi RPC.
- Preserve I23-L: structured-exchange transcript evidence comes from durable `toolResult.content` / `toolResult.details`.
- Preserve explicit artifact persistence: tests should write only to a temp fixture root unless a builder intentionally regenerates committed `.fixtures` output.

### Assumption dependency

Depends on: A23-L — already validated by the public RPC parity proof; this card only strengthens the artifact oracle over that proof.

### Promotion checklist

- [ ] Changes a requirement
- [ ] Creates/retires/invalidates an assumption
- [ ] Depends on an unvalidated high-impact assumption
- [ ] Makes/reverses a non-trivial design decision
- [ ] Establishes a new seam-level invariant
- [ ] Changes a frontier-level obligation or verification architecture layer
- [ ] Crosses more than two major seams
- [ ] First touch in an unfamiliar seam
- [ ] Cannot name containing seam/current rationale

## Card 2 — Add a self-describing parity report envelope

**Status:** next  
**Weight:** light scope card

### Objective

The public RPC parity `report.json` identifies its schema, probe id, run id, and generation timestamp without relying on directory layout.

### Acceptance Criteria

✓ `PublicRpcParityProofReport` includes an explicit `schemaVersion: 1`.  
✓ `PublicRpcParityProofReport` includes `probeId: "public-rpc-parity"`.  
✓ `PublicRpcParityProofReport` includes the `runId` used for artifact output.  
✓ `PublicRpcParityProofReport` includes `generatedAt` as an ISO timestamp.  
✓ The artifact-writing test proves `report.json.artifacts.runDir` ends in `/runs/public-rpc-parity/<report.runId>` and that the report's `probeId` matches the artifact path's probe segment.  
✓ The committed seed bundle at `.fixtures/runs/public-rpc-parity/2026-05-29-public-rpc-parity/` is regenerated or edited so `report.json` matches the new envelope.

### Verification Approach

- Inner: `npm run test -- src/probes/public-rpc-parity-proof.test.ts` — proves the report envelope and path coherence.
- Middle: inspect `.fixtures/runs/public-rpc-parity/2026-05-29-public-rpc-parity/report.json` — confirms the committed review artifact is self-describing.
- Inner: `npm run fix` after edits.
- Gate: `npm run verify` before committing.

### Cross-cutting obligations

- Keep `.fixtures/runs/<probe-id>/<run-id>/` as the probe-oracle review-bundle shape documented in SPEC.
- Do not change the public RPC parity behavior while changing only the report envelope.
- Do not mutate committed `.fixtures` during ordinary tests; seed regeneration must be an explicit builder action.

### Assumption dependency

Depends on: A5-L and A23-L — the artifact envelope improves fixture-driver/probe quality over the already-validated parity path; it does not introduce a new substrate assumption.

### Promotion checklist

- [ ] Changes a requirement
- [ ] Creates/retires/invalidates an assumption
- [ ] Depends on an unvalidated high-impact assumption
- [ ] Makes/reverses a non-trivial design decision
- [ ] Establishes a new seam-level invariant
- [ ] Changes a frontier-level obligation or verification architecture layer
- [ ] Crosses more than two major seams
- [ ] First touch in an unfamiliar seam
- [ ] Cannot name containing seam/current rationale

## Card 3 — Make transcript rendering Brunch-semantic by default

**Status:** queued  
**Weight:** light scope card

### Objective

The session transcript renderer's default output omits generic non-Brunch tool results while retaining Brunch semantic transcript evidence for the currently implemented structured-exchange families.

### Acceptance Criteria

✓ `src/session-transcript.test.ts` covers a JSONL session containing both a generic tool result and structured-exchange `present_*` / `request_*` tool results.  
✓ `renderSessionTranscript(...)` default output includes the structured-exchange prompt/response sections.  
✓ `renderSessionTranscript(...)` default output omits the generic tool result heading/body.  
✓ `runPublicRpcParityProof({ fixtureRoot, runId })` still writes a transcript containing all ten exchange ids from the report.  
✓ This card does not implement `capture_analysis`; it leaves `capture_*` ANALYSIS rendering for the separate design pass unless a minimal classifier falls out naturally without choosing the details schema.

### Verification Approach

- Inner: `npm run test -- src/session-transcript.test.ts src/probes/public-rpc-parity-proof.test.ts` — proves the renderer default and parity artifact integration.
- Middle: inspect generated `transcript.md` from a temp artifact-writing parity run if tests fail to make the behavior obvious.
- Inner: `npm run fix` after edits.
- Gate: `npm run verify` before committing.

### Cross-cutting obligations

- Preserve I23-L: durable semantic display comes from `toolResult.content` / `toolResult.details`, not `renderCall` or live UI state.
- Preserve I33-L / D50-L at the boundary: `capture_*` is transcript evidence only and should be included in Brunch-semantic transcripts once designed, but this card must not invent the `capture_analysis` details schema or shared component API.
- Keep the transcript renderer aligned with the human-review oracle: Brunch semantic transcript evidence should be visible; unrelated generic tool noise should not obscure it.
- Defer raw/debug transcript mode unless implementation shows it is cheaper to preserve during this slice; if raw mode is added, it must be explicit and covered by tests.

### Assumption dependency

Depends on: A23-L — the implemented structured-exchange tool families and parity transcript are already validated; this card narrows the default human transcript view over that known substrate. It references I33-L only as a deferral guard, not as an implementation dependency.

### Promotion checklist

- [ ] Changes a requirement
- [ ] Creates/retires/invalidates an assumption
- [ ] Depends on an unvalidated high-impact assumption
- [ ] Makes/reverses a non-trivial design decision
- [ ] Establishes a new seam-level invariant
- [ ] Changes a frontier-level obligation or verification architecture layer
- [ ] Crosses more than two major seams
- [ ] First touch in an unfamiliar seam
- [ ] Cannot name containing seam/current rationale
