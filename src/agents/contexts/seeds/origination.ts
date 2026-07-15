/**
 * Context-seed payload composition (FE-857 card 2, D78-L content half).
 *
 * Owns the provider-visible text of the `brunch.context_seed` continuity
 * entry (D78-L revised 2026-06-12): the pre-rendered workspace overview,
 * the **full graph overview** (canonical renderer shared with `read_graph` —
 * codes, titles, edges; never truncated), the thin graph-fact neutral seed
 * (A36-L/D102-L — facts, never judgments), and the session scratchpad
 * (D101-L) — enough context that the kicked opening turn needs no read tool
 * call. Pure over already-read data — callers fetch the slice/scratchpad
 * through existing spec-scoped reads (D20-L/D52-L) and pre-render the
 * workspace section; this module never opens the database or filesystem.
 *
 * Input:  spec identity + GraphSlice + session scratchpad + workspace text
 * Output: seed content string carried by the custom message entry
 * Used by: brunch-tui boot seeding, session.triggerExchange RPC origination
 */

import { formatGraphOverview } from '../../../agents/contexts/data-model/graph/graph-slice.js';
import type { GraphSlice } from '../../../graph/index.js';
import type { SpecKind, SpecOrigin } from '../../../graph/schema/kinds.js';
import type { ElicitationScratchpadItem } from '../../../session/elicitation-scratchpad.js';
import type { SessionOrientationDirectiveChoice } from '../../../session/session-orientation.js';
import { formatElicitationScratchpad } from '../data-model/elicitation-scratchpad.js';
import { formatSessionOrientationSeed } from '../data-model/session-orientation.js';
import { deriveGraphFactSeed, renderGraphFactSeed } from './graph-fact-seed.js';

/** A spec's posture (D118-L) as read by kick assembly — never established here. */
export interface SpecPostureSeedInput {
  readonly kind: SpecKind;
  readonly origin: SpecOrigin | null;
  readonly relatesToSpecId: number | null;
}

export interface ComposeContextSeedInput {
  readonly specId: number;
  readonly specName?: string;
  readonly slice: Pick<GraphSlice, 'nodes' | 'edges' | 'lsn'>;
  readonly scratchpad: readonly ElicitationScratchpadItem[];
  /**
   * Pre-rendered workspace overview section (`renderWorkspaceOverviewContext`
   * output). Required so no caller drifts to a seed without it; a blank
   * render degrades to omitting the section.
   */
  readonly workspaceContext: string;
  /**
   * Fresh session-orientation choice (`freshSessionOrientationChoice` output)
   * routing the opening turn. Omitted entirely when no fresh choice exists or
   * the fresh choice is an inert `dismissed` — never rendered as a
   * blank/default section (decision-flow chart §Choice schema).
   */
  readonly orientation?: SessionOrientationDirectiveChoice;
  /**
   * The spec's posture (D118-L) — confirmed kind, origin, and an optional
   * relates-to-spec reference (A41-L). Read-only here: the agent never
   * establishes posture. Omitted (not rendered blank) when posture is
   * unestablished (`origin: null`), mirroring the orientation section's
   * omit-rather-than-blank convention — a resumed spec with confirmed
   * posture is not a blank restart.
   */
  readonly posture?: SpecPostureSeedInput;
}

export function composeContextSeedContent(input: ComposeContextSeedInput): string {
  const specLabel = input.specName ? `spec ${input.specId} “${input.specName}”` : `spec ${input.specId}`;
  const lines: string[] = [`[Brunch] Context seeded for ${specLabel} at graph LSN ${input.slice.lsn}.`];

  if (input.workspaceContext.trim().length > 0) {
    lines.push('', input.workspaceContext.trim());
  }

  // Full overview — the same render read_graph emits — so the opening turn
  // can reason about actual nodes/edges without a tool call.
  lines.push('', formatGraphOverview(input.slice, 'Graph'));

  lines.push(
    '',
    renderGraphFactSeed(deriveGraphFactSeed({ lsn: input.slice.lsn, nodes: input.slice.nodes })),
  );

  lines.push('', formatElicitationScratchpad(input.scratchpad));

  if (input.orientation) {
    lines.push('', formatSessionOrientationSeed(input.orientation));
  }

  if (input.posture && input.posture.origin !== null) {
    lines.push('', formatSpecPostureSeed(input.posture));
  }

  return lines.join('\n');
}

function formatSpecPostureSeed(posture: SpecPostureSeedInput): string {
  const relatesTo = posture.relatesToSpecId === null ? 'none' : `spec ${posture.relatesToSpecId}`;
  return [
    'SPEC POSTURE',
    `- kind: ${posture.kind}`,
    `- origin: ${posture.origin}`,
    `- relates-to-spec: ${relatesTo}`,
  ].join('\n');
}
