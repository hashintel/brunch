import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { planFilePath } from './plan-file.js';

export type LaunchStatus = 'invalid_plan_path' | 'missing_plan' | 'ready';

export interface LaunchResult {
  readonly status: LaunchStatus;
  readonly runStatus: 'not_started';
  readonly planPath: string;
  readonly sideEffects: readonly [];
}

export async function prepareLaunch(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly planPath?: string;
}): Promise<LaunchResult> {
  const planPath = args.planPath ?? planFilePath(args.cwd, args.specId);
  if (args.planPath && !isSelectedSpecPlanPath({ cwd: args.cwd, specId: args.specId, planPath })) {
    return {
      status: 'invalid_plan_path',
      runStatus: 'not_started',
      planPath,
      sideEffects: [],
    };
  }
  return {
    status: (await fileExists(planPath)) ? 'ready' : 'missing_plan',
    runStatus: 'not_started',
    planPath,
    sideEffects: [],
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isSelectedSpecPlanPath(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly planPath: string;
}): boolean {
  return resolve(args.planPath) === resolve(planFilePath(args.cwd, args.specId));
}
