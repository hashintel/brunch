# Track B — Scope Cards

- Containing seam: center-pane phase header action for non-review phase closure, backed by the shared `phase-close` command model and server-side workflow validation.
- Frontier item: `Close Phase confirmation modal` from `memory/PLAN.md` Active Track B.
- Volatile state: the current UI submits `force-close-active-phase` immediately from the header and the shared close-action helper still rejects grounding as an unsupported force-close phase.
- Main open risk: extending the close action from design-only to grounding + design must preserve the existing closeability/proposal-pending gating and stay out of review-phase closure behavior.

## Card 1: Close Phase confirmation modal for non-review phases [status: done]

### Target Behavior

In-progress non-review phases show a confirmation modal before header-driven phase close, with readiness and turn-count context, and confirming the modal submits the existing typed close command only when the current phase is closeable under the shared rules.

### Boundary Crossings

```
→ Center-pane header action (`src/client/routes/specification/$id/_view/-interview-view.tsx`) — render the close affordance for closeable grounding/design phases and open a confirmation modal instead of submitting immediately
→ Interview controller (`src/client/routes/specification/$id/_view/-interview-controller.ts`) — keep typed confirmation submission on explicit modal confirm
→ Shared close-action projection (`src/shared/phase-close.ts`) — allow non-review active phases to use the existing force-close command when closeable and no proposal is pending
→ Server chat validation (`src/server/app.ts`) — continue enforcing shared closeability/proposal-pending rules for grounding/design confirmation payloads
```

### Risks and Assumptions

```
- RISK: The current design-only restriction in `src/shared/phase-close.ts` may reflect an intentional unfinished slice rather than a pure UI gap. → MITIGATION: Keep the change tightly scoped to grounding + design only, matching the current plan acceptance for non-review phases and leaving review closure untouched.
- ASSUMPTION: Existing closeability already models the intended gating for grounding/design (`hasTurnHistory`) and can be reused for the modal without new workflow rules. → VALIDATE: Unit tests for `getForceClosePhaseAction` and UI tests for button/modal visibility across closeable and non-closeable states.
```

### Acceptance Criteria

```
✓ close-button-visible-for-closeable-grounding-and-design — the header close action appears only for closeable in-progress grounding/design phases with no pending proposal
✓ modal-shows-readiness-and-turn-context — clicking Close Phase opens a confirmation modal that names the phase and shows readiness plus current turn count
✓ reject-keeps-phase-open — cancelling the modal closes it without sending a confirmation payload
✓ confirm-sends-typed-command — confirming the modal submits the existing `force-close-active-phase` confirmation payload for the active grounding/design phase
✓ review-phases-unchanged — requirements/criteria continue to use their existing review/proposal affordances and never surface this header modal path
✓ npm-run-verify — `npm run verify` passes
```

### Verification Approach

```
- Inner: `npm run fix`; `npm run verify`
- Middle: client/shared tests covering visibility, modal content, cancel/confirm behavior, and grounding/design gating
- Outer: manual close / reject / confirm walkthroughs on grounding and elicitation phases
```

### Traceability

D104, D65, D66; I72.
