import { appendFile } from 'node:fs/promises';

import type { TestRunnerPort } from './execution-ports.js';
import type { ReadyStep, SchedulerPlan } from './orchestrate-topology.js';
import { reportsPath } from './report.js';
import { persistRunMetadata, readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

type EpicStep = Extract<ReadyStep, { readonly kind: 'epic_integrate' | 'epic_verify' | 'epic_complete' }>;

export type EpicLifecycleResult =
  | {
      readonly status: 'epic_integrated' | 'epic_verified' | 'epic_completed';
      readonly runStatus: RunMetadata['status'];
      readonly advanced: true;
    }
  | {
      readonly status: 'missing_run' | 'epic_not_ready' | 'epic_test_run_failed' | 'epic_verification_failed';
      readonly runStatus: RunMetadata['status'] | 'not_started';
    };

export async function executeEpicLifecycleStep(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly step: EpicStep;
  readonly plan: SchedulerPlan | undefined;
  readonly testRunner: TestRunnerPort;
  readonly signal?: AbortSignal;
}): Promise<EpicLifecycleResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata) return { status: 'missing_run', runStatus: 'not_started' };
  const epic = args.plan?.epics?.find((candidate) => candidate.id === args.step.epicId);
  if (!epic || !metadata.worktreeDir) {
    return { status: 'epic_not_ready', runStatus: metadata.status };
  }
  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);

  switch (args.step.kind) {
    case 'epic_integrate': {
      const memberIds = (args.plan?.slices ?? [])
        .filter((slice) => slice.epic_id === epic.id)
        .map((slice) => slice.id);
      if (!memberIds.every((sliceId) => metadata.completedSliceIds?.includes(sliceId))) {
        return { status: 'epic_not_ready', runStatus: metadata.status };
      }
      await appendFile(
        reportPath,
        `${JSON.stringify({ event: 'epic_integrated', runId: args.runId, epicId: epic.id, status: 'integrated' })}\n`,
        'utf8',
      );
      await persistRunMetadata(metadataPath, {
        ...metadata,
        integratedEpicIds: appendId(metadata.integratedEpicIds, epic.id),
      });
      return { status: 'epic_integrated', runStatus: metadata.status, advanced: true };
    }
    case 'epic_verify': {
      if (!epic.verification?.length || !metadata.integratedEpicIds?.includes(epic.id)) {
        return { status: 'epic_not_ready', runStatus: metadata.status };
      }
      const result = await args.testRunner.run({
        worktreeDir: metadata.worktreeDir,
        ...(metadata.verifyTarget ? { verifyTarget: metadata.verifyTarget } : {}),
        ...(args.signal ? { signal: args.signal } : {}),
      });
      const status = result.status === 'completed' ? result.verdict : 'failed';
      await appendFile(
        reportPath,
        `${JSON.stringify({
          event: 'epic_test_result',
          runId: args.runId,
          epicId: epic.id,
          status,
          verification: epic.verification,
          ...(result.status === 'completed'
            ? { exitCode: result.exitCode, ...(result.target ? { target: result.target } : {}) }
            : { message: result.message }),
        })}\n`,
        'utf8',
      );
      if (result.status !== 'completed') {
        return { status: 'epic_test_run_failed', runStatus: metadata.status };
      }
      if (result.verdict !== 'passed') {
        return { status: 'epic_verification_failed', runStatus: metadata.status };
      }
      await persistRunMetadata(metadataPath, {
        ...metadata,
        verifiedEpicIds: appendId(metadata.verifiedEpicIds, epic.id),
      });
      return { status: 'epic_verified', runStatus: metadata.status, advanced: true };
    }
    case 'epic_complete': {
      const ready = epic.verification?.length
        ? metadata.verifiedEpicIds?.includes(epic.id)
        : metadata.integratedEpicIds?.includes(epic.id);
      if (!ready) return { status: 'epic_not_ready', runStatus: metadata.status };
      await appendFile(
        reportPath,
        `${JSON.stringify({ event: 'epic_completed', runId: args.runId, epicId: epic.id, status: 'completed' })}\n`,
        'utf8',
      );
      await persistRunMetadata(metadataPath, {
        ...metadata,
        completedEpicIds: appendId(metadata.completedEpicIds, epic.id),
      });
      return { status: 'epic_completed', runStatus: metadata.status, advanced: true };
    }
  }
}

function appendId(ids: readonly string[] | undefined, id: string): readonly string[] {
  return ids?.includes(id) ? ids : [...(ids ?? []), id];
}
