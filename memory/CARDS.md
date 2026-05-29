<!-- CARDS.md — temporary scope-card queue for one active frontier item.
     Created by ln-scope. Delete or overwrite when exhausted/superseded.
     Canonical planning state remains memory/SPEC.md and memory/PLAN.md. -->

# Scope Card Queue — FE-744 RPC parity hardening

## Orientation

- **Containing seam:** FE-744 `pi-ui-extension-patterns`, specifically the public Brunch JSON-RPC structured-exchange parity proof and tuple-shaped Pi JSONL projections.
- **Frontier boundary:** one existing Linear/branch unit: FE-744 / `ln/fe-744-pi-ui-extension-patterns`. These are hardening slices inside that frontier, not new Linear issues or branches.
- **Current state:** four RPC parity slices landed and `npm run verify` passed; `memory/PLAN.md` says ten-turn public RPC tuple parity is landed, and the next feature slice is web real-time structured-exchange observation smoke.
- **Main open risk:** the parity proof currently passes while under-witnessing tuple identity, terminal request status handling, and option content/rationale fidelity. Harden those before web observation builds on the projection contract.

## Queue Discipline

- Consume cards in order unless implementation reveals a blocker that invalidates later cards.
- Each card should be verified and committed independently.
- These cards should not alter FE-744’s requirements; they tighten implementation and oracles against existing SPEC decisions/invariants (D13-L, D37-L, D38-L, D49-L, I23-L, I32-L).
- Inner loop after meaningful edits: `npm run fix`. Gate before each commit: `npm run verify`.

---

## Card 1 — Make the ten-turn parity proof assert ten distinct tuple instances

**Status:** done  
**Weight:** light scope card

### Objective

The public RPC parity proof completes ten exchanges with ten distinct exchange IDs and validates each present/request pair independently.

### Acceptance Criteria

✓ The deterministic elicitation script no longer reuses the same exchange IDs across the ten-turn parity run.  
✓ `src/probes/public-rpc-parity-proof.test.ts` asserts all 10 exchange IDs are distinct, not merely at least three.  
✓ The JSONL parity oracle checks present-before-request ordering for every completed exchange instance, not `new Set(exchangeIds)` first occurrences.  
✓ The proof still covers `present_question`, `request_answer`, `present_options`, `request_choice`, and `request_choices`.  
✓ Existing resume behavior still returns an already-open pending exchange without appending a duplicate present result.

### Verification Approach

- Inner: focused RPC handler/probe tests for deterministic sequencing and resume-no-duplicate behavior.
- Middle: `src/probes/public-rpc-parity-proof.test.ts` validates ten distinct completed tuple instances and per-instance ordering.
- Gate: `npm run verify`.

### Cross-cutting Obligations

- Preserve I32-L: public RPC clients drive the loop through Brunch JSON-RPC only.
- Preserve I23-L: each structured exchange remains a recoverable present/request tuple with one matching terminal request.
- Do not reintroduce `brunch.elicitation_prompt` / `brunch.elicitation_response` into the public proof path.

### Assumption Dependency

Depends on: A23-L — this card strengthens the landed validation of public RPC elicitation parity; it does not introduce a new assumption.

---

## Card 2 — Treat matching cancelled and unavailable request tuples as terminal in projections

**Status:** done  
**Weight:** light scope card

### Objective

Elicitation projection closes an open structured exchange when the matching `request_*` result is `answered`, `cancelled`, or `unavailable`.

### Acceptance Criteria

✓ `projectElicitationExchanges` closes a matching present/request tuple for `status: "cancelled"`.  
✓ `projectElicitationExchanges` closes a matching present/request tuple for `status: "unavailable"`.  
✓ Mismatched `exchangeId`, `respondsTo.exchangeId`, `respondsTo.presentTool`, or unexpected request tool still does not silently close the prompt.  
✓ `session.pendingExchange` returns `idle` after a matching cancelled/unavailable terminal request in selected and explicit session projection paths.  
✓ Tests cover at least one `request_choices` invalid/editor-unavailable result so the editor-fallback error path cannot leave the session permanently open.

### Verification Approach

- Inner: projection tests in `src/elicitation-exchange.test.ts` for answered/cancelled/unavailable terminal statuses and mismatch guards.
- Middle: RPC projection tests in `src/rpc/handlers.test.ts` for selected and explicit sessions with terminal non-answered request tuples.
- Gate: `npm run verify`.

### Cross-cutting Obligations

- Preserve D13-L: terminal structured-exchange tool results are response-side transcript entries.
- Preserve I23-L: terminal means `answered`, `cancelled`, or `unavailable`; do not make “open prompt” depend on successful answer only.
- Do not introduce a sidecar pending-exchange store to track terminal state.

### Assumption Dependency

None — this is a bugfix/hardening against existing SPEC semantics.

---

## Card 3 — Preserve option content and rationale through pending/proof projections

**Status:** next  
**Weight:** light scope card

### Objective

Public RPC pending exchange and parity-proof assertions preserve structured option `content` and optional `rationale`, not only id/label.

### Acceptance Criteria

✓ The public pending exchange schema/result can expose option `content` and optional `rationale` for `present_options` exchanges while keeping a stable label for compact choice display.  
✓ Deterministic `present_options` data includes at least one option with distinct `content` and `rationale` so the oracle can catch flattening.  
✓ `session.pendingExchange` tests assert option content/rationale survive from tuple details or markdown-backed projection.  
✓ `src/probes/public-rpc-parity-proof.ts` asserts JSONL/projection parity for option content/rationale on single-select and multi-select exchanges.  
✓ `session.transcriptDisplay` still renders human-readable option markdown with option artifacts at TUI-comparable quality.

### Verification Approach

- Inner: RPC handler tests for pending option shape and transcript display rows.
- Middle: public RPC parity proof asserts content/rationale fidelity across JSONL and projections.
- Gate: `npm run verify`.

### Cross-cutting Obligations

- Preserve D37-L: `toolResult.content` remains the durable user/model-readable markdown; `toolResult.details` carries structured projection/recovery data.
- Preserve D49-L: public clients read product-shaped pending exchange data through Brunch RPC, not raw Pi RPC events.
- Keep the response payload compact; do not expose assistant tool-call internals as the product contract.

### Assumption Dependency

Depends on: A23-L — this strengthens semantic parity quality for public RPC elicitation; it does not change the public proof’s boundary.
