import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Skill } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it } from 'vitest';

import {
  cookResourceLoader,
  createPiActions,
  epicRemediateTask,
  epicVerifyTask,
  instrumentToolDefinition,
  runPi,
  sandboxScopedSkills,
  type SessionFactory,
  sliceTestTask,
  toolLabel,
  toolsForAction,
} from './pi-actions.js';
import type { CookEvent } from './presenter/events.js';
import { brunchProfile, bunProfile } from './project-profile.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, Epic, Plan, ProbeGrounder, Slice, TestResult, TestRunner } from './types.js';

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

describe('evaluate-done / verify-epic share the runner seam — failureKind is visible at both', () => {
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
  const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };

  function fakeRunner(result: TestResult): TestRunner {
    return {
      async run() {
        return result;
      },
    };
  }

  function ctx(reports: InMemoryReportSink): ActionContext {
    return { slice, epic, plan, sandboxDir: '/tmp/unused', reports };
  }

  it('evaluate-done surfaces an infra failureKind in the eval-done report', async () => {
    const reports = new InMemoryReportSink();
    const actions = createPiActions({
      testRunner: fakeRunner({ passed: false, output: 'no runner', failureKind: 'infra' }),
    });
    const id = await actions['evaluate-done']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { done: boolean; failureKind?: string };
    expect(payload.done).toBe(false);
    expect(payload.failureKind).toBe('infra');
  });

  it('evaluate-done reports a passing verdict with no failureKind', async () => {
    const reports = new InMemoryReportSink();
    const actions = createPiActions({ testRunner: fakeRunner({ passed: true, output: 'ok' }) });
    const id = await actions['evaluate-done']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { done: boolean; failureKind?: string };
    expect(payload.done).toBe(true);
    expect(payload.failureKind).toBeUndefined();
  });

  it('verify-epic surfaces an infra failureKind in the epic-verified report', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const reports = new InMemoryReportSink();
    // verify-epic first runs a pi session to author the integration test; stub
    // it so no real agent runs, then the injected runner reports the infra fail.
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const actions = createPiActions({
      testRunner: fakeRunner({ passed: false, output: 'no runner', failureKind: 'infra' }),
      createSession,
    });
    const id = await actions['verify-epic']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { passed: boolean; failureKind?: string };
    expect(payload.passed).toBe(false);
    expect(payload.failureKind).toBe('infra');
  });

  it('brackets the test-run wait with a balanced activity-start/end', async () => {
    const events: CookEvent[] = [];
    const actions = createPiActions({
      testRunner: fakeRunner({ passed: true, output: 'ok' }),
      emit: (e) => events.push(e),
    });
    await actions['evaluate-done']!(ctx(new InMemoryReportSink()));

    const starts = events.filter((e) => e.kind === 'activity-start');
    const ends = events.filter((e) => e.kind === 'activity-end');
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect((ends[0] as { id: string }).id).toBe((starts[0] as { id: string }).id);
  });

  it('closes the pi-session activity even when the session fails (finally)', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const events: CookEvent[] = [];
    const createSession = (async () => {
      throw new Error('session boom');
    }) as unknown as SessionFactory;
    const actions = createPiActions({ createSession, emit: (e) => events.push(e) });

    await expect(actions['write-tests']!(ctx(new InMemoryReportSink()))).rejects.toThrow();
    expect(events.filter((e) => e.kind === 'activity-start')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'activity-end')).toHaveLength(1);
  });

  it('marks writer slices failed when pi throws before reporting', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const createSession = (async () => {
      throw new Error('session boom');
    }) as unknown as SessionFactory;

    for (const action of ['write-tests', 'write-code'] as const) {
      const events: CookEvent[] = [];
      const actions = createPiActions({ createSession, emit: (e) => events.push(e) });

      await expect(actions[action]!(ctx(new InMemoryReportSink()))).rejects.toThrow(/session boom/);

      expect(events.filter((e) => e.kind === 'slice')).toEqual([
        {
          kind: 'slice',
          id: 'chunk',
          epicId: 'utils',
          status: 'running',
          step: action === 'write-tests' ? 'tests' : 'code',
        },
        {
          kind: 'slice',
          id: 'chunk',
          epicId: 'utils',
          status: 'failed',
          reason: action === 'write-tests' ? 'test authoring failed' : 'code authoring failed',
        },
      ]);
    }
  });
});

describe('verify-epic reachability grounding (FE-876) — intent resolves before the epic verdict', () => {
  const probeDirs: string[] = [];
  afterEach(() => {
    for (const dir of probeDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  // A real zero-dep app that answers `routes` (path → status); 404 otherwise.
  function appSandbox(routes: Record<string, number>): string {
    const dir = mkdtempSync(join(tmpdir(), 'verify-epic-probe-'));
    probeDirs.push(dir);
    writeFileSync(
      join(dir, 'server.js'),
      `const http = require('node:http');\n` +
        `const routes = ${JSON.stringify(routes)};\n` +
        `http.createServer((req, res) => {\n` +
        `  const status = routes[req.url] ?? 404;\n` +
        `  res.writeHead(status); res.end(String(status));\n` +
        `}).listen(Number(process.env.PORT), '127.0.0.1');\n`,
    );
    return dir;
  }

  function epicWithProbe(): Epic {
    return {
      id: 'utils',
      summary: 'Utilities',
      depends_on: [],
      verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
      probe: { boot: ['node', 'server.js'], readyPath: '/health', featurePath: '/feature' },
    };
  }

  function passingActions(sandboxDir: string): {
    actions: ReturnType<typeof createPiActions>;
    ctx: (reports: InMemoryReportSink) => ActionContext;
  } {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const epic = epicWithProbe();
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      createSession,
    });
    return { actions, ctx: (reports) => ({ slice, epic, plan, sandboxDir, reports }) };
  }

  it('tests pass + feature reachable → epic passes (reachable)', async () => {
    const reports = new InMemoryReportSink();
    const { actions, ctx } = passingActions(appSandbox({ '/health': 200, '/feature': 200 }));
    const id = await actions['verify-epic']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { passed: boolean; reachability?: string };
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBe('reachable');
  });

  it('tests pass but feature endpoint is absent → epic fails (the FE-800 orphan)', async () => {
    const reports = new InMemoryReportSink();
    // App boots and answers /health, but /feature is 404 — merged but not wired in.
    const { actions, ctx } = passingActions(appSandbox({ '/health': 200 }));
    const id = await actions['verify-epic']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { passed: boolean; reachability?: string };
    expect(payload.passed).toBe(false);
    expect(payload.reachability).toBe('not-reachable');
  });

  it('failing tests short-circuit the probe — no boot, unchanged unit verdict', async () => {
    const reports = new InMemoryReportSink();
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const epic = epicWithProbe();
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: false, output: 'no runner', failureKind: 'infra' };
        },
      },
      createSession,
    });
    // Point at a dir with no server.js: if the probe booted, it would error — it
    // must not run because tests failed first.
    const id = await actions['verify-epic']!({ slice, epic, plan, sandboxDir: tmpdir(), reports });
    const payload = reports.getById(id)!.payload as {
      passed: boolean;
      failureKind?: string;
      reachability?: string;
    };
    expect(payload.passed).toBe(false);
    expect(payload.failureKind).toBe('infra');
    expect(payload.reachability).toBeUndefined();
  });

  it('no probe target → unit-test verdict only (unchanged behavior)', async () => {
    const reports = new InMemoryReportSink();
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const epic: Epic = {
      id: 'utils',
      summary: 'Utilities',
      depends_on: [],
      verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
    };
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      createSession,
    });
    const id = await actions['verify-epic']!({ slice, epic, plan, sandboxDir: tmpdir(), reports });
    const payload = reports.getById(id)!.payload as { passed: boolean; reachability?: string };
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBeUndefined();
  });

  // ---- Half B: cook-time grounding seam -----------------------------------

  function intentEpic(extra?: Partial<Epic>): Epic {
    return {
      id: 'utils',
      summary: 'Utilities',
      depends_on: [],
      verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
      reachability: { feature: 'the /feature route responds' },
      ...extra,
    };
  }

  function groundedVerifyEpic(opts: {
    sandboxDir: string;
    epic: Epic;
    groundProbe?: ProbeGrounder;
  }): Promise<{ passed: boolean; failureKind?: string; reachability?: string }> {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const reports = new InMemoryReportSink();
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [opts.epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      createSession,
      groundProbe: opts.groundProbe,
    });
    return actions['verify-epic']!({
      slice,
      epic: opts.epic,
      plan,
      sandboxDir: opts.sandboxDir,
      reports,
    }).then(
      (id) =>
        reports.getById(id)!.payload as { passed: boolean; failureKind?: string; reachability?: string },
    );
  }

  it('grounds a reachability intent into a concrete target, then probes it', async () => {
    let seenFeature = '';
    const payload = await groundedVerifyEpic({
      sandboxDir: appSandbox({ '/health': 200, '/feature': 200 }),
      epic: intentEpic(),
      groundProbe: async (intent) => {
        seenFeature = intent.feature;
        return { boot: ['node', 'server.js'], readyPath: '/health', featurePath: '/feature' };
      },
    });
    expect(seenFeature).toContain('/feature');
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBe('reachable');
  });

  it('a reachability intent with no injected grounder is a no-op (unit verdict only)', async () => {
    // sandbox has no app; if grounding ran and probed, it would error/fail.
    const payload = await groundedVerifyEpic({ sandboxDir: tmpdir(), epic: intentEpic() });
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBeUndefined();
  });

  it('a grounder that throws is an infra fault — the epic fails, not silently passes', async () => {
    const payload = await groundedVerifyEpic({
      sandboxDir: tmpdir(),
      epic: intentEpic(),
      groundProbe: async () => {
        throw new Error('agent could not resolve wiring');
      },
    });
    expect(payload.passed).toBe(false);
    expect(payload.failureKind).toBe('infra');
    expect(payload.reachability).toBe('infra');
  });

  it('a concrete probe target wins over a reachability intent (Half A precedence)', async () => {
    let grounderCalled = false;
    const payload = await groundedVerifyEpic({
      sandboxDir: appSandbox({ '/health': 200, '/feature': 200 }),
      epic: intentEpic({
        probe: { boot: ['node', 'server.js'], readyPath: '/health', featurePath: '/feature' },
      }),
      groundProbe: async () => {
        grounderCalled = true;
        throw new Error('should not be called');
      },
    });
    expect(grounderCalled).toBe(false);
    expect(payload.reachability).toBe('reachable');
  });
});

describe('verify-epic integration oracle (FE-876) — reachability folds into the epic verdict', () => {
  const probeDirs: string[] = [];
  afterEach(() => {
    for (const dir of probeDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  // A real zero-dep app that answers `routes` (path → status); 404 otherwise.
  function appSandbox(routes: Record<string, number>): string {
    const dir = mkdtempSync(join(tmpdir(), 'verify-epic-probe-'));
    probeDirs.push(dir);
    writeFileSync(
      join(dir, 'server.js'),
      `const http = require('node:http');\n` +
        `const routes = ${JSON.stringify(routes)};\n` +
        `http.createServer((req, res) => {\n` +
        `  const status = routes[req.url] ?? 404;\n` +
        `  res.writeHead(status); res.end(String(status));\n` +
        `}).listen(Number(process.env.PORT), '127.0.0.1');\n`,
    );
    return dir;
  }

  function epicWithProbe(): Epic {
    return {
      id: 'utils',
      summary: 'Utilities',
      depends_on: [],
      verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
      probe: { boot: ['node', 'server.js'], readyPath: '/health', featurePath: '/feature' },
    };
  }

  function passingActions(sandboxDir: string): {
    actions: ReturnType<typeof createPiActions>;
    ctx: (reports: InMemoryReportSink) => ActionContext;
  } {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const epic = epicWithProbe();
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      createSession,
    });
    return { actions, ctx: (reports) => ({ slice, epic, plan, sandboxDir, reports }) };
  }

  it('tests pass + feature reachable → epic passes (reachable)', async () => {
    const reports = new InMemoryReportSink();
    const { actions, ctx } = passingActions(appSandbox({ '/health': 200, '/feature': 200 }));
    const id = await actions['verify-epic']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { passed: boolean; reachability?: string };
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBe('reachable');
  });

  it('tests pass but feature endpoint is absent → epic fails (the FE-800 orphan)', async () => {
    const reports = new InMemoryReportSink();
    // App boots and answers /health, but /feature is 404 — merged but not wired in.
    const { actions, ctx } = passingActions(appSandbox({ '/health': 200 }));
    const id = await actions['verify-epic']!(ctx(reports));
    const payload = reports.getById(id)!.payload as { passed: boolean; reachability?: string };
    expect(payload.passed).toBe(false);
    expect(payload.reachability).toBe('not-reachable');
  });

  it('failing tests short-circuit the probe — no boot, unchanged unit verdict', async () => {
    const reports = new InMemoryReportSink();
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const epic = epicWithProbe();
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: false, output: 'no runner', failureKind: 'infra' };
        },
      },
      createSession,
    });
    // Point at a dir with no server.js: if the probe booted, it would error — it
    // must not run because tests failed first.
    const id = await actions['verify-epic']!({ slice, epic, plan, sandboxDir: tmpdir(), reports });
    const payload = reports.getById(id)!.payload as {
      passed: boolean;
      failureKind?: string;
      reachability?: string;
    };
    expect(payload.passed).toBe(false);
    expect(payload.failureKind).toBe('infra');
    expect(payload.reachability).toBeUndefined();
  });

  it('no probe target → unit-test verdict only (unchanged behavior)', async () => {
    const reports = new InMemoryReportSink();
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const epic: Epic = {
      id: 'utils',
      summary: 'Utilities',
      depends_on: [],
      verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
    };
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      createSession,
    });
    const id = await actions['verify-epic']!({ slice, epic, plan, sandboxDir: tmpdir(), reports });
    const payload = reports.getById(id)!.payload as { passed: boolean; reachability?: string };
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBeUndefined();
  });

  // ---- Half B: cook-time grounding seam -----------------------------------

  function intentEpic(extra?: Partial<Epic>): Epic {
    return {
      id: 'utils',
      summary: 'Utilities',
      depends_on: [],
      verification: [{ kind: 'integration-test', target: 'tests/utils.integration.test.ts' }],
      reachability: { feature: 'the /feature route responds' },
      ...extra,
    };
  }

  function groundedVerifyEpic(opts: {
    sandboxDir: string;
    epic: Epic;
    groundProbe?: ProbeGrounder;
  }): Promise<{ passed: boolean; failureKind?: string; reachability?: string }> {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const reports = new InMemoryReportSink();
    const fake = makeFakeSession({ emit: 'wrote the integration test' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const slice: Slice = {
      id: 'chunk',
      epic_id: 'utils',
      definition: 'Add chunk()',
      depends_on: [],
      verification: [{ kind: 'unit-test', target: 'tests/chunk.test.ts' }],
    };
    const plan: Plan = { mode: 'greenfield', epics: [opts.epic], slices: [slice] };
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      createSession,
      groundProbe: opts.groundProbe,
    });
    return actions['verify-epic']!({
      slice,
      epic: opts.epic,
      plan,
      sandboxDir: opts.sandboxDir,
      reports,
    }).then(
      (id) =>
        reports.getById(id)!.payload as { passed: boolean; failureKind?: string; reachability?: string },
    );
  }

  it('grounds a reachability intent into a concrete target, then probes it', async () => {
    let seenFeature = '';
    const payload = await groundedVerifyEpic({
      sandboxDir: appSandbox({ '/health': 200, '/feature': 200 }),
      epic: intentEpic(),
      groundProbe: async (intent) => {
        seenFeature = intent.feature;
        return { boot: ['node', 'server.js'], readyPath: '/health', featurePath: '/feature' };
      },
    });
    expect(seenFeature).toContain('/feature');
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBe('reachable');
  });

  it('a reachability intent with no injected grounder is a no-op (unit verdict only)', async () => {
    // sandbox has no app; if grounding ran and probed, it would error/fail.
    const payload = await groundedVerifyEpic({ sandboxDir: tmpdir(), epic: intentEpic() });
    expect(payload.passed).toBe(true);
    expect(payload.reachability).toBeUndefined();
  });

  it('a grounder that throws is an infra fault — the epic fails, not silently passes', async () => {
    const payload = await groundedVerifyEpic({
      sandboxDir: tmpdir(),
      epic: intentEpic(),
      groundProbe: async () => {
        throw new Error('agent could not resolve wiring');
      },
    });
    expect(payload.passed).toBe(false);
    expect(payload.failureKind).toBe('infra');
    expect(payload.reachability).toBe('infra');
  });

  it('a concrete probe target wins over a reachability intent (Half A precedence)', async () => {
    let grounderCalled = false;
    const payload = await groundedVerifyEpic({
      sandboxDir: appSandbox({ '/health': 200, '/feature': 200 }),
      epic: intentEpic({
        probe: { boot: ['node', 'server.js'], readyPath: '/health', featurePath: '/feature' },
      }),
      groundProbe: async () => {
        grounderCalled = true;
        throw new Error('should not be called');
      },
    });
    expect(grounderCalled).toBe(false);
    expect(payload.reachability).toBe('reachable');
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

// A controllable stand-in for the SDK boundary so runPi's drive logic can be
// tested without network or a real model. abort() unsticks a hung prompt the
// way the real session does.
function makeFakeSession(behavior: {
  emit?: string | readonly unknown[];
  hang?: boolean;
  finalStopReason?: 'stop' | 'error' | 'aborted';
  errorMessage?: string;
}) {
  const calls = { prompt: [] as string[], aborted: false, disposed: false };
  let listener: ((event: unknown) => void) | undefined;
  let resolveHang: (() => void) | undefined;
  const messages: unknown[] = [];
  const session = {
    subscribe(fn: (event: unknown) => void) {
      listener = fn;
      return () => {};
    },
    async prompt(text: string) {
      calls.prompt.push(text);
      const emissions = Array.isArray(behavior.emit) ? behavior.emit : [behavior.emit];
      for (const delta of emissions) {
        if (delta === undefined) continue;
        listener?.({
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta },
        });
      }
      if (behavior.hang) await new Promise<void>((res) => (resolveHang = res));
      if (behavior.finalStopReason) {
        messages.push({
          role: 'assistant',
          content: [],
          stopReason: behavior.finalStopReason,
          ...(behavior.errorMessage ? { errorMessage: behavior.errorMessage } : {}),
        });
      }
    },
    async abort() {
      calls.aborted = true;
      resolveHang?.();
    },
    dispose() {
      calls.disposed = true;
    },
    get state() {
      return { messages };
    },
    get messages() {
      return messages;
    },
  };
  return { calls, session };
}

describe('runPi drives an in-process pi session (no subprocess)', () => {
  const baseOpts = (sandboxDir: string, tools: string) => ({
    label: 'tests slice-1',
    model: 'claude-opus-4-6',
    promptFile: join(promptsDir, 'test-writer.md'),
    task: 'do the thing',
    sandboxDir,
    tools,
  });

  it('binds the session to the sandbox cwd, splits the tool string into the SDK allowlist, and returns captured output', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({ emit: 'wrote the tests' });
      let capturedOptions: { cwd?: string; tools?: string[] } | undefined;
      const createSession = (async (options: { cwd?: string; tools?: string[] }) => {
        capturedOptions = options;
        return { session: fake.session };
      }) as unknown as SessionFactory;

      const out = await runPi(baseOpts(sandboxDir, 'read,write,edit,bash'), { createSession });

      expect(capturedOptions?.cwd).toBe(sandboxDir);
      expect(capturedOptions?.tools).toEqual(['read', 'write', 'edit', 'bash']);
      expect(fake.calls.prompt).toEqual(['do the thing']);
      expect(out).toContain('wrote the tests');
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('honors a read-only tool allowlist — no write/edit/bash reach the SDK (preserves I126-K)', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({ emit: 'observed' });
      let capturedTools: string[] | undefined;
      const createSession = (async (options: { tools?: string[] }) => {
        capturedTools = options.tools;
        return { session: fake.session };
      }) as unknown as SessionFactory;

      await runPi(baseOpts(sandboxDir, 'read'), { createSession });

      expect(capturedTools).toEqual(['read']);
      expect(capturedTools).not.toContain('write');
      expect(capturedTools).not.toContain('edit');
      expect(capturedTools).not.toContain('bash');
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('shadows the built-in file tools with sandbox-confined definitions (FE-853)', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({ emit: 'ok' });
      let capturedCustomTools: Array<{ name: string }> | undefined;
      const createSession = (async (options: { customTools?: Array<{ name: string }> }) => {
        capturedCustomTools = options.customTools;
        return { session: fake.session };
      }) as unknown as SessionFactory;

      await runPi(baseOpts(sandboxDir, 'read,write,edit,bash'), { createSession });

      // Same names as the built-ins, so the SDK registry overrides them and the
      // per-action allowlist (I126-K) keeps filtering both the same way.
      expect(capturedCustomTools?.map((t) => t.name).sort()).toEqual(['edit', 'read', 'write']);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('captures agent output without writing it to process.stdout', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    const writes: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stdout.write;
    try {
      const fake = makeFakeSession({ emit: 'SECRET_AGENT_OUTPUT' });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
      await runPi(baseOpts(sandboxDir, 'read'), { createSession });
    } finally {
      process.stdout.write = original;
      rmSync(sandboxDir, { recursive: true, force: true });
    }
    expect(writes.join('')).not.toContain('SECRET_AGENT_OUTPUT');
  });

  it('caps activity heartbeat snippets including the ellipsis', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    const events: CookEvent[] = [];
    createPiActions({ emit: (e) => events.push(e) });
    try {
      const fake = makeFakeSession({ emit: 'x'.repeat(2_048) });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
      await runPi(baseOpts(sandboxDir, 'read'), { createSession });
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
    const progress = events.find(
      (e): e is Extract<CookEvent, { kind: 'activity-progress' }> => e.kind === 'activity-progress',
    );
    expect(progress?.detail).toHaveLength(56);
    expect(progress?.detail.startsWith('…')).toBe(true);
  });

  it('aborts the session and rejects when the prompt exceeds the timeout', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({ hang: true });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession, timeoutMs: 20 })).rejects.toThrow(
        /timed out/,
      );
      expect(fake.calls.aborted).toBe(true);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('rejects when the SDK resolves prompt with a failed assistant turn', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({
        emit: 'partial output',
        finalStopReason: 'error',
        errorMessage: 'model failed',
      });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;

      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession })).rejects.toThrow(/model failed/);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('treats the timeout as an idle deadline — periodic activity keeps a long session alive (FE-864)', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      // Emit a non-text activity event every 15ms for ~90ms total — well past
      // the 40ms budget, but never idle longer than it. A wall-clock cap would
      // abort; an idle deadline (re-armed on any event, not just text) must not.
      let listener: ((event: unknown) => void) | undefined;
      let aborted = false;
      const session = {
        subscribe(fn: (event: unknown) => void) {
          listener = fn;
          return () => {};
        },
        async prompt() {
          for (let i = 0; i < 6; i++) {
            await new Promise<void>((res) => setTimeout(res, 15));
            listener?.({ type: 'tool_execution_update' });
          }
        },
        async abort() {
          aborted = true;
        },
        dispose() {},
        get state() {
          return { messages: [] as unknown[] };
        },
      };
      const createSession = (async () => ({ session })) as unknown as SessionFactory;

      await expect(
        runPi(baseOpts(sandboxDir, 'read'), { createSession, timeoutMs: 40 }),
      ).resolves.toBeDefined();
      expect(aborted).toBe(false);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('throws a clear error when ANTHROPIC_API_KEY is absent (no pi login / auth.json fallback)', async () => {
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const createSession = (async () => ({
        session: makeFakeSession({}).session,
      })) as unknown as SessionFactory;
      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession })).rejects.toThrow(
        /ANTHROPIC_API_KEY/,
      );
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('uses an isolated agent dir per call and removes it after the session ends', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const agentDirs: (string | undefined)[] = [];
      const createSession = (async (options: { agentDir?: string }) => {
        agentDirs.push(options.agentDir);
        return { session: makeFakeSession({ emit: 'ok' }).session };
      }) as unknown as SessionFactory;

      await runPi(baseOpts(sandboxDir, 'read'), { createSession });
      const firstDir = agentDirs[0];
      await runPi(baseOpts(sandboxDir, 'read'), { createSession });

      expect(firstDir).toBeDefined();
      expect(agentDirs[1]).toBeDefined();
      expect(agentDirs[1]).not.toBe(firstDir);
      expect(existsSync(firstDir!)).toBe(false);
      expect(existsSync(agentDirs[1]!)).toBe(false);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('rejects on timeout even while session creation is still pending', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const createSession = (async () => new Promise(() => {})) as unknown as SessionFactory;
      const outcome = await Promise.race([
        runPi(baseOpts(sandboxDir, 'read'), { createSession, timeoutMs: 20 }).then(
          () => 'resolved',
          (err: unknown) => (err instanceof Error ? err.message : String(err)),
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 80)),
      ]);

      expect(outcome).toMatch(/timed out/);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('removes the agent dir after setup timeout even if session creation never settles', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      let agentDir: string | undefined;
      const createSession = (async (options: { agentDir?: string }) => {
        agentDir = options.agentDir;
        await new Promise(() => {});
      }) as unknown as SessionFactory;

      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession, timeoutMs: 20 })).rejects.toThrow(
        /timed out/,
      );

      expect(agentDir).toBeDefined();
      expect(existsSync(agentDir!)).toBe(false);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('aborts and rejects when captured output exceeds the size cap', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({ emit: 'x'.repeat(50) });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession, maxOutput: 10 })).rejects.toThrow(
        /exceeded/,
      );
      expect(fake.calls.aborted).toBe(true);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('does not keep appending text deltas after the output cap aborts the session', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    let appendedAfterOverflow = false;
    try {
      const fake = makeFakeSession({
        emit: [
          'x'.repeat(50),
          {
            toString() {
              appendedAfterOverflow = true;
              return 'should not be appended';
            },
          },
        ],
      });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;

      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession, maxOutput: 10 })).rejects.toThrow(
        /exceeded/,
      );

      expect(fake.calls.aborted).toBe(true);
      expect(appendedAfterOverflow).toBe(false);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('counts the output cap in UTF-8 bytes rather than JavaScript code units', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-runpi-'));
    try {
      const fake = makeFakeSession({ emit: 'ééé' });
      const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;

      await expect(runPi(baseOpts(sandboxDir, 'read'), { createSession, maxOutput: 4 })).rejects.toThrow(
        /exceeded/,
      );

      expect(fake.calls.aborted).toBe(true);
    } finally {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
  });
});

// Opt-in self-containment smoke. Skipped unless both PI_REAL_LLM=1 and
// ANTHROPIC_API_KEY are set, so it stays out of CI and the default local
// `npm run verify`. Drives the real in-process pi session end-to-end (no fake) —
// the agent must use the write tool to create a file — proving brunch needs no
// external `pi` binary on $PATH. Run with:
//   PI_REAL_LLM=1 ANTHROPIC_API_KEY=… npx vitest run \
//     src/orchestrator/src/pi-actions.test.ts
describe('runPi — real LLM self-containment smoke', () => {
  const realLlmEnabled = process.env.PI_REAL_LLM === '1' && Boolean(process.env.ANTHROPIC_API_KEY);
  const itReal = realLlmEnabled ? it : it.skip;

  itReal(
    'drives a real in-process session that uses the write tool — no external pi binary',
    async () => {
      const sandboxDir = mkdtempSync(join(tmpdir(), 'brunch-pi-smoke-'));
      const promptFile = join(sandboxDir, 'prompt.md');
      writeFileSync(
        promptFile,
        'You are a coding assistant. Use the write tool to create files exactly as instructed. Do nothing else.',
      );
      try {
        await runPi({
          label: 'smoke',
          model: 'claude-opus-4-6',
          promptFile,
          task: 'Use the write tool to create a file named hello.txt in the current directory containing exactly: BRUNCH_SELF_CONTAINED',
          sandboxDir,
          tools: 'read,write,edit,bash',
        });
        expect(readFileSync(join(sandboxDir, 'hello.txt'), 'utf8')).toContain('BRUNCH_SELF_CONTAINED');
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    },
    120_000,
  );
});

describe('toolLabel — what the agent is doing', () => {
  it('labels file tools by path, bash by command, grep/find by pattern', () => {
    expect(toolLabel('edit', { path: 'src/auth/token.ts' })).toBe('edit src/auth/token.ts');
    expect(toolLabel('write', { path: 'tests/x.test.ts' })).toBe('write tests/x.test.ts');
    expect(toolLabel('bash', { command: 'bun test' })).toBe('bash bun test');
    expect(toolLabel('grep', { pattern: 'RefreshToken' })).toBe('grep RefreshToken');
  });

  it('falls back to the bare tool name when no recognized target is present', () => {
    expect(toolLabel('read', {})).toBe('read');
    expect(toolLabel('bash', undefined)).toBe('bash');
  });

  it('truncates long labels with an ellipsis', () => {
    const long = toolLabel('edit', { path: 'a/'.repeat(60) });
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(56);
  });
});

describe('instrumentToolDefinition — observe then delegate', () => {
  function fakeTool(name: string, run: (...args: unknown[]) => unknown) {
    return { name, execute: run } as unknown as Parameters<typeof instrumentToolDefinition>[0];
  }

  it('emits a label from the params, then delegates with the same args and result', () => {
    const seen: unknown[] = [];
    const labels: string[] = [];
    const def = fakeTool('edit', (...args) => {
      seen.push(...args);
      return 'tool-result';
    });

    instrumentToolDefinition(def, (label) => labels.push(label));
    const out = def.execute('call-1', { path: 'src/a.ts' }, undefined, undefined, {} as never);

    expect(labels).toEqual(['edit src/a.ts']);
    expect(out).toBe('tool-result'); // delegation result preserved
    expect(seen).toEqual(['call-1', { path: 'src/a.ts' }, undefined, undefined, {}]); // same args
  });

  it('never lets an observation error break the tool call', () => {
    const def = fakeTool('bash', () => 'ok');
    instrumentToolDefinition(def, () => {
      throw new Error('observer boom');
    });
    expect(def.execute('id', { command: 'echo hi' }, undefined, undefined, {} as never)).toBe('ok');
  });

  it('brackets an async tool: onStart before, onSettle only after it resolves', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const def = fakeTool('bash', async () => {
      await gate;
      return 'done';
    });
    instrumentToolDefinition(
      def,
      () => order.push('start'),
      () => order.push('settle'),
    );

    const pending = def.execute('id', { command: 'bun test' }, undefined, undefined, {} as never);
    // Start fired synchronously; settle must NOT fire while the tool is in flight.
    expect(order).toEqual(['start']);
    release();
    await expect(pending).resolves.toBe('done');
    expect(order).toEqual(['start', 'settle']);
  });

  it('settles on a rejected tool call too', async () => {
    const order: string[] = [];
    const def = fakeTool('bash', async () => {
      throw new Error('tool failed');
    });
    instrumentToolDefinition(
      def,
      () => order.push('start'),
      () => order.push('settle'),
    );
    await expect(
      def.execute('id', { command: 'bun test' }, undefined, undefined, {} as never),
    ).rejects.toThrow('tool failed');
    expect(order).toEqual(['start', 'settle']);
  });
});

describe('action handlers emit slice grid events', () => {
  const slice: Slice = {
    id: 'login',
    epic_id: 'api',
    definition: 'Login',
    depends_on: [],
    verification: [{ kind: 'unit-test', target: 'tests/login.test.ts' }],
  };
  const epic: Epic = { id: 'api', summary: 'API', depends_on: [], verification: [] };
  const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
  const ctx = (): ActionContext => ({
    slice,
    epic,
    plan,
    sandboxDir: '/tmp/unused',
    reports: new InMemoryReportSink(),
  });
  type SliceEvent = Extract<CookEvent, { kind: 'slice' }>;
  const sliceEvents = (events: CookEvent[]) => events.filter((e): e is SliceEvent => e.kind === 'slice');

  it('evaluate-done emits running(verify) then passed for a DONE verdict', async () => {
    const events: CookEvent[] = [];
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: true, output: 'ok' };
        },
      },
      emit: (e) => events.push(e),
    });
    await actions['evaluate-done']!(ctx());
    expect(sliceEvents(events).map((s) => [s.id, s.status, s.step])).toEqual([
      ['login', 'running', 'verify'],
      ['login', 'passed', undefined],
    ]);
  });

  it('evaluate-done emits failed for a NEEDS-WORK verdict', async () => {
    const events: CookEvent[] = [];
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: false, output: 'nope' };
        },
      },
      emit: (e) => events.push(e),
    });
    await actions['evaluate-done']!(ctx());
    expect(sliceEvents(events).at(-1)).toMatchObject({ status: 'failed' });
  });

  it('evaluate-done does NOT emit a failure for an unbuilt slice (absent gate)', async () => {
    // The greenfield gate runs before any test file exists → failureKind 'absent'.
    // That is "not started", not a red: emitting `failed` here makes the presenter
    // count a phantom attempt and paint a ✗ NEEDS WORK on every clean slice.
    const events: CookEvent[] = [];
    const reports = new InMemoryReportSink();
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: false, output: 'No test files found, exiting with code 1', failureKind: 'absent' };
        },
      },
      emit: (e) => events.push(e),
    });
    const id = await actions['evaluate-done']!({ ...ctx(), reports });
    // Stays running(verify) → routes to write-tests as the same attempt; never 'failed'.
    expect(sliceEvents(events).map((s) => [s.status, s.step])).toEqual([['running', 'verify']]);
    expect(sliceEvents(events).some((s) => s.status === 'failed')).toBe(false);
    // The verdict still reports not-done so the net routes to needs-more (write-tests).
    const payload = reports.getById(id)!.payload as { done: boolean; failureKind?: string };
    expect(payload.done).toBe(false);
    expect(payload.failureKind).toBe('absent');
  });

  it('write-tests emits running(tests) keyed by the slice id', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const events: CookEvent[] = [];
    const fake = makeFakeSession({ emit: 'wrote tests' });
    const createSession = (async () => ({ session: fake.session })) as unknown as SessionFactory;
    const actions = createPiActions({ createSession, emit: (e) => events.push(e) });
    await actions['write-tests']!(ctx());
    expect(sliceEvents(events)[0]).toMatchObject({
      id: 'login',
      epicId: 'api',
      status: 'running',
      step: 'tests',
    });
  });
});

describe('evaluate-done failure carries a reason', () => {
  const slice: Slice = {
    id: 'login',
    epic_id: 'api',
    definition: 'L',
    depends_on: [],
    verification: [{ kind: 'unit-test', target: 'tests/l.test.ts' }],
  };
  const epic: Epic = { id: 'api', summary: 'API', depends_on: [], verification: [] };
  const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };
  const ctx = (): ActionContext => ({
    slice,
    epic,
    plan,
    sandboxDir: '/tmp/x',
    reports: new InMemoryReportSink(),
  });
  type SliceEvent = Extract<CookEvent, { kind: 'slice' }>;
  const lastSlice = (events: CookEvent[]) => events.filter((e): e is SliceEvent => e.kind === 'slice').at(-1);

  it('maps a test failure to "tests failed"', async () => {
    const events: CookEvent[] = [];
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: false, output: 'fail', failureKind: 'test' };
        },
      },
      emit: (e) => events.push(e),
    });
    await actions['evaluate-done']!(ctx());
    expect(lastSlice(events)).toMatchObject({ status: 'failed', reason: 'tests failed' });
  });

  it('maps an infra failure to "infra error"', async () => {
    const events: CookEvent[] = [];
    const actions = createPiActions({
      testRunner: {
        async run() {
          return { passed: false, output: 'no runner', failureKind: 'infra' };
        },
      },
      emit: (e) => events.push(e),
    });
    await actions['evaluate-done']!(ctx());
    expect(lastSlice(events)).toMatchObject({ status: 'failed', reason: 'infra error' });
  });
});

describe('sandboxScopedSkills (FE-881) keeps only skills rooted under the sandbox', () => {
  const skill = (filePath: string): Skill => ({
    name: filePath,
    description: '',
    filePath,
    baseDir: dirname(filePath),
    sourceInfo: {} as Skill['sourceInfo'],
    disableModelInvocation: false,
  });

  it('keeps repo skills, drops sibling-slice / prefix-lookalike / global skills', () => {
    const sandbox = '/tmp/run/worktree/slice-a';
    const kept = sandboxScopedSkills(
      [
        skill('/tmp/run/worktree/slice-a/.agents/skills/foo/SKILL.md'),
        skill('/tmp/run/worktree/slice-a/.claude/skills/bar/SKILL.md'),
        skill('/tmp/run/worktree/slice-b/.agents/skills/sibling/SKILL.md'),
        skill('/tmp/run/worktree/slice-a-other/.agents/skills/lookalike/SKILL.md'),
        skill('/home/dev/.pi/skills/global/SKILL.md'),
      ],
      sandbox,
    );
    expect(kept.map((s) => s.name)).toEqual([
      '/tmp/run/worktree/slice-a/.agents/skills/foo/SKILL.md',
      '/tmp/run/worktree/slice-a/.claude/skills/bar/SKILL.md',
    ]);
  });
});

describe('cookResourceLoader (FE-881) loads sandbox skills, excludes global', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  const writeSkill = (root: string, name: string) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
      join(root, name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${name} skill\n---\nbody\n`,
    );
  };

  it('discovers the repo .agents/skills and drops agentDir (global) skills', async () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'cook-sandbox-'));
    dirs.push(sandbox);
    const agentDir = mkdtempSync(join(tmpdir(), 'cook-agent-'));
    dirs.push(agentDir);
    writeSkill(join(sandbox, '.agents', 'skills'), 'repo-skill');
    writeSkill(join(agentDir, 'skills'), 'global-skill');

    const loader = cookResourceLoader(sandbox, agentDir, 'system prompt');
    await loader.reload();
    const names = loader.getSkills().skills.map((s) => s.name);

    expect(names).toContain('repo-skill');
    expect(names).not.toContain('global-skill');
  });
});

describe('remediate-epic action — FE-884 Slice A production wiring', () => {
  const slice: Slice = {
    id: 'login',
    epic_id: 'api',
    definition: 'Login',
    depends_on: [],
    verification: [{ kind: 'unit-test', target: 'tests/login.test.ts' }],
  };
  const epic: Epic = {
    id: 'api',
    summary: 'API surface',
    depends_on: [],
    verification: [{ kind: 'integration-test', target: 'tests/api.integration.test.ts' }],
  };
  const plan: Plan = { mode: 'greenfield', epics: [epic], slices: [slice] };

  it('createPiActions registers a remediate-epic handler', () => {
    const actions = createPiActions();
    expect(actions['remediate-epic']).toBeTypeOf('function');
  });

  it('drives a write-capable agent against the folded epic tree and reports the attempt', async () => {
    process.env.ANTHROPIC_API_KEY ??= 'test-key-unused-fake-session';
    const reports = new InMemoryReportSink();
    const fake = makeFakeSession({ emit: 'patched the product code' });
    let captured: { cwd?: string; tools?: string[] } | undefined;
    const createSession = (async (options: { cwd?: string; tools?: string[] }) => {
      captured = options;
      return { session: fake.session };
    }) as unknown as SessionFactory;
    const actions = createPiActions({ createSession });

    const foldedDir = '/tmp/__epic__/api';
    const id = await actions['remediate-epic']!({ slice, epic, plan, sandboxDir: foldedDir, reports });

    expect(captured?.cwd).toBe(foldedDir);
    expect(captured?.tools).toEqual(['read', 'write', 'edit', 'bash']);
    expect(fake.calls.prompt[0]).toContain('api');
    expect(fake.calls.prompt[0]).toContain('tests/api.integration.test.ts');
    const rec = reports.getById(id)!;
    expect(rec.actor).toBe('coding-agent');
    expect(rec.event).toBe('remediation-agent-done');
    expect(rec.epicId).toBe('api');
  });

  it('epicRemediateTask names the epic and instructs fixing code, not the oracle', () => {
    const task = epicRemediateTask(epic);
    expect(task).toContain('api');
    expect(task).toContain('tests/api.integration.test.ts');
    expect(task.toLowerCase()).toContain('do not');
  });
});
