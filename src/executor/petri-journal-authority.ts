import {
  compileExecutorTopology,
  type ExecutorNetEvent,
  type ExecutorTransition,
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
      !journalEventsMatchTopology(journal.events, args.runId, topology.transitions) ||
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

function journalEventsMatchTopology(
  events: readonly ExecutorNetEvent[],
  runId: string,
  transitions: ReturnType<typeof compileExecutorTopology>['transitions'],
): boolean {
  const transitionsById = new Map(transitions.map((transition) => [transition.id, transition]));
  return events.every((event) => {
    if (event.runId !== runId) return false;
    if (event.kind !== 'transition_fired') return true;

    const transition = transitionsById.get(event.transitionId);
    return (
      transition !== undefined &&
      event.subnetId === transition.subnetId &&
      optionalStringEqual(event.epicId, transition.epicId) &&
      optionalStringArrayEqual(event.derivedFrom, transition.derivedFrom) &&
      event.step === transitionEventStep(transition) &&
      event.contract.kind === transition.contract.kind &&
      event.contract.lane === transition.contract.lane &&
      stringArrayEqual(
        event.consumed,
        transition.inputArcs.map((arc) => arc.placeId),
      ) &&
      stringArrayEqual(
        event.produced,
        transition.outputArcs.map((arc) => arc.placeId),
      )
    );
  });
}

function transitionEventStep(
  transition: ExecutorTransition,
): Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }>['step'] | undefined {
  if (transition.step) return transition.step.kind;
  if (transition.id.startsWith('epic_integrate:')) return 'epic_integrate';
  if (transition.id.startsWith('epic_verify:')) return 'epic_verify';
  if (transition.id.startsWith('epic_complete:')) return 'epic_complete';
  if (transition.id.startsWith('agent_retry:') || transition.id.startsWith('agent_exhausted:')) {
    return 'agent_result';
  }
  if (transition.id.startsWith('verify_retry:') || transition.id.startsWith('verify_exhausted:')) {
    return 'test_result';
  }
  if (transition.id.startsWith('agent_reset:')) return 'agent_result';
  if (transition.id.startsWith('verify_reset:')) return 'test_result';
  return undefined;
}

function optionalStringEqual(left: string | undefined, right: string | undefined): boolean {
  return left === right;
}

function optionalStringArrayEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  return left === undefined && right === undefined
    ? true
    : left !== undefined && right !== undefined && stringArrayEqual(left, right);
}

function stringArrayEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
