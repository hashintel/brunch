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

  return parsed;
}
