/**
 * Text rendering for the session orientation choice
 * (`session/session-orientation.ts`) in the context-seed payload. Pure
 * formatting only — no reads. Each §Choice schema id maps to one distinct
 * opening-turn directive; omitting the section (rather than rendering a
 * blank one) is the caller's job when no fresh choice exists.
 */

import type { SessionOrientationChoice } from '../../../session/session-orientation.js';

const ORIENTATION_DIRECTIVES: Record<SessionOrientationChoice, string> = {
  continue: 'Continue the thread in your own judgment; no directed opening move was chosen.',
  elicit_decisions:
    'Open by asking decision-driven questions (grill-style) that surface choices under uncertainty.',
  elicit_examples:
    'Open by asking example-driven questions (disambiguate-style) that ground ambiguity in concrete cases.',
  propose_intent: 'Open by proposing candidate spec/intent designs for the user to react to.',
  propose_design: 'Open by proposing candidate technical designs for the user to react to.',
  propose_oracle: 'Open by proposing candidate verification/oracle designs for the user to react to.',
  ingest: 'Open by ingesting the source material the user has provided before asking anything else.',
  proceed:
    'Open with a readiness assessment over the seeded graph, facts, and scratchpad; name the next safe execution step before acting.',
  backfill:
    'Accept the user’s desired execution move, then backfill missing information in CODE mode with targeted questions before acting.',
  design_first:
    'Open by designing the technical approach first; route through propose/project:design conduct before execution.',
  oracle_first:
    'Open by designing the verification approach first; route through propose/project:oracle conduct before execution.',
  project_plan:
    'Open by projecting a frontier-level plan at D103-L depth, then proceed only to the next safe execution step.',
};

export function formatSessionOrientationSeed(choice: SessionOrientationChoice): string {
  return `SESSION ORIENTATION\n- chosen: ${choice}\n- directive: ${ORIENTATION_DIRECTIVES[choice]}`;
}
