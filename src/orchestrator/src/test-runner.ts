import { execSync } from 'node:child_process';

import type { TestResult, TestRunner } from './types.js';

export class BunTestRunner implements TestRunner {
  async run(target: string, worktreeDir: string): Promise<TestResult> {
    try {
      const output = execSync(`bun test ${target}`, {
        cwd: worktreeDir,
        encoding: 'utf8',
        timeout: 60_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { passed: true, output };
    } catch (err) {
      const output =
        err && typeof err === 'object' && 'stdout' in err
          ? String((err as { stdout: unknown }).stdout)
          : String(err);
      return { passed: false, output };
    }
  }
}
