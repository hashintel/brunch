import { access } from 'node:fs/promises';

import { cookPlanFilePath } from './cook-plan-file.js';

export type CookLaunchStatus = 'missing_plan' | 'ready';

export interface CookLaunchResult {
  readonly status: CookLaunchStatus;
  readonly runStatus: 'not_started';
  readonly planPath: string;
  readonly sideEffects: readonly [];
}

export async function prepareCookLaunch(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly planPath?: string;
}): Promise<CookLaunchResult> {
  const planPath = args.planPath ?? cookPlanFilePath(args.cwd, args.specId);
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
