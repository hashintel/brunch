import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createOrchestrator } from './engine.js';
import { compilePlan, compileTopology, wireHandlers } from './net-compiler.js';
import type { NetEvent } from './petri-net.js';
import {
  createPetrinautEventStream,
  type PetrinautEvent,
  type PetrinautTransitionFiredEvent,
} from './petrinaut-events.js';
import { createNetFolding } from './petrinaut-fold.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, ActionHandlers, OrchestratorInput, Plan, RunCtx, TestRunner } from './types.js';

// ---------------------------------------------------------------------------
// Shared engine list for parameterized tests
// ---------------------------------------------------------------------------

const engines = [
  { name: 'serial', create: () => createOrchestrator('serial') },
  { name: 'parallel', create: () => createOrchestrator('parallel') },
] as const;

// ---------------------------------------------------------------------------
// Reusable fake factory — per-test closures instead of module-level state
// ---------------------------------------------------------------------------

function createFakes(opts?: {
  evalSequence?: boolean[]; // sequence of done values for evaluate-done
  testRunResults?: boolean[]; // sequence of passed values for test runner
  verifyEpicResult?: boolean; // result of verify-epic
  semanticResults?: boolean[]; // sequence of satisfied values for assess-semantic
  throwOnAction?: string; // action name that throws
}) {
  const callOrder: string[] = [];
  const reports = new InMemoryReportSink();
  let evalIdx = 0;
  let testRunIdx = 0;
  let semanticIdx = 0;
  const evalSeq = opts?.evalSequence ?? [false, true]; // default: NO then YES
  const testSeq = opts?.testRunResults ?? [true]; // default: pass
  const semanticSeq = opts?.semanticResults ?? [true]; // default: satisfied

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
    'assess-semantic': async (ctx: ActionContext) => {
      if (opts?.throwOnAction === 'assess-semantic') throw new Error('assess-semantic failed');
      const satisfied = semanticSeq[semanticIdx % semanticSeq.length]!;
      semanticIdx++;
      const id = `rpt-sem-${ctx.slice.id}-${semanticIdx}`;
      reports.append({
        id,
        ts: new Date().toISOString(),
        epicId: ctx.epic.id,
        sliceId: ctx.slice.id,
        actor: 'semantic-assessor',
        event: 'semantic-assessed',
        payload: { satisfied },
      });
      callOrder.push(`${ctx.slice.id}:assess-semantic:${satisfied ? 'PASS' : 'FAIL'}`);
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
// Concurrency-tracking wrapper — reusable across parallel/pool tests
// ---------------------------------------------------------------------------

type ConcurrencyTracker = { maxConcurrent: number };

/**
 * Wrap action handlers with concurrency tracking. Each wrapped handler
 * increments an active counter, yields to allow interleaving under
 * Promise.allSettled, calls the original, then decrements.
 *
 * @param actions   Original action handlers to wrap
 * @param onlyKeys  If provided, only wrap these action keys (others pass through)
 */
function withConcurrencyTracking(
  actions: ActionHandlers,
  onlyKeys?: Set<string>,
): { tracked: ActionHandlers; tracker: ConcurrencyTracker } {
  let active = 0;
  const tracker: ConcurrencyTracker = { maxConcurrent: 0 };

  const tracked: ActionHandlers = {};
  for (const [key, handler] of Object.entries(actions)) {
    if (onlyKeys && !onlyKeys.has(key)) {
      tracked[key] = handler!;
    } else {
      tracked[key] = async (ctx: ActionContext) => {
        active++;
        tracker.maxConcurrent = Math.max(tracker.maxConcurrent, active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return await handler!(ctx);
        } finally {
          active--;
        }
      };
    }
  }

  return { tracked, tracker };
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
          sandboxDir: '/tmp/fake',
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
          sandboxDir: '/tmp/fake',
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
          sandboxDir: '/tmp/fake',
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
          'slice-1:assess-semantic:PASS',
        ]);
      });

      it('report sink contains expected lines', async () => {
        const fakes = createFakes();
        await create().run({
          plan: simplePlan,
          sandboxDir: '/tmp/fake',
          actions: fakes.actions,
          reports: fakes.reports,
          testRunner: fakes.testRunner,
          policy: { maxRetries: 3 },
        });
        const events = fakes.reports.getAll().map((r) => r.event);
        expect(events).toContain('eval-done');
        expect(events).toContain('tests-written');
        expect(events).toContain('code-written');
        expect(events).toContain('semantic-assessed');
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
          'assess-semantic': async (ctx: ActionContext) => {
            const id = `rpt-sem-${ctx.slice.id}`;
            reports.append({
              id,
              ts: new Date().toISOString(),
              epicId: ctx.epic.id,
              sliceId: ctx.slice.id,
              actor: 'semantic-assessor',
              event: 'semantic-assessed',
              payload: { satisfied: true },
            });
            sliceCallOrder.push(`${ctx.slice.id}:assess-semantic:PASS`);
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
          sandboxDir: '/tmp/fake',
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
        sandboxDir: '/tmp/f',
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
        sandboxDir: '/tmp/f',
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
        sandboxDir: '/tmp/f',
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
        sandboxDir: '/tmp/f',
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
        sandboxDir: '/tmp/f',
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
        sandboxDir: '/tmp/f',
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
        sandboxDir: '/tmp/f',
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

// ---------------------------------------------------------------------------
// Contract test #10 — semantic gate rejects → rework loop
// ---------------------------------------------------------------------------

describe('Engine contract test #10 — semantic gate rejects then accepts', () => {
  for (const { name, create } of engines) {
    it(`${name}: assess-semantic fails once then passes → extra TDD cycle`, async () => {
      // eval: NO, YES (first TDD cycle completes mechanically),
      //   semantic: FAIL → needs-more → write-tests → write-code → run-tests
      //   → spec-ready → eval: YES (second mechanical done),
      //   semantic: PASS → done
      const fakes = createFakes({
        evalSequence: [false, true, true],
        semanticResults: [false, true],
      });
      const result = await create().run({
        plan: simplePlan,
        sandboxDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('completed');
      // Should have two assess-semantic calls: first FAIL, then PASS
      const semantics = fakes.callOrder.filter((c) => c.includes('assess-semantic'));
      expect(semantics).toEqual(['slice-1:assess-semantic:FAIL', 'slice-1:assess-semantic:PASS']);
      // Two TDD cycles (2 write-tests calls)
      const writeTests = fakes.callOrder.filter((c) => c.includes('write-tests'));
      expect(writeTests.length).toBe(2);
    });
  }
});

// ---------------------------------------------------------------------------
// Contract test #11 — semantic rework exhaustion
// ---------------------------------------------------------------------------

describe('Engine contract test #11 — semantic rework exhaustion halts', () => {
  for (const { name, create } of engines) {
    it(`${name}: assess-semantic always fails → halted after maxSemanticReworks`, async () => {
      const fakes = createFakes({
        evalSequence: [false, true], // NO then YES (repeated)
        semanticResults: [false], // always rejects
      });
      const result = await create().run({
        plan: simplePlan,
        sandboxDir: '/tmp/f',
        actions: fakes.actions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3, maxSemanticReworks: 2 },
      });

      expect(result.status).toBe('halted');
      expect(result.slices).toEqual([{ sliceId: 'slice-1', status: 'halted' }]);
      expect(result.reason).toContain('semantic');
      // Should have exactly maxSemanticReworks + 1 semantic assessments
      const semantics = fakes.callOrder.filter((c) => c.includes('assess-semantic'));
      expect(semantics.length).toBe(3); // 0, 1, 2 → exhausted at 2
    });
  }
});

// ---------------------------------------------------------------------------
// Adapter test — compiled net shape for simplePlan
// ---------------------------------------------------------------------------

describe('Adapter: compiled net shape (topology-only — no runtime bindings)', () => {
  it('simplePlan compiles to expected place and transition counts', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });

    // simplePlan: 1 epic, 1 slice (no deps)
    // Pool places: pool:test-agent, pool:code-agent = 2
    // Epic places: epic:epic-1:done = 1
    // Mechanical places: spec-ready, failing-tests, untested-code,
    //                    needs-more, done-spec, completed, eligible,
    //                    retry-budget, evaluate:reported, run-tests:reported,
    //                    halted (FE-761 Slice 2a),
    //                    evaluate:running, write-tests:running,
    //                    write-code:running, run-tests:running,
    //                    assess-semantic:running (FE-761 Slice 4) = 16
    // Semantic places: semantic-budget, semantic-satisfied, assess-semantic:reported = 3
    // Total places: 22
    expect(blueprint.places.length).toBe(22);

    // Transitions (FE-761 Slice 4: every producer split into dispatch + complete):
    //   slice-ready:slice-1,
    //   slice-1:evaluate:dispatch, slice-1:evaluate:complete,
    //   slice-1:evaluate:done, slice-1:evaluate:more,
    //   slice-1:write-tests:dispatch, slice-1:write-tests:complete,
    //   slice-1:write-code:dispatch, slice-1:write-code:complete,
    //   slice-1:run-tests:dispatch, slice-1:run-tests:complete,
    //   slice-1:run-tests:pass, slice-1:run-tests:fail,
    //   slice-1:assess-semantic:dispatch, slice-1:assess-semantic:complete,
    //   slice-1:assess-semantic:satisfied, slice-1:assess-semantic:rejected,
    //   slice-1:return-done, epic-complete:epic-1
    // Total: 19
    expect(blueprint.transitions.length).toBe(19);
  });

  it('simplePlan transitions carry correct contract metadata', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const transitions = blueprint.transitions;

    // Mechanical-lane transitions
    const mechanical = transitions.filter((t) => t.contract.lane === 'mechanical');
    expect(mechanical.length).toBeGreaterThanOrEqual(5); // ready, evaluate, write-tests, write-code, run-tests
    for (const t of mechanical) {
      if (t.contract.kind !== 'structural') {
        expect(t.contract.kind).toBe('mechanical');
      }
    }

    // Semantic-lane transitions
    const semantic = transitions.filter((t) => t.contract.lane === 'semantic');
    expect(semantic.length).toBeGreaterThanOrEqual(1); // assess-semantic, return-done
    // FE-761 Slice 4: the semantic-lane handler descriptor lives on :complete.
    const assessSemantic = transitions.find((t) => t.id.endsWith(':assess-semantic:complete'));
    expect(assessSemantic?.contract.kind).toBe('semantic');
    expect(assessSemantic?.contract.actor).toBe('semantic-assessor');
  });

  it('depPlan compiles with additional dep-signal places and transitions', () => {
    const blueprint = compileTopology(depPlan, { maxRetries: 3 });

    // depPlan: 1 epic, 2 slices (slice-b depends on slice-a)
    // Pool places: pool:test-agent, pool:code-agent = 2
    // Epic places: epic:epic-1:done = 1
    // Slice-a places: 19 (6 mechanical + eligible + retry-budget + semantic-budget + semantic-satisfied
    //                     + evaluate:reported + run-tests:reported + assess-semantic:reported
    //                     + halted (FE-761 Slice 2a)
    //                     + evaluate:running + write-tests:running + write-code:running
    //                     + run-tests:running + assess-semantic:running (FE-761 Slice 4))
    // Slice-b places: 19 (same)
    // Dep-signal places: slice:slice-a:dep-signal:slice-b = 1
    // Total: 42
    expect(blueprint.places.length).toBe(42);

    // Transitions (FE-761 Slice 4: each producer split into dispatch + complete):
    //   slice-a: slice-ready,
    //            evaluate:dispatch, evaluate:complete, evaluate:done, evaluate:more,
    //            write-tests:dispatch, write-tests:complete,
    //            write-code:dispatch, write-code:complete,
    //            run-tests:dispatch, run-tests:complete, run-tests:pass, run-tests:fail,
    //            assess-semantic:dispatch, assess-semantic:complete,
    //            assess-semantic:satisfied, assess-semantic:rejected,
    //            return-done = 18
    //   slice-b: same = 18
    //   epic-complete:epic-1 = 1
    // Total: 37
    expect(blueprint.transitions.length).toBe(37);
  });

  it('blueprint handler descriptors cover all transition kinds', () => {
    const blueprint = compileTopology(simplePlan, { maxRetries: 3 });
    const kinds = new Set(blueprint.transitions.map((t) => t.handler.kind));
    expect(kinds).toContain('passthrough');
    // FE-761 Slice 4: explicit dispatch/complete topology split adds dispatch descriptors.
    expect(kinds).toContain('dispatch');
    expect(kinds).toContain('action');
    expect(kinds).toContain('sibling-passthrough');
    expect(kinds).toContain('run-tests');
    expect(kinds).toContain('assess-semantic');
    expect(kinds).toContain('complete-slice');
    expect(kinds).toContain('complete-epic');
  });
});

// ---------------------------------------------------------------------------
// Adapter test — §7 event vocabulary
// ---------------------------------------------------------------------------

describe('Adapter: §7 event vocabulary', () => {
  it('simplePlan happy path emits transition_fired events for each transition', async () => {
    const fakes = createFakes();
    const ctx: RunCtx = {
      reportIds: [],
      sliceOutcomes: new Map(),
      epicOutcomes: new Map(),
    };
    const input: OrchestratorInput = {
      plan: simplePlan,
      sandboxDir: '/tmp/fake',
      actions: fakes.actions,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    };

    const net = compilePlan(input, ctx);
    const events: NetEvent[] = [];
    await net.run('serial', () => net.hasHaltToken(), { emit: (e) => events.push(e) });

    // All events should be transition_fired (happy path, no deadlock/halt)
    const fired = events.filter((e) => e.kind === 'transition_fired');
    expect(fired.length).toBeGreaterThan(0);

    // Check transition IDs appear in order
    const ids = fired.map((e) => e.transitionId);
    expect(ids).toContain('slice-ready:slice-1');
    // FE-761 Slice 4: producers split into dispatch + complete — both fire.
    expect(ids).toContain('slice-1:evaluate:dispatch');
    expect(ids).toContain('slice-1:evaluate:complete');
    expect(ids).toContain('slice-1:assess-semantic:dispatch');
    expect(ids).toContain('slice-1:assess-semantic:complete');
    expect(ids).toContain('slice-1:return-done');
    expect(ids).toContain('epic-complete:epic-1');

    // Each fired event carries contract metadata
    for (const e of fired) {
      expect(e.contract).toBeDefined();
      expect(e.consumed).toBeDefined();
      expect(e.produced).toBeDefined();
    }

    // No halt or false-deadlock events (happy path)
    expect(events.filter((e) => e.kind === 'net_halted').length).toBe(0);
    expect(events.filter((e) => e.kind === 'net_deadlocked').length).toBe(0);
  });

  it('retry exhaustion emits net_halted', async () => {
    const fakes = createFakes({ testRunResults: [false] });
    const ctx: RunCtx = {
      reportIds: [],
      sliceOutcomes: new Map(),
      epicOutcomes: new Map(),
    };
    const input: OrchestratorInput = {
      plan: simplePlan,
      sandboxDir: '/tmp/fake',
      actions: fakes.actions,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 1 },
    };

    const net = compilePlan(input, ctx);
    const events: NetEvent[] = [];
    // FE-761 Slice 2b: halt is observed via net.hasHaltToken() reading
    // tokens on `:halted` places, not via the retired ctx.halted mutation.
    await net.run('serial', () => net.hasHaltToken(), { emit: (e) => events.push(e) });

    // Should have a net_halted event once the retry-exhaustion halt token
    // lands on slice:slice-1:halted and the next loop iteration observes it.
    const halted = events.filter((e) => e.kind === 'net_halted');
    expect(halted.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// FE-763 — Petrinaut event stream end-to-end on the orchestrator
// ---------------------------------------------------------------------------

describe('FE-763: Petrinaut event stream on a real run', () => {
  it('emits initial_marking + transition_fired (with token payload) for simplePlan happy path', async () => {
    const fakes = createFakes();
    const ctx: RunCtx = {
      reportIds: [],
      sliceOutcomes: new Map(),
      epicOutcomes: new Map(),
    };
    const input: OrchestratorInput = {
      plan: simplePlan,
      sandboxDir: '/tmp/fake',
      actions: fakes.actions,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    };

    const blueprint = compileTopology(input.plan, input.policy);
    const net = wireHandlers(blueprint, input, ctx);

    const events: PetrinautEvent[] = [];
    const stream = createPetrinautEventStream({
      runId: 'run-e2e',
      folding: createNetFolding(blueprint),
      onEvent: (e) => events.push(e),
    });
    stream.emitInitialMarking(blueprint);
    await net.run('serial', () => net.hasHaltToken(), stream.sink);

    // 1. initial_marking is first.
    expect(events[0]!.kind).toBe('initial_marking');

    // 2. every event carries the runId.
    expect(events.every((e) => 'runId' in e && e.runId === 'run-e2e')).toBe(true);

    // 3. transition_fired events expose the FE-761 Slice 4 dispatch/complete
    //    topology directly in Petrinaut's wire format.
    //    FE-784: names are color-folded to slice-independent roles (the
    //    firing slice lives on the token color, not the transition name).
    const fired = events.filter((e): e is PetrinautTransitionFiredEvent => e.kind === 'transition_fired');
    const names = fired.map((e) => e.transitionName);
    expect(names).toContain('evaluate:dispatch');
    expect(names).toContain('evaluate:complete');
    expect(names).toContain('assess-semantic:dispatch');
    expect(names).toContain('assess-semantic:complete');

    // 4. each transition_fired carries per-place token data with a UUID
    //    (cross-team-agreed shape: { id: <UUID>, ...payload }).
    for (const e of fired) {
      for (const tokens of Object.values(e.input)) {
        for (const tok of tokens) expect(typeof tok.id).toBe('string');
      }
      for (const tokens of Object.values(e.output)) {
        for (const tok of tokens) expect(typeof tok.id).toBe('string');
      }
    }

    // 5. happy path: no net_halted / net_deadlocked emitted (engine exits
    //    the loop cleanly when nothing remains enabled). When the cook
    //    fails — retry exhaustion etc. — Petrinaut sees the halt token
    //    travel through the topology as a transition_fired event landing
    //    in `slice:<sid>:halted`, plus the engine emits net_halted.
    expect(events.filter((e) => e.kind === 'net_halted')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'net_deadlocked')).toHaveLength(0);
  });

  it('surfaces Petrinaut integration failures as warnings without halting the run', async () => {
    const fakes = createFakes();
    const result = await createOrchestrator('serial').run({
      plan: simplePlan,
      sandboxDir: '/tmp/fake',
      actions: fakes.actions,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
      runId: 'run-warnings',
      runDir: join(tmpdir(), 'brunch-missing-run-dir', 'child'),
    });

    expect(result.status).toBe('completed');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Petrinaut net export disabled:'),
        expect.stringContaining('Petrinaut event stream disabled:'),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Contract test #12 — parallel fires concurrently
// ---------------------------------------------------------------------------

describe('Engine contract test #12 — parallel fires concurrently', () => {
  const threeSlicePlan: Plan = {
    epics: [{ id: 'e1', summary: 'Three independent slices', depends_on: [], verification: [] }],
    slices: [
      {
        id: 'p1',
        epic_id: 'e1',
        definition: 'S1',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't1' }],
      },
      {
        id: 'p2',
        epic_id: 'e1',
        definition: 'S2',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't2' }],
      },
      {
        id: 'p3',
        epic_id: 'e1',
        definition: 'S3',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't3' }],
      },
    ],
  };

  it('parallel: multiple action handlers execute concurrently for independent slices', async () => {
    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const { tracked, tracker } = withConcurrencyTracking(fakes.actions);

    const engine = createOrchestrator('parallel');
    const result = await engine.run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: tracked,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    });

    expect(result.status).toBe('completed');
    // Under parallel policy, independent slices fire concurrently.
    expect(tracker.maxConcurrent).toBeGreaterThan(1);
  });

  it('serial: transitions fire one at a time, handlers run concurrently within agent-pool bounds', async () => {
    // FE-761 Slice 3: under async dispatch, "serial" means *transition
    // firing* is serial — but handlers run asynchronously after dispatch,
    // so multiple handlers can be in flight concurrently as long as the
    // agent pool has enough tokens. The agent pool (default = slices count
    // = 3 here) bounds handler concurrency.
    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const { tracked, tracker } = withConcurrencyTracking(fakes.actions);

    const engine = createOrchestrator('serial');
    const result = await engine.run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: tracked,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    });

    expect(result.status).toBe('completed');
    // Pre-Slice 3 this was hardcoded to 1 because fire() awaited the handler
    // inline. Now handlers complete asynchronously after dispatch.
    expect(tracker.maxConcurrent).toBeGreaterThan(1);
    expect(tracker.maxConcurrent).toBeLessThanOrEqual(threeSlicePlan.slices.length);
  });

  it('serial and parallel have comparable wall-clock for handler-bound work (async dispatch)', async () => {
    // FE-761 Slice 3: with async dispatch, both serial and parallel
    // policies let handlers run concurrently — the difference is only in
    // *transition* firing batching. For handler-bound work, both policies
    // complete in roughly the same wall-clock time.
    const DELAY_MS = 20;

    function createDelayedFakes() {
      const f = createFakes({ evalSequence: [true], semanticResults: [true] });
      const delayed: ActionHandlers = {};
      for (const [key, handler] of Object.entries(f.actions)) {
        delayed[key] = async (ctx: ActionContext) => {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
          return handler!(ctx);
        };
      }
      return { ...f, actions: delayed };
    }

    // Serial run
    const serialFakes = createDelayedFakes();
    const t0 = Date.now();
    await createOrchestrator('serial').run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: serialFakes.actions,
      reports: serialFakes.reports,
      testRunner: serialFakes.testRunner,
      policy: { maxRetries: 3 },
    });
    const serialMs = Date.now() - t0;

    // Parallel run
    const parallelFakes = createDelayedFakes();
    const t1 = Date.now();
    await createOrchestrator('parallel').run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: parallelFakes.actions,
      reports: parallelFakes.reports,
      testRunner: parallelFakes.testRunner,
      policy: { maxRetries: 3 },
    });
    const parallelMs = Date.now() - t1;

    // Parallel should be no slower than serial (they're effectively equal
    // now that async dispatch lets handlers overlap in both policies).
    // Allow a small constant slack for scheduling jitter.
    expect(parallelMs).toBeLessThan(serialMs + 25);
  });
});

// ---------------------------------------------------------------------------
// Contract test #13 — resource pool bounds concurrency
// ---------------------------------------------------------------------------

describe('Engine contract test #13 — resource pool bounds concurrency', () => {
  const threeSlicePlan: Plan = {
    epics: [{ id: 'e1', summary: 'Three independent slices', depends_on: [], verification: [] }],
    slices: [
      {
        id: 'r1',
        epic_id: 'e1',
        definition: 'S1',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't1' }],
      },
      {
        id: 'r2',
        epic_id: 'e1',
        definition: 'S2',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't2' }],
      },
      {
        id: 'r3',
        epic_id: 'e1',
        definition: 'S3',
        depends_on: [],
        verification: [{ kind: 'unit-test', target: 't3' }],
      },
    ],
  };

  const agentActions = new Set(['evaluate-done', 'write-tests', 'write-code']);

  it('parallel + agentPoolSize=1: only 1 agent-consuming action at a time', async () => {
    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const { tracked, tracker } = withConcurrencyTracking(fakes.actions, agentActions);

    const result = await createOrchestrator('parallel').run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: tracked,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3, agentPoolSize: 1 },
    });

    expect(result.status).toBe('completed');
    expect(tracker.maxConcurrent).toBe(1);
  });

  it('parallel + agentPoolSize=2: at most 2 agent-consuming actions at a time', async () => {
    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const { tracked, tracker } = withConcurrencyTracking(fakes.actions, agentActions);

    const result = await createOrchestrator('parallel').run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: tracked,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3, agentPoolSize: 2 },
    });

    expect(result.status).toBe('completed');
    expect(tracker.maxConcurrent).toBe(2);
  });

  it('default agentPoolSize (unbounded) preserves full concurrency', async () => {
    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const { tracked, tracker } = withConcurrencyTracking(fakes.actions, agentActions);

    const result = await createOrchestrator('parallel').run({
      plan: threeSlicePlan,
      sandboxDir: '/tmp/f',
      actions: tracked,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    });

    expect(result.status).toBe('completed');
    expect(tracker.maxConcurrent).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Adapter test — sandbox-per-slice isolation
// ---------------------------------------------------------------------------

describe('Adapter: sandbox-per-slice isolation', () => {
  it('each action handler receives a per-slice sandboxDir (parallel-safe)', async () => {
    const sandboxDirs = new Map<string, string>();

    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const trackingActions: ActionHandlers = {};
    for (const [key, handler] of Object.entries(fakes.actions)) {
      trackingActions[key] = async (ctx: ActionContext) => {
        sandboxDirs.set(`${ctx.slice.id}:${key}`, ctx.sandboxDir);
        return handler!(ctx);
      };
    }

    const engine = createOrchestrator('serial');
    const result = await engine.run({
      plan: simplePlan,
      sandboxDir: '/tmp/run',
      actions: trackingActions,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    });

    expect(result.status).toBe('completed');
    for (const [key, dir] of sandboxDirs) {
      const sliceId = key.split(':')[0]!;
      expect(dir).toBe(`/tmp/run/${sliceId}`);
      expect(simplePlan.slices.find((s) => s.id === sliceId)?.epic_id).toBe('epic-1');
    }
    expect(sandboxDirs.size).toBeGreaterThanOrEqual(2);
  });

  it('parallel slices in the same epic receive distinct sandboxDirs', async () => {
    const parallelPlan: Plan = {
      epics: [{ id: 'e1', summary: 'Three independent slices', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'p1',
          epic_id: 'e1',
          definition: 'S1',
          depends_on: [],
          verification: [{ kind: 'unit-test', target: 't1' }],
        },
        {
          id: 'p2',
          epic_id: 'e1',
          definition: 'S2',
          depends_on: [],
          verification: [{ kind: 'unit-test', target: 't2' }],
        },
        {
          id: 'p3',
          epic_id: 'e1',
          definition: 'S3',
          depends_on: [],
          verification: [{ kind: 'unit-test', target: 't3' }],
        },
      ],
    };

    const sandboxDirs = new Set<string>();
    const fakes = createFakes({ evalSequence: [true], semanticResults: [true] });
    const trackingActions: ActionHandlers = {};
    for (const [key, handler] of Object.entries(fakes.actions)) {
      trackingActions[key] = async (ctx: ActionContext) => {
        sandboxDirs.add(ctx.sandboxDir);
        return handler!(ctx);
      };
    }

    const result = await createOrchestrator('parallel').run({
      plan: parallelPlan,
      sandboxDir: '/tmp/parallel-run',
      actions: trackingActions,
      reports: fakes.reports,
      testRunner: fakes.testRunner,
      policy: { maxRetries: 3 },
    });

    expect(result.status).toBe('completed');
    expect(sandboxDirs.size).toBeGreaterThan(1);
    for (const dir of sandboxDirs) {
      expect(dir.startsWith('/tmp/parallel-run/')).toBe(true);
    }
  });

  it('verify-epic receives a merged epic sandbox under <parent>/__epic__/<epicId>/ (not slice worktree, not parent)', async () => {
    const verifyPlan: Plan = {
      epics: [
        {
          id: 'ev',
          summary: 'Verified',
          depends_on: [],
          verification: [{ kind: 'integration-test', target: 't' }],
        },
      ],
      slices: [
        {
          id: 'sv',
          epic_id: 'ev',
          definition: 'S',
          depends_on: [],
          verification: [{ kind: 'unit-test', target: 't' }],
        },
      ],
    };

    const parent = mkdtempSync(join(tmpdir(), 'cook-ec-'));
    try {
      // Seed the slice worktree with a file so the merge has something to copy.
      mkdirSync(join(parent, 'sv'), { recursive: true });
      writeFileSync(join(parent, 'sv', 'slice-marker.txt'), 'from-slice-sv');

      let verifyEpicSandboxDir = '';
      const fakes = createFakes({ evalSequence: [true], semanticResults: [true], verifyEpicResult: true });
      const trackingActions: ActionHandlers = {};
      for (const [key, handler] of Object.entries(fakes.actions)) {
        trackingActions[key] = async (ctx: ActionContext) => {
          if (key === 'verify-epic') verifyEpicSandboxDir = ctx.sandboxDir;
          return handler!(ctx);
        };
      }

      const result = await createOrchestrator('serial').run({
        plan: verifyPlan,
        sandboxDir: parent,
        actions: trackingActions,
        reports: fakes.reports,
        testRunner: fakes.testRunner,
        policy: { maxRetries: 3 },
      });

      expect(result.status).toBe('completed');
      expect(verifyEpicSandboxDir).toBe(join(parent, '__epic__', 'ev'));
      // Merge produced a real dir holding the slice worktree seed file.
      expect(existsSync(join(verifyEpicSandboxDir, 'slice-marker.txt'))).toBe(true);

      // An epic-sandbox-merged event was appended before verify-epic.
      const merged = fakes.reports.getAll().find((r) => r.event === 'epic-sandbox-merged');
      expect(merged).toBeDefined();
      expect(merged?.payload).toMatchObject({
        epicSandboxDir: join(parent, '__epic__', 'ev'),
        sliceIds: ['sv'],
        conflicts: [],
      });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
