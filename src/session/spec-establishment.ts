/**
 * Deterministic spec-posture establishment branching (D118-L).
 *
 * Pure decision over cwd-populated state and current posture — no I/O, no
 * agent involvement. The same branching serves both spec creation (posture
 * starts unestablished) and spec resume (posture may already be
 * established, in which case establishment questions are never re-asked;
 * D118-L covers creation *and* resume). Keeps the question sequence minimal
 * per the card's risk mitigation: a populated cwd asks a combined kind +
 * brownfield-confirm pair; a bare cwd infers greenfield and only confirms it.
 *
 * Lives in session/ (not `.pi/components/workspace-dialog/`, the card's
 * tentative home) because it is domain logic consumed by both the
 * session-domain coordinator (`workspace-session-coordinator.ts`, for the
 * "never re-asked" resume behavior) and the Pi-presentation dialog
 * (`.pi/components/workspace-dialog/model.ts`) — the dependency direction in
 * `src/.pi/components/TOPOLOGY.md` only allows components to import from
 * session/, never the reverse.
 */

import type { SpecOrigin } from '../graph/schema/kinds.js';

export type SpecEstablishmentAsk = 'confirmKind' | 'confirmOrigin';

export interface SpecEstablishmentContext {
  /** The spec's currently stored origin, or `null` if posture is unestablished. */
  readonly currentOrigin: SpecOrigin | null;
  /** Whether the target cwd already holds product code beyond `.brunch/`. */
  readonly workspacePopulated: boolean;
}

export function decideSpecEstablishmentAsks(
  context: SpecEstablishmentContext,
): readonly SpecEstablishmentAsk[] {
  if (context.currentOrigin !== null) {
    return [];
  }
  return context.workspacePopulated ? ['confirmKind', 'confirmOrigin'] : ['confirmOrigin'];
}

/** The inferred origin a bare-cwd `confirmOrigin` ask defaults to. */
export function inferredOriginFor(context: Pick<SpecEstablishmentContext, 'workspacePopulated'>): SpecOrigin {
  return context.workspacePopulated ? 'brownfield' : 'greenfield';
}
