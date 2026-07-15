import { appendFile, readFile } from 'node:fs/promises';

import { populatedPlanPath } from './populate.js';
import { readEpicVerificationVerdict, readSliceVerificationVerdict } from './report-verdict.js';
import { reportsPath } from './report.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

interface PlanSlice {
  readonly id: string;
}
interface PlanPayload {
  readonly slices?: readonly PlanSlice[];
  readonly epics?: readonly {
    readonly id: string;
    readonly verification?: readonly unknown[];
  }[];
}

export type RunCompleteResult =
  | RunExecutionActiveResult
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slices_incomplete';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly completedSliceIds: readonly string[];
      readonly expectedSliceIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'verification_failed';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly failedSliceIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'verification_missing';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly missingSliceIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'epics_incomplete';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly completedEpicIds: readonly string[];
      readonly expectedEpicIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'epic_verification_failed' | 'epic_verification_missing';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly epicIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'already_completed';
      readonly runStatus: 'run_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_completed';
      readonly runStatus: 'run_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export async function completeRun(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<RunCompleteResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => completeRunOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function completeRunOwned(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<RunCompleteResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata)
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };

  if (metadata.status === 'run_completed') {
    return {
      status: 'already_completed',
      runStatus: 'run_completed',
      runId: args.runId,
      metadataPath,
      reportsPath: metadata.reportsPath ?? reportsPath(args.cwd, args.runId),
      sideEffects: [],
    };
  }

  const plan = await readPlan(metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId));
  const expectedSliceIds = (plan.slices ?? []).map((slice) => slice.id);
  const completedSliceIds = metadata.completedSliceIds ?? [];
  const complete =
    expectedSliceIds.length > 0 && expectedSliceIds.every((id) => completedSliceIds.includes(id));
  if (!complete) {
    return {
      status: 'slices_incomplete',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      completedSliceIds,
      expectedSliceIds,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const verification = await readSliceVerificationVerdict({ reportsPath: reportPath, expectedSliceIds });
  if (verification.status === 'failed') {
    return {
      status: 'verification_failed',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      failedSliceIds: verification.failedSliceIds,
      sideEffects: [],
    };
  }
  if (verification.status === 'missing') {
    return {
      status: 'verification_missing',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      missingSliceIds: verification.missingSliceIds,
      sideEffects: [],
    };
  }

  const expectedEpicIds = (plan.epics ?? []).map((epic) => epic.id);
  const completedEpicIds = metadata.completedEpicIds ?? [];
  if (!expectedEpicIds.every((epicId) => completedEpicIds.includes(epicId))) {
    return {
      status: 'epics_incomplete',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      completedEpicIds,
      expectedEpicIds,
      sideEffects: [],
    };
  }
  const requiredEpicIds = (plan.epics ?? [])
    .filter((epic) => epic.verification?.length)
    .map((epic) => epic.id);
  const epicVerification = await readEpicVerificationVerdict({
    reportsPath: reportPath,
    expectedEpicIds: requiredEpicIds,
  });
  if (epicVerification.status !== 'passed') {
    return {
      status: epicVerification.status === 'failed' ? 'epic_verification_failed' : 'epic_verification_missing',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      epicIds:
        epicVerification.status === 'failed'
          ? epicVerification.failedEpicIds
          : epicVerification.missingEpicIds,
      sideEffects: [],
    };
  }

  const event = { event: 'run_completed', runId: args.runId, status: 'run_completed' };
  const updated: RunMetadata = { ...metadata, status: 'run_completed' };
  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'run_completed',
    runStatus: 'run_completed',
    runId: args.runId,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}

async function readPlan(path: string): Promise<PlanPayload> {
  return JSON.parse(await readFile(path, 'utf8')) as PlanPayload;
}
