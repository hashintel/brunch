import { compileExecutorTopology, type SchedulerPlan } from './orchestrate-topology.js';
import { appendPetriEvent } from './petri-events.js';
import { inspectPetriJournalAuthority } from './petri-journal-authority.js';
import {
  petriMarkingLifecycleProvenance,
  petriMarkingSnapshotMatchesRunMetadata,
  readPetriMarkingSnapshot,
  writePetriMarkingSnapshot,
} from './petri-marking.js';
import { replayTransitionHistory } from './petri-replay.js';
import { readPetriRuntimePlan } from './petri-runtime-plan.js';
import type { RunMetadata } from './run.js';

export type PetriLifecycleReconciliationBlockReason =
  | 'parallel_batch_active'
  | 'petri_input_unreadable'
  | 'petri_journal_append_failed'
  | 'petri_journal_gap'
  | 'petri_marking_persist_failed'
  | 'petri_terminal_recorded';

export type PetriLifecycleReconciliation =
  | { readonly status: 'not_prepared' }
  | { readonly status: 'synchronized' }
  | {
      readonly status: 'blocked';
      readonly reason: PetriLifecycleReconciliationBlockReason;
    };

export async function reconcilePreparedLifecycleJournal(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly state: RunMetadata;
  readonly lifecycleTransitionIds: readonly string[] | undefined;
  readonly plan?: SchedulerPlan | undefined;
}): Promise<PetriLifecycleReconciliation> {
  const existing = await readPetriMarkingSnapshot({ cwd: args.cwd, runId: args.runId });
  if (existing?.parallelSliceBatch) {
    return { status: 'blocked', reason: 'parallel_batch_active' };
  }
  if (args.state.petriObservationPrepared !== true) return { status: 'not_prepared' };
  const plan = args.plan ?? (await readPetriRuntimePlan(args.cwd, args.state));
  if (!args.lifecycleTransitionIds) {
    return { status: 'blocked', reason: 'petri_input_unreadable' };
  }
  const authority = await inspectPetriJournalAuthority({
    cwd: args.cwd,
    runId: args.runId,
    lifecycleTransitionIds: args.lifecycleTransitionIds,
    plan,
  });
  if (authority.status !== 'readable') {
    return { status: 'blocked', reason: 'petri_input_unreadable' };
  }
  if (
    authority.events.some(
      (event) =>
        event.kind === 'net_completed' || event.kind === 'net_halted' || event.kind === 'net_deadlocked',
    )
  ) {
    return { status: 'blocked', reason: 'petri_terminal_recorded' };
  }
  if (
    authority.relation === 'equal' &&
    existing &&
    petriMarkingSnapshotMatchesRunMetadata(existing, args.state)
  ) {
    return { status: 'synchronized' };
  }
  if (authority.relation === 'journal_ahead') {
    const parallelClaimOnly =
      authority.residualTransitionIds.length > 0 &&
      authority.residualTransitionIds.every((transitionId) => transitionId.startsWith('slice_start:'));
    return {
      status: 'blocked',
      reason: parallelClaimOnly ? 'parallel_batch_active' : 'petri_input_unreadable',
    };
  }

  const topology = compileExecutorTopology(plan);
  if (authority.relation === 'lifecycle_ahead') {
    const missingTransitionIds = authority.residualTransitionIds;
    if (!isSuffix(missingTransitionIds, args.lifecycleTransitionIds)) {
      return { status: 'blocked', reason: 'petri_input_unreadable' };
    }
    if (missingTransitionIds.some((id) => !isRecoverableLifecycleTransition(id))) {
      return { status: 'blocked', reason: 'petri_journal_gap' };
    }
    for (const transitionId of missingTransitionIds) {
      const transition = topology.transitions.find((candidate) => candidate.id === transitionId);
      const statuses = lifecycleStatuses(transitionId, args.state);
      if (!transition || !statuses) {
        return { status: 'blocked', reason: 'petri_journal_gap' };
      }
      try {
        await appendPetriEvent({
          cwd: args.cwd,
          runId: args.runId,
          event: {
            kind: 'transition_fired',
            runId: args.runId,
            runStatus: statuses.toStatus,
            transitionId,
            subnetId: transition.subnetId,
            ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
            ...(transition.derivedFrom === undefined ? {} : { derivedFrom: transition.derivedFrom }),
            step: transition.step!.kind,
            contract: transition.contract,
            consumed: transition.inputArcs.map((arc) => arc.placeId),
            produced: transition.outputArcs.map((arc) => arc.placeId),
            fromStatus: statuses.fromStatus,
            toStatus: statuses.toStatus,
          },
        });
      } catch {
        return { status: 'blocked', reason: 'petri_journal_append_failed' };
      }
    }
  }

  const replayed = replayTransitionHistory(topology, args.lifecycleTransitionIds);
  if (!replayed) return { status: 'blocked', reason: 'petri_input_unreadable' };
  try {
    await writePetriMarkingSnapshot({
      cwd: args.cwd,
      runId: args.runId,
      snapshot: {
        ...replayed,
        lifecycleProvenance: petriMarkingLifecycleProvenance(args.state),
        ...(existing?.epicVerificationClaims
          ? { epicVerificationClaims: existing.epicVerificationClaims }
          : {}),
      },
    });
  } catch {
    return { status: 'blocked', reason: 'petri_marking_persist_failed' };
  }
  return { status: 'synchronized' };
}

function isSuffix(suffix: readonly string[], value: readonly string[]): boolean {
  const offset = value.length - suffix.length;
  return offset >= 0 && suffix.every((entry, index) => value[offset + index] === entry);
}

function isRecoverableLifecycleTransition(transitionId: string): boolean {
  return (
    transitionId === 'worktree_create' ||
    transitionId === 'populate' ||
    transitionId === 'source_policy' ||
    transitionId === 'source_copy' ||
    transitionId === 'report_init' ||
    transitionId.startsWith('slice_start:')
  );
}

function lifecycleStatuses(
  transitionId: string,
  state: RunMetadata,
): { readonly fromStatus: RunMetadata['status']; readonly toStatus: RunMetadata['status'] } | undefined {
  const fixed = RUN_LIFECYCLE_STATUSES[transitionId];
  if (fixed) return fixed;
  if (transitionId.startsWith('slice_start:')) {
    return {
      fromStatus: (state.completedSliceIds?.length ?? 0) > 0 ? 'slice_completed' : 'reports_initialized',
      toStatus: 'slice_started',
    };
  }
  return undefined;
}

const RUN_LIFECYCLE_STATUSES: Readonly<
  Record<string, { readonly fromStatus: RunMetadata['status']; readonly toStatus: RunMetadata['status'] }>
> = {
  worktree_create: { fromStatus: 'created', toStatus: 'worktree_created' },
  populate: { fromStatus: 'worktree_created', toStatus: 'worktree_populated' },
  source_policy: { fromStatus: 'worktree_populated', toStatus: 'source_policy_selected' },
  source_copy: { fromStatus: 'source_policy_selected', toStatus: 'source_copied' },
  report_init: { fromStatus: 'source_copied', toStatus: 'reports_initialized' },
};
