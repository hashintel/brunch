# Scope Cards — web-shell judo review fixes

## Orientation

- Containing seam: M3 `web-shell` read-only browser/RPC projection over Pi JSONL session truth.
- Relevant frontier item: `web-shell` / FE-737 on branch `ln/fe-737-web-shell`; these are close-out hardening cards inside the same frontier, not new Linear/branch work.
- Volatile handoff state: judo review found three maintainability candidates after the builder's final slices; `npm run verify` is green, qualitative browser-open smoke remains an accepted environment-blocked outer-loop deferral.
- Main open risk: fixing projection structure must not accidentally loosen the D24-L linear transcript policy or let browser attachment state become durable session identity.
- Frontier obligations to preserve: browser stays a thin remote head over named JSON-RPC handlers; no REST product reads, no generic read gateway, no browser writes; session-consuming reads target durable explicit `{ sessionId, specId }` or the selected coordinator state; transcript readers fail fast on non-linear Pi JSONL.

---

## Card 1 — Canonical linear Brunch session envelope reader

**Status:** done  
**Weight:** full scope card

### Target Behavior

Session projection reads from one validated Brunch session envelope.

### Boundary Crossings

```text
→ Pi JSONL file under .brunch/sessions/
→ canonical session-envelope loader
→ explicit session target resolver
→ exchange/display projection loaders
→ JSON-RPC session.* handlers
```

### Risks and Assumptions

- RISK: collapsing the readers could hide malformed self-description errors behind `session not found` → MITIGATION: tests must cover missing/duplicate Pi headers, missing/duplicate `brunch.session_binding`, and header/binding session-id mismatch when either observed id is requested.
- RISK: the resolver may start treating invalid sessions as projectable because the projection loader performs later checks → MITIGATION: the envelope loader returns/throws product-shaped discriminants before projection work begins.
- ASSUMPTION: one canonical in-memory envelope `{ header, binding, entries }` is enough for current resolver and projection callers → VALIDATE: resolver and both projection loaders consume the same loader without re-parsing JSONL.

### Acceptance Criteria

✓ `session envelope validation` — malformed self-description cases produce the existing product-shaped invalid-self-description behavior for explicit session reads.  
✓ `session projection loader reuse` — `session.elicitationExchanges` and `session.transcriptDisplay` both project from the canonical validated envelope while preserving current non-linear transcript errors.  
✓ `reader deletion` — `targetsSession` closure logic and unused/silent `readBrunchSessionBinding()` are deleted rather than wrapped.  
✓ `no duplicate JSONL parsing path` — Brunch session header/binding validation lives in one module-level path used by explicit session resolution and projection loading.

### Verification Approach

- Inner: `npm run fix` and focused unit tests for the envelope loader, explicit resolver, and projection loaders.
- Middle: JSON-RPC handler contract tests for explicit session id/spec id reads, invalid self-description reads, and non-linear transcript reads.
- Outer: no new outer-loop requirement; this preserves the existing M3 direct HTTP/WebSocket smoke evidence.

### Cross-cutting obligations

- Preserve D24-L/I19-L fail-fast linear transcript policy; do not flatten, branch-select, or adapt Pi branch structure.
- Preserve D33-L/I21-L: WebSocket/stdio/TUI attachment state is not session identity; explicit reads validate durable session binding.
- Keep named `session.*` projection handlers over canonical Pi JSONL truth; do not introduce a generic read model or side store.

---

## Card 2 — Explicit transcript custom-entry classifiers

**Status:** next  
**Weight:** light scope card

### Objective

Elicitation exchange projection classifies prompt-side custom entries from an explicit allowlist instead of substring matching.

### Acceptance Criteria

✓ `known prompt-side entries` — current prompt-side custom transcript entries such as `brunch.elicitation_prompt` are still included in prompt spans.  
✓ `future known elicitor entries` — SPEC-named elicitor prompt/proposal entries that should participate in prompt spans are represented explicitly, not inferred from their names.  
✓ `unknown custom entries` — arbitrary or operational custom types containing the word `prompt` are ignored unless deliberately allowlisted.  
✓ `response-side parity` — existing structured response classification remains explicit and unchanged.

### Verification Approach

- Inner: `npm run fix` plus projection unit tests for allowlisted prompt-side entries, ignored unknown `*prompt*` entries, and existing structured responses.
- Middle: existing RPC/fixture projection tests continue to pass through `npm run verify`.
- Outer: none.

### Cross-cutting obligations

- Preserve D13-L capture-aware elicitation exchange projection: prompt spans are derived from transcript truth, not a parallel chat/turn store.
- Preserve D17-L: new product semantics should compose onto the custom-message/event substrate deliberately, not via name-shape magic.

### Promotion checklist

- [x] Does this change a requirement? No.
- [x] Does this create, retire, or invalidate an assumption? No.
- [x] Does this make or reverse a non-trivial design decision? No.
- [x] Does this establish a new seam-level invariant? No; it hardens the existing explicit transcript-shape policy.
- [x] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [x] Does it cross more than two major seams? No.
- [x] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [x] Can you name the containing seam and current rationale from live docs? Yes — M3 web-shell over D13-L/D17-L/D24-L.

---

## Card 3 — Typed browser session projection target

**Status:** next  
**Weight:** light scope card

### Objective

The React web shell builds transcript query params from an explicit typed session projection target instead of non-null assertions on the workspace snapshot.

### Acceptance Criteria

✓ `explicit target helper` — `WorkspaceSnapshot` is converted to `SessionProjectionTarget | null` before query options are built.  
✓ `no non-null assertions` — `src/web-client/app.tsx` no longer uses `snapshot.session!` or `snapshot.spec!` to call `session.transcriptDisplay`.  
✓ `read-only behavior preserved` — the app still calls `session.transcriptDisplay` only with durable `{ sessionId, specId }` when both are present.  
✓ `empty selection preserved` — no selected session still renders the existing no-session UI and makes no session projection request.

### Verification Approach

- Inner: `npm run fix` plus React app unit tests for ready and select-spec snapshots.
- Middle: existing WebSocket/RPC integration tests through `npm run verify`.
- Outer: none.

### Cross-cutting obligations

- Preserve D33-L/I21-L: browser state is an ephemeral client attachment and must not become canonical session binding.
- Preserve the M3 browser-read contract: read-only transcript projection over one WebSocket RPC client, with no browser writes or REST product reads.

### Promotion checklist

- [x] Does this change a requirement? No.
- [x] Does this create, retire, or invalidate an assumption? No.
- [x] Does this make or reverse a non-trivial design decision? No.
- [x] Does this establish a new seam-level invariant? No.
- [x] Does this change a frontier-level cross-cutting obligation or verification architecture layer? No.
- [x] Does it cross more than two major seams? No.
- [x] Is this the first touch in an unfamiliar seam from a fresh thread? No.
- [x] Can you name the containing seam and current rationale from live docs? Yes — M3 web-shell browser projection over explicit session resources.
