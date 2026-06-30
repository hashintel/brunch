import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { prepareCookLaunch } from './cook-launch.js';

export interface CookRunMetadata {
  readonly runId: string;
  readonly specId: string;
  readonly planPath: string;
  readonly status:
    | 'created'
    | 'worktree_created'
    | 'worktree_populated'
    | 'source_policy_selected'
    | 'source_copied'
    | 'reports_initialized'
    | 'slice_started';
  readonly worktreeDir?: string;
  readonly populatedPlanPath?: string;
  readonly sourcePolicy?: string;
  readonly sourcePolicyPath?: string;
  readonly sourceCopied?: boolean;
  readonly copiedEntries?: readonly string[];
  readonly reportsPath?: string;
  readonly activeSliceId?: string;
  readonly activeEpicId?: string;
}

export type CookRunCreateResult =
  | {
      readonly status: 'missing_plan';
      readonly runStatus: 'not_started';
      readonly planPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'created';
      readonly runStatus: 'created';
      readonly runId: string;
      readonly runDir: string;
      readonly metadataPath: string;
      readonly planPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function cookRunDir(cwd: string, runId: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'runs', runId);
}

export function cookRunMetadataPath(cwd: string, runId: string): string {
  return join(cookRunDir(cwd, runId), 'run.json');
}

export async function createCookRun(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly runId?: string;
}): Promise<CookRunCreateResult> {
  const launch = await prepareCookLaunch({ cwd: args.cwd, specId: args.specId });
  if (launch.status === 'missing_plan') {
    return {
      status: 'missing_plan',
      runStatus: launch.runStatus,
      planPath: launch.planPath,
      sideEffects: launch.sideEffects,
    };
  }

  const runId = args.runId ?? `run-${Date.now().toString(36)}`;
  const runDir = cookRunDir(args.cwd, runId);
  const metadataPath = cookRunMetadataPath(args.cwd, runId);
  const metadata: CookRunMetadata = {
    runId,
    specId: args.specId,
    planPath: launch.planPath,
    status: 'created',
  };

  await mkdir(runDir, { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    status: 'created',
    runStatus: 'created',
    runId,
    runDir,
    metadataPath,
    planPath: launch.planPath,
    sideEffects: [
      { kind: 'mkdir', path: runDir },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}
