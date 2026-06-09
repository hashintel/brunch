import { readFileSync } from 'node:fs';

import { parse } from 'yaml';

import type { Plan } from './types.js';

export function loadPlan(yamlPath: string): Plan {
  const raw = readFileSync(yamlPath, 'utf8');
  const parsed = parse(raw) as Plan;

  if (!Array.isArray(parsed?.epics)) {
    throw new Error(`Invalid plan: missing or non-array "epics" in ${yamlPath}`);
  }
  if (!Array.isArray(parsed?.slices)) {
    throw new Error(`Invalid plan: missing or non-array "slices" in ${yamlPath}`);
  }

  // Mode is spec-derived plan truth; authored/legacy plans that omit it
  // (or carry an unrecognized value) load as greenfield so cook uses an
  // empty worktree rather than cloning the cwd repo.
  return { ...parsed, mode: parsed.mode === 'brownfield' ? 'brownfield' : 'greenfield' };
}
