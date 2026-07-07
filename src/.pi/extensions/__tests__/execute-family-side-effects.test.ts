import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Family contract sentinel for the run-update observer
 * (executor/execute-run-updates): a state-advancing execute tool must
 * expose its explicit side effects (I52-L) as `sideEffects` inside its tool
 * `details`, because that is the position the observer reads to publish
 * run-scoped brunch.updated hints. A tool that stops exposing it silently
 * stops producing live web updates — this sentinel makes that drift loud.
 */

const EXECUTOR_EXTENSION_ROOT = join(process.cwd(), 'src', '.pi', 'extensions', 'executor');

/** Exempt with reasons — widen the contract, never this list silently. */
const EXEMPT: Record<string, string> = {
  'execute-orchestrate': 'driver tool; reports an aggregate outcome the observer special-cases',
  'execute-run-updates': 'the observer itself; registers no tool',
};

function executeToolDirs(): string[] {
  return readdirSync(EXECUTOR_EXTENSION_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('execute-'))
    .map((entry) => entry.name)
    .sort();
}

describe('execute tool family side-effect contract', () => {
  it('every non-exempt execute tool module exposes sideEffects in its details payload', () => {
    const violations: string[] = [];
    for (const dir of executeToolDirs()) {
      if (dir in EXEMPT) continue;
      const source = readFileSync(join(EXECUTOR_EXTENSION_ROOT, dir, 'index.ts'), 'utf8');
      if (!source.includes('details:') || !source.includes('sideEffects')) {
        violations.push(dir);
      }
    }
    expect(violations).toEqual([]);
  });

  it('exempt entries stay honest: each names an existing module', () => {
    const dirs = new Set(executeToolDirs());
    for (const name of Object.keys(EXEMPT)) {
      expect(dirs.has(name)).toBe(true);
    }
  });

  it('the observer still special-cases the exempt driver tool', () => {
    const observer = readFileSync(join(EXECUTOR_EXTENSION_ROOT, 'execute-run-updates', 'index.ts'), 'utf8');
    expect(observer.includes('execute_orchestrate')).toBe(true);
  });
});
