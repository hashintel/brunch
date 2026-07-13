import {
  compileExecutorTopology,
  type ExecutorNetEvent,
  type SchedulerPlan,
} from './orchestrate-topology.js';
import { inspectPetriTransitionJournal } from './petri-events.js';
import { replayTransitionHistory } from './petri-replay.js';

export type PetriJournalAuthorityInspection =
  | { readonly status: 'missing' }
  | { readonly status: 'unreadable'; readonly events?: readonly ExecutorNetEvent[] }
  | {
      readonly status: 'readable';
      readonly events: readonly ExecutorNetEvent[];
      readonly relation: 'equal' | 'journal_ahead' | 'lifecycle_ahead';
      readonly residualTransitionIds: readonly string[];
      readonly sliceStartClaimIds: readonly string[];
    };

export async function inspectPetriJournalAuthority(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly lifecycleTransitionIds: readonly string[] | undefined;
  readonly plan: SchedulerPlan | undefined;
}): Promise<PetriJournalAuthorityInspection> {
  try {
    const journal = await inspectPetriTransitionJournal(args);
    if (journal.status === 'missing') return { status: 'missing' };
    if (journal.status !== 'readable') {
      return { status: 'unreadable' };
    }
    if (args.lifecycleTransitionIds === undefined) {
      return { status: 'unreadable', events: journal.events };
    }

    const topology = compileExecutorTopology(args.plan);
    if (
      !replayTransitionHistory(topology, args.lifecycleTransitionIds) ||
      !replayTransitionHistory(topology, journal.transitionIds)
    ) {
      return { status: 'unreadable', events: journal.events };
    }

    const journalResidual = transitionMultisetResidual(journal.transitionIds, args.lifecycleTransitionIds);
    const lifecycleResidual = transitionMultisetResidual(args.lifecycleTransitionIds, journal.transitionIds);
    if (journalResidual.length > 0 && lifecycleResidual.length > 0) {
      return { status: 'unreadable', events: journal.events };
    }

    const relation =
      journalResidual.length > 0
        ? 'journal_ahead'
        : lifecycleResidual.length > 0
          ? 'lifecycle_ahead'
          : 'equal';
    const residualTransitionIds = relation === 'journal_ahead' ? journalResidual : lifecycleResidual;
    return {
      status: 'readable',
      events: journal.events,
      relation,
      residualTransitionIds,
      sliceStartClaimIds:
        relation === 'journal_ahead'
          ? [
              ...new Set(
                journalResidual.flatMap((transitionId) =>
                  transitionId.startsWith('slice_start:') ? [transitionId.slice('slice_start:'.length)] : [],
                ),
              ),
            ]
          : [],
    };
  } catch {
    return { status: 'unreadable' };
  }
}

function transitionMultisetResidual(
  minuend: readonly string[],
  subtrahend: readonly string[],
): readonly string[] {
  const remaining = new Map<string, number>();
  for (const transitionId of subtrahend) {
    remaining.set(transitionId, (remaining.get(transitionId) ?? 0) + 1);
  }
  return minuend.filter((transitionId) => {
    const count = remaining.get(transitionId) ?? 0;
    if (count === 0) return true;
    remaining.set(transitionId, count - 1);
    return false;
  });
}
