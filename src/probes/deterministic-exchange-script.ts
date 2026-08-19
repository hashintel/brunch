/**
 * Deterministic structured-exchange permutation script — probe/dev machinery.
 *
 * Relocated out of product origination (D78-L/D49-L revised 2026-06-12): the
 * product never fabricates a `present_*` offer — the assistant authors
 * openings live from seeded graph facts and the session-local elicitation
 * scratchpad. What survives here is the *sequencing* script only: the ordered
 * permutation set (single-select / text / multi-select) that exchange tests
 * cycle through. Its consumer is
 * `src/session/__tests__/structured-exchange-loop.test.ts`.
 *
 * This module mints nothing. The synthetic call+result writers that used to
 * fabricate `present_question` pairs into a session file were deleted
 * (FE-1311) once FE-1187 (`c3ee4ebc1`, "Retire legacy question read paths")
 * rewired both consumers away: `public-rpc-parity-proof.ts` now mints its own
 * pair in the active `present_candidates` grammar, and the `handlers.test.ts`
 * helper went with it. Do not reintroduce a minting helper here — a probe that
 * needs a synthetic pair builds it against the active exchange grammar at its
 * own call site, next to the assertions that depend on its shape.
 *
 * Never import this from product code.
 */

import type { PendingStructuredExchange } from '../session/structured-exchange-loop.js';

export function nextDeterministicStructuredExchange(completedCount: number): PendingStructuredExchange {
  const turnNumber = completedCount + 1;
  const script: PendingStructuredExchange[] = [
    {
      exchangeId: `deterministic-grounding-choice-${turnNumber}`,
      lens: 'intent',
      mode: 'single-select',
      prompt: 'Is this a new product or feature from scratch?',
      details: 'Choose the best starting context so later elicitation can ask useful follow-ups.',
      options: [
        {
          id: 'new-from-scratch',
          label: 'Yes — this is new from scratch',
          content: 'Start a new spec workspace from a blank slate.',
          rationale: 'This keeps the parity run focused on initial grounding.',
        },
        {
          id: 'existing-codebase',
          label: 'No — this builds on existing code',
          content: 'Ground the spec in existing implementation constraints.',
          rationale: 'Existing code changes what the elicitor should inspect next.',
        },
        {
          id: 'relates-to-existing-spec',
          label: 'It relates to an existing spec',
          content: 'Connect this work to a prior specification thread.',
          rationale: 'Continuity matters when prior graph intent exists.',
        },
      ],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-text-${turnNumber}`,
      lens: 'intent',
      mode: 'text',
      prompt: 'What are we specifying?',
      details:
        "This covers the text-answer permutation in Brunch's deterministic public-RPC structured-exchange parity proof.",
      options: [],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-multi-${turnNumber}`,
      lens: 'intent',
      mode: 'multi-select',
      prompt: 'Which proof qualities matter for this parity run?',
      details:
        'Select all qualities the deterministic structured-exchange permutation proof should preserve.',
      options: [
        {
          id: 'transcript',
          label: 'Transcript fidelity',
          content: 'Pi JSONL keeps every present/request tuple recoverable.',
          rationale: 'The transcript is the durable source of truth.',
        },
        {
          id: 'projection',
          label: 'Projection fidelity',
          content: 'Brunch projections preserve semantic option artifacts.',
          rationale: 'Public clients depend on projected structured exchange data.',
        },
        {
          id: 'other',
          label: 'Other',
          content: 'Another proof quality should be captured in the note.',
          rationale: 'Other requires a comment so the transcript stays explicit.',
        },
        {
          id: 'none',
          label: 'None',
          content: 'No additional proof qualities matter for this run.',
          rationale: 'None requires a comment to avoid silent dismissal.',
        },
      ],
      note: { allowed: true },
    },
  ];
  return script[completedCount % script.length]!;
}
