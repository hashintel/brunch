import { spawnSync } from 'node:child_process';

import type { TestResult, TestRunner } from './types.js';

export class BunTestRunner implements TestRunner {
  async run(target: string, sandboxDir: string): Promise<TestResult> {
    const result = spawnSync('bun', ['test', target], {
      cwd: sandboxDir,
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // `bun test` writes its results (failure detail, pass/fail counts) to
    // stderr and only the version banner to stdout — concatenate both so
    // tests-run reports carry real diagnostics.
    const output = [result.stdout, result.stderr, result.error ? String(result.error) : '']
      .filter(Boolean)
      .join('');
    return { passed: result.status === 0, output };
  }
}
