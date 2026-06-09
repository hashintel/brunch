import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createPiActions,
  epicVerifyTask,
  evaluateVerificationTargets,
  sliceTestTask,
  toolsForAction,
} from './pi-actions.js';
import { brunchProfile, bunProfile } from './project-profile.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, Epic, Slice } from './types.js';

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts');

describe('cook task builders carry the toolchain conventions, not a hardcoded stack', () => {
  const slice: Slice = {
    id: 'chunk',
    epic_id: 'utils',
    definition: 'Add chunk()',
    depends_on: [],
    verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
  };
  const epic: Epic = {
    id: 'utils',
    summary: 'Utilities',
    depends_on: [],
    verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
  };

  it('slice test task injects the bun conventions for the bun toolchain', () => {
    const task = sliceTestTask(slice, bunProfile.toolchain);
    expect(task).toContain('chunk');
    expect(task).toContain('bun:test');
  });

  it('slice test task injects vitest conventions (no bun) for the brunch toolchain', () => {
    const task = sliceTestTask(slice, brunchProfile.toolchain);
    expect(task).toContain('vitest');
    expect(task).not.toContain('bun');
  });

  it('epic verify task carries the toolchain conventions', () => {
    expect(epicVerifyTask(epic, brunchProfile.toolchain)).toContain('vitest');
    expect(epicVerifyTask(epic, bunProfile.toolchain)).toContain('bun:test');
  });

  it('the test-writer prompt no longer hardcodes a stack', () => {
    const prompt = readFileSync(join(promptsDir, 'test-writer.md'), 'utf8');
    expect(prompt).not.toContain('bun');
  });
});

describe('evaluateVerificationTargets — done reflects real test execution', () => {
  it('done only when at least one target exists and every target passes', async () => {
    const { done } = await evaluateVerificationTargets([{ target: 'a' }, { target: 'b' }], async () => true);
    expect(done).toBe(true);
  });

  it('not done if any target fails, and reports per-target results', async () => {
    const { done, results } = await evaluateVerificationTargets(
      [{ target: 'a' }, { target: 'b' }],
      async (t) => t === 'a',
    );
    expect(done).toBe(false);
    expect(results).toEqual([
      { target: 'a', passed: true },
      { target: 'b', passed: false },
    ]);
  });

  it('not done when there are no verification targets (nothing proves it)', async () => {
    const { done } = await evaluateVerificationTargets([], async () => true);
    expect(done).toBe(false);
  });

  it('a throwing runner counts as a failed target', async () => {
    const { done } = await evaluateVerificationTargets([{ target: 'x' }], async () => {
      throw new Error('runner blew up');
    });
    expect(done).toBe(false);
  });
});

describe('pi-actions tool scoping', () => {
  it('evaluate-done is read-only — the evaluator cannot mutate the sandbox during evaluation', () => {
    const tools = toolsForAction('evaluate-done');
    expect(tools).toContain('read');
    expect(tools).not.toContain('write');
    expect(tools).not.toContain('edit');
    expect(tools).not.toContain('bash');
  });

  it('code-producing actions keep write-capable tools', () => {
    for (const action of ['write-tests', 'write-code', 'verify-epic']) {
      const tools = toolsForAction(action);
      expect(tools).toContain('read');
      expect(tools).toContain('write');
      expect(tools).toContain('edit');
      expect(tools).toContain('bash');
    }
  });
});

describe('createPiActions evaluate-done', () => {
  it('runs verification target paths with spaces and shell metacharacters without shell splitting', async () => {
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-pi-actions-'));
    try {
      mkdirSync(join(sandboxDir, 'tests'));
      const target = 'tests/path with spaces; false.test.ts';
      writeFileSync(
        join(sandboxDir, target),
        "import { expect, test } from 'bun:test';\n\ntest('runs', () => expect(1).toBe(1));\n",
      );
      const reports = new InMemoryReportSink();
      const ctx: ActionContext = {
        sandboxDir,
        reports,
        plan: {
          mode: 'greenfield',
          epics: [{ id: 'epic-1', summary: 'Epic', depends_on: [], verification: [] }],
          slices: [
            {
              id: 'slice-1',
              epic_id: 'epic-1',
              definition: 'Run a spaced test path',
              depends_on: [],
              verification: [{ kind: 'unit-test', target }],
            },
          ],
        },
        epic: { id: 'epic-1', summary: 'Epic', depends_on: [], verification: [] },
        slice: {
          id: 'slice-1',
          epic_id: 'epic-1',
          definition: 'Run a spaced test path',
          depends_on: [],
          verification: [{ kind: 'unit-test', target }],
        },
      };

      const reportId = await createPiActions()['evaluate-done']!(ctx);
      const report = reports.getById(reportId);

      expect(report?.payload).toMatchObject({
        done: true,
        results: [{ target, passed: true }],
      });
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });
});
