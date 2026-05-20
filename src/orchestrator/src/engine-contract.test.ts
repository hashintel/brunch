import { describe, expect, it } from 'vitest';

import { PetriOrchestrator } from './engine-petri.js';
import { ProceduralOrchestrator } from './engine-proc.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, ActionHandlers, OrchestratorInput, Plan, TestRunner } from './types.js';

// ---------------------------------------------------------------------------
// Shared engine list for parameterized tests
// ---------------------------------------------------------------------------

const engines = [
  { name: 'procedural', create: () => new ProceduralOrchestrator() },
  { name: 'petri', create: () => new PetriOrchestrator() },
] as const;

// ---------------------------------------------------------------------------
// Reusable fake factory — per-test closures instead of module-level state
// ---------------------------------------------------------------------------

function createFakes(opts?: {
  evalSequence?: boolean[]; // sequence of done values for evaluate-done
  testRunResults?: boolean[]; // sequence of passed values for test runner
  verifyEpicResult?: boolean; // result of verify-epic
  throwOnAction?: string; // action name that throws
}) {
  const callOrder: string[] = [];
  const reports = new InMemoryReportSink();
  let evalIdx = 0;
  let testRunIdx = 0;
  const evalSeq = opts?.evalSequence ?? [false, true]; // default: NO then YES
  const testSeq = opts?.testRunResults ?? [true]; // default: pass

  const actions: ActionHandlers = {
    'evaluate-done': async (ctx: ActionContext) => {
      if (opts?.throwOnAction === 'evaluate-done') throw new Error('evaluate-done failed');
      const done = evalSeq[evalIdx % evalSeq.length]!;
      evalIdx++;
      const id = `rpt-eval-${ctx.slice.id}-${evalIdx}`;
      reports.append({
        id,
        ts: new Date().toISOString(),
        epicId: ctx.epic.id,
        sliceId: ctx.slice.id,
        actor: 'evaluator',
        event: 'eval-done',
        payload: { done },
      });
      callOrder.push(`${ctx.slice.id}:evaluate-done:${done ? 'YES' : 'NO'}`);
      return id;
    },
    'write-tests': async (ctx: ActionContext) => {
      if (opts?.throwOnAction === 'write-tests') throw new Error('write-tests failed');
      const id = `rpt-wt-${ctx.slice.id}-${callOrder.length}`;
      reports.append({
        id,
        ts: new Date().toISOString(),
        epicId: ctx.epic.id,
        sliceId: ctx.slice.id,
        actor: 'test-writer',
        event: 'tests-written',
        payload: { files: [`tests/${ctx.slice.id}.test.ts`] },
      });
      callOrder.push(`${ctx.slice.id}:write-tests`);
      return id;
    },
    'write-code': async (ctx: ActionContext) => {
      if (opts?.throwOnAction === 'write-code') throw new Error('write-code failed');
      const id = `rpt-wc-${ctx.slice.id}-${callOrder.length}`;
      reports.append({
        id,
        ts: new Date().toISOString(),
        epicId: ctx.epic.id,
        sliceId: ctx.slice.id,
        actor: 'code-writer',
        event: 'code-written',
        payload: { files: [`src/${ctx.slice.id}.ts`] },
      });
      callOrder.push(`${ctx.slice.id}:write-code`);
      return id;
    },
    'verify-epic': async (ctx: ActionContext) => {
      const passed = opts?.verifyEpicResult ?? true;
      const id = `rpt-ve-${ctx.epic.id}`;
      reports.append({
        id,
        ts: new Date().toISOString(),
        epicId: ctx.epic.id,
        sliceId: '',
        actor: 'orchestrator',
        event: 'epic-verified',
        payload: { passed },
      });
      callOrder.push(`${ctx.epic.id}:verify-epic:${passed ? 'PASS' : 'FAIL'}`);
      return id;
    },
  };

  const testRunner: TestRunner = {
    async run() {
      const passed = testSeq[testRunIdx % testSeq.length]!;
      testRunIdx++;
      callOrder.push(`run-tests:${passed ? 'pass' : 'fail'}`);
      return { passed, output: passed ? 'ok' : 'FAIL' };
    },
  };

  return { callOrder, reports, actions, testRunner };
}

// ---------------------------------------------------------------------------
// Contract test #1 — single epic, single slice, happy path
// ---------------------------------------------------------------------------

const simplePlan: Plan = {
  epics: [
    {
      id: 'epic-1',
      summary: 'Hello world',
      depends_on: [],
      verification: [],
    },
  ],
  slices: [
    {
      id: 'slice-1',
      epic_id: 'epic-1',
      definition: 'Print hello world',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/hello.test.ts' }],
    },
  ],
};

describe('Engine contract test #1 — single epic, single slice, happy path', () => {
  for (const { name, create } of engines) {
    describe(name, () => {
      it("completes with status 'completed'", async () => {
        const fakes = createFakes();
        const result = await create().run({
          plan: simplePlan,
          worktreeDir: '/tmp/fake',
          actions: fakes.actions,
          reports: fakes.reports,
          testRunner: fakes.testRunner,
          policy: { maxRetries: 3 },
        });
        expect(result.status).toBe('completed');
      });

      it('produces correct epic and slice outcomes', async () => {
        const fakes = createFakes();
        const result = await create().run({
          plan: simplePlan,
          worktreeDir: '/tmp/fake',
          actions: fakes.actions,
          reports: fakes.reports,
          testRunner: fakes.testRunner,
          policy: { maxRetries: 3 },
        });
        expect(result.epics).toEqual([{ epicId: 'epic-1', status: 'completed' }]);
        expect(result.slices).toEqual([{ sliceId: 'slice-1', status: 'completed' }]);
      });

      it('calls actions in correct TDD cycle order', async () => {
        const fakes = createFakes();
        await create().run({
          plan: simplePlan,
          worktreeDir: '/tmp/fake',
          actions: fakes.actions,
          reports: fakes.reports,
          testRunner: fakes.testRunner,
          policy: { maxRetries: 3 },
        });
        expect(fakes.callOrder).toEqual([
          'slice-1:evaluate-done:NO',
          'slice-1:write-tests',
          'slice-1:write-code',
          'run-tests:pass',
          'slice-1:evaluate-done:YES',
        ]);
      });

      it('report sink contains expected lines', async () => {
        const fakes = createFakes();
        await create().run({
          plan: simplePlan,
          worktreeDir: '/tmp/fake',
          actions: fakes.actions,
          reports: fakes.reports,
          testRunner: fakes.testRunner,
          policy: { maxRetries: 3 },
        });
        const events = fakes.reports.getAll().map((r) => r.event);
        expect(events).toContain('eval-done');
        expect(events).toContain('tests-written');
        expect(events).toContain('code-written');
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #2 — intra-epic slice dependencies
// ---------------------------------------------------------------------------

const depPlan: Plan = {
  epics: [
    {
      id: 'epic-1',
      summary: 'Two dependent slices',
      depends_on: [],
      verification: [],
    },
  ],
  slices: [
    {
      id: 'slice-a',
      epic_id: 'epic-1',
      definition: 'First slice',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/a.test.ts' }],
    },
    {
      id: 'slice-b',
      epic_id: 'epic-1',
      definition: 'Second slice — depends on first',
      depends_on: ['slice-a'],
      verification: [{ kind: 'unit-test', target: 'tests/b.test.ts' }],
    },
  ],
};

describe('Engine contract test #2 — intra-epic slice dependencies', () => {
  const engines = [
    { name: 'procedural', create: () => new ProceduralOrchestrator() },
    { name: 'petri', create: () => new PetriOrchestrator() },
  ] as const;

  for (const { name, create } of engines) {
    describe(name, () => {
      it('completes both slices in dependency order', async () => {
        // Track which slice each action call belongs to
        const sliceCallOrder: string[] = [];
        let perSliceEvalCount = new Map<string, number>();

        const reports = new InMemoryReportSink();

        const depActions: ActionHandlers = {
          'evaluate-done': async (ctx: ActionContext) => {
            const count = (perSliceEvalCount.get(ctx.slice.id) ?? 0) + 1;
            perSliceEvalCount.set(ctx.slice.id, count);
            const done = count >= 2;
            const id = `rpt-eval-${ctx.slice.id}-${count}`;
            reports.append({
              id,
              ts: new Date().toISOString(),
              epicId: ctx.epic.id,
              sliceId: ctx.slice.id,
              actor: 'evaluator',
              event: 'eval-done',
              payload: { done },
            });
            sliceCallOrder.push(`${ctx.slice.id}:evaluate-done:${done ? 'YES' : 'NO'}`);
            return id;
          },
          'write-tests': async (ctx: ActionContext) => {
            const id = `rpt-write-tests-${ctx.slice.id}`;
            reports.append({
              id,
              ts: new Date().toISOString(),
              epicId: ctx.epic.id,
              sliceId: ctx.slice.id,
              actor: 'test-writer',
              event: 'tests-written',
              payload: { files: [`tests/${ctx.slice.id}.test.ts`] },
            });
            sliceCallOrder.push(`${ctx.slice.id}:write-tests`);
            return id;
          },
          'write-code': async (ctx: ActionContext) => {
            const id = `rpt-write-code-${ctx.slice.id}`;
            reports.append({
              id,
              ts: new Date().toISOString(),
              epicId: ctx.epic.id,
              sliceId: ctx.slice.id,
              actor: 'code-writer',
              event: 'code-written',
              payload: { files: [`src/${ctx.slice.id}.ts`] },
            });
            sliceCallOrder.push(`${ctx.slice.id}:write-code`);
            return id;
          },
          'verify-epic': async (ctx: ActionContext) => {
            const id = `rpt-verify-${ctx.epic.id}`;
            reports.append({
              id,
              ts: new Date().toISOString(),
              epicId: ctx.epic.id,
              sliceId: '',
              actor: 'orchestrator',
              event: 'epic-verified',
              payload: { passed: true },
            });
            return id;
          },
        };

        const depTestRunner: TestRunner = {
          async run() {
            return { passed: true, output: 'ok' };
          },
        };

        const engine = create();
        const result = await engine.run({
          plan: depPlan,
          worktreeDir: '/tmp/fake',
          actions: depActions,
          reports,
          testRunner: depTestRunner,
          policy: { maxRetries: 3 },
        });

        expect(result.status).toBe('completed');
        expect(result.slices).toEqual([
          { sliceId: 'slice-a', status: 'completed' },
          { sliceId: 'slice-b', status: 'completed' },
        ]);

        // Slice-a actions must all come before slice-b actions
        const aLast = Math.max(...sliceCallOrder.map((s, i) => (s.startsWith('slice-a:') ? i : -1)));
        const bFirst = Math.min(...sliceCallOrder.map((s, i) => (s.startsWith('slice-b:') ? i : Infinity)));
        expect(aLast).toBeLessThan(bFirst);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #3 — epic dependencies
// ---------------------------------------------------------------------------

describe('Engine contract test #3 — epic dependencies', () => {
  const epicDepPlan: Plan = {
    epics: [
      { id: 'epic-1', summary: 'First', depends_on: [], verification: [] },
      { id: 'epic-2', summary: 'Second — depends on first', depends_on: ['epic-1'], verification: [] },
    ],
    slices: [
      {
        id: 's1',
        epic_id: 'epic-1',
        definition: 'Slice in epic 1',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't1' }],
      },
      {
        id: 's2',
        epic_id: 'epic-2',
        definition: 'Slice in epic 2',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't2' }],
      },
    ],
  };

  for (const { name, create } of engines) {
    it(`${name}: epic-2 slices run after epic-1 completes`, async () => {
      const fakes = createFakes();
      const result = await create().run({
        plan: epicDepPlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('completed');
      expect(result.epics).toEqual([
        { epicId: 'epic-1', status: 'completed' },
        { epicId: 'epic-2', status: 'completed' },
      ]);

      const s1Last = Math.max(...fakes.callOrder.map((s, i) => (s.startsWith('s1:') ? i : -1)));
      const s2First = Math.min(...fakes.callOrder.map((s, i) => (s.startsWith('s2:') ? i : Infinity)));
      expect(s1Last).toBeLessThan(s2First);
    });
  }
});

// ---------------------------------------------------------------------------
// Contract tests #4-5 — epic-level verification (pass + fail)
// ---------------------------------------------------------------------------

describe('Engine contract test #4 — epic verification passes', () => {
  const verifyPlan: Plan = {
    epics: [
      {
        id: 'epic-v',
        summary: 'Verified epic',
        depends_on: [],
        verification: [{ kind: 'integration-test', target: 'integration.test.ts' }],
      },
    ],
    slices: [
      {
        id: 'sv',
        epic_id: 'epic-v',
        definition: 'Slice',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't' }],
      },
    ],
  };

  for (const { name, create } of engines) {
    it(`${name}: epic with passing verification → completed`, async () => {
      const fakes = createFakes({ verifyEpicResult: true });
      const result = await create().run({
        plan: verifyPlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('completed');
      expect(result.epics).toEqual([{ epicId: 'epic-v', status: 'completed' }]);
      expect(fakes.callOrder).toContain('epic-v:verify-epic:PASS');
    });
  }
});

describe('Engine contract test #5 — epic verification fails', () => {
  const verifyFailPlan: Plan = {
    epics: [
      {
        id: 'epic-f',
        summary: 'Failing epic',
        depends_on: [],
        verification: [{ kind: 'integration-test', target: 'integration.test.ts' }],
      },
    ],
    slices: [
      {
        id: 'sf',
        epic_id: 'epic-f',
        definition: 'Slice',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't' }],
      },
    ],
  };

  for (const { name, create } of engines) {
    it(`${name}: epic with failing verification → halted`, async () => {
      const fakes = createFakes({ verifyEpicResult: false });
      const result = await create().run({
        plan: verifyFailPlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('halted');
      expect(result.epics).toEqual([{ epicId: 'epic-f', status: 'halted' }]);
      expect(fakes.callOrder).toContain('epic-f:verify-epic:FAIL');
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #6 — retry loop (fail then pass)
// ---------------------------------------------------------------------------

describe('Engine contract test #6 — retry loop', () => {
  for (const { name, create } of engines) {
    it(`${name}: test fails once then passes → slice completed`, async () => {
      const fakes = createFakes({ testRunResults: [false, true] });
      const result = await create().run({
        plan: simplePlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('completed');
      expect(result.slices).toEqual([{ sliceId: 'slice-1', status: 'completed' }]);
      // Should have: write-code (first), run-tests fail, write-code (retry), run-tests pass
      const writeCodes = fakes.callOrder.filter((c) => c.includes('write-code'));
      expect(writeCodes.length).toBe(2);
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #7 — retry exhaustion
// ---------------------------------------------------------------------------

describe('Engine contract test #7 — retry exhaustion', () => {
  for (const { name, create } of engines) {
    it(`${name}: tests always fail → halted after maxRetries`, async () => {
      const fakes = createFakes({ testRunResults: [false] });
      const result = await create().run({
        plan: simplePlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 2 },
      });

      expect(result.status).toBe('halted');
      expect(result.slices).toEqual([{ sliceId: 'slice-1', status: 'halted' }]);
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #8 — multi-cycle "needs more"
// ---------------------------------------------------------------------------

describe('Engine contract test #8 — multi-cycle needs more', () => {
  for (const { name, create } of engines) {
    it(`${name}: evaluator says NO twice then YES → 2 TDD cycles`, async () => {
      const fakes = createFakes({ evalSequence: [false, false, true] });
      const result = await create().run({
        plan: simplePlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('completed');
      const evals = fakes.callOrder.filter((c) => c.includes('evaluate-done'));
      expect(evals).toEqual([
        'slice-1:evaluate-done:NO',
        'slice-1:evaluate-done:NO',
        'slice-1:evaluate-done:YES',
      ]);
      const writeTests = fakes.callOrder.filter((c) => c.includes('write-tests'));
      expect(writeTests.length).toBe(2);
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #9 — action handler throws
// ---------------------------------------------------------------------------

describe('Engine contract test #9 — action handler throws', () => {
  for (const { name, create } of engines) {
    it(`${name}: write-tests throws → halted with reason`, async () => {
      const fakes = createFakes({ throwOnAction: 'write-tests' });
      const result = await create().run({
        plan: simplePlan,
        worktreeDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('halted');
      expect(result.reason).toContain('write-tests failed');
    });
  }
});
