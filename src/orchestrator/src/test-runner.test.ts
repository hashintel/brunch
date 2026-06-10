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
import { ToolchainTestRunner } from './test-runner.js';

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
