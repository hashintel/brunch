import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createPiActions,
  epicVerifyTask,
  runPi,
  type SessionFactory,
  sliceTestTask,
  toolsForAction,
} from './pi-actions.js';
import { brunchProfile, bunProfile } from './project-profile.js';
import { InMemoryReportSink } from './report-sink.js';
import type { ActionContext, Epic, Plan, Slice, TestResult, TestRunner } from './types.js';

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
    model: 'claude-sonnet-4-6',
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
          model: 'claude-sonnet-4-6',
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
