import { spawnSync } from 'node:child_process';

import { defaultToolchain, type Toolchain } from './project-profile.js';
import type { TestFailureKind, TestResult, TestRunner } from './types.js';

// Shell-reported "the runner binary doesn't exist" — the cross-platform spawn
// `error` (ENOENT) is the primary signal; these catch the case where a shell
// wrapper swallows that into a normal non-zero exit instead.
const RUNNER_MISSING_PATTERNS: readonly RegExp[] = [
  /command not found/i,
  /is not recognized as an internal or external command/i,
];

/**
 * Classify a **failed** test run as `infra` (the toolchain broke) vs `test` (the
 * code failed its assertions). Deliberately conservative: only an unambiguous
 * "the runner itself isn't there" signal counts as infra — a spawn failure
 * (missing binary) or a shell "command not found". Everything else is `test`,
 * because a missing *module* is ambiguous with a legitimate TDD red (a test
 * importing source that doesn't exist yet), and misrouting a real failure as
 * "infra noise" would silently skip it.
 */
export function classifyTestFailure(output: string, spawnFailed: boolean): TestFailureKind {
  if (spawnFailed) return 'infra';
  return RUNNER_MISSING_PATTERNS.some((re) => re.test(output)) ? 'infra' : 'test';
}

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
    const passed = result.status === 0;
    if (passed) return { passed, output };
    // `result.error` is set when the binary can't be spawned at all (ENOENT).
    return { passed, output, failureKind: classifyTestFailure(output, result.error != null) };
  }
}
