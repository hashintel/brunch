import { access } from 'node:fs/promises';

import { planFilePath } from './plan-file.js';

export type LaunchStatus = 'missing_plan' | 'ready';

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
