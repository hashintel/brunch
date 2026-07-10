/**
 * Text rendering for the session orientation choice
 * (`session/session-orientation.ts`) in the context-seed payload. Pure
 * formatting only — no reads. Each §Choice schema id maps to one distinct
 * opening-turn directive; omitting the section (rather than rendering a
 * blank one) is the caller's job when no fresh choice exists.
 */

import type { SessionOrientationDirectiveChoice } from '../../../session/session-orientation.js';

// `dismissed` is deliberately absent: an escaped menu is inert and never
// renders an orientation section (the caller omits the section instead).
const ORIENTATION_DIRECTIVES: Record<SessionOrientationDirectiveChoice, string> = {
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
    'Accept the user’s desired execution move, then backfill missing information in Execute mode with targeted questions before acting.',
  prepare_execution:
    'Open by assessing design, oracle, and commitment evidence; recommend one next preparation path and obtain structured user confirmation before beginning it.',
  compile_plan:
    'Open by assessing plan-compilation readiness across design, oracle, and commitment sufficiency; name concrete gaps, then offer compile-now versus backfill-first.',
  execute_plan:
    'Open by validating that the compiled plan is fresh and executable; if valid, begin only the next safe scoped unit, and otherwise route to compilation or backfill.',
};

export function formatSessionOrientationSeed(choice: SessionOrientationDirectiveChoice): string {
  return `SESSION ORIENTATION\n- chosen: ${choice}\n- directive: ${ORIENTATION_DIRECTIVES[choice]}`;
}
