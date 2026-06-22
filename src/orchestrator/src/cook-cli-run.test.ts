import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CookBus } from './presenter.js';
import type { CookEvent } from './presenter/events.js';

const mocks = vi.hoisted(() => ({
  createSandbox: vi.fn(),
  engineRun: vi.fn(),
  harvestCookRun: vi.fn(),
}));

vi.mock('./engine.js', () => ({
  createOrchestrator: () => ({ run: mocks.engineRun }),
}));

vi.mock('./worktree.js', () => ({
  createSandbox: mocks.createSandbox,
}));

vi.mock('./run-artifact.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./run-artifact.js')>();
  return {
    ...actual,
    harvestCookRun: mocks.harvestCookRun,
  };
});

const dirs: string[] = [];

function makeDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function initCleanRepo(dir: string): void {
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'seed\n');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: dir });
}

function writeBrownfieldPlan(dir: string): void {
  writeFileSync(
    join(dir, 'plan.yaml'),
    [
      'mode: brownfield',
      'epics:',
      '  - id: e',
      '    summary: E',
      '    depends_on: []',
      '    verification: []',
      'slices:',
      '  - id: a',
      '    epic_id: e',
      '    definition: A',
      '    depends_on: []',
      '    verification: []',
      '',
    ].join('\n'),
  );
}

describe('runCook brownfield promotion failures', () => {
  beforeEach(() => {
    mocks.createSandbox.mockReset();
    mocks.engineRun.mockReset();
    mocks.harvestCookRun.mockReset();
    process.exitCode = undefined;
  });

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    process.exitCode = undefined;
  });

  it('emits cook-done when the brownfield promotion fold reports conflicts', async () => {
    const { runCook } = await import('./cook-cli.js');
    const sourceDir = makeDir('cook-run-source-');
    const runDir = makeDir('cook-run-dir-');
    const sandboxDir = join(runDir, 'worktree');
    mkdirSync(sandboxDir, { recursive: true });
    initCleanRepo(sourceDir);
    writeBrownfieldPlan(sourceDir);
    mocks.createSandbox.mockReturnValue({ sandboxDir, runDir, runId: 'r1' });
    mocks.engineRun.mockResolvedValue({
      status: 'completed',
      warnings: [],
      reports: [],
      epics: [{ epicId: 'e', status: 'completed' }],
      slices: [{ sliceId: 'a', status: 'completed' }],
    });
    mocks.harvestCookRun.mockReturnValue({
      branch: 'brunch/run/r1',
      head: '1234567890abcdef',
      commits: [],
      conflicts: [{ sliceId: 'a', paths: ['src/a.ts'] }],
    });
    const events: CookEvent[] = [];
    const bus = new CookBus();
    bus.subscribe({
      onEvent(event) {
        events.push(event);
      },
      async dispose() {},
    });

    await runCook(
      {
        dir: sourceDir,
        policy: 'serial',
        maxRetries: 3,
        verbose: false,
        petrinautFold: 'identity',
        petrinautLanes: 'both',
        petrinautStream: false,
        petrinautOpen: true,
        force: false,
        confine: 'off',
      },
      bus,
    );

    expect(events).toContainEqual({
      kind: 'cook-done',
      ok: false,
      reason: 'promotion conflict',
    });
    expect(process.exitCode).toBe(1);
  });
});
