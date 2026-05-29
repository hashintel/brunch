<!-- CARDS.md — temporary scope-card queue for one active frontier item.
     Created by ln-scope. Delete or overwrite when exhausted/superseded.
     Canonical planning state remains memory/SPEC.md and memory/PLAN.md. -->

# Scope Card Queue — FE-744 public RPC structured-exchange parity

## Orientation

- **Containing seam:** FE-744 `pi-ui-extension-patterns`, specifically the public Brunch JSON-RPC structured-elicitation relay over Pi transcript truth.
- **Frontier boundary:** one existing Linear/branch unit: FE-744 / `ln/fe-744-pi-ui-extension-patterns`. These cards are commit-sized slices inside that frontier, not new Linear issues or branches.
- **Volatile state:** `HANDOFF.md` is transfer state only. The handoff flagged `memory/STRUCTURED_EXCHANGE_SIDE_MISSION.md` as protected cleanup; current git status does not show a tracked deletion, but do not recreate/delete/overwrite that path without confirmation.
- **Main risk:** accidentally proving the old lightweight `brunch.elicitation_prompt` / `brunch.elicitation_response` loop instead of the durable structured-exchange tuple model, or exposing raw Pi RPC/editor fallback as the product API.

## Queue Discipline

- Consume cards in order unless implementation reveals a blocker that invalidates later scopes.
- Each card should be verified and committed independently.
- Stop and rescope if a card requires changing `memory/SPEC.md` requirements/decisions/invariants rather than merely implementing the existing D37-L/D38-L/D49-L shape.
- Inner loop after meaningful edits: `npm run fix`. Gate before each commit: `npm run verify`.

## Card 1 — Implement `request_choices` as a durable structured-exchange request tool

**Status:** done  
**Weight:** full scope card

### Target Behavior

`request_choices` is a registered structured-exchange request tool that collects one-or-more option choices through the RPC-compatible editor fallback and persists terminal `brunch.structured_exchange.request` details.

### Boundary Crossings

```text
→ structured-exchange tool registry
→ request_choices tool parameter/result schema
→ Pi UI adapter (`ctx.ui.editor` JSON fallback for RPC-compatible multi-select)
→ durable toolResult.content/details
```

### Risks and Assumptions

- RISK: The existing editor-fallback helper emits the legacy `brunch.structured_exchange.result` details shape rather than the current present/request request schema.
  → MITIGATION: Add or refactor a request-schema-specific editor prefill/parser/result helper; keep the legacy helper only for old probe support if still needed.
- RISK: “Other” and “None” comment rules get flattened into an optional note and stop being enforceable.
  → MITIGATION: Model `allowOther` / `allowNone` explicitly; parser rejects answered responses containing `other` or `none` without a nonblank comment.
- ASSUMPTION: Multi-select over public-RPC-compatible UI can be represented as schema-tagged JSON over `ctx.ui.editor` until a richer product form lands.
  → IMPACT IF FALSE: Card 4 cannot exercise the required custom-UI-over-RPC fallback without raw Pi RPC or a bespoke product form.
  → VALIDATE: request tool execute tests with fake editor contexts for answered/cancelled/invalid JSON and a probe-compatible payload.
  → memory/SPEC.md: D38-L, I23-L, A23-L.

### Tracer-bullet Check

- **Proof of life:** lights up the currently stubbed multi-choice response tool needed by the parity proof.
- **Invariants:** reinforces that semantic response truth lives in request `toolResult.details`, not editor lifecycle state.
- **Uncertainty:** retires the local risk that multi-choice needs a new raw Pi RPC command shape.

### Acceptance Criteria

✓ `structured-exchange request_choices registry test` — `request_choices` moves from `STRUCTURED_EXCHANGE_STUB_TOOL_NAMES` into `STRUCTURED_EXCHANGE_IMPLEMENTED_TOOLS` and is registered by the extension entrypoint.  
✓ `request_choices editor fallback tests` — answered multi-choice results persist `schema: "brunch.structured_exchange.request"`, `requestTool: "request_choices"`, `status: "answered"`, `choices`, optional `comment`, `respondsTo.presentTool: "present_options"`, and `transport` only if the request model deliberately carries one.  
✓ `request_choices comment validation tests` — `other` or `none` answers without a nonblank comment are rejected or returned as `unavailable` with an explicit validation message; listed-option-only responses may omit comment.  
✓ `request_choices markdown test` — `toolResult.content` is readable markdown summarizing selected choices and any comment.

### Verification Approach

- Inner: focused Vitest unit tests for schemas, parser, execute behavior, and markdown rendering.
- Middle: existing structured-exchange extension registry tests prove the active/stub split is updated intentionally.
- Outer: none for this card; Card 4 supplies the public-RPC parity proof using `request_choices`.

### Cross-cutting Obligations

- Preserve D37-L: `renderCall` remains transient; semantic display/response truth is in `renderResult` / `toolResult.content` and `toolResult.details`.
- Preserve D38-L: JSON-over-editor is an adapter behind Brunch/Pi, not the public product API.
- Do not implement review-set or candidate stubs as collateral work.

---

## Card 2 — Project present/request structured-exchange tuples as pending and completed elicitation exchanges

**Status:** done  
**Weight:** full scope card

### Target Behavior

Session projections recognize unmatched `present_*` tool results as pending exchanges and matching terminal `request_*` tool results as response-side exchange closures.

### Boundary Crossings

```text
→ Pi JSONL session envelope
→ structured-exchange present/request details classifiers
→ elicitation-exchange projection
→ session.pendingExchange / session.transcriptDisplay RPC projections
```

### Risks and Assumptions

- RISK: Current projection code classifies only the legacy `brunch.structured_exchange.result` terminal details, so new request details could remain prompt-side or invisible.
  → MITIGATION: Add classifiers for `brunch.structured_exchange.present` and `brunch.structured_exchange.request`; keep legacy support only while old probes require it.
- RISK: Transcript display omits toolResult content even though D37-L treats it as durable user-facing transcript content.
  → MITIGATION: Render present tool results as assistant/prompt display rows and terminal request results as user/response display rows in Brunch projections.
- ASSUMPTION: Tuple recovery from `exchangeId` + expected request is sufficient without a parallel pending table.
  → IMPACT IF FALSE: Cards 3–4 would need an alternate in-memory or store-backed pending-exchange model, changing the FE-744 proof shape.
  → VALIDATE: synthetic JSONL projection tests for open, closed, mismatched, and multiple sequential tuples.
  → memory/SPEC.md: D13-L, D37-L, I23-L, I32-L, A23-L.

### Tracer-bullet Check

- **Proof of life:** makes tuple-shaped transcript truth visible through the public read projections.
- **Invariants:** stabilizes the no-parallel-chat/turn-store rule for pending state.
- **Uncertainty:** tests whether unmatched-present recovery is enough for public RPC pending state.

### Acceptance Criteria

✓ `elicitation projection open tuple test` — a linear transcript containing `present_question` without a terminal `request_answer` projects `status: "open_prompt"` and `session.pendingExchange` returns a product-shaped pending exchange.  
✓ `elicitation projection closed tuple test` — a matching terminal `request_answer`, `request_choice`, or `request_choices` result closes the exchange and appears in `responseEntryIds`.  
✓ `projection mismatch test` — a terminal request with a different `exchangeId` or incompatible `respondsTo.presentTool` does not close the open prompt silently.  
✓ `transcript display tuple test` — present markdown is visible as assistant/prompt text and terminal request markdown is visible as user/response text.  
✓ `legacy prompt/response guard` — existing lightweight custom prompt/response projection tests are either intentionally preserved as backward probe support or retired when no longer used by public RPC.

### Verification Approach

- Inner: projection/unit tests over synthetic session entries and TypeBox/runtime classifiers.
- Middle: RPC handler tests for `session.pendingExchange`, `session.elicitationExchanges`, and `session.transcriptDisplay` reading tuple-shaped sessions by selected and explicit session ids.
- Outer: none for this card; Card 4 supplies end-to-end parity.

### Cross-cutting Obligations

- Preserve linear transcript rejection for branched Pi JSONL.
- Do not introduce a canonical chat/turn table or sidecar pending-exchange store.
- Public projection shape should describe Brunch product semantics, not raw Pi RPC events.

---

## Card 3 — Move public RPC start/respond onto structured-exchange tuple truth for one deterministic exchange

**Status:** next  
**Weight:** full scope card

### Target Behavior

`session.startElicitation` and `elicitation.respond` operate on one deterministic structured-exchange tuple instead of appending the old lightweight `brunch.elicitation_prompt` / `brunch.elicitation_response` pair.

### Boundary Crossings

```text
→ Brunch JSON-RPC handler (`session.startElicitation`)
→ selected workspace/spec/session coordinator state
→ deterministic structured-exchange present builder
→ Pi JSONL toolResult-shaped transcript entries
→ Brunch JSON-RPC handler (`elicitation.respond`)
→ deterministic structured-exchange request builder
→ projection-backed pending/closed exchange reads
```

### Risks and Assumptions

- RISK: Public RPC cannot honestly “use structured-exchange tools” without running a raw Pi RPC agent loop.
  → MITIGATION: Route through shared structured-exchange builder/helper code that produces the same `toolResult.content/details` contract; if a real Pi invocation is cheap and stable, it may be hidden behind the Brunch adapter, but the public client still speaks only Brunch RPC.
- RISK: Handler code imports TUI-only picker/custom UI modules while adopting structured-exchange helpers.
  → MITIGATION: Keep the architectural source test for no `workspace-dialog` imports; replace the broad “no structured-exchange” assertion with a narrower “no TUI picker/raw Pi RPC public dependency” assertion.
- ASSUMPTION: A product-RPC response can append the terminal request result details directly and still be comparable to TUI/Pi tool execution transcript semantics.
  → IMPACT IF FALSE: The parity proof must delegate to an internal Pi RPC adapter rather than in-process tuple append helpers.
  → VALIDATE: one-exchange contract tests compare JSONL/projections against expected present/request details and display rows.
  → memory/SPEC.md: D37-L, D38-L, D49-L, I23-L, I32-L, A23-L.

### Tracer-bullet Check

- **Proof of life:** first product-RPC exchange uses the real tuple shape.
- **Invariants:** establishes public pending/respond semantics over transcript truth rather than custom prompt/response side entries.
- **Uncertainty:** proves whether an in-process Brunch adapter can produce parity-quality transcript artifacts without exposing raw Pi RPC.

### Acceptance Criteria

✓ `rpc discover schema update` — `rpc.discover` describes tuple-shaped pending exchange/result schemas for text, single-choice, and multi-choice responses, with examples that do not mention raw Pi RPC.  
✓ `start one tuple test` — starting elicitation in an activated session appends exactly one deterministic `present_*` toolResult-shaped transcript entry and returns the projection-backed pending exchange.  
✓ `resume open tuple test` — calling `session.startElicitation` while that tuple is open returns the same pending exchange without duplicating transcript entries.  
✓ `respond text test` — `elicitation.respond` can close a `present_question → request_answer` pending exchange with a freeform answer.  
✓ `respond single-choice test` — `elicitation.respond` can close a `present_options → request_choice` pending exchange with one listed choice and optional comment.  
✓ `respond multi-choice test` — `elicitation.respond` can close a `present_options → request_choices` pending exchange with one-or-more choices and required comment for `other`/`none`.  
✓ `respond guard tests` — mismatched exchange id, invalid choice id, missing required comment, and duplicate response do not append transcript entries.  
✓ `old lightweight loop retired` — public start/respond no longer appends `brunch.elicitation_prompt` / `brunch.elicitation_response` for the deterministic proof path; stale tests are updated or removed.

### Verification Approach

- Inner: RPC handler contract tests and transcript JSONL assertions.
- Middle: projection round-trip tests after each start/respond path prove pending closes through `session.pendingExchange`, `session.elicitationExchanges`, and `session.transcriptDisplay`.
- Outer: none for this card; Card 4 expands to ten turns from a fresh cwd.

### Cross-cutting Obligations

- Preserve D49-L: public clients use Brunch JSON-RPC methods only.
- Preserve D36-L/I22-L: RPC/headless activation uses structured selection state and activation decisions, not TUI picker code.
- Preserve D37-L: do not encode semantic display in `renderCall` or raw extension UI event order.

---

## Card 4 — Add the deterministic ten-turn public-RPC parity proof

**Status:** queued  
**Weight:** full scope card

### Target Behavior

A scripted public Brunch JSON-RPC agent-as-user creates a spec/session from a fresh cwd and completes establishment plus ten structured-exchange elicitation turns with parity assertions over JSONL and projections.

### Boundary Crossings

```text
→ probe/test client over Brunch JSON-RPC handlers or stdio host
→ rpc.discover
→ workspace.selectionState
→ workspace.activate(newSpec)
→ session.startElicitation / session.pendingExchange / elicitation.respond loop
→ Pi JSONL transcript in .brunch/sessions
→ session.transcriptDisplay + session.elicitationExchanges projections
→ parity oracle report
```

### Risks and Assumptions

- RISK: The proof counts handler unit tests as parity without exercising fresh project entry and spec/session creation.
  → MITIGATION: The probe starts from an empty temp cwd and must create a new spec/session through public activation methods before the first elicitation exchange.
- RISK: The ten-turn script overfits one response mode and fails to prove editor-fallback multi-choice semantics.
  → MITIGATION: Fixed script includes at minimum: establishment/framing exchange(s), `present_question → request_answer`, multiple `present_options → request_choice`, and at least one `present_options → request_choices` case that uses the comment-required `other` or `none` path.
- RISK: The proof asserts only method success and misses transcript/projection quality.
  → MITIGATION: Parity oracle checks tool names, exchange ids, present-before-request order, response modes, options/rationales, answers, comments, display rows, exchange spans, and absence of old lightweight public-RPC prompt/response entries.
- ASSUMPTION: Public Brunch RPC can drive at least ten assistant-first structured exchanges without raw Pi RPC, graph persistence, or a parallel prompt/turn store.
  → IMPACT IF FALSE: FE-744 cannot close A23-L and PLAN sequencing should not move to sealed profile/runtime-state yet.
  → VALIDATE: deterministic public-RPC parity test/probe with blocker/friction report.
  → memory/SPEC.md: A5-L, A23-L, D5-L, D37-L, D48-L, D49-L, I23-L, I32-L.

### Tracer-bullet Check

- **Proof of life:** lights up the full public product path from empty cwd to ten answered assistant-first exchanges.
- **Invariants:** proves selected-session activation, linear transcript truth, pending/respond lifecycle, and tuple projection stay coherent together.
- **Uncertainty:** directly attacks A23-L, the active FE-744 risk blocking profile/runtime-state work.

### Acceptance Criteria

✓ `public rpc parity probe` — a deterministic script/test starts from a temp cwd, calls `rpc.discover`, observes selection required, activates `{ action: "newSpec" }`, and obtains a ready spec/session without invoking TUI picker code.  
✓ `ten-turn loop oracle` — the probe completes at least ten structured exchanges through `session.startElicitation`, `session.pendingExchange`, and `elicitation.respond` only.  
✓ `tool coverage oracle` — the resulting transcript includes `present_question`, `request_answer`, `present_options`, `request_choice`, and `request_choices` tuple entries.  
✓ `establishment/framing oracle` — initial system/assistant-generated questions establish enough specification/session kind/framing metadata in transcript text/details to explain why later turns are being asked, without requiring graph persistence.  
✓ `projection parity oracle` — `session.elicitationExchanges` reports ten completed exchanges with prompt and response spans; `session.transcriptDisplay` preserves prompt/question/option/rationale/answer/comment artifacts at TUI-comparable quality.  
✓ `JSONL parity oracle` — every exchange has a recoverable `exchangeId`; each present precedes its matching request; terminal request details contain the correct mode-specific answer payload; no public-proof exchange is represented by `brunch.elicitation_prompt` / `brunch.elicitation_response`.  
✓ `blocker/friction report` — the probe returns a compact scenario report with mission, evaluation focus, max-turn budget, completed turns, and any friction encountered.

### Verification Approach

- Inner: deterministic handler/probe tests for the ten-turn loop and parity oracle.
- Middle: executable probe under `src/probes/` or equivalent Vitest integration test using public Brunch RPC only; JSONL/projection postcondition checker.
- Outer: not required for this card; web real-time observation smoke is the next FE-744 slice after this queue.

### Cross-cutting Obligations

- No graph/data-layer capture is required or expected; transcript/projection is the proof surface for now.
- Do not expose raw Pi RPC/editor fallback as public product API.
- Do not introduce a parallel chat/turn store or durable pending-exchange table.
- Keep the proof deterministic enough to run in `npm run verify` without network/model access.
