# FE-1187 scratchpad confidentiality tracer

Frontier: walkthrough-remediation-2
Status:   active
Mode:     single
Created:  2026-07-14

Posture: proving (inherited from walkthrough-remediation-2)

Orientation:

- Containing seam: foreground elicitor conduct over the session-local D101-L scratchpad.
- Active frontier: FE-1187 walkthrough closure; R11 is reproduced in the actual ingest session JSONL.
- Volatile state: the consolidated outer checkpoint is paused after Session B beats 1–3.
- Main risk: hiding scratchpad state from the model would break planning conduct; the correction must govern user-facing disclosure, not remove provider-visible context.

## Card 1 · Keep scratchpad obligations internal — `in progress`

Implementation checkpoint (2026-07-14): composed live-prompt oracle and carrier-preservation suites pass. R11 authenticated outer re-observation remains human-gated; do not mark this card done until that evidence is recorded.

### Target Behavior

The foreground elicitor keeps scratchpad obligations out of ordinary user-facing summaries.

### Full-card cold-start reads

- `memory/SPEC.md` — D101-L, D102-L; scratchpad current-state contract
- `memory/PLAN.md` — frontier: `walkthrough-remediation-2`
- `TESTING_FINDINGS.md` — R11
- `src/session/TOPOLOGY.md` — scratchpad ownership and authority
- `src/agents/prompts/elicitor.md` — always-on foreground conduct

### Boundary Crossings

```text
session-local scratchpad snapshot
→ provider-visible seed/tool result
→ foreground elicitor reasoning
→ ordinary assistant-facing completion prose
```

### Risks and Assumptions

- RISK: removing scratchpad content from seeds/tool results would make the elicitor forget obligations → MITIGATION: change conduct only; preserve all context and tool-result shapes.
- RISK: a source-substring test proves text exists but not that the live foreground agent receives it → MITIGATION: bind the inner oracle to composed live-prompt output, then retain R11 as the outer adherence oracle.
- ASSUMPTION: an explicit always-on confidentiality rule is sufficient to suppress routine enumeration while allowing a user-requested summary.
  → IMPACT IF FALSE: prompt-only control is insufficient and the product needs a projection/redaction or presentation seam; that would reshape later work.
  → VALIDATE: one post-build authenticated ingest run with several scratchpad updates, judged against R11.

### Posture check

Retires a load-bearing uncertainty: whether conduct guidance is enough to keep an internal planning carrier from leaking into ordinary product prose without depriving the model of it. The slice preserves the real context path and makes the live walkthrough the falsifying oracle.

### Acceptance Criteria

- ✓ `src/agents/runtime/elicitor/__tests__/compose-live-prompt.test.ts` — the composed foreground elicitor prompt says scratchpad obligations are private working state, forbids routine enumeration in user-facing prose, and permits disclosure only when the user explicitly asks for them.
- ✓ existing origination/spec-context scratchpad tests — full scratchpad state remains provider-visible and no storage/projection shape changes.
- ✓ `TESTING_FINDINGS.md` R11 outer re-observation — after multiple scratchpad updates, the assistant gives a user-facing completion summary without listing obligation ids/text; an explicit user request can still retrieve a summary.

### Invariants preserved

- D101-L session-local scratchpad remains the elicitor's planning carrier — guarded by: `src/session/__tests__/elicitation-scratchpad.test.ts`.
- D102-L seed/context assembly still includes current scratchpad state — guarded by: `src/agents/contexts/seeds/__tests__/origination.test.ts` and `turn-context.test.ts`.
- Debug/thinking evidence may expose internal reasoning; ordinary user-facing prose may not enumerate it absent a request — guarded by: composed-prompt test plus R11 outer beat.

### Verification Approach

- Inner: composed live-prompt consumer test proves the active foreground agent receives the confidentiality rule.
- Middle: existing context/scratchpad suites prove no carrier or authority regression.
- Outer: one authenticated ingest run reproducing the four-obligation shape from R11; this card owns the ledger disposition.

### Cross-cutting obligations

- No redaction or second scratchpad projection in this slice.
- No graph authority for scratchpad items; they remain non-authoritative session state.
- If the outer oracle still leaks obligations, stop and route through `ln-design` rather than stacking more prompt text.

### Expected touched paths (tentative)

```text
src/agents/prompts/
└── elicitor.md                                      ~
src/agents/runtime/elicitor/__tests__/
└── compose-live-prompt.test.ts                      ~
TESTING_FINDINGS.md                                  ~
```
