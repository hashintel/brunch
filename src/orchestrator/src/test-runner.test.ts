// Regression oracle for cook-harness report fidelity: `bun test` writes its
// results (failure detail, pass/fail counts) to **stderr** and only the
// version banner to stdout. A `TestResult.output` that drops stderr reduces
// every failing `tests-run` / `epic-verified` report to the bare banner —
// zero diagnostics (observed on cook run 289c9843, 2026-06-04).
//
// These tests spawn the real `bun` binary against tmpdir test files, so they
// pin the actual stream behavior rather than a mock's assumption of it.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bunProfile, type Toolchain } from './project-profile.js';
import {
  classifyTestFailure,
  runVerification,
  stripAgentTailLines,
  ToolchainTestRunner,
} from './test-runner.js';
import type { TestResult, TestRunner } from './types.js';

const bun = bunProfile.toolchain;

describe('ToolchainTestRunner output fidelity (bun)', () => {
  const dirs: string[] = [];

  function makeSandbox(testFileContent: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'bun-test-runner-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'sample.test.ts'), testFileContent);
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('failing run output carries the failure detail, not just the banner', async () => {
    const sandbox = makeSandbox(
      `import { expect, test } from 'bun:test';\n` +
        `test('deliberately fails', () => { expect(1).toBe(2); });\n`,
    );

    const result = await new ToolchainTestRunner(bun).run('sample.test.ts', sandbox);

    expect(result.passed).toBe(false);
    expect(result.output).toContain('1 fail');
    expect(result.output).toContain('expect(received).toBe(expected)');
  });

  it('passing run output carries the test summary', async () => {
    const sandbox = makeSandbox(
      `import { expect, test } from 'bun:test';\n` + `test('passes', () => { expect(1).toBe(1); });\n`,
    );

    const result = await new ToolchainTestRunner(bun).run('sample.test.ts', sandbox);

    expect(result.passed).toBe(true);
    expect(result.output).toContain('1 pass');
  });
});

describe('ToolchainTestRunner honors the toolchain test command', () => {
  function fakeToolchain(testCommand: (target: string) => string[]): Toolchain {
    return {
      sliceTarget: (id) => id,
      epicTarget: (id) => id,
      testCommand,
      testConventions: 'fake',
    };
  }

  it('runs the argv the toolchain returns, not a hardcoded `bun test`', async () => {
    const pass = fakeToolchain((target) => [
      'node',
      '-e',
      `process.stdout.write(${JSON.stringify(target)});process.exit(0)`,
    ]);
    const fail = fakeToolchain(() => ['node', '-e', 'process.exit(1)']);

    const passed = await new ToolchainTestRunner(pass).run('the-target', process.cwd());
    expect(passed.passed).toBe(true);
    expect(passed.output).toContain('the-target');

    const failed = await new ToolchainTestRunner(fail).run('x', process.cwd());
    expect(failed.passed).toBe(false);
  });
});

describe('classifyTestFailure (infra vs test)', () => {
  it('a spawn failure (missing runner binary) is infra', () => {
    expect(classifyTestFailure('', true)).toBe('infra');
  });

  it('a shell "command not found" is infra even with a normal exit', () => {
    expect(classifyTestFailure('sh: 1: vitest: command not found', false)).toBe('infra');
    expect(classifyTestFailure("'jest' is not recognized as an internal or external command", false)).toBe(
      'infra',
    );
  });

  it('an assertion failure with no toolchain signal is a test failure', () => {
    expect(classifyTestFailure('expect(received).toBe(expected)\n\n1 fail', false)).toBe('test');
  });

  it('a missing *module* stays a test failure (ambiguous with TDD red), not infra', () => {
    // A red test importing source that does not exist yet must not be mislabeled
    // infra and skipped.
    expect(classifyTestFailure("Cannot find module './widget' from 'widget.test.ts'", false)).toBe('test');
  });

  it('"No test files found" is absent (nothing built yet), not a test red', () => {
    // The greenfield evaluate gate runs before the target test file exists, so
    // the runner matches zero files. That is "not started", not a failure — it
    // must not be conflated with a genuine assertion red (which keeps a slice's
    // attempt counter clean and avoids a phantom ✗ NEEDS WORK on the grid).
    expect(classifyTestFailure('No test files found, exiting with code 1', false)).toBe('absent');
  });
});

describe('stripAgentTailLines', () => {
  it('removes [agent-tail] harness lines while preserving real runner output verbatim', () => {
    const raw = [
      '[agent-tail] Pruned old session: 2026-06-17T12-21-20-772Z',
      ' RUN  v4.1.5 /sandbox',
      '[agent-tail] Writing to /sandbox/tmp/logs/browser.log',
      ' ✓ src/x.test.ts (3 tests)',
    ].join('\n');
    const cleaned = stripAgentTailLines(raw);
    expect(cleaned).not.toContain('[agent-tail]');
    expect(cleaned).toContain('RUN  v4.1.5');
    expect(cleaned).toContain('✓ src/x.test.ts');
  });

  it('is a no-op when there is no agent-tail noise', () => {
    expect(stripAgentTailLines('ok\nall good')).toBe('ok\nall good');
  });
});

describe('ToolchainTestRunner stamps failureKind', () => {
  function fakeToolchain(testCommand: (target: string) => string[]): Toolchain {
    return {
      sliceTarget: (id) => id,
      epicTarget: (id) => id,
      testCommand,
      testConventions: 'fake',
    };
  }

  it('a missing runner binary surfaces as failureKind "infra"', async () => {
    const missing = fakeToolchain(() => ['definitely-not-a-real-binary-xyz', 'arg']);
    const result = await new ToolchainTestRunner(missing).run('x', process.cwd());
    expect(result.passed).toBe(false);
    expect(result.failureKind).toBe('infra');
  });

  it('an assertion failure surfaces as failureKind "test"', async () => {
    const fail = fakeToolchain(() => ['node', '-e', 'process.exit(1)']);
    const result = await new ToolchainTestRunner(fail).run('x', process.cwd());
    expect(result.passed).toBe(false);
    expect(result.failureKind).toBe('test');
  });

  it('a runner output cap error is still a test failure, not missing-toolchain infra', async () => {
    const noisy = fakeToolchain(() => [
      process.execPath,
      '-e',
      'process.stdout.write("x".repeat(2 * 1024 * 1024)); process.exit(1);',
    ]);
    const result = await new ToolchainTestRunner(noisy).run('x', process.cwd());
    expect(result.passed).toBe(false);
    expect(result.failureKind).toBe('test');
  });

  it('a passing run carries no failureKind', async () => {
    const pass = fakeToolchain(() => ['node', '-e', 'process.exit(0)']);
    const result = await new ToolchainTestRunner(pass).run('x', process.cwd());
    expect(result.passed).toBe(true);
    expect(result.failureKind).toBeUndefined();
  });

  it('a "No test files found" exit surfaces as failureKind "absent"', async () => {
    const noFiles = fakeToolchain(() => [
      process.execPath,
      '-e',
      'process.stderr.write("No test files found, exiting with code 1"); process.exit(1);',
    ]);
    const result = await new ToolchainTestRunner(noFiles).run('x', process.cwd());
    expect(result.passed).toBe(false);
    expect(result.failureKind).toBe('absent');
  });

  it('captured output omits [agent-tail] harness noise', async () => {
    const noisy = fakeToolchain(() => [
      process.execPath,
      '-e',
      'process.stdout.write("[agent-tail] Pruned old session\\nreal runner output\\n"); process.exit(0);',
    ]);
    const result = await new ToolchainTestRunner(noisy).run('x', process.cwd());
    expect(result.output).not.toContain('[agent-tail]');
    expect(result.output).toContain('real runner output');
  });
});

describe('runVerification — the single verdict + aggregate seam', () => {
  // Replays a fixed sequence of results across targets so the verdict and the
  // infra-dominates aggregate can be pinned without spawning real runners.
  function seqRunner(results: readonly TestResult[]): TestRunner {
    let i = 0;
    return {
      async run() {
        return results[i++ % results.length]!;
      },
    };
  }

  it('done only when ≥1 target exists and every target passes', async () => {
    const { done, failureKind } = await runVerification(
      [{ target: 'a' }, { target: 'b' }],
      seqRunner([{ passed: true, output: 'ok' }]),
      '/tmp',
    );
    expect(done).toBe(true);
    expect(failureKind).toBeUndefined();
  });

  it('not done with zero targets (nothing proves it)', async () => {
    const { done, results } = await runVerification([], seqRunner([{ passed: true, output: 'ok' }]), '/tmp');
    expect(done).toBe(false);
    expect(results).toEqual([]);
  });

  it('a plain assertion failure aggregates to "test"', async () => {
    const { done, failureKind } = await runVerification(
      [{ target: 'a' }],
      seqRunner([{ passed: false, output: 'FAIL', failureKind: 'test' }]),
      '/tmp',
    );
    expect(done).toBe(false);
    expect(failureKind).toBe('test');
  });

  it('infra dominates: one infra failure makes the whole verdict infra', async () => {
    const { done, failureKind } = await runVerification(
      [{ target: 'a' }, { target: 'b' }],
      seqRunner([
        { passed: false, output: 'assert', failureKind: 'test' },
        { passed: false, output: 'no runner', failureKind: 'infra' },
      ]),
      '/tmp',
    );
    expect(done).toBe(false);
    expect(failureKind).toBe('infra');
  });

  it('all-unmatched targets aggregate to "absent" (the greenfield gate, not a red)', async () => {
    const { done, failureKind } = await runVerification(
      [{ target: 'a' }, { target: 'b' }],
      seqRunner([{ passed: false, output: 'No test files found', failureKind: 'absent' }]),
      '/tmp',
    );
    expect(done).toBe(false);
    expect(failureKind).toBe('absent');
  });

  it('a genuine test red dominates an absent target', async () => {
    const { failureKind } = await runVerification(
      [{ target: 'a' }, { target: 'b' }],
      seqRunner([
        { passed: false, output: 'no files', failureKind: 'absent' },
        { passed: false, output: 'assert', failureKind: 'test' },
      ]),
      '/tmp',
    );
    expect(failureKind).toBe('test');
  });

  it('a runner that throws is treated as an infra failure, not a swallowed pass', async () => {
    const throwing: TestRunner = {
      async run() {
        throw new Error('runner blew up');
      },
    };
    const { done, failureKind } = await runVerification([{ target: 'x' }], throwing, '/tmp');
    expect(done).toBe(false);
    expect(failureKind).toBe('infra');
  });
});
