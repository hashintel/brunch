import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import type { CookPlanPreview } from './plan-preview.js';

export interface CookPlanFilePayload {
  readonly mode: CookPlanPreview['mode'];
  readonly spec: CookPlanPreview['spec'];
  readonly epics: CookPlanPreview['epics'];
  readonly slices: CookPlanPreview['slices'];
}

export interface CookPlanFileWriteResult {
  readonly path: string;
  readonly writeMode: 'overwrite';
  readonly sideEffects: readonly [
    { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
  ];
}

export function cookPlanFilePath(cwd: string, specId: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'specs', specId, 'plan.yaml');
}

export function cookPlanFilePayload(preview: CookPlanPreview): CookPlanFilePayload {
  return {
    mode: preview.mode,
    spec: preview.spec,
    epics: preview.epics,
    slices: preview.slices,
  };
}

export async function writeCookPlanFile(args: {
  readonly cwd: string;
  readonly preview: CookPlanPreview;
}): Promise<CookPlanFileWriteResult> {
  const path = cookPlanFilePath(args.cwd, args.preview.spec.spec_id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(cookPlanFilePayload(args.preview), null, 2)}\n`, 'utf8');
  return { path, writeMode: 'overwrite', sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }] };
}
