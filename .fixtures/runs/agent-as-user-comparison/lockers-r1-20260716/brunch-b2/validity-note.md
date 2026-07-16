# brunch-b2 — validity note

**Status: COMPLETE, valid with one declared deviation (reveal-count accounting).**

## Outcome

The lane produced a target-authored ready document from settled graph state:
`final-document.md` (4534 bytes), acquired via the frozen
`document-export` seam (spec-id 1) after the target reported 16 committed nodes. No
transcript reconstruction occurred; the actor only transported the exported file.
Completed in ~12.5 of 20 budget minutes, 5 of 8 target turns, zero takeovers.

## Declared deviation — reveal-count accounting

The packet budgets 3 qualifying questions. The target's single unprompted grounding
questionnaire contained sub-questions that directly matched **four** reveal facts
(`ils-integration`, `pilot-scale`, `auth-method`, `hold-window`); the actor answered
the questionnaire in one visible response and disclosed all four. Reading: the packet
counts qualifying *questions* (3 asked: users / flow / constraints) rather than facts,
under which the lane is within budget; under a strict facts-revealed reading it is one
over. The ambiguity is a mission-packet format finding (question-count vs fact-count
semantics), recorded for the handover. **Cross-lane fairness rule adopted:** the
Claude and Cursor lanes get the identical treatment — a grounding question matching
multiple reveal conditions receives all matched facts in one response. Matched budget
therefore remains matched in practice.

## Other notes

- Target-internal `TOOL_INPUT_INVALID` errors (ask tool: `acceptsDigest`,
  `exchangeId`) occurred twice around the draft-confirmation exchange; the target
  recovered autonomously both times. Recorded as a Brunch-side diagnostic observation
  (also seen in brunch-b1); it cost the target time inside its own budget and no actor
  compensation was given.
- The target proactively surfaced two consequential gaps (staff loading workflow,
  capacity overflow) that the mission intentionally leaves open; the actor supplied
  mission-conform non-answers and the document records all four unknowns (UNK1–UNK4)
  as open uncertainty rather than invented policy.
- The document was NOT written by the TUI into the target cwd before session close;
  the confirm exchange settled the graph and the export seam produced the file. This
  matches the manifest's Brunch acquisition rule exactly.
- Standing equivalence caveat (manifest): one delegated session is controller+actor
  for all lanes; sequential lanes, no cross-lane content carryover.
