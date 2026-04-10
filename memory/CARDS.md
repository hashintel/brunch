<!-- CARDS.md — temporary scoped-card working document.
     Authority: none. Derivative of PLAN.md for active implementation convenience.
     Create when pre-scoping several near-term slices saves time; retire once these cards are built or superseded.
     Current intent: pre-scope Slice 10 tracer bullets without introducing a permanent third planning document. -->

# Cards

## Scope Card — `10.1` Criteria grounding + first synthesis/review loop

### Target Behavior
After requirements closes, the first prepared criteria turn is grounded in the approved requirement set and can round-trip one initial criterion through the existing seams without dropping out of `criteria` mode.

### Boundary Crossings
```text
→ requirements phase is confirmed closed from slice 9.5, with criteria now the active phase
→ next prepared turn / /chat invocation selects `phase: 'criteria'`
→ interviewer context injects the approved requirement inventory (and any existing criterion inventory)
→ criteria-mode interviewer emits a criteria-shaped question rather than a generic follow-up
→ user replies through the existing turn-response seam
→ observer persists one criterion through the generic knowledge seam
→ workflow remains `criteria` / `in_progress` and entities projection exposes the new criterion
```

### Risks and Assumptions
- **RISK:** Criteria mode may technically activate but still receive weak or stale grounding, producing a generic follow-up instead of a verification-oriented question.
  - **MITIGATION:** Lock both artifacts independently: approved-requirement inventory reaching the interviewer seam and the emitted turn remaining criteria-shaped.

- **RISK:** The first criterion round-trip could accidentally widen into explicit criterion review-state or closeability work.
  - **MITIGATION:** Keep this slice synthesis-thin: prove one first criterion can emerge and persist; defer approve/reject/closeability to `10.2`.

- **RISK:** Criteria grounding may include rejected or otherwise out-of-scope requirements rather than the reviewed active set.
  - **MITIGATION:** Assert approved-requirement grounding specifically, not just generic requirement inventory presence.

- **ASSUMPTION:** The criteria interviewer can be usefully grounded by the approved requirement inventory plus any earlier criterion-like signals without first introducing a dedicated criteria workspace.
  - **VALIDATE:** criteria context/prompt tests and one criterion persistence round-trip stay coherent.
  - → existing `SPEC.md` assumptions/decisions already cover this (`A28`, `A40`, `D25`, `D55`, `D56`, `D71`)

### Acceptance Criteria
```text
✓ src/server/context.test.ts or src/server/interview.test.ts — criteria-mode interviewer context includes the approved requirement inventory (not just prior chat history)
✓ src/server/app.test.ts — the first post-9.5 /chat turn runs the interviewer and observer with `phase: 'criteria'` and emits a criteria-shaped question rather than a generic follow-up
✓ src/server/app.test.ts or src/server/db.test.ts — one initial criterion can round-trip through criteria-mode reply → observer persistence → entities projection while criteria remains `in_progress`
```

### Verification Approach
- **Inner:** fast unit tests — proves criteria context/prompt grounding and criteria-mode phase selection.
- **Middle:** round-trip oracle (criteria synthesis) — approved requirements → criteria turn → observer-created criterion → entities projection with no drift.
- **Outer:** manual walkthrough — finish requirements, enter criteria, verify the first criteria question feels tied to the reviewed requirement set.

### Traceability
- **PLAN:** Slice `10.1`
- **SPEC requirements:** `#6`, `#8`, `#12`
- **SPEC assumptions:** `A28`, `A40`
- **SPEC decisions:** `D25`, `D55`, `D56`, `D71`
- **Invariants to respect:** `I18`, `I19`, `I21`, `I24`, `I95`, `I96`
- **Deferred to later cards:** explicit per-criterion review state, criteria closeability, final criteria closure

---

## Scope Card — `10.2` Explicit criterion review state + minimal closeability

### Target Behavior
Criteria review can persist explicit per-criterion positive/non-positive review state, project `approved` / `rejected` / `pending` status from the active path, and mark criteria closeable only when no current criterion remains pending.

### Boundary Crossings
```text
→ criteria mode has a current criterion set on the active path
→ interviewer emits a targeted criteria-review turn carrying explicit criterion review metadata
→ user responds through the existing turn-response seam
→ response handling records durable active-path criterion review linkage
→ entities / sidebar read model projects `approved` / `rejected` / `pending` criterion state from the latest explicit review action
→ workflow projection computes criteria `closeability: true` only when every current criterion has non-pending review state
```

### Risks and Assumptions
- **RISK:** Repeating the slice-9 pattern too literally could split criterion approval, rejection, and closeability into separate tracer bullets that do not unblock the app.
  - **MITIGATION:** Bundle the minimum useful criterion lifecycle into one slice: explicit positive action, explicit non-positive action, latest-action projection, and deterministic closeability.

- **RISK:** Criterion review semantics may diverge from requirement review enough that reusing the same metadata/linkage seam becomes awkward.
  - **MITIGATION:** Keep the first seam narrow and structural; defer edit/merge/split/stale semantics to `13a`.

- **RISK:** Criteria closeability could accidentally widen into richer coverage logic such as "every approved requirement must have N criteria" before the thin end-to-end path is working.
  - **MITIGATION:** Start with the same deterministic minimum-bar approach as earlier phases: current criterion set has no pending explicit review state.

- **ASSUMPTION:** The first explicit criterion review seam can reuse the same targeted-review + active-path link pattern already proven for requirements.
  - **VALIDATE:** targeted criterion review round-trip and latest-action projection pass without introducing a separate mutation path.
  - → likely SPEC follow-on from existing seams (`A15`, `A28`, `D24`, `D61`, `D65`, `D66`, `D70`)

### Acceptance Criteria
```text
✓ src/shared/chat.ts or src/server/interview.test.ts — criteria review metadata validates targeted criterion review actions through the existing structured question seam
✓ src/server/app.test.ts — one explicit positive criterion review action and one explicit non-positive criterion review action persist through the response seam and project correctly in entities/sidebar state
✓ src/server/db.test.ts — criterion review projection resolves `approved` / `rejected` / `pending` from the latest explicit active-path action
✓ src/server/db.test.ts — criteria becomes closeable only when every current criterion has explicit non-pending review state
```

### Verification Approach
- **Inner:** fast unit tests — proves criterion review metadata, read-model projection, and closeability rule.
- **Middle:** round-trip oracle (criteria review) — targeted review metadata → response submit → durable review linkage → projected criterion state with no drift.
- **Middle:** model-based lifecycle oracle (criteria review) — criteria remains `in_progress` until all current criteria are explicitly reviewed.
- **Outer:** manual walkthrough — confirm the thin approve/reject semantics are legible enough to keep moving toward completed workflow.

### Traceability
- **PLAN:** Slice `10.2`
- **SPEC requirements:** `#7`, `#8`, `#12`, `#13`
- **SPEC assumptions:** `A15`, `A28`
- **SPEC decisions:** `D24`, `D61`, `D65`, `D66`, `D70`
- **Invariants to respect:** `I18`, `I21`, `I24`, `I62`, `I63`, `I96`
- **Deferred to later cards:** criterion edit/add/merge/split flows, richer requirement↔criterion coverage logic, stale review invalidation

---

## Scope Card — `10.3` Criteria closure + completed workflow state

### Target Behavior
Once criteria is closeable, the shared phase-close seam can propose and confirm final criteria closure, leaving workflow with all phases closed and no stale active interviewer phase before export.

### Boundary Crossings
```text
→ criteria phase is active and closeable after 10.2
→ interviewer emits `propose_phase_closure` for `criteria`
→ `/chat` streams `data-phase-summary` and persists a proposed criteria `phase_outcome`
→ user confirms the proposed criteria closure through `data-confirmation`
→ `phase_outcome` persistence confirms the final criteria outcome with durable closure basis
→ workflow projection marks criteria `closed` and projects no remaining active phase
→ next app/project state reads as interview-complete rather than reopening stale criteria mode
```

### Risks and Assumptions
- **RISK:** The current server-side "first unclosed phase or `criteria` fallback" behavior may fabricate an active criteria phase even after final closure.
  - **MITIGATION:** Lock completed-workflow projection explicitly and treat "all phases closed" as its own tested structural state.

- **RISK:** Final-phase closure could widen into export gating, dashboard polish, or force-close variants.
  - **MITIGATION:** Keep this slice about closure mechanics only: proposed final close, confirmation, and completed workflow projection. Leave export/dashboard concerns to slices `11a` and `13`.

- **RISK:** Criteria closure may be implemented correctly in persistence but fail to suppress stale interviewer activity on the next app interaction.
  - **MITIGATION:** Add an app/core assertion that post-confirmation state has no remaining active interview phase before export.

- **ASSUMPTION:** The shared phase-close transport used for scope, design, and requirements can close the terminal `criteria` phase without a criteria-specific mutation path.
  - **VALIDATE:** proposal/confirmation round-trip persists and projects a completed workflow state through the same seam.
  - → existing `SPEC.md` assumptions/decisions already cover this (`A15`, `A28`, `D65`, `D66`, `D71`)

### Acceptance Criteria
```text
✓ src/server/app.test.ts — criteria can emit a shared `data-phase-summary` proposal and persist a proposed final `phase_outcome`
✓ src/server/db.test.ts or src/server/app.test.ts — confirming the proposed criteria outcome closes criteria with durable closure provenance and leaves all workflow phases closed
✓ src/server/core.test.ts or src/server/app.test.ts — post-confirmation app state projects no stale active interviewer phase before export rather than reopening `criteria`
```

### Verification Approach
- **Inner:** fast unit/integration tests — proves final-phase proposal/confirmation persistence and completed-workflow projection.
- **Middle:** round-trip oracle (phase outcome) — criteria proposal → confirmation → confirmed final `phase_outcome` → completed workflow state with no drift.
- **Outer:** manual walkthrough — complete the interview, confirm final criteria closure, and verify the app feels done before export-specific polish lands.

### Traceability
- **PLAN:** Slice `10.3`
- **SPEC requirements:** `#7`, `#8`, `#13`
- **SPEC assumptions:** `A15`, `A28`
- **SPEC decisions:** `D65`, `D66`, `D71`
- **Invariants to respect:** `I18`, `I24`, `I96`
- **Deferred to later cards:** export predicate details, dashboard summarization, low-readiness/forced-close variants if they prove necessary later
