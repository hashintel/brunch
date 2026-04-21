# Track A — Scope Cards

## Card 1: Turn-internal grounding cards — server-side flow [status: done]

### Target Behavior

A brownfield grounding turn produces both a grounding card and a question card within one turn lifecycle, the observer captures from the full validated unit (grounding context + question + user response), and the interviewer context renders both artifacts for stacked turns in conversation history.

### Boundary Crossings

```
→ Brownfield grounding prompts (src/server/interview.ts) — instruct model to call present_grounding_card then ask_question within the same turn
→ Observer skip logic (src/server/app.ts) — allow observer to run on turns that have both grounding card AND question+answer
→ Observer context (src/server/context.ts buildObserverContext) — include grounding card content for the observed turn
→ Interviewer context (src/server/context.ts buildInterviewerContext) — render both grounding card and question for stacked turns in history
→ Persistence round-trip (verified via existing projector tests) — no changes needed, materializeTurnArtifacts already handles both parts
```

### Risks and Assumptions

```
- RISK: LLM may not reliably call both tools in sequence within one turn → MITIGATION: Explicit prompt instruction + the ToolLoopAgent allows multi-step tool use within one agent turn. step count limit (12 for brownfield) provides enough headroom.
- ASSUMPTION: The present_grounding_card tool already creates a "Continue" option at position 0, and ask_question persists the structured question — both writing to the same turn. When both tools fire, the turn will have both a grounding card in assistant_parts and question/options from ask_question, which is exactly what the client projector expects for persisted-grounding-question. → VALIDATE: Existing projector test 'projects a stacked grounding-question artifact' confirms the rendering path.
- ASSUMPTION: ToolLoopAgent continues executing within the same turn after present_grounding_card returns, allowing ask_question to be called next. → VALIDATE: AI SDK ToolLoopAgent is designed for multi-tool sequential execution within one stream turn.
```

### Acceptance Criteria

```
✓ brownfield-opening-prompt — opening brownfield prompt instructs model to call present_grounding_card followed by ask_question within the same turn
✓ brownfield-ongoing-prompt — ongoing brownfield prompt instructs model to call present_grounding_card followed by ask_question when context gathering is needed
✓ observer-runs-on-stacked-turns — observer runs on turns that have both a grounding card and a completed question+answer, capturing the full validated unit
✓ observer-context-includes-grounding — buildObserverContext includes grounding card content when the observed turn carries one
✓ interviewer-context-stacked-turns — buildInterviewerContext renders both grounding card and question for stacked turns in history, not just the grounding card
✓ npm-run-verify — all existing tests pass and the build succeeds
```

### Verification Approach

```
- Inner: npm run verify (unit tests + type check + build)
- Middle: unit tests for context builders confirming stacked turn rendering
- Outer: manual brownfield walkthrough (deferred to brownfield-workspace-analysis-grounding-brief frontier item)
```

### Traceability

D83, D89, D91, D99, D112, D117; A56, A61; Requirements 20, 21, 28.

---

## Card 2: Review per-item commenting — schema and payload [status: done]

This is the first sub-slice of the "Review per-item commenting and regeneration" frontier item. It establishes the data model for per-item comments without yet building the full UI or iterative regeneration.

### Target Behavior

The review set schema, structured turn response, and review submission flow support per-item comments as an array of `{ itemIndex, comment }` entries alongside the existing global review note, and the interviewer prompt for review phases instructs the model to interpret per-item comments as targeted change requests on regeneration.

### Boundary Crossings

```
→ Review set item schema (src/shared/chat.ts) — no changes needed, items already have structure
→ Turn response schema (src/shared/chat.ts dataTurnResponseSchema) — add optional itemComments array
→ Review submission flow (src/server/app.ts) — pass per-item comments through to the interviewer context on request-changes
→ Interviewer prompt (src/server/interview.ts) — instruct model to use per-item comments as targeted change requests
→ Interviewer context (src/server/context.ts) — include per-item comments in the context for successor review turns
```

### Risks and Assumptions

```
- RISK: Adding itemComments to the turn response schema may affect existing submission paths → MITIGATION: The field is optional; existing submissions without it continue to work.
- ASSUMPTION: Per-item comments use itemIndex (position in the review set items array) as the key, which is stable within a single review set revision. → VALIDATE: Review set items have stable positions within one revision; cross-revision stability comes from referenceCode, not index.
```

### Acceptance Criteria

```
✓ schema-accepts-item-comments — dataTurnResponseSchema accepts optional itemComments: Array<{ itemIndex: number, comment: string }>
✓ schema-rejects-invalid — schema rejects malformed itemComments (missing fields, negative index)
✓ existing-submissions-unchanged — existing review submissions without itemComments continue to work
✓ npm-run-verify — all existing tests pass and the build succeeds
```

### Verification Approach

```
- Inner: npm run verify (unit tests + type check + build)
```

### Traceability

D90, D118, D119; A61, A62; Requirements 11, 12, 25.

---

## Card 3: Review per-item commenting — interviewer context for change requests [status: next]

### Objective

When a user submits `request-changes` with per-item comments, the interviewer context for the successor review turn includes the per-item comments alongside the global review note so the model can produce a targeted regeneration.

### Acceptance Criteria

```
✓ interviewer-context-includes-item-comments — buildInterviewerContext formats per-item comments from the previous review turn's user_parts for the successor review turn
✓ review-prompt-instructs-per-item — requirements and criteria system prompts instruct the model to interpret per-item comments as targeted change requests (uncommented items are implicitly approved)
✓ npm-run-verify — all existing tests pass and the build succeeds
```

### Verification Approach

```
- Inner: npm run verify (unit tests + type check + build)
- Middle: unit test for context builder confirming per-item comment formatting
```

### Traceability

D90, D118, D119; A62; Requirements 11, 12, 25.

---

## Card 4: Review set UI — per-item comment toggles [status: next]

### Objective

Each review set item has an inline comment toggle; when expanded, the user can type a comment. The comments are included in the structured submission payload as `itemComments` when the user selects `Request changes`.

### Acceptance Criteria

```
✓ per-item-toggle-renders — each review set item renders an inline comment toggle
✓ comments-included-in-submission — selecting request-changes sends itemComments in the data-turn-response payload
✓ accept-omits-comments — selecting accept does not include itemComments
✓ npm-run-verify — all existing tests pass and the build succeeds
```

### Verification Approach

```
- Inner: npm run verify
- Outer: manual review walkthrough (deferred)
```

### Traceability

D90, D118, D119; A61, A62; Requirements 11, 12, 25.
