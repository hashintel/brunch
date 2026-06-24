// FE-885 slice 3: tests for the pure exec-progress projector + atomic writer.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  EXEC_PROGRESS_FILE,
  projectExecProgress,
  writeExecProgress,
  type ExecProgress,
} from './exec-progress.js';
import type { OrchestratorResult, Plan } from './types.js';

/**
 * A 3-slice plan: scaffold (no provenance) → feat-a (req-1) + feat-b (req-2),
 * both depending on scaffold, all in epic `core`. Plus req-3 with no
 * contributing slice (non-buildable) and a deterministic-projection-style
 * slice `req-4` whose id IS the requirement item id.
 */
function plan(): Plan {
  return {
    mode: 'greenfield',
    spec: {
      spec_id: '49',
      requirements: [
        { item_id: 'req-1', content: 'First' },
        { item_id: 'req-2', content: 'Second' },
        { item_id: 'req-3', content: 'Non-buildable constraint' },
        { item_id: 'req-4', content: 'Projection-style' },
      ],
      criteria: [
        { item_id: 'crit-10', content: 'a fast', verifies: ['req-1'] },
        { item_id: 'crit-11', content: 'orphan', verifies: [] },
        { item_id: 'crit-12', content: 'verifies non-buildable', verifies: ['req-3'] },
      ],
    },
    epics: [{ id: 'core', summary: 'Core', depends_on: [], verification: [] }],
    slices: [
      { id: 'scaffold', epic_id: 'core', definition: 's', depends_on: [], verification: [] },
      {
        id: 'feat-a',
        epic_id: 'core',
        definition: 'a',
        depends_on: ['scaffold'],
        verification: [],
        derived_from: ['req-1'],
      },
      {
        id: 'feat-b',
        epic_id: 'core',
        definition: 'b',
        depends_on: ['scaffold'],
        verification: [],
        derived_from: ['req-2'],
      },
      { id: 'req-4', epic_id: 'core', definition: 'd', depends_on: [], verification: [] },
    ],
  };
}

const statusOf = (p: ExecProgress, itemId: string) =>
  p.requirements.find((r) => r.item_id === itemId)!.status;

describe('projectExecProgress', () => {
  it('marks every requirement completed on a fully completed run; criteria coverage is structural', () => {
    const result: OrchestratorResult = {
      status: 'completed',
      warnings: [],
      reports: [],
      epics: [{ epicId: 'core', status: 'completed' }],
      slices: [
        { sliceId: 'scaffold', status: 'completed' },
        { sliceId: 'feat-a', status: 'completed' },
        { sliceId: 'feat-b', status: 'completed' },
        { sliceId: 'req-4', status: 'completed' },
      ],
    };

    const p = projectExecProgress({ plan: plan(), result, runId: 'r1' });
    expect(p.spec_id).toBe('49');
    expect(p.run_id).toBe('r1');
    expect(p.run_status).toBe('completed');
    expect(statusOf(p, 'req-1')).toBe('completed');
    expect(statusOf(p, 'req-2')).toBe('completed');
    expect(statusOf(p, 'req-4')).toBe('completed');
    // req-3 has no contributing slice → not executable.
    expect(statusOf(p, 'req-3')).toBe('not-executable');
    // Criteria: covered when the verified requirement is executable.
    expect(p.criteria.find((c) => c.item_id === 'crit-10')!.covered).toBe(true);
    expect(p.criteria.find((c) => c.item_id === 'crit-11')!.covered).toBe(false); // no verifies edge
    expect(p.criteria.find((c) => c.item_id === 'crit-12')!.covered).toBe(false); // verifies a non-buildable req
    // No fabricated per-criterion lifecycle status.
    expect(p.criteria[0]).not.toHaveProperty('status');
  });

  it('maps requirements via both derived_from and slice-id identity', () => {
    const result: OrchestratorResult = {
      status: 'completed',
      warnings: [],
      reports: [],
      epics: [{ epicId: 'core', status: 'completed' }],
      slices: [
        { sliceId: 'feat-a', status: 'completed' },
        { sliceId: 'req-4', status: 'completed' },
      ],
    };
    const p = projectExecProgress({ plan: plan(), result, runId: 'r1' });
    expect(p.requirements.find((r) => r.item_id === 'req-1')!.slices).toEqual(['feat-a']);
    expect(p.requirements.find((r) => r.item_id === 'req-4')!.slices).toEqual(['req-4']);
  });

  it('blocks a requirement whose contributing slice halted', () => {
    const result: OrchestratorResult = {
      status: 'halted',
      reason: 'slice feat-a exhausted its rework budget',
      warnings: [],
      reports: [],
      epics: [],
      slices: [
        { sliceId: 'scaffold', status: 'completed' },
        { sliceId: 'feat-a', status: 'halted' },
      ],
    };
    const p = projectExecProgress({ plan: plan(), result, runId: 'r1' });
    expect(p.run_status).toBe('halted');
    expect(p.reason).toBe('slice feat-a exhausted its rework budget');
    expect(statusOf(p, 'req-1')).toBe('blocked');
  });

  it('transitively blocks a dependent slice when its dependency halted (scaffold → feat-b)', () => {
    const result: OrchestratorResult = {
      status: 'halted',
      warnings: [],
      reports: [],
      epics: [],
      // scaffold halted; feat-b depends on scaffold and never ran.
      slices: [{ sliceId: 'scaffold', status: 'halted' }],
    };
    const p = projectExecProgress({ plan: plan(), result, runId: 'r1' });
    expect(statusOf(p, 'req-2')).toBe('blocked'); // feat-b blocked transitively via scaffold
  });

  it('blocks a requirement whose slice completed but whose epic halted', () => {
    const result: OrchestratorResult = {
      status: 'halted',
      warnings: [],
      reports: [],
      epics: [{ epicId: 'core', status: 'halted' }],
      slices: [{ sliceId: 'feat-a', status: 'completed' }],
    };
    const p = projectExecProgress({ plan: plan(), result, runId: 'r1' });
    expect(statusOf(p, 'req-1')).toBe('blocked');
  });

  it('reports a half-done requirement set as in-progress and an untouched, unblocked one as pending+next', () => {
    // Two-slice requirement: split feat-a/feat-b onto the same requirement.
    const customPlan = plan();
    customPlan.slices.find((s) => s.id === 'feat-b')!.derived_from = ['req-1'];
    const result: OrchestratorResult = {
      status: 'halted',
      warnings: [],
      reports: [],
      epics: [],
      slices: [
        { sliceId: 'scaffold', status: 'completed' },
        { sliceId: 'feat-a', status: 'completed' },
        // feat-b never ran but its dep (scaffold) completed → pending, and ready.
      ],
    };
    const p = projectExecProgress({ plan: customPlan, result, runId: 'r1' });
    // req-1 now has feat-a (completed) + feat-b (pending) → in-progress.
    expect(statusOf(p, 'req-1')).toBe('in-progress');
    // req-4 never ran, has no deps → pending and next (ready to start).
    const req4 = p.requirements.find((r) => r.item_id === 'req-4')!;
    expect(req4.status).toBe('pending');
    expect(req4.next).toBe(true);
  });

  it('never emits needs-review in v1 (semantic assessor inert)', () => {
    const result: OrchestratorResult = {
      status: 'completed',
      warnings: [],
      reports: [],
      epics: [{ epicId: 'core', status: 'completed' }],
      slices: plan().slices.map((s) => ({ sliceId: s.id, status: 'completed' as const })),
    };
    const p = projectExecProgress({ plan: plan(), result, runId: 'r1' });
    expect(p.requirements.every((r) => r.status !== 'needs-review')).toBe(true);
  });

  it('projects empty lists when the plan has no spec block', () => {
    const noSpec: Plan = { mode: 'greenfield', epics: [], slices: [] };
    const result: OrchestratorResult = {
      status: 'completed',
      warnings: [],
      reports: [],
      epics: [],
      slices: [],
    };
    const p = projectExecProgress({ plan: noSpec, result, runId: 'r1' });
    expect(p.spec_id).toBe('');
    expect(p.requirements).toEqual([]);
    expect(p.criteria).toEqual([]);
  });
});

describe('writeExecProgress', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it('atomically writes a readable exec-progress.json round-trip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exec-progress-'));
    dirs.push(dir);
    const progress: ExecProgress = {
      spec_id: '49',
      run_id: 'r1',
      run_status: 'completed',
      requirements: [
        { item_id: 'req-1', content: 'First', status: 'completed', next: false, slices: ['feat-a'] },
      ],
      criteria: [{ item_id: 'crit-10', content: 'a fast', verifies: ['req-1'], covered: true }],
    };

    const path = writeExecProgress(dir, progress);
    expect(path).toBe(join(dir, EXEC_PROGRESS_FILE));
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(progress);
  });
});
