import { appendFile, readFile } from 'node:fs/promises';

import { sliceStartReport } from './isolated-slice-operations.js';
import {
  blockedPlanSliceSteps,
  readyPlanSliceIds,
  type BlockedStep,
  type SchedulerPlan,
} from './orchestrate-topology.js';
import { inspectPetriJournalAuthority } from './petri-journal-authority.js';
import { readPetriMarkingSnapshot } from './petri-marking.js';
import { projectExecutorPetriTransitionHistory } from './petri-runtime.js';
import { populatedPlanPath } from './populate.js';
import { reportsPath } from './report.js';
import { withRunExecutionAuthority } from './run-execution-authority.js';
import {
  assertSafeSliceId,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  type RunMetadata,
} from './run.js';

type PlanPayload = SchedulerPlan;

export type SliceStartResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_execution_active' | 'parallel_batch_active';
      readonly runStatus: RunMetadata['status'] | 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'reports_not_initialized';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'no_slice';
      readonly runStatus: 'reports_initialized' | 'slice_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly blockedSteps: readonly BlockedStep[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_started';
      readonly runStatus: 'slice_started';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId?: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export async function startSlice(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly sliceId?: string;
}): Promise<SliceStartResult> {
  return startSliceWithExecutionAuthority(args);
}

export async function startSliceWithExecutionAuthority(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly sliceId?: string;
}): Promise<SliceStartResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => startSliceOwned(args),
    onContended: async () => {
      const metadataPath = runMetadataPath(args.cwd, args.runId);
      const metadata = await readRunMetadata(metadataPath);
      return {
        status: 'run_execution_active',
        runStatus: metadata?.status ?? 'not_started',
        runId: args.runId,
        metadataPath,
        sideEffects: [],
      };
    },
  });
}

async function startSliceOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly sliceId?: string;
}): Promise<SliceStartResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  // Pre-report runs have no populated plan or Petri authority substrate yet.
  if (metadata.status !== 'reports_initialized' && metadata.status !== 'slice_completed') {
    return {
      status: 'reports_not_initialized',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const marking = await readPetriMarkingSnapshot({ cwd: args.cwd, runId: args.runId });
  if (marking?.parallelSliceBatch) {
    return {
      status: 'parallel_batch_active',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const plan = await readPlan(metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId));
  const journalAuthority = await inspectPetriJournalAuthority({
    cwd: args.cwd,
    runId: args.runId,
    lifecycleTransitionIds: projectExecutorPetriTransitionHistory(metadata, plan)?.transitionIds,
    plan,
  });
  if (
    journalAuthority.status === 'unreadable' ||
    (journalAuthority.status === 'missing' && metadata.petriObservationPrepared === true) ||
    (journalAuthority.status === 'readable' && journalAuthority.sliceStartClaimIds.length > 0)
  ) {
    return {
      status: 'parallel_batch_active',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const readySliceIds = new Set(
    readyPlanSliceIds(plan, metadata.completedSliceIds ?? [], metadata.completedEpicIds ?? []),
  );
  const slice = args.sliceId
    ? readySliceIds.has(args.sliceId)
      ? plan.slices?.find((candidate) => candidate.id === args.sliceId)
      : undefined
    : plan.slices?.find((candidate) => readySliceIds.has(candidate.id));

  if (!slice) {
    return {
      status: 'no_slice',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      blockedSteps: blockedPlanSliceSteps(
        plan,
        metadata.completedSliceIds ?? [],
        metadata.completedEpicIds ?? [],
      ),
      sideEffects: [],
    };
  }
  assertSafeSliceId(slice.id);

  const event = sliceStartReport({
    runId: args.runId,
    ...(slice.epic_id === undefined ? {} : { epicId: slice.epic_id }),
    sliceId: slice.id,
  });
  const { activeEpicId: _previousEpicId, ...metadataWithoutEpic } = metadata;
  const updated: RunMetadata = {
    ...metadataWithoutEpic,
    status: 'slice_started',
    activeSliceId: slice.id,
    ...(slice.epic_id === undefined ? {} : { activeEpicId: slice.epic_id }),
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'slice_started',
    runStatus: 'slice_started',
    runId: args.runId,
    sliceId: slice.id,
    ...(slice.epic_id === undefined ? {} : { epicId: slice.epic_id }),
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}

async function readPlan(path: string): Promise<PlanPayload> {
  return JSON.parse(await readFile(path, 'utf8')) as PlanPayload;
}
