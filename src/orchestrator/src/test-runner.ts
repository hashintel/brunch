import { spawnSync } from 'node:child_process';

import { defaultToolchain, type Toolchain } from './project-profile.js';
import type { TestResult, TestRunner } from './types.js';

export class ToolchainTestRunner implements TestRunner {
  constructor(private readonly toolchain: Toolchain = defaultToolchain) {}

  async run(target: string, sandboxDir: string): Promise<TestResult> {
    const [command, ...args] = this.toolchain.testCommand(target);
    const result = spawnSync(command!, args, {
      cwd: sandboxDir,
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Test runners vary in which stream carries diagnostics (e.g. `bun test`
    // writes its results to stderr and only the version banner to stdout) —
    // concatenate both so tests-run reports carry real detail.
    const output = [result.stdout, result.stderr, result.error ? String(result.error) : '']
      .filter(Boolean)
      .join('');
    return { passed: result.status === 0, output };
  }
}
