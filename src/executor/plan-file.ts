import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import type { PlanPreview } from './plan-preview.js';

export interface PlanFilePayload {
  readonly mode: PlanPreview['mode'];
  readonly spec: PlanPreview['spec'];
  readonly epics: PlanPreview['epics'];
  readonly slices: PlanPreview['slices'];
}

export interface PlanFileWriteResult {
  readonly path: string;
  readonly writeMode: 'overwrite';
  readonly sideEffects: readonly [
    { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
  ];
}

export function planFilePath(cwd: string, specId: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'specs', specId, 'plan.yaml');
}

export function planFilePayload(preview: PlanPreview): PlanFilePayload {
  return {
    mode: preview.mode,
    spec: preview.spec,
    epics: preview.epics,
    slices: preview.slices,
  };
}

export async function writePlanFile(args: {
  readonly cwd: string;
  readonly preview: PlanPreview;
}): Promise<PlanFileWriteResult> {
  const path = planFilePath(args.cwd, args.preview.spec.spec_id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(planFilePayload(args.preview), null, 2)}\n`, 'utf8');
  return { path, writeMode: 'overwrite', sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }] };
}
