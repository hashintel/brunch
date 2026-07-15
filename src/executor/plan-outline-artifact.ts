import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { assertExecutionPlanOutlineVersion, type ExecutionPlanOutline } from './execute-plan-outline.js';

export interface PlanOutlineArtifactWriteResult {
  readonly path: string;
  readonly writeMode: 'overwrite';
  readonly sideEffects: readonly [
    { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
  ];
}

export function planOutlineArtifactPath(cwd: string, specId: string): string {
  return join(cwd, BRUNCH_DIR, 'execution-reports', specId, 'plan-outline.json');
}

export async function writePlanOutlineArtifact(args: {
  readonly cwd: string;
  readonly outline: ExecutionPlanOutline;
}): Promise<PlanOutlineArtifactWriteResult> {
  assertExecutionPlanOutlineVersion(args.outline);
  const path = planOutlineArtifactPath(args.cwd, args.outline.specId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(args.outline, null, 2)}\n`, 'utf8');
  return { path, writeMode: 'overwrite', sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }] };
}
