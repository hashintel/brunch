import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { assertExecutablePlanDraftVersion, type ExecutablePlanDraft } from './executable-plan-draft.js';

export interface ExecutablePlanDraftArtifactWriteResult {
  readonly path: string;
  readonly writeMode: 'overwrite';
  readonly sideEffects: readonly [
    { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
  ];
}

export function executablePlanDraftArtifactPath(cwd: string, specId: string): string {
  return join(cwd, BRUNCH_DIR, 'execution-reports', specId, 'executable-plan-draft.json');
}

export async function writeExecutablePlanDraftArtifact(args: {
  readonly cwd: string;
  readonly draft: ExecutablePlanDraft;
}): Promise<ExecutablePlanDraftArtifactWriteResult> {
  assertExecutablePlanDraftVersion(args.draft);
  const path = executablePlanDraftArtifactPath(args.cwd, args.draft.specId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(args.draft, null, 2)}\n`, 'utf8');
  return { path, writeMode: 'overwrite', sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }] };
}
