# Cancelled-exchange legibility — self-describing terminals + standalone-cancel guidance

Frontier: walkthrough-remediation-2
Status:   active
Mode:     slices
Created:  2026-07-13

Posture: proving (inherited from walkthrough-remediation-2)

Two light cards over settled seams, from the 2026-07-13 Session B walkthrough
finding (cancelled ask rendered `_User cancelled._` in the exact visual slot an
answered ask uses for its comment) and the user's design reframing:

1. With the encapsulated `ask` tool the whole question/answer exchange lives in
   one tool result, so a cancelled invocation can emit **self-describing
   content**: the question was posed and the user declined — to be read as
   "the user wants to change direction or give free-text input." This content
   is double-duty: transcript rendering *and* model context for the next turn.
2. The TOPOLOGY line "standalone ask cancellation is terminal and does not
   promise recovery" refers to the **recovery scan** (system capability:
   regenerating an interrupted `present_* + ask` tuple via `/brunch:continue`).
   It says nothing about user guidance. A standalone cancel currently leaves no
   status line at all — the same "nothing actionable" experience WR18 O4 named,
   on a different path. These are separate concerns; fixing one does not touch
   the other.

## Card 1 · Self-describing cancelled terminals across the exchange family — `done`

### Objective

A cancelled exchange terminal states what happened and how to interpret it —
visually distinct from an answered ask's comment, and steering the agent's
next turn ("user declined; likely wants a different direction or free-text
input") — swept across the whole request-response family, not just `ask`.

### Light-card cold-start reads

```
- memory/SPEC.md   — D119-L (continue/wait lexicon), exchange-protocol decisions
- src/agents/contexts/exchanges/ask.ts — cancelled branch (line ~49): bare
  italic fallback `_User cancelled._`, same shape/slot as the answered comment
- src/agents/contexts/exchanges/option-echo.ts — formatResponseTerminal (the
  shared bare-italic helper the family funnels through)
- src/agents/contexts/exchanges/design-permutations.md — "cancelled should
  whisper" note (line ~698); the new copy stays quiet but must not mimic a
  comment
- testing session evidence: workspace-alpha-grounding session
  2026-07-13T14-28-00-400Z (details carry clean `"cancelled": {}`; the string
  never exists in data — it is render-time)
```

### Design constraints (settled 2026-07-13, do not re-litigate)

```
- The cancelled terminal is a labeled statement, not a bare italic that shares
  the comment slot (e.g. a `**Cancelled** — …` line; exact copy at build).
- Ask copy carries the interpretation: question posed, user declined — read as
  wanting to change direction or reply in free text.
- Review-family copy adapts the same rule to review semantics (declined to
  review), keeping the distinct-from-comment shape.
- `present_* + ask` tuples stay coherent: present content stands alone; the
  cancelled ask notes only that the question half was declined.
- Content is model-facing: the new copy is what the agent reads next turn.
  Keep it one or two lines — steering, not essay.
```

### Acceptance Criteria

```
✓ src/agents/contexts/exchanges/ask.ts — cancelled branch emits the labeled
  self-describing terminal; no bare-italic fallback remains
✓ request-response family (answer.ts, choice.ts, choices.ts, review.ts) — the
  cancelled path uses the same labeled rule (shared helper reshaped in
  option-echo.ts or a dedicated cancelled-terminal helper; builder's call,
  prefer the deep-module option)
✓ snapshots regenerated and reviewed — ask-tuples.md, question-tuples.md,
  review-set-tuples.md, digest-tuples.md show the new terminal; no snapshot
  shows an italic-only cancelled line that could read as a comment
✓ honesty/permutation tests (present-question-honesty, present-review-set,
  present-digest, ask.test.ts) green with the new shape
✓ gate — `npm run verify` green
```

### Verification Approach

```
- Inner: formatter unit tests + regenerated context-surface snapshots
  (test:context-surfaces — review the diff, do not blind-update)
- Outer: next walkthrough re-runs the cancel-an-ask beat; owned by this card,
  record in TESTING_FINDINGS.md
```

### Expected touched paths (tentative)

```
src/agents/contexts/exchanges/ask.ts                     ~
src/agents/contexts/exchanges/option-echo.ts             ~
src/agents/contexts/exchanges/request-response/answer.ts ~
src/agents/contexts/exchanges/request-response/choice.ts ~
src/agents/contexts/exchanges/request-response/choices.ts ~
src/agents/contexts/exchanges/request-response/review.ts ~
src/agents/contexts/exchanges/__tests__/                 ~   (ask, honesty, review-set, digest)
src/agents/contexts/exchanges/__snapshots__/             ~   (four tuple files)
src/agents/contexts/exchanges/design-permutations.md     ~?  (if the cancelled examples are shown)
```

## Card 2 · Standalone-cancel user guidance + recovery-lexicon disambiguation — `next`

### Objective

Cancelling a **standalone** ask surfaces user guidance naming `/brunch:consult`
and `/brunch:mode` (pointedly *not* `/brunch:continue` — there is no
interrupted tuple to regenerate), while the exchange remains terminal for the
recovery scan. The TOPOLOGY prose separates the two meanings of "recovery" so
the next reader does not conflate system capability with user guidance.

### Light-card cold-start reads

```
- src/.pi/extensions/exchanges/TOPOLOGY.md (~lines 36–40) — the
  "standalone ask cancellation is terminal and does not promise recovery"
  sentence to be disambiguated
- src/.pi/extensions/exchanges/ask.ts — standalone terminal path (currently
  sets no status on cancel)
- src/.pi/extensions/exchanges/ask/continuation.ts — surfaceContinueHint /
  clearContinueHint (the declared-continuation hint lifecycle; the standalone
  variant is a sibling, not a reuse — different command set, different key or
  copy)
- src/exchanges/recovery.ts — the recovery scan (unchanged; standalone asks
  stay out of it)
```

### Design constraints (settled 2026-07-13)

```
- Recovery scan behavior is unchanged: standalone cancels stay terminal;
  declared-continuation semantics untouched.
- Standalone guidance names /brunch:consult and /brunch:mode only. Never
  promise /brunch:continue for a standalone ask.
- Hint lifecycle mirrors the continuation collector's discipline: surface on
  cancel, clear on the next answered collection (or the equivalent natural
  clearing point the collector already owns).
```

### Acceptance Criteria

```
✓ standalone ask cancel sets a status/notification naming /brunch:consult and
  /brunch:mode; answered standalone ask does not — asserted in the ask/
  exchanges test home (exchanges-present-request.test.ts or ask tests)
✓ declared-continuation hint behavior unchanged (existing three-command hint
  tests stay green untouched)
✓ src/.pi/extensions/exchanges/TOPOLOGY.md — "recovery" disambiguated: the
  scan (regeneration capability, declared continuations only) vs user guidance
  (both cancel paths now surface next-step commands); current behavior stated
✓ gate — `npm run verify` green
```

### Verification Approach

```
- Inner: collector lifecycle tests (standalone cancel → guidance, answered →
  cleared; continuation path unchanged)
- Outer: next walkthrough cancels a standalone ask and checks the guidance is
  noticeable; owned by this card, record in TESTING_FINDINGS.md
```

### Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/ask.ts              ~   (standalone terminal path)
src/.pi/extensions/exchanges/ask/continuation.ts ~?  (if the hint helpers generalize)
src/.pi/extensions/exchanges/TOPOLOGY.md         ~   (recovery-lexicon disambiguation)
src/.pi/extensions/__tests__/                    ~   (exchanges-present-request / ask tests)
```
