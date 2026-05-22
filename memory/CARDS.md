# Scope cards — FE-737 web-shell final tie-off queue

## Orientation

- **Containing seam/frontier:** `web-shell` (FE-737, M3) — browser as a read-only client attachment over named JSON-RPC session/workspace projections, not a separate product runtime.
- **Current volatile state:** M3 implementation is functionally complete and verified: persistent WebSocket RPC, explicit session projections, transcript display rows, shared session-binding codec, and HTTP/WebSocket smoke postconditions. Final review found two correctness gaps before tie-off: explicit session lookup accepts ambiguous session self-description, and transcript display omits transcript-native custom-message prompts.
- **Main open risk:** closing M3 while read-only transcript projection still under-represents Brunch transcript truth or accepts malformed session binding state would weaken D12-L/D13-L/D24-L/D33-L and I10-L/I19-L/I21-L.
- **Frontier obligations:** preserve Pi JSONL as transcript truth, validate exactly one durable `brunch.session_binding`, reject non-linear/malformed sessions rather than adapting them, keep web read-only, keep session reads explicit by `{ sessionId, specId }`, and record browser-open smoke status before marking the frontier done.

---

## Card 1 — Strict session self-description validation

**Status:** done  
**Weight:** full scope card

### Target Behavior

Explicit session projection rejects session files whose durable self-description is ambiguous or inconsistent.

### Boundary Crossings

```text
→ session.elicitationExchanges / session.transcriptDisplay explicit params
→ session projection reader
→ Pi JSONL session header + brunch.session_binding entries
→ projection target success or product-shaped JSON-RPC failure
```

### Risks and Assumptions

- RISK: malformed binding/session-header errors leak as generic internal errors → MITIGATION: projection reader returns product-shaped target failures with stable codes/messages for duplicate binding, missing header, or header/binding mismatch.
- RISK: duplicating transcript structural validation with `loadJsonlTranscriptEntries` causes divergent policy → MITIGATION: validate only the self-description needed for lookup here: exactly one Pi session header, exactly one valid `brunch.session_binding`, and matching `sessionId`; leave linearity/entry-shape projection validation to existing transcript loaders.
- RISK: no-param selected-session fallback might inherit stricter explicit-read behavior accidentally → MITIGATION: scope this card to explicit lookup path; selected fallback can remain covered by existing loader/coordinator tests unless implementation naturally shares safe helpers.
- ASSUMPTION: strict self-description failures should be product-shaped read errors, not process crashes → VALIDATE: RPC and WebSocket tests assert explicit failures.

### Acceptance Criteria

✓ explicit projection returns a product-shaped error when a session file contains duplicate valid `brunch.session_binding` entries.  
✓ explicit projection returns a product-shaped error when the Pi session header is missing or duplicated.  
✓ explicit projection returns a product-shaped error when binding `sessionId` does not match the Pi session header id.  
✓ valid explicit projection still works for coordinator-created sessions.  
✓ non-linear transcript errors remain `-32002` and are not conflated with self-description failures.  
✓ shared session-binding codec remains the only source of binding type/schema/data validation.

### Verification Approach

- Inner: `npm run fix`; focused session-projection-reader/RPC tests with synthetic JSONL files.
- Middle: WebSocket RPC contract test for at least one malformed self-description failure if the RPC-layer behavior is not already covered through handler tests.
- Outer: not needed.

### Cross-cutting obligations

- Preserve I8-L/I21-L: durable session binding and Pi session header agree on canonical session identity.
- Preserve D24-L/I19-L: fail fast on unsupported/malformed transcript shapes; do not flatten, repair, or adapt.
- Preserve D33-L: explicit reads are resource-targeted, not transport/default-state-targeted.

---

## Card 2 — Display transcript-native custom-message prompts

**Status:** next  
**Weight:** full scope card

### Target Behavior

The read-only transcript display projection renders text-bearing Brunch custom-message elicitation prompts alongside assistant and user messages.

### Boundary Crossings

```text
→ Pi JSONL transcript entries
→ transcript display projection
→ session.transcriptDisplay RPC response
→ React transcript panel
```

### Risks and Assumptions

- RISK: displaying every custom/custom_message entry exposes operational internals as chat UI → MITIGATION: include only text-bearing prompt/display custom-message kinds that participate in transcript truth; omit operational entries such as session binding, side-task bookkeeping, and future non-display custom records.
- RISK: custom-message payload shapes from Pi differ from ordinary messages → MITIGATION: inspect existing fixture/custom-message shape in tests and add projection tests for the actual `appendCustomMessageEntry("brunch.elicitation_prompt", text, true)` output.
- RISK: this becomes final structured elicitation UI prematurely → MITIGATION: render text-only read-only rows for M3; defer action/radio/checkbox/freeform input rendering to later write-ownership/structured UI slices.
- ASSUMPTION: `brunch.elicitation_prompt` is the only custom-message prompt kind required for current M1/M3 fixtures → VALIDATE: tests cover this kind; future prompt kinds can be added deliberately.

### Acceptance Criteria

✓ `session.transcriptDisplay` includes a read-only row for `brunch.elicitation_prompt` custom-message entries with their text content.  
✓ display rows distinguish prompt/assistant/user roles or labels clearly enough for the browser panel.  
✓ operational custom entries such as `brunch.session_binding` do not render as transcript rows.  
✓ existing assistant/user message rendering remains unchanged.  
✓ React transcript panel renders the custom-message prompt text from the projection.  
✓ no browser input, response submission, or write method is introduced.

### Verification Approach

- Inner: `npm run fix`; transcript projection tests using real Pi custom-message entries and React/jsdom rendering tests.
- Middle: RPC/WebSocket test for `session.transcriptDisplay` over a coordinator-created session containing an elicitation prompt custom message plus user response, if not covered through existing handler tests.
- Outer: covered by final browser-open smoke card.

### Cross-cutting obligations

- Preserve D12-L/D13-L/I10-L: structured/transcript-native prompt entries are part of transcript truth and must project without a parallel chat store.
- Preserve D19-L: read through named `session.*` RPC methods.
- Preserve read-only web posture.

---

## Card 3 — Human browser-open smoke and frontier reconciliation

**Status:** queued  
**Weight:** light scope card

### Objective

Complete or explicitly adjudicate the browser-open smoke debt and reconcile `web-shell` for frontier tie-off.

### Acceptance Criteria

✓ a human/browser-capable environment opens the built web shell and observes workspace chrome plus transcript display text, including custom-message prompt text if seeded.  
✓ the smoke note records whether session reads used explicit `{ sessionId, specId }` via `session.transcriptDisplay` and that HTTP product read endpoints remain absent.  
✓ if browser-open remains impossible in the current environment, `memory/PLAN.md` records the explicit accepted deferral and why it does not block submission; otherwise it records the browser-open smoke as passed.  
✓ `memory/PLAN.md` marks `web-shell` done only if the team accepts the remaining outer-loop status.  
✓ no `memory/CARDS.md` remains after this queue is exhausted.

### Verification Approach

- Inner: `npm run verify` after any doc/runbook edits.
- Middle: manual browser smoke + projection postconditions; reuse the already proven HTTP/WebSocket checks as supporting evidence.
- Outer: qualitative browser-open/render check for M3 dashboard feel.

### Cross-cutting obligations

- Preserve PLAN truth: do not silently erase browser-open debt.
- Preserve D10-L/D19-L/D33-L in the smoke notes: browser is a native read-only client attachment over WebSocket RPC.

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
