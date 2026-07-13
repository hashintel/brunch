import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { access, appendFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { agentStreamPath, ingestAgentResult } from '../agent-result.js';
import { executeEpicLifecycleStep } from '../epic-lifecycle.js';
import type { AgentRunnerPort, ExecutionPorts, TestRunnerPort } from '../execution-ports.js';
import { readRunDetail } from '../observer-read.js';
import {
  compileExecutorTopology,
  drive,
  frontierFiringPolicy,
  linearScheduler,
  type ExecutorNetEvent,
  petriScheduler,
  type ReadyStep,
  serialFiringPolicy,
} from '../orchestrate.js';
import {
  appendPetriEvent,
  petriEventsPath,
  subscribePetriEvents,
  subscribePetriJournalFailures,
} from '../petri-events.js';
import {
  petriMarkingLifecycleProvenance,
  petriMarkingPath,
  readPetriMarkingSnapshot,
  writePetriMarkingSnapshot,
} from '../petri-marking.js';
import { petriPlanSnapshotPath } from '../petri-plan-snapshot.js';
import { replayPetri, replayTransitionHistory } from '../petri-replay.js';
import { readPetriRuntimePlan, petriRuntimePlanPathCandidates } from '../petri-runtime-plan.js';
import {
  bindExecutorPetriRuntime,
  enabledPetriTransitionIds,
  impliedPetriTransitionHistory,
  materializeExecutorPetriRuntime,
  projectExecutorPetriTransitionHistory,
  resolvePetriTransitionIdForReadyStep,
} from '../petri-runtime.js';
import { classifyDriveTerminal } from '../petri-terminal.js';
import { exportPetri, petriNetPath, petriSdcpnPath, preparePetriObservation } from '../petri.js';
import { reducePetrinautReplayExport } from '../petrinaut/replay-export.js';
import { planFilePath } from '../plan-file.js';
import { populatedPlanPath as runPopulatedPlanPath, populateWorktree } from '../populate.js';
import { preparePromotion } from '../promotion.js';
import { initializeReports, reportsPath } from '../report.js';
import { completeRun } from '../run-complete.js';
import {
  createRun,
  persistRunMetadata,
  readRunMetadata,
  resetActiveSliceAttempts,
  runDirPath,
  runMetadataPath,
  subscribeRunMetadata,
  type RunMetadata,
} from '../run.js';
import { completeSlice, completeStandaloneSlice } from '../slice-complete.js';
import { requestSliceExecution, sliceExecutionRequestPath } from '../slice-execute.js';
import { integrateSlice } from '../slice-integration.js';
import { startSlice } from '../slice-start.js';
import { sliceWorkspacePath } from '../slice-workspace.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy } from '../source-policy.js';
import { ingestTestResult, verifyStreamPath } from '../test-result.js';
import { createWorktree } from '../worktree.js';
import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitSliceIntegrationPort,
  createFakeGitWorktreePort,
  createFakeTestRunnerPort,
} from './fake-ports.js';

const completedAgentRunner: AgentRunnerPort = {
  async run() {
    return { status: 'completed' };
  },
};

function flakyAgentRunner(
  failures: number,
): AgentRunnerPort & { readonly calls: () => number; readonly resultPaths: () => readonly string[] } {
  let calls = 0;
  const resultPaths: string[] = [];
  return {
    calls: () => calls,
    resultPaths: () => resultPaths,
    async run(args) {
      calls += 1;
      resultPaths.push(args.resultPath);
      await args.onUpdate?.({ kind: 'status', message: `agent attempt ${calls}` });
      return calls <= failures ? { status: 'failed', message: 'flaky agent' } : { status: 'completed' };
    },
  };
}

function flakyTestRunner(failures: number): TestRunnerPort & { readonly calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    async run(args) {
      calls += 1;
      await args.onUpdate?.({ kind: 'status', message: `verify attempt ${calls}` });
      return calls <= failures
        ? { status: 'failed', message: 'flaky verify' }
        : { status: 'completed', verdict: 'passed', exitCode: 0 };
    },
  };
}

function fakePorts(overrides: Partial<ExecutionPorts> = {}): ExecutionPorts {
  return {
    gitWorktree: createFakeGitWorktreePort(),
    gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    agentRunner: completedAgentRunner,
    testRunner: createFakeTestRunnerPort(),
    gitLand: createFakeGitLandPort(),
    gitHostPromotion: createFakeGitHostPromotionPort({}),
    ...overrides,
  };
}

function planJson(
  slices: readonly (string | { readonly id: string; readonly dependsOn?: readonly string[] })[],
  options: { readonly includeMode?: boolean } = {},
): string {
  return JSON.stringify({
    ...(options.includeMode === false ? {} : { mode: 'greenfield' }),
    epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
    slices: slices.map((slice, index) => {
      const sliceId = typeof slice === 'string' ? slice : slice.id;
      return {
        id: sliceId,
        epic_id: 'frontier-1',
        definition: `${sliceId}.`,
        depends_on: typeof slice === 'string' ? [] : (slice.dependsOn ?? []),
        verification: [{ kind: 'criterion', criterionId: `AC${index + 1}`, target: `${sliceId} works.` }],
        derived_from: [`REQ${index + 1}`],
      };
    }),
  });
}

async function createRunAtCreated(
  cwd: string,
  sliceIds: readonly (string | { readonly id: string; readonly dependsOn?: readonly string[] })[] = [
    'task-1',
    'task-2',
  ],
): Promise<void> {
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planFilePath(cwd, '42'), planJson(sliceIds), 'utf8');
  await createRun({ cwd, specId: '42', runId: 'run-1' });
}

async function createRunAtCreatedWithPlan(cwd: string, plan: object): Promise<void> {
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planFilePath(cwd, '42'), JSON.stringify(plan), 'utf8');
  await createRun({
    cwd,
    specId: '42',
    runId: 'run-1',
    verifyTarget: { command: 'npm', args: ['run', 'verify'] },
  });
}

async function prepareRunAtReports(cwd: string, sliceIds: readonly string[]): Promise<RunMetadata> {
  await createRunAtCreated(cwd, sliceIds);
  await drive(
    { cwd, runId: 'run-1', ports: fakePorts(), sourcePolicy: 'host_source_deferred' },
    linearScheduler,
    serialFiringPolicy,
    { maxFirings: 5 },
  );
  return (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
}

async function prepareEpicVerificationReadyRun(cwd: string): Promise<{
  readonly state: RunMetadata;
  readonly plan: NonNullable<Awaited<ReturnType<typeof readPetriRuntimePlan>>>;
  readonly runtime: ReturnType<typeof materializeExecutorPetriRuntime>;
}> {
  await createRunAtCreatedWithPlan(cwd, {
    mode: 'greenfield',
    epics: [
      {
        id: 'epic-1',
        depends_on: [],
        verification: [{ kind: 'criterion', target: 'provenance only' }],
      },
    ],
    slices: [{ id: 'task-1', epic_id: 'epic-1', definition: 'task', depends_on: [], verification: [] }],
  });
  await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, serialFiringPolicy, {
    maxFirings: 12,
  });
  const state = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
  const plan = (await readPetriRuntimePlan(cwd, state))!;
  const runtime = materializeExecutorPetriRuntime(state, plan);
  expect(runtime.readySteps).toEqual([{ kind: 'epic_verify', epicId: 'epic-1' }]);
  return { state, plan, runtime };
}

function metadata(status: RunMetadata['status'], extra: Partial<RunMetadata> = {}): RunMetadata {
  return { runId: 'run-1', specId: '42', planPath: 'plan.yaml', status, ...extra };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readReportEvents(cwd: string): Promise<unknown[]> {
  const raw = await readFile(reportsPath(cwd, 'run-1'), 'utf8');
  return raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as unknown);
}

async function readPetriEvents(cwd: string): Promise<readonly ExecutorNetEvent[]> {
  const raw = await readFile(
    join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'petrinaut', 'events.jsonl'),
    'utf8',
  );
  return raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as ExecutorNetEvent);
}

async function reorderPetriTransitions(cwd: string, rank: (transitionId: string) => number): Promise<void> {
  const events = await readPetriEvents(cwd);
  const transitions = events
    .filter(
      (event): event is Extract<ExecutorNetEvent, { readonly kind: 'transition_fired' }> =>
        event.kind === 'transition_fired',
    )
    .map((event, index) => ({ event, index }))
    .sort(
      (left, right) =>
        rank(left.event.transitionId) - rank(right.event.transitionId) || left.index - right.index,
    )
    .map(({ event }) => event);
  let transitionIndex = 0;
  const reordered = events.map((event) =>
    event.kind === 'transition_fired' ? transitions[transitionIndex++]! : event,
  );
  await writeFile(
    petriEventsPath(cwd, 'run-1'),
    reordered.map((event) => JSON.stringify(event)).join('\n') + '\n',
    'utf8',
  );
}

// The differential baseline for the parity oracle: crank the same lifecycle steps
// by hand, exactly as drive() composes them.
async function crankManually(cwd: string, ports: ExecutionPorts): Promise<void> {
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: ports.gitWorktree });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
  for (;;) {
    const started = await startSlice({ cwd, runId: 'run-1' });
    if (started.status !== 'slice_started') break;
    await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: ports.gitSliceIntegration,
    });
    await ingestAgentResult({ cwd, runId: 'run-1', agentRunner: ports.agentRunner });
    await ingestTestResult({ cwd, runId: 'run-1', testRunner: ports.testRunner });
    await integrateSlice({ cwd, runId: 'run-1', gitSliceIntegration: ports.gitSliceIntegration });
    await completeSlice({ cwd, runId: 'run-1' });
  }
  const metadata = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
  const plan = await readPetriRuntimePlan(cwd, metadata);
  for (const epic of plan?.epics ?? []) {
    await executeEpicLifecycleStep({
      cwd,
      runId: 'run-1',
      step: { kind: 'epic_integrate', epicId: epic.id },
      plan,
      testRunner: ports.testRunner,
    });
    if (epic.verification?.length) {
      await executeEpicLifecycleStep({
        cwd,
        runId: 'run-1',
        step: { kind: 'epic_verify', epicId: epic.id },
        plan,
        testRunner: ports.testRunner,
      });
    }
    await executeEpicLifecycleStep({
      cwd,
      runId: 'run-1',
      step: { kind: 'epic_complete', epicId: epic.id },
      plan,
      testRunner: ports.testRunner,
    });
  }
  await completeRun({ cwd, runId: 'run-1' });
  await exportPetri({ cwd, runId: 'run-1' });
  await preparePromotion({ cwd, runId: 'run-1', gitLand: ports.gitLand });
}

describe('drive', () => {
  it('admits concurrent same-run drives once and shares the owner outcome', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-single-owner-'));
    await createRunAtCreated(cwd, ['task-1']);
    let calls = 0;
    let entered!: () => void;
    const ownerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = createFakeGitWorktreePort();
    const ports = fakePorts({
      gitWorktree: createFakeGitWorktreePort(async (args) => {
        calls += 1;
        entered();
        await released;
        return base.create(args);
      }),
    });

    const owner = drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy);
    const waiter = drive(
      { cwd: join(cwd, '.'), runId: 'run-1', ports },
      petriScheduler,
      frontierFiringPolicy,
    );
    await ownerEntered;
    release();

    const [ownerOutcome, waiterOutcome] = await Promise.all([owner, waiter]);
    expect(waiterOutcome).toEqual(ownerOutcome);
    expect(ownerOutcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(calls).toBe(1);
  });

  it('allows different run ids to execute external effects concurrently', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-distinct-runs-'));
    await createRunAtCreated(cwd, ['task-1']);
    await createRun({ cwd, specId: '42', runId: 'run-2' });
    const entered = new Set<string>();
    let bothEntered!: () => void;
    const overlap = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = createFakeGitWorktreePort();
    const ports = fakePorts({
      gitWorktree: createFakeGitWorktreePort(async (args) => {
        entered.add(args.worktreeDir);
        if (entered.size === 2) bothEntered();
        await released;
        return base.create(args);
      }),
    });

    const first = drive({ cwd, runId: 'run-1', ports });
    const second = drive({ cwd, runId: 'run-2', ports });
    await overlap;
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'completed', runStatus: 'promotion_prepared' },
      { status: 'completed', runStatus: 'promotion_prepared' },
    ]);
  });

  it('releases same-run waiters and authority state when the owner rejects', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-owner-rejects-'));
    await createRunAtCreated(cwd, ['task-1']);
    let calls = 0;
    const throwing = fakePorts({
      gitWorktree: createFakeGitWorktreePort(async () => {
        calls += 1;
        throw new Error('worktree exploded');
      }),
    });

    const owner = drive({ cwd, runId: 'run-1', ports: throwing });
    const waiter = drive({ cwd, runId: 'run-1', ports: throwing });
    await expect(Promise.all([owner, waiter])).resolves.toEqual([
      {
        status: 'halted',
        step: 'worktree_create',
        runStatus: 'created',
        reason: 'worktree_create_threw: worktree exploded',
      },
      {
        status: 'halted',
        step: 'worktree_create',
        runStatus: 'created',
        reason: 'worktree_create_threw: worktree exploded',
      },
    ]);
    expect(calls).toBe(1);

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'completed',
      runStatus: 'promotion_prepared',
    });
  });

  it.each([
    {
      fault: 'worktree',
      setupFirings: 0,
      step: 'worktree_create',
      runStatus: 'created',
      reason: 'worktree_create_threw',
    },
    {
      fault: 'workspace',
      setupFirings: 6,
      step: 'slice_execute',
      runStatus: 'slice_started',
      reason: 'slice_workspace_threw',
    },
    {
      fault: 'agent',
      setupFirings: 7,
      step: 'agent_result',
      runStatus: 'slice_execution_requested',
      reason: 'agent_run_threw',
    },
    {
      fault: 'verifier',
      setupFirings: 8,
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_threw',
    },
    {
      fault: 'integration',
      setupFirings: 9,
      step: 'slice_integrate',
      runStatus: 'test_result_ingested',
      reason: 'slice_integration_threw',
    },
    {
      fault: 'promotion',
      setupFirings: 0,
      step: 'promotion',
      runStatus: 'petri_exported',
      reason: 'promotion_threw',
    },
  ] as const)(
    'normalizes a thrown serial $fault effect into a durable terminal',
    async ({ fault, setupFirings, step, runStatus, reason }) => {
      const cwd = await mkdtemp(join(tmpdir(), `brunch-serial-${fault}-throw-`));
      await createRunAtCreated(cwd, ['task-1']);
      if (setupFirings > 0) {
        await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, serialFiringPolicy, {
          maxFirings: setupFirings,
        });
      }
      const ports = fakePorts({
        ...(fault === 'worktree'
          ? {
              gitWorktree: createFakeGitWorktreePort(async () => {
                throw new Error(`${fault} exploded`);
              }),
            }
          : {}),
        ...(fault === 'workspace'
          ? {
              gitSliceIntegration: createFakeGitSliceIntegrationPort({
                async prepare() {
                  throw new Error(`${fault} exploded`);
                },
              }),
            }
          : {}),
        ...(fault === 'agent'
          ? {
              agentRunner: {
                async run() {
                  throw new Error(`${fault} exploded`);
                },
              },
            }
          : {}),
        ...(fault === 'verifier'
          ? {
              testRunner: {
                async run() {
                  throw new Error(`${fault} exploded`);
                },
              },
            }
          : {}),
        ...(fault === 'integration'
          ? {
              gitSliceIntegration: createFakeGitSliceIntegrationPort({
                async integrate() {
                  throw new Error(`${fault} exploded`);
                },
              }),
            }
          : {}),
        ...(fault === 'promotion'
          ? {
              gitLand: {
                async currentHead() {
                  throw new Error(`${fault} exploded`);
                },
                async promote() {
                  throw new Error('must not promote');
                },
              },
            }
          : {}),
      });

      await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
        status: 'halted',
        step,
        runStatus,
        reason: `${reason}: ${fault} exploded`,
      });
      await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
        terminalEventKind: 'net_halted',
        haltedReason: `${reason}: ${fault} exploded`,
      });
    },
  );

  it.each(['missing', 'unavailable'] as const)(
    'halts before agent dispatch when the journal and net are both $carrier after reports initialize',
    async (carrier) => {
      const cwd = await mkdtemp(join(tmpdir(), `brunch-petri-correlated-carrier-loss-${carrier}-`));
      await prepareRunAtReports(cwd, ['task-1']);
      await rm(petriEventsPath(cwd, 'run-1'));
      await rm(petriNetPath(cwd, 'run-1'));
      if (carrier === 'unavailable') await mkdir(petriNetPath(cwd, 'run-1'));
      let agentCalls = 0;
      const started: string[] = [];

      await expect(
        drive({
          cwd,
          runId: 'run-1',
          ports: fakePorts({
            agentRunner: {
              async run() {
                agentCalls += 1;
                return { status: 'completed' };
              },
            },
          }),
          onStepStart: (step) => started.push(step),
        }),
      ).resolves.toMatchObject({
        status: 'halted',
        runStatus: 'reports_initialized',
        reason: 'petri_input_unreadable',
      });
      expect(agentCalls).toBe(0);
      expect(started).toEqual([]);
      await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
        status: 'reports_initialized',
      });
    },
  );

  it.each([
    ['missing', 'net.json', [petriNetPath]],
    ['missing', 'both definitions', [petriNetPath, petriSdcpnPath]],
    ['unavailable', 'net.sdcpn.json', [petriSdcpnPath]],
    ['unreadable', 'both definitions', [petriNetPath, petriSdcpnPath]],
  ] as const)(
    'does not repair $1 after a prepared created run journal becomes $0',
    async (carrier, _label, definitionPaths) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-correlated-preparation-loss-'));
      await createRunAtCreated(cwd, ['task-1']);
      await preparePetriObservation({ cwd, runId: 'run-1' });
      const journalPath = petriEventsPath(cwd, 'run-1');
      await rm(journalPath);
      if (carrier === 'unavailable') await mkdir(journalPath);
      if (carrier === 'unreadable') await writeFile(journalPath, '{', 'utf8');
      for (const definitionPath of definitionPaths) await rm(definitionPath(cwd, 'run-1'));
      const started: string[] = [];

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await expect(
          drive({
            cwd,
            runId: 'run-1',
            ports: fakePorts(),
            onStepStart: (step) => started.push(step),
          }),
        ).resolves.toEqual({
          status: 'halted',
          step: 'worktree_create',
          runStatus: 'created',
          reason: 'petri_input_unreadable',
        });
        if (carrier === 'missing') expect(await pathExists(journalPath)).toBe(false);
        if (carrier === 'unavailable') {
          await expect(readFile(journalPath, 'utf8')).rejects.toMatchObject({ code: 'EISDIR' });
        }
        if (carrier === 'unreadable') expect(await readFile(journalPath, 'utf8')).toBe('{');
        for (const definitionPath of definitionPaths) {
          expect(await pathExists(definitionPath(cwd, 'run-1'))).toBe(false);
        }
      }
      expect(started).toEqual([]);
    },
  );

  it('repairs lost definitions when the independently prepared journal remains readable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-definition-only-loss-'));
    await createRunAtCreated(cwd, ['task-1']);
    await preparePetriObservation({ cwd, runId: 'run-1' });
    await rm(petriNetPath(cwd, 'run-1'));
    await rm(petriSdcpnPath(cwd, 'run-1'));

    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts() }, linearScheduler, serialFiringPolicy, {
        maxFirings: 1,
      }),
    ).resolves.toEqual({ status: 'completed', runStatus: 'worktree_created' });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(true);
    expect(await pathExists(petriSdcpnPath(cwd, 'run-1'))).toBe(true);
  });

  it.each(['missing', 'unavailable'] as const)(
    'does not append through a $carrier journal when observation preparation fails',
    async (carrier) => {
      const cwd = await mkdtemp(join(tmpdir(), `brunch-petri-preparation-journal-${carrier}-`));
      await createRunAtCreated(cwd, ['task-1']);
      await preparePetriObservation({ cwd, runId: 'run-1' });
      const journalPath = petriEventsPath(cwd, 'run-1');
      await rm(journalPath);
      if (carrier === 'unavailable') await mkdir(journalPath);
      let failureWakeUps = 0;
      const unsubscribe = subscribePetriJournalFailures({
        cwd,
        runId: 'run-1',
        listener: () => {
          failureWakeUps += 1;
        },
      });

      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
            status: 'halted',
            step: 'worktree_create',
            runStatus: 'created',
            reason: 'petri_input_unreadable',
          });
          if (carrier === 'missing') expect(await pathExists(journalPath)).toBe(false);
          else await expect(readFile(journalPath, 'utf8')).rejects.toMatchObject({ code: 'EISDIR' });
        }
      } finally {
        unsubscribe();
      }
      expect(failureWakeUps).toBe(2);
      await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
        status: 'created',
      });
    },
  );

  it('rejects a durable transition order that starts a dependent slice before its predecessor', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-dependent-order-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [{ id: 'epic-1', depends_on: [], verification: [] }],
      slices: [
        { id: 'task-1', epic_id: 'epic-1', depends_on: [], verification: [] },
        { id: 'task-2', epic_id: 'epic-1', depends_on: ['task-1'], verification: [] },
      ],
    });
    await drive({ cwd, runId: 'run-1', ports: fakePorts() });
    await reorderPetriTransitions(cwd, (transitionId) => {
      if (
        ['worktree_create', 'populate', 'source_policy', 'source_copy', 'report_init'].includes(transitionId)
      )
        return 0;
      if (transitionId.includes(':task-2')) return 1;
      if (transitionId.includes(':task-1')) return 2;
      if (transitionId.startsWith('epic_')) return 3;
      return 4;
    });

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toMatchObject({
      status: 'halted',
      reason: 'petri_input_unreadable',
    });
  });

  it('rejects durable epic transitions ordered before their member slice transitions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-epic-before-members-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [{ id: 'epic-1', depends_on: [], verification: [] }],
      slices: [{ id: 'task-1', epic_id: 'epic-1', depends_on: [], verification: [] }],
    });
    await drive({ cwd, runId: 'run-1', ports: fakePorts() });
    await reorderPetriTransitions(cwd, (transitionId) => {
      if (
        ['worktree_create', 'populate', 'source_policy', 'source_copy', 'report_init'].includes(transitionId)
      )
        return 0;
      if (transitionId.startsWith('epic_')) return 1;
      if (transitionId.includes(':task-1')) return 2;
      return 3;
    });

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toMatchObject({
      status: 'halted',
      reason: 'petri_input_unreadable',
    });
  });

  it('rejects an unmatched epic verify hidden by a reordered independent common suffix', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-residual-epic-verify-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [
        {
          id: 'epic-1',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'provenance only' }],
        },
      ],
      slices: [
        { id: 'task-1', epic_id: 'epic-1', definition: 'one', depends_on: [], verification: [] },
        { id: 'task-2', definition: 'two', depends_on: [], verification: [] },
      ],
    });
    await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, serialFiringPolicy, {
      maxFirings: 12,
    });
    const state = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
    expect(state).toMatchObject({ status: 'slice_started', activeSliceId: 'task-2' });
    const plan = (await readPetriRuntimePlan(cwd, state))!;
    const topology = compileExecutorTopology(plan);
    const addedTransitions = ['epic_integrate:epic-1', 'epic_verify:epic-1'].map(
      (transitionId) => topology.transitions.find((transition) => transition.id === transitionId)!,
    );
    const events = [...(await readPetriEvents(cwd))];
    const taskTwoStartIndex = events.findIndex(
      (event) => event.kind === 'transition_fired' && event.transitionId === 'slice_start:task-2',
    );
    events.splice(
      taskTwoStartIndex,
      0,
      ...addedTransitions.map<ExecutorNetEvent>((transition) => ({
        kind: 'transition_fired',
        runId: 'run-1',
        runStatus: state.status,
        transitionId: transition.id,
        subnetId: transition.subnetId,
        ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
        step: transition.step!.kind,
        contract: transition.contract,
        consumed: transition.inputArcs.map((arc) => arc.placeId),
        produced: transition.outputArcs.map((arc) => arc.placeId),
        fromStatus: state.status,
        toStatus: state.status,
      })),
    );
    await writeFile(
      petriEventsPath(cwd, 'run-1'),
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
      'utf8',
    );
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), {
      ...state,
      epicTransitionHistory: ['epic_integrate:epic-1'],
      integratedEpicIds: ['epic-1'],
    });

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_execute',
      runStatus: 'slice_started',
      reason: 'petri_input_unreadable',
    });
  });

  it.each(['slice_execute', 'agent_result', 'test_result', 'slice_complete'] as const)(
    'refuses standalone %s while drive owns the same run without duplicating its effect',
    async (standaloneStep) => {
      const cwd = await mkdtemp(join(tmpdir(), `brunch-drive-standalone-${standaloneStep}-`));
      const setupPorts = fakePorts();
      await prepareRunAtReports(cwd, ['task-1']);
      const setupFirings = standaloneStep === 'slice_execute' ? 1 : standaloneStep === 'agent_result' ? 2 : 3;
      await drive({ cwd, runId: 'run-1', ports: setupPorts }, petriScheduler, serialFiringPolicy, {
        maxFirings: setupFirings,
      });

      let calls = 0;
      let entered!: () => void;
      const effectEntered = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let release!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const baseIntegration = createFakeGitSliceIntegrationPort();
      const ports = fakePorts({
        gitSliceIntegration: createFakeGitSliceIntegrationPort({
          async prepare(args) {
            calls += 1;
            entered();
            await released;
            return baseIntegration.prepare(args);
          },
          async integrate(args) {
            calls += 1;
            entered();
            await released;
            return baseIntegration.integrate(args);
          },
        }),
        agentRunner: {
          async run() {
            calls += 1;
            entered();
            await released;
            return { status: 'completed' };
          },
        },
        testRunner: {
          async run() {
            calls += 1;
            entered();
            await released;
            return { status: 'completed', verdict: 'passed', exitCode: 0 };
          },
        },
      });
      const owner = drive({ cwd, runId: 'run-1', ports }, petriScheduler, serialFiringPolicy, {
        maxFirings: 1,
      });
      await effectEntered;

      const contended =
        standaloneStep === 'slice_execute'
          ? await requestSliceExecution({
              cwd,
              runId: 'run-1',
              gitSliceIntegration: ports.gitSliceIntegration,
            })
          : standaloneStep === 'agent_result'
            ? await ingestAgentResult({ cwd, runId: 'run-1', agentRunner: ports.agentRunner })
            : standaloneStep === 'test_result'
              ? await ingestTestResult({ cwd, runId: 'run-1', testRunner: ports.testRunner })
              : (
                  await completeStandaloneSlice({
                    cwd,
                    runId: 'run-1',
                    gitSliceIntegration: ports.gitSliceIntegration,
                  })
                ).result;
      expect(contended).toMatchObject({ status: 'run_execution_active', sideEffects: [] });
      expect(calls).toBe(1);
      release();
      await owner;
      expect(calls).toBe(1);
    },
  );

  it('runs declared epic verification once on the integrated run tree before completing the epic', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-serial-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [
        {
          id: 'epic-1',
          summary: 'Verified epic',
          depends_on: [],
          verification: [{ kind: 'criterion', criterionId: 'AC-epic', target: 'provenance only' }],
        },
      ],
      slices: [
        {
          id: 'task-1',
          epic_id: 'epic-1',
          definition: 'Build it.',
          depends_on: [],
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'slice works' }],
        },
      ],
    });
    const calls: { readonly worktreeDir: string; readonly command?: string }[] = [];
    let promotionWorktree: string | undefined;
    let claimWasDurableBeforeRunner = false;
    const testRunner: TestRunnerPort = {
      async run(args) {
        calls.push({
          worktreeDir: args.worktreeDir,
          ...(args.verifyTarget ? { command: args.verifyTarget.command } : {}),
        });
        if (!args.worktreeDir.includes('/slice-workspaces/')) {
          const events = await readPetriEvents(cwd);
          const snapshot = await readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
          const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
          claimWasDurableBeforeRunner =
            events.some((event) => event.kind === 'epic_verification_claimed' && event.epicId === 'epic-1') &&
            snapshot?.epicVerificationClaims?.some(
              (claim) => claim.epicId === 'epic-1' && claim.phase === 'claimed',
            ) === true &&
            !metadata?.verifiedEpicIds?.includes('epic-1');
        }
        return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' };
      },
    };

    await expect(
      drive(
        {
          cwd,
          runId: 'run-1',
          ports: fakePorts({
            testRunner,
            gitLand: {
              async currentHead() {
                return { status: 'ok', commitSha: 'base123' };
              },
              async promote(args) {
                promotionWorktree = args.worktreeDir;
                return {
                  status: 'promoted',
                  commitSha: 'promoted123',
                  sideEffects: [{ kind: 'git_commit', path: args.worktreeDir, sha: 'promoted123' }],
                };
              },
            },
          }),
        },
        petriScheduler,
      ),
    ).resolves.toEqual({ status: 'completed', runStatus: 'promotion_prepared' });

    const run = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(calls).toHaveLength(2);
    expect(claimWasDurableBeforeRunner).toBe(true);
    expect(calls[1]).toEqual({ worktreeDir: run?.worktreeDir, command: 'npm' });
    expect(promotionWorktree).toBe(calls[1]?.worktreeDir);
    expect(
      (await readPetriEvents(cwd)).flatMap((event) =>
        event.kind === 'transition_fired' && event.contract.lane === 'epic' ? [event.transitionId] : [],
      ),
    ).toEqual(['epic_integrate:epic-1', 'epic_verify:epic-1', 'epic_complete:epic-1']);
    expect(await readReportEvents(cwd)).toContainEqual(
      expect.objectContaining({ event: 'epic_test_result', epicId: 'epic-1', status: 'passed' }),
    );
  });

  it('runs one epic verification after a parallel member batch converges', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-parallel-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [
        {
          id: 'epic-1',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'provenance only' }],
        },
      ],
      slices: ['task-1', 'task-2'].map((id) => ({
        id,
        epic_id: 'epic-1',
        definition: id,
        depends_on: [],
        verification: [],
      })),
    });
    const worktrees: string[] = [];
    const testRunner: TestRunnerPort = {
      async run(args) {
        worktrees.push(args.worktreeDir);
        return { status: 'completed', verdict: 'passed', exitCode: 0 };
      },
    };

    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts({ testRunner }) }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({ status: 'completed', runStatus: 'promotion_prepared' });

    const run = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(worktrees).toHaveLength(3);
    expect(worktrees.filter((path) => path === run?.worktreeDir)).toHaveLength(1);
    expect(run).toMatchObject({
      integratedEpicIds: ['epic-1'],
      verifiedEpicIds: ['epic-1'],
      completedEpicIds: ['epic-1'],
    });
  });

  it('halts failed epic verification without verify, completion, dependent release, or promotion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-failed-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [
        {
          id: 'epic-1',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'provenance only' }],
        },
        { id: 'epic-2', depends_on: ['epic-1'], verification: [] },
      ],
      slices: [
        { id: 'task-1', epic_id: 'epic-1', definition: 'one', depends_on: [], verification: [] },
        { id: 'task-2', epic_id: 'epic-2', definition: 'two', depends_on: [], verification: [] },
      ],
    });
    const agentSlices: string[] = [];
    const testRunner: TestRunnerPort = {
      async run(args) {
        return args.worktreeDir.includes('/slice-workspaces/')
          ? { status: 'completed', verdict: 'passed', exitCode: 0 }
          : { status: 'completed', verdict: 'failed', exitCode: 1 };
      },
    };

    await expect(
      drive(
        {
          cwd,
          runId: 'run-1',
          ports: fakePorts({
            testRunner,
            agentRunner: {
              async run(args) {
                agentSlices.push(args.sliceId);
                return { status: 'completed' };
              },
            },
          }),
        },
        petriScheduler,
        frontierFiringPolicy,
      ),
    ).resolves.toEqual({
      status: 'halted',
      step: 'epic_verify',
      runStatus: 'slice_completed',
      reason: 'epic_verification_failed',
    });

    expect(agentSlices).toEqual(['task-1']);
    const events = await readPetriEvents(cwd);
    const epicTransitions = events.flatMap((event) =>
      event.kind === 'transition_fired' && event.contract.lane === 'epic' ? [event.transitionId] : [],
    );
    expect(epicTransitions).toEqual(['epic_integrate:epic-1']);
    expect(epicTransitions).not.toContain('epic_verify:epic-1');
    expect(epicTransitions).not.toContain('epic_complete:epic-1');
    expect(events.at(-1)).toMatchObject({
      kind: 'net_halted',
      step: 'epic_verify',
      reason: 'epic_verification_failed',
    });
    expect(await readReportEvents(cwd)).toContainEqual(
      expect.objectContaining({ event: 'epic_test_result', epicId: 'epic-1', status: 'failed' }),
    );
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.promotionPath).toBeUndefined();
    const replay = replayPetri({
      net: JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')),
      events,
    });
    expect(replay?.currentMarking).toHaveProperty('epic:epic-1:integrated', 1);
    expect(replay?.currentMarking).not.toHaveProperty('epic:epic-1:verified');
    expect(replay?.currentMarking).not.toHaveProperty('epic:epic-1:completed');
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriProjection: {
        currentMarking: { 'epic:epic-1:integrated': 1 },
        terminalEventKind: 'net_halted',
        haltedReason: 'epic_verification_failed',
      },
    });
  });

  it('never reruns epic verification after a durable claim without a result', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-claimed-crash-'));
    const { state, runtime } = await prepareEpicVerificationReadyRun(cwd);
    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'epic_verification_claimed',
        runId: 'run-1',
        runStatus: state.status,
        epicId: 'epic-1',
        step: 'epic_verify',
      },
    });
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: runtime.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(
          state,
          await readPetriRuntimePlan(cwd, state),
        )!.transitionIds.length,
        lifecycleProvenance: petriMarkingLifecycleProvenance(state),
        epicVerificationClaims: [{ epicId: 'epic-1', phase: 'claimed' }],
      },
    });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      epicVerificationClaims: [{ epicId: 'epic-1', phase: 'claimed' }],
    });
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        {
          kind: 'epic_verify',
          epicId: 'epic-1',
          blockers: [{ kind: 'epic_verification_authority', phase: 'claimed' }],
        },
      ],
    });
    let runnerCalls = 0;
    const testRunner: TestRunnerPort = {
      async run() {
        runnerCalls += 1;
        return { status: 'completed', verdict: 'passed', exitCode: 0 };
      },
    };
    await expect(
      executeEpicLifecycleStep({
        cwd,
        runId: 'run-1',
        step: { kind: 'epic_verify', epicId: 'epic-1' },
        plan: await readPetriRuntimePlan(cwd, state),
        testRunner,
        currentMarking: runtime.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(
          state,
          await readPetriRuntimePlan(cwd, state),
        )!.transitionIds.length,
      }),
    ).resolves.toMatchObject({ status: 'epic_verification_interrupted' });

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({ testRunner }),
    });
    expect(runnerCalls).toBe(0);
    expect(outcome).toEqual({
      status: 'halted',
      step: 'epic_verify',
      runStatus: 'slice_completed',
      reason: 'epic_verification_interrupted',
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.verifiedEpicIds).toBeUndefined();
  });

  it('never reruns a claimed epic verifier when its journal becomes unavailable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-claimed-unavailable-'));
    const { state, runtime } = await prepareEpicVerificationReadyRun(cwd);
    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'epic_verification_claimed',
        runId: 'run-1',
        runStatus: state.status,
        epicId: 'epic-1',
        step: 'epic_verify',
      },
    });
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: runtime.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(
          state,
          await readPetriRuntimePlan(cwd, state),
        )!.transitionIds.length,
        lifecycleProvenance: petriMarkingLifecycleProvenance(state),
        epicVerificationClaims: [{ epicId: 'epic-1', phase: 'claimed' }],
      },
    });
    const journalPath = petriEventsPath(cwd, 'run-1');
    await rm(journalPath);
    await mkdir(journalPath);
    let runnerCalls = 0;
    const testRunner: TestRunnerPort = {
      async run() {
        runnerCalls += 1;
        return { status: 'completed', verdict: 'passed', exitCode: 0 };
      },
    };

    await expect(
      executeEpicLifecycleStep({
        cwd,
        runId: 'run-1',
        step: { kind: 'epic_verify', epicId: 'epic-1' },
        plan: await readPetriRuntimePlan(cwd, state),
        testRunner,
        currentMarking: runtime.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(
          state,
          await readPetriRuntimePlan(cwd, state),
        )!.transitionIds.length,
      }),
    ).rejects.toThrow('epic verification journal is unavailable');
    expect(runnerCalls).toBe(0);
  });

  it('fails closed when restart reconciliation encounters a torn Petri journal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-history-torn-journal-'));
    await prepareEpicVerificationReadyRun(cwd);
    await appendFile(petriEventsPath(cwd, 'run-1'), '{"kind":"transition_fired"', 'utf8');
    let runnerCalls = 0;

    await expect(
      drive({
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: {
            async run() {
              runnerCalls += 1;
              return { status: 'completed', verdict: 'passed', exitCode: 0 };
            },
          },
        }),
      }),
    ).resolves.toEqual({
      status: 'halted',
      step: 'epic_verify',
      runStatus: 'slice_completed',
      reason: 'petri_input_unreadable',
    });
    expect(runnerCalls).toBe(0);
  });

  it.each([
    { carrier: 'missing', firings: 0, status: 'created', step: 'worktree_create' },
    { carrier: 'unavailable', firings: 1, status: 'worktree_created', step: 'populate' },
    { carrier: 'unreadable', firings: 2, status: 'worktree_populated', step: 'source_policy' },
  ] as const)(
    'dispatches no $step effect when the prepared journal is $carrier at $status',
    async ({ carrier, firings, status, step }) => {
      const cwd = await mkdtemp(join(tmpdir(), `brunch-petri-journal-${carrier}-`));
      await createRunAtCreated(cwd, ['task-1']);
      await preparePetriObservation({ cwd, runId: 'run-1' });
      if (firings > 0) {
        await expect(
          drive({ cwd, runId: 'run-1', ports: fakePorts() }, linearScheduler, serialFiringPolicy, {
            maxFirings: firings,
          }),
        ).resolves.toEqual({ status: 'completed', runStatus: status });
      }
      const journalPath = petriEventsPath(cwd, 'run-1');
      if (carrier === 'missing') await rm(journalPath);
      if (carrier === 'unavailable') {
        await rm(journalPath);
        await mkdir(journalPath);
      }
      if (carrier === 'unreadable') await appendFile(journalPath, '{', 'utf8');
      const started: string[] = [];

      await expect(
        drive({
          cwd,
          runId: 'run-1',
          ports: fakePorts(),
          onStepStart: (startedStep) => started.push(startedStep),
        }),
      ).resolves.toEqual({
        status: 'halted',
        step,
        runStatus: status,
        reason: 'petri_input_unreadable',
      });
      expect(started).toEqual([]);
      await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({ status });
    },
  );

  it('does not release an epic dependent when the final valid journal line lacks a newline', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-history-unframed-final-line-'));
    await prepareEpicVerificationReadyRun(cwd);
    const journalPath = petriEventsPath(cwd, 'run-1');
    const journal = await readFile(journalPath, 'utf8');
    await writeFile(journalPath, journal.slice(0, -1), 'utf8');
    let runnerCalls = 0;

    await expect(
      drive({
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: {
            async run() {
              runnerCalls += 1;
              return { status: 'completed', verdict: 'passed', exitCode: 0 };
            },
          },
        }),
      }),
    ).resolves.toMatchObject({ status: 'halted', reason: 'petri_input_unreadable' });
    expect(runnerCalls).toBe(0);
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.not.toMatchObject({
      completedEpicIds: ['epic-1'],
    });
  });

  it('catches epic verification summary up from transitioned marking without rerunning', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-summary-lag-'));
    const { state, plan, runtime } = await prepareEpicVerificationReadyRun(cwd);
    const transition = runtime.topology.transitions.find(
      (candidate) => candidate.id === 'epic_verify:epic-1',
    )!;
    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'epic_verification_claimed',
        runId: 'run-1',
        runStatus: state.status,
        epicId: 'epic-1',
        step: 'epic_verify',
      },
    });
    await appendFile(
      reportsPath(cwd, 'run-1'),
      `${JSON.stringify({ event: 'epic_test_result', runId: 'run-1', epicId: 'epic-1', status: 'passed' })}\n`,
      'utf8',
    );
    await appendPetriEvent({
      cwd,
      runId: 'run-1',
      event: {
        kind: 'transition_fired',
        runId: 'run-1',
        runStatus: state.status,
        transitionId: transition.id,
        subnetId: transition.subnetId,
        epicId: 'epic-1',
        step: 'epic_verify',
        contract: transition.contract,
        consumed: transition.inputArcs.map((arc) => arc.placeId),
        produced: transition.outputArcs.map((arc) => arc.placeId),
        fromStatus: state.status,
        toStatus: state.status,
      },
    });
    const transitioned = replayTransitionHistory(
      { transitions: [transition], initialMarking: runtime.currentMarking },
      [transition.id],
    )!;
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: transitioned.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(state, plan)!.transitionIds.length + 1,
        lifecycleProvenance: petriMarkingLifecycleProvenance(state),
        epicVerificationClaims: [{ epicId: 'epic-1', phase: 'transitioned' }],
      },
    });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      epicVerificationClaims: [{ epicId: 'epic-1', phase: 'transitioned' }],
    });
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [{ kind: 'epic_complete', epicId: 'epic-1' }],
      petriBlockedSteps: [
        {
          kind: 'epic_verify',
          epicId: 'epic-1',
          blockers: [{ kind: 'epic_verification_authority', phase: 'transitioned' }],
        },
      ],
    });
    let runnerCalls = 0;

    await expect(
      drive({
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: {
            async run() {
              runnerCalls += 1;
              return { status: 'completed', verdict: 'passed', exitCode: 0 };
            },
          },
        }),
      }),
    ).resolves.toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(runnerCalls).toBe(0);
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.verifiedEpicIds).toEqual(['epic-1']);
    expect(
      (await readPetriEvents(cwd)).filter(
        (event) => event.kind === 'transition_fired' && event.transitionId === 'epic_verify:epic-1',
      ),
    ).toHaveLength(1);
  });

  it('interrupts a transitioned epic marking claim without its durable verify transition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-transitioned-claim-journal-gap-'));
    const { state, plan, runtime } = await prepareEpicVerificationReadyRun(cwd);
    const transition = runtime.topology.transitions.find(
      (candidate) => candidate.id === 'epic_verify:epic-1',
    )!;
    const transitioned = replayTransitionHistory(
      { transitions: [transition], initialMarking: runtime.currentMarking },
      [transition.id],
    )!;
    await appendFile(
      reportsPath(cwd, 'run-1'),
      `${JSON.stringify({ event: 'epic_test_result', runId: 'run-1', epicId: 'epic-1', status: 'passed' })}\n`,
      'utf8',
    );
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: transitioned.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(state, plan)!.transitionIds.length + 1,
        lifecycleProvenance: petriMarkingLifecycleProvenance(state),
        epicVerificationClaims: [{ epicId: 'epic-1', phase: 'transitioned' }],
      },
    });
    let runnerCalls = 0;

    await expect(
      drive({
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: {
            async run() {
              runnerCalls += 1;
              return { status: 'completed', verdict: 'passed', exitCode: 0 };
            },
          },
        }),
      }),
    ).resolves.toEqual({
      status: 'halted',
      step: 'epic_verify',
      runStatus: 'slice_completed',
      reason: 'epic_verification_interrupted',
    });
    expect(runnerCalls).toBe(0);
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.not.toMatchObject({
      verifiedEpicIds: ['epic-1'],
      completedEpicIds: ['epic-1'],
    });
    expect(await readReportEvents(cwd)).not.toContainEqual(
      expect.objectContaining({ event: 'epic_completed', epicId: 'epic-1' }),
    );
  });

  it('turns a thrown epic runner into a durable failed report and terminal marking', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-runner-throw-'));
    await prepareEpicVerificationReadyRun(cwd);

    await expect(
      drive({
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: {
            async run() {
              throw new Error('verify exploded');
            },
          },
        }),
      }),
    ).resolves.toEqual({
      status: 'halted',
      step: 'epic_verify',
      runStatus: 'slice_completed',
      reason: 'epic_test_run_failed',
    });
    expect(await readReportEvents(cwd)).toContainEqual(
      expect.objectContaining({
        event: 'epic_test_result',
        epicId: 'epic-1',
        status: 'failed',
        reason: 'epic_test_runner_threw',
        message: 'verify exploded',
      }),
    );
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      terminalEventKind: 'net_halted',
      haltedReason: 'epic_test_run_failed',
      epicVerificationClaims: [{ epicId: 'epic-1', phase: 'claimed' }],
    });
  });

  it.each(['journal', 'marking'] as const)(
    'starts no epic runner or summary when claim %s persistence fails',
    async (carrier) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-verification-claim-failure-'));
      await prepareEpicVerificationReadyRun(cwd);
      const blockedPath =
        carrier === 'journal' ? petriEventsPath(cwd, 'run-1') : petriMarkingPath(cwd, 'run-1');
      const preservedPath = `${blockedPath}.preserved`;
      renameSync(blockedPath, preservedPath);
      mkdirSync(blockedPath);
      let runnerCalls = 0;

      const driving = drive({
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: {
            async run() {
              runnerCalls += 1;
              return { status: 'completed', verdict: 'passed', exitCode: 0 };
            },
          },
        }),
      });
      if (carrier === 'journal') {
        await expect(driving).resolves.toMatchObject({
          status: 'halted',
          step: 'epic_verify',
          reason: 'petri_input_unreadable',
        });
      } else {
        await expect(driving).rejects.toThrow();
      }
      expect(runnerCalls).toBe(0);
      expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.verifiedEpicIds).toBeUndefined();
    },
  );

  it('completes an empty-verification epic without invoking an epic test', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-no-verification-'));
    await createRunAtCreated(cwd, ['task-1']);
    let calls = 0;
    const testRunner: TestRunnerPort = {
      async run() {
        calls += 1;
        return { status: 'completed', verdict: 'passed', exitCode: 0 };
      },
    };

    await drive({ cwd, runId: 'run-1', ports: fakePorts({ testRunner }) }, petriScheduler);

    expect(calls).toBe(1);
    expect(
      (await readPetriEvents(cwd)).flatMap((event) =>
        event.kind === 'transition_fired' && event.contract.lane === 'epic' ? [event.transitionId] : [],
      ),
    ).toEqual(['epic_integrate:frontier-1', 'epic_complete:frontier-1']);
    expect(await readReportEvents(cwd)).not.toContainEqual(
      expect.objectContaining({ event: 'epic_test_result' }),
    );
  });

  it('starts a dependent epic slice only after predecessor epic completion is durable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-dependency-release-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [
        { id: 'epic-1', depends_on: [], verification: [] },
        { id: 'epic-2', depends_on: ['epic-1'], verification: [] },
      ],
      slices: [
        { id: 'task-1', epic_id: 'epic-1', definition: 'one', depends_on: [], verification: [] },
        { id: 'task-2', epic_id: 'epic-2', definition: 'two', depends_on: [], verification: [] },
      ],
    });
    let predecessorCompleteBeforeDependent = false;

    await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          agentRunner: {
            async run(args) {
              if (args.sliceId === 'task-2') {
                predecessorCompleteBeforeDependent = (await readPetriEvents(cwd)).some(
                  (event) =>
                    event.kind === 'transition_fired' && event.transitionId === 'epic_complete:epic-1',
                );
              }
              return { status: 'completed' };
            },
          },
        }),
      },
      petriScheduler,
      frontierFiringPolicy,
    );

    expect(predecessorCompleteBeforeDependent).toBe(true);
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.completedEpicIds).toEqual([
      'epic-1',
      'epic-2',
    ]);
  });

  it('binds simultaneously enabled epic steps by epic identity', () => {
    const plan = {
      epics: [
        { id: 'epic-1', depends_on: [], verification: [{ kind: 'criterion' as const, target: 'one' }] },
        { id: 'epic-2', depends_on: [], verification: [{ kind: 'criterion' as const, target: 'two' }] },
      ],
      slices: [
        { id: 'task-1', epic_id: 'epic-1', depends_on: [] },
        { id: 'task-2', epic_id: 'epic-2', depends_on: [] },
      ],
    };
    const runtime = materializeExecutorPetriRuntime(
      metadata('slice_completed', {
        completedSliceIds: ['task-1', 'task-2'],
        integratedEpicIds: ['epic-1', 'epic-2'],
        epicTransitionHistory: ['epic_integrate:epic-1', 'epic_integrate:epic-2'],
      }),
      plan,
    );

    expect(runtime.readySteps).toEqual([
      { kind: 'epic_verify', epicId: 'epic-1' },
      { kind: 'epic_verify', epicId: 'epic-2' },
    ]);
    expect(runtime.transitionForReadyStep({ kind: 'epic_verify', epicId: 'epic-2' })?.id).toBe(
      'epic_verify:epic-2',
    );
  });

  it('reconciles multiple epic summaries to durable non-plan journal order on restart', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-epic-journal-order-restart-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      epics: [
        { id: 'epic-1', depends_on: ['epic-2'], verification: [] },
        { id: 'epic-2', depends_on: [], verification: [] },
      ],
      slices: [
        { id: 'task-2', epic_id: 'epic-2', depends_on: [], verification: [] },
        { id: 'task-1', epic_id: 'epic-1', depends_on: [], verification: [] },
      ],
    });
    await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, serialFiringPolicy);
    const durableOrder = (await readPetriEvents(cwd)).flatMap((event) =>
      event.kind === 'transition_fired' && event.contract.lane === 'epic' ? [event.transitionId] : [],
    );
    expect(durableOrder).toEqual([
      'epic_integrate:epic-2',
      'epic_complete:epic-2',
      'epic_integrate:epic-1',
      'epic_complete:epic-1',
    ]);
    const metadata = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), {
      ...metadata,
      epicTransitionHistory: [
        'epic_integrate:epic-1',
        'epic_complete:epic-1',
        'epic_integrate:epic-2',
        'epic_complete:epic-2',
      ],
      integratedEpicIds: ['epic-1', 'epic-2'],
      completedEpicIds: ['epic-1', 'epic-2'],
    });
    const eventCount = (await readPetriEvents(cwd)).length;

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler)).resolves.toEqual({
      status: 'completed',
      runStatus: 'promotion_prepared',
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      epicTransitionHistory: durableOrder,
      integratedEpicIds: ['epic-2', 'epic-1'],
      completedEpicIds: ['epic-2', 'epic-1'],
    });
    expect((await readPetriEvents(cwd)).length).toBe(eventCount);
  });

  it('executes orphan slices without synthesizing epic identity in serial and parallel modes', async () => {
    const serial = await mkdtemp(join(tmpdir(), 'brunch-orphan-slices-serial-'));
    const parallel = await mkdtemp(join(tmpdir(), 'brunch-orphan-slices-parallel-'));
    const plan = {
      mode: 'greenfield',
      epics: [],
      slices: ['task-1', 'task-2'].map((id) => ({
        id,
        definition: id,
        depends_on: [],
        verification: [],
      })),
    };
    await createRunAtCreatedWithPlan(serial, plan);
    await createRunAtCreatedWithPlan(parallel, plan);
    const serialCalls: { readonly sliceId: string; readonly epicId?: string }[] = [];
    const parallelCalls: { readonly sliceId: string; readonly epicId?: string }[] = [];
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let bothEntered!: () => void;
    const overlap = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });

    await drive(
      {
        cwd: serial,
        runId: 'run-1',
        ports: fakePorts({
          agentRunner: {
            async run(args) {
              serialCalls.push({
                sliceId: args.sliceId,
                ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
              });
              return { status: 'completed' };
            },
          },
        }),
      },
      petriScheduler,
      serialFiringPolicy,
    );
    const parallelDrive = drive(
      {
        cwd: parallel,
        runId: 'run-1',
        ports: fakePorts({
          agentRunner: {
            async run(args) {
              parallelCalls.push({
                sliceId: args.sliceId,
                ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
              });
              if (parallelCalls.length === 2) bothEntered();
              await released;
              return { status: 'completed' };
            },
          },
        }),
      },
      petriScheduler,
      frontierFiringPolicy,
    );
    await overlap;
    release();
    await parallelDrive;

    expect(serialCalls).toEqual([{ sliceId: 'task-1' }, { sliceId: 'task-2' }]);
    expect(new Set(parallelCalls.map((call) => call.sliceId))).toEqual(new Set(['task-1', 'task-2']));
    expect(parallelCalls.every((call) => call.epicId === undefined)).toBe(true);
  });

  it('overlaps independent slice effects only after each claim is journaled and marked', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-slices-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    const entered: string[] = [];
    const entryEvidence: {
      readonly sliceId: string;
      readonly transitionIds: readonly string[];
      readonly marking: Record<string, number> | undefined;
    }[] = [];
    const liveEvents: ExecutorNetEvent[] = [];
    const unsubscribe = subscribePetriEvents({
      cwd,
      runId: 'run-1',
      listener: (event) => liveEvents.push(event),
    });
    let releaseAgents!: () => void;
    const released = new Promise<void>((resolve) => {
      releaseAgents = resolve;
    });
    let bothEntered!: () => void;
    const overlapping = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });
    const agentRunner: AgentRunnerPort = {
      async run(args) {
        await args.onUpdate?.({ kind: 'status', message: `running ${args.sliceId}` });
        const events = await readPetriEvents(cwd);
        const snapshot = await readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
        entryEvidence.push({
          sliceId: args.sliceId,
          transitionIds: events.flatMap((event) =>
            event.kind === 'transition_fired' ? [event.transitionId] : [],
          ),
          marking: snapshot?.currentMarking,
        });
        entered.push(args.sliceId);
        if (entered.length === 2) bothEntered();
        await released;
        return { status: 'completed' };
      },
    };

    const driving = drive(
      { cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) },
      petriScheduler,
      frontierFiringPolicy,
    );
    await overlapping;

    expect(new Set(entered)).toEqual(new Set(['task-1', 'task-2']));
    for (const evidence of entryEvidence) {
      expect(evidence.transitionIds).toEqual(
        expect.arrayContaining(['slice_start:task-1', 'slice_start:task-2']),
      );
      expect(evidence.marking).not.toHaveProperty('slice:task-1:claim');
      expect(evidence.marking).not.toHaveProperty('slice:task-2:claim');
    }
    expect(
      (await readPetriEvents(cwd))
        .filter((event) => event.kind === 'transition_fired')
        .map((event) => event.transitionId),
    ).toEqual(
      expect.arrayContaining([
        'slice_start:task-1',
        'slice_start:task-2',
        'slice_execute:task-1',
        'slice_execute:task-2',
      ]),
    );
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      currentMarking: {
        'slice:task-1:agent_attempt:1': 1,
        'slice:task-2:agent_attempt:1': 1,
      },
      lifecycleProvenance: { runStatus: 'reports_initialized' },
      parallelSliceBatch: {
        claimedSliceIds: ['task-1', 'task-2'],
        settlements: [],
      },
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'reports_initialized',
    });
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        {
          sliceId: 'task-1',
          blockers: [{ kind: 'parallel_authority', state: 'running' }],
        },
        {
          sliceId: 'task-2',
          blockers: [{ kind: 'parallel_authority', state: 'running' }],
        },
      ],
      petriProjectionSource: 'snapshot',
      petriProjection: {
        currentMarking: {
          'slice:task-1:agent_attempt:1': 1,
          'slice:task-2:agent_attempt:1': 1,
        },
      },
      agentStreamTail: expect.arrayContaining([
        expect.objectContaining({ sliceId: 'task-1', message: 'running task-1' }),
        expect.objectContaining({ sliceId: 'task-2', message: 'running task-2' }),
      ]),
      sliceStreamInventory: [
        { sliceId: 'task-1', state: 'running', agentAttempts: [1], verifyAttempts: [] },
        { sliceId: 'task-2', state: 'running', agentAttempts: [1], verifyAttempts: [] },
      ],
    });

    releaseAgents();
    await expect(driving).resolves.toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    unsubscribe();
    const reconnectEvents = await readPetriEvents(cwd);
    expect(liveEvents).toEqual(reconnectEvents);
    const replay = reducePetrinautReplayExport({
      sdcpnFile: JSON.parse(await readFile(petriSdcpnPath(cwd, 'run-1'), 'utf8')),
      events: reconnectEvents,
    });
    expect(replay.transitionFirings.map((firing) => firing.transitionId)).toEqual([
      ...liveEvents.flatMap((event) => (event.kind === 'transition_fired' ? [event.transitionId] : [])),
      'run:finish',
    ]);
  });

  it('reports claimed slices as blocked before workspace preparation completes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-claimed-observer-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    let entered = 0;
    let bothEntered!: () => void;
    const claimed = new Promise<void>((resolve) => {
      bothEntered = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = createFakeGitSliceIntegrationPort();
    const ports = fakePorts({
      gitSliceIntegration: createFakeGitSliceIntegrationPort({
        async prepare(args) {
          entered += 1;
          if (entered === 2) bothEntered();
          await released;
          return base.prepare(args);
        },
        integrate: (args) => base.integrate(args),
      }),
    });
    const driving = drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy);
    await claimed;

    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        { sliceId: 'task-1', blockers: [{ kind: 'parallel_authority', state: 'claimed' }] },
        { sliceId: 'task-2', blockers: [{ kind: 'parallel_authority', state: 'claimed' }] },
      ],
      sliceStreamInventory: [
        { sliceId: 'task-1', state: 'claimed', agentAttempts: [], verifyAttempts: [] },
        { sliceId: 'task-2', state: 'claimed', agentAttempts: [], verifyAttempts: [] },
      ],
    });
    const marking = await readFile(petriMarkingPath(cwd, 'run-1'), 'utf8');
    await writeFile(petriMarkingPath(cwd, 'run-1'), '{malformed', 'utf8');
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        { kind: 'authority_unreadable', blockers: [{ kind: 'parallel_authority_unreadable' }] },
        { kind: 'slice_start', sliceId: 'task-1', blockers: [{ kind: 'parallel_authority_unreadable' }] },
        { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'parallel_authority_unreadable' }] },
      ],
    });
    await writeFile(petriMarkingPath(cwd, 'run-1'), marking, 'utf8');
    release();
    await driving;
  });

  it('preserves cross-slice stream order across reconnect before applying the tail limit', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-stream-order-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    let a1Written!: () => void;
    const a1 = new Promise<void>((resolve) => {
      a1Written = resolve;
    });
    let b1Written!: () => void;
    const b1 = new Promise<void>((resolve) => {
      b1Written = resolve;
    });
    let v1Written!: () => void;
    const v1 = new Promise<void>((resolve) => {
      v1Written = resolve;
    });
    let w1Written!: () => void;
    const w1 = new Promise<void>((resolve) => {
      w1Written = resolve;
    });
    let verifyEventsWritten!: () => void;
    const emitted = new Promise<void>((resolve) => {
      verifyEventsWritten = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const driving = drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          agentRunner: {
            async run(args) {
              if (args.sliceId === 'task-1') {
                await args.onUpdate?.({ kind: 'message', message: 'A1' });
                a1Written();
                await b1;
                await args.onUpdate?.({ kind: 'message', message: 'A2' });
              } else {
                await a1;
                await args.onUpdate?.({ kind: 'message', message: 'B1' });
                b1Written();
              }
              return { status: 'completed' };
            },
          },
          testRunner: {
            async run(args) {
              if (args.worktreeDir.includes('/task-1/')) {
                await args.onUpdate?.({ kind: 'stdout', message: 'V1' });
                v1Written();
                await w1;
                await args.onUpdate?.({ kind: 'stdout', message: 'V2' });
                verifyEventsWritten();
              } else {
                await v1;
                await args.onUpdate?.({ kind: 'stdout', message: 'W1' });
                w1Written();
              }
              await released;
              return { status: 'completed', verdict: 'passed', exitCode: 0 };
            },
          },
        }),
      },
      petriScheduler,
      frontierFiringPolicy,
    );
    await emitted;

    const complete = await readRunDetail(cwd, 'run-1');
    expect(complete && 'agentStreamTail' in complete ? complete.agentStreamTail : []).toMatchObject([
      { sliceId: 'task-1', message: 'A1', runSequence: 0 },
      { sliceId: 'task-2', message: 'B1', runSequence: 1 },
      { sliceId: 'task-1', message: 'A2', runSequence: 2 },
    ]);
    const newest = await readRunDetail(cwd, 'run-1', { agentStreamTailLimit: 2 });
    expect(newest && 'agentStreamTail' in newest ? newest.agentStreamTail : []).toMatchObject([
      { sliceId: 'task-2', message: 'B1', runSequence: 1 },
      { sliceId: 'task-1', message: 'A2', runSequence: 2 },
    ]);
    expect(complete && 'verifyStreamTail' in complete ? complete.verifyStreamTail : []).toMatchObject([
      { sliceId: 'task-1', message: 'V1', runSequence: 3 },
      { sliceId: 'task-2', message: 'W1', runSequence: 4 },
      { sliceId: 'task-1', message: 'V2', runSequence: 5 },
    ]);
    const newestVerify = await readRunDetail(cwd, 'run-1', { verifyStreamTailLimit: 2 });
    expect(
      newestVerify && 'verifyStreamTail' in newestVerify ? newestVerify.verifyStreamTail : [],
    ).toMatchObject([
      { sliceId: 'task-2', message: 'W1', runSequence: 4 },
      { sliceId: 'task-1', message: 'V2', runSequence: 5 },
    ]);

    release();
    await driving;
  });

  it('keeps succeeded-unintegrated batch streams visible while ordered integration is blocked', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-unintegrated-observer-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    let integrationEntered!: () => void;
    const integrating = new Promise<void>((resolve) => {
      integrationEntered = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = createFakeGitSliceIntegrationPort();
    const ports = fakePorts({
      agentRunner: {
        async run(args) {
          await args.onUpdate?.({ kind: 'status', message: `agent ${args.sliceId}` });
          return { status: 'completed' };
        },
      },
      testRunner: {
        async run(args) {
          await args.onUpdate?.({ kind: 'status', message: 'verify' });
          return { status: 'completed', verdict: 'passed', exitCode: 0 };
        },
      },
      gitSliceIntegration: createFakeGitSliceIntegrationPort({
        prepare: (args) => base.prepare(args),
        async integrate(args) {
          if (args.sliceId === 'task-1') {
            integrationEntered();
            await released;
          }
          return base.integrate(args);
        },
      }),
    });
    const driving = drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy);
    await integrating;

    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        {
          sliceId: 'task-1',
          blockers: [{ kind: 'parallel_authority', state: 'succeeded_unintegrated' }],
        },
        {
          sliceId: 'task-2',
          blockers: [{ kind: 'parallel_authority', state: 'succeeded_unintegrated' }],
        },
      ],
      sliceStreamInventory: [
        { sliceId: 'task-1', state: 'succeeded_unintegrated', agentAttempts: [1], verifyAttempts: [1] },
        { sliceId: 'task-2', state: 'succeeded_unintegrated', agentAttempts: [1], verifyAttempts: [1] },
      ],
    });
    release();
    await driving;
  });

  it('keeps every failed batch slice visible after terminal reconnect', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-all-failed-observer-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      spec: {
        requirements: [{ item_id: 'REQ-all', content: 'Both slices must succeed.' }],
        criteria: [{ item_id: 'AC-all', verifies: ['REQ-all'] }],
      },
      epics: [{ id: 'frontier-1', depends_on: [], verification: [] }],
      slices: ['task-1', 'task-2'].map((id) => ({
        id,
        epic_id: 'frontier-1',
        definition: id,
        depends_on: [],
        verification: [],
        derived_from: ['REQ-all'],
      })),
    });
    await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          agentRunner: {
            async run(args) {
              await args.onUpdate?.({ kind: 'status', message: `failed ${args.sliceId}` });
              return { status: 'failed', message: 'failed' };
            },
          },
        }),
      },
      petriScheduler,
      frontierFiringPolicy,
    );

    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        { sliceId: 'task-1', blockers: [{ kind: 'parallel_authority', state: 'failed' }] },
        { sliceId: 'task-2', blockers: [{ kind: 'parallel_authority', state: 'failed' }] },
      ],
      sliceStreamInventory: [
        { sliceId: 'task-1', state: 'failed', agentAttempts: [1, 2, 3], verifyAttempts: [] },
        { sliceId: 'task-2', state: 'failed', agentAttempts: [1, 2, 3], verifyAttempts: [] },
      ],
      agentStreamTotal: 6,
      requirements: [
        expect.objectContaining({
          requirementId: 'REQ-all',
          status: 'failed',
          failedSliceIds: ['task-1', 'task-2'],
        }),
      ],
    });
  });

  it('keeps a successful sibling durable when an independent slice exhausts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-failure-isolation-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    const integrated: string[] = [];
    const baseIntegration = createFakeGitSliceIntegrationPort();
    const ports = fakePorts({
      agentRunner: {
        async run(args) {
          return args.sliceId === 'task-1'
            ? { status: 'failed', message: 'task-1 failed' }
            : { status: 'completed' };
        },
      },
      gitSliceIntegration: createFakeGitSliceIntegrationPort({
        prepare: (args) => baseIntegration.prepare(args),
        async integrate(args) {
          integrated.push(args.sliceId);
          return baseIntegration.integrate(args);
        },
      }),
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({
      status: 'halted',
      step: 'agent_result',
      runStatus: 'slice_completed',
      reason: 'agent_run_failed',
    });

    expect(integrated).toEqual(['task-2']);
    const events = await readPetriEvents(cwd);
    expect(
      events.flatMap((event) => (event.kind === 'transition_fired' ? [event.transitionId] : [])),
    ).toEqual(
      expect.arrayContaining(['agent_exhausted:task-1', 'slice_integrate:task-2', 'slice_complete:task-2']),
    );
    expect(await readReportEvents(cwd)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'slice_integrated', sliceId: 'task-2' }),
        expect.objectContaining({ event: 'slice_completed', sliceId: 'task-2' }),
      ]),
    );
    const snapshot = await readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
    expect(snapshot).toMatchObject({
      currentMarking: {
        'slice:task-1:agent_attempts_exhausted': 1,
        'epic:frontier-1:member:task-2': 1,
      },
      parallelSliceBatch: {
        claimedSliceIds: ['task-1', 'task-2'],
        settlements: [
          {
            sliceId: 'task-1',
            status: 'failed',
            step: 'agent_result',
            reason: 'agent_run_failed',
          },
          { sliceId: 'task-2', status: 'succeeded' },
        ],
      },
      terminalEventKind: 'net_halted',
      haltedReason: 'agent_run_failed',
    });
    const replay = replayPetri({
      net: JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')),
      events,
    });
    expect(replay?.currentMarking).toEqual(snapshot?.currentMarking);
  });

  it('halts a persisted parallel slice batch on restart without duplicating effects', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-restart-'));
    const state = await prepareRunAtReports(cwd, ['task-1', 'task-2']);
    const plan = JSON.parse(planJson(['task-1', 'task-2']));
    const runtime = materializeExecutorPetriRuntime(state, plan);
    const transitionIds = ['slice_start:task-1', 'slice_start:task-2'];
    const claimed = replayTransitionHistory(runtime.topology, [
      ...projectExecutorPetriTransitionHistory(state, plan)!.transitionIds,
      ...transitionIds,
    ])!;
    for (const transitionId of transitionIds) {
      const transition = runtime.topology.transitions.find((candidate) => candidate.id === transitionId)!;
      await appendPetriEvent({
        cwd,
        runId: 'run-1',
        event: {
          kind: 'transition_fired',
          runId: 'run-1',
          runStatus: state.status,
          transitionId,
          subnetId: transition.subnetId,
          ...(transition.epicId ? { epicId: transition.epicId } : {}),
          step: 'slice_start',
          contract: transition.contract,
          consumed: transition.inputArcs.map((arc) => arc.placeId),
          produced: transition.outputArcs.map((arc) => arc.placeId),
          fromStatus: state.status,
          toStatus: state.status,
        },
      });
    }
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: claimed.currentMarking,
        firedTransitionCount: claimed.firedTransitionCount,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
        parallelSliceBatch: { claimedSliceIds: ['task-1', 'task-2'], settlements: [] },
      },
    });
    let agentCalls = 0;
    let testCalls = 0;
    const ports = fakePorts({
      agentRunner: {
        async run() {
          agentCalls += 1;
          return { status: 'completed' };
        },
      },
      testRunner: {
        async run() {
          testCalls += 1;
          return { status: 'completed', verdict: 'passed', exitCode: 0 };
        },
      },
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'parallel_slice_replan_required',
    });
    expect({ agentCalls, testCalls }).toEqual({ agentCalls: 0, testCalls: 0 });
  });

  it('halts a final-summary batch crash before the next epic lifecycle step', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-final-summary-crash-'));
    const state = await prepareRunAtReports(cwd, ['task-1', 'task-2']);
    const plan = JSON.parse(planJson(['task-1', 'task-2']));
    const summary: RunMetadata = {
      ...state,
      status: 'slice_completed',
      completedSliceIds: ['task-1', 'task-2'],
      integratedSliceCommits: { 'task-1': 'integrated-1', 'task-2': 'integrated-2' },
      sliceAttemptHistory: {
        'task-1': {
          agent: [{ outcome: 'succeeded', attempts: 1 }],
          verify: [{ outcome: 'succeeded', attempts: 1 }],
        },
        'task-2': {
          agent: [{ outcome: 'succeeded', attempts: 1 }],
          verify: [{ outcome: 'succeeded', attempts: 1 }],
        },
      },
    };
    await persistRunMetadata(runMetadataPath(cwd, 'run-1'), summary);
    const runtime = materializeExecutorPetriRuntime(summary, plan);
    expect(runtime.readySteps).toEqual([{ kind: 'epic_integrate', epicId: 'frontier-1' }]);
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: runtime.currentMarking,
        firedTransitionCount: projectExecutorPetriTransitionHistory(summary, plan)!.transitionIds.length,
        lifecycleProvenance: {
          runStatus: 'slice_completed',
          completedSliceIds: ['task-1', 'task-2'],
        },
        parallelSliceBatch: {
          claimedSliceIds: ['task-1', 'task-2'],
          settlements: [
            { sliceId: 'task-1', status: 'succeeded' },
            { sliceId: 'task-2', status: 'succeeded' },
          ],
        },
      },
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({
      status: 'halted',
      step: 'epic_integrate',
      runStatus: 'slice_completed',
      reason: 'parallel_slice_replan_required',
    });
    expect(
      (await readPetriEvents(cwd)).some(
        (event) => event.kind === 'transition_fired' && event.transitionId === 'epic_integrate:frontier-1',
      ),
    ).toBe(false);
  });

  it('persists failed settlement and integrates an ordered sibling while a later sibling hangs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-incremental-settlement-'));
    await createRunAtCreatedWithPlan(cwd, {
      mode: 'greenfield',
      spec: {
        requirements: [
          { item_id: 'REQ-failed', content: 'Failed member.' },
          { item_id: 'REQ-integrated', content: 'Integrated member.' },
          { item_id: 'REQ-running', content: 'Running member.' },
        ],
        criteria: [
          { item_id: 'AC-failed', verifies: ['REQ-failed'] },
          { item_id: 'AC-integrated', verifies: ['REQ-integrated'] },
          { item_id: 'AC-running', verifies: ['REQ-running'] },
        ],
      },
      epics: [{ id: 'frontier-1', depends_on: [], verification: [] }],
      slices: ['task-1', 'task-2', 'task-3'].map((id, index) => ({
        id,
        epic_id: 'frontier-1',
        definition: id,
        depends_on: [],
        verification: [],
        derived_from: [['REQ-failed'], ['REQ-integrated'], ['REQ-running']][index],
      })),
    });
    let releaseThird!: () => void;
    const thirdReleased = new Promise<void>((resolve) => {
      releaseThird = resolve;
    });
    let task2Integrated!: () => void;
    const cleanSiblingIntegrated = new Promise<void>((resolve) => {
      task2Integrated = resolve;
    });
    let fanInWriteWindowDetail: Promise<Awaited<ReturnType<typeof readRunDetail>>> | undefined;
    const unsubscribe = subscribeRunMetadata({
      cwd,
      runId: 'run-1',
      listener(metadata) {
        if (metadata.completedSliceIds?.includes('task-2')) {
          fanInWriteWindowDetail ??= readRunDetail(cwd, 'run-1');
          task2Integrated();
        }
      },
    });
    const baseIntegration = createFakeGitSliceIntegrationPort();
    const ports = fakePorts({
      agentRunner: {
        async run(args) {
          if (args.sliceId === 'task-1') return { status: 'failed', message: 'task-1 failed' };
          if (args.sliceId === 'task-3') await thirdReleased;
          return { status: 'completed' };
        },
      },
      gitSliceIntegration: createFakeGitSliceIntegrationPort({
        prepare: (args) => baseIntegration.prepare(args),
        async integrate(args) {
          return baseIntegration.integrate(args);
        },
      }),
    });

    const driving = drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy);
    await cleanSiblingIntegrated;

    await expect(fanInWriteWindowDetail).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: expect.arrayContaining([
        expect.objectContaining({
          sliceId: 'task-1',
          blockers: [{ kind: 'parallel_authority', state: 'failed' }],
        }),
        expect.objectContaining({
          sliceId: 'task-2',
          blockers: [{ kind: 'parallel_authority', state: 'integrated' }],
        }),
        expect.objectContaining({
          sliceId: 'task-3',
          blockers: [{ kind: 'parallel_authority', state: 'running' }],
        }),
      ]),
    });

    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      parallelSliceBatch: {
        settlements: [
          { sliceId: 'task-1', status: 'failed', reason: 'agent_run_failed' },
          { sliceId: 'task-2', status: 'succeeded' },
        ],
      },
    });
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriParallelSliceBatch: {
        settlements: [
          { sliceId: 'task-1', status: 'failed', reason: 'agent_run_failed' },
          { sliceId: 'task-2', status: 'succeeded' },
        ],
      },
      petriReadySteps: [],
      petriBlockedSteps: [
        { sliceId: 'task-1', blockers: [{ kind: 'parallel_authority', state: 'failed' }] },
        { sliceId: 'task-2', blockers: [{ kind: 'parallel_authority', state: 'integrated' }] },
        { sliceId: 'task-3', blockers: [{ kind: 'parallel_authority', state: 'running' }] },
      ],
      sliceStreamInventory: [
        { sliceId: 'task-1', state: 'failed' },
        { sliceId: 'task-2', state: 'integrated' },
        { sliceId: 'task-3', state: 'running' },
      ],
      requirements: [
        expect.objectContaining({
          requirementId: 'REQ-failed',
          status: 'failed',
          failedSliceIds: ['task-1'],
        }),
        expect.objectContaining({ requirementId: 'REQ-integrated', status: 'passed' }),
        expect.objectContaining({ requirementId: 'REQ-running', status: 'running' }),
      ],
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      completedSliceIds: ['task-2'],
      integratedSliceCommits: { 'task-2': 'integrated123' },
    });

    releaseThird();
    await expect(driving).resolves.toMatchObject({
      status: 'halted',
      step: 'agent_result',
      reason: 'agent_run_failed',
    });
    unsubscribe();
  });

  it.each([
    { fault: 'workspace', step: 'slice_execute', reason: 'slice_workspace_threw' },
    { fault: 'artifact', step: 'slice_execute', reason: 'slice_artifact_write_failed' },
    { fault: 'agent', step: 'agent_result', reason: 'agent_run_threw' },
    { fault: 'verifier', step: 'test_result', reason: 'test_run_threw' },
  ] as const)(
    'durably settles a thrown parallel $fault effect while integrating its sibling',
    async ({ fault, step, reason }) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-thrown-effect-'));
      await createRunAtCreated(cwd, ['task-1', 'task-2']);
      const integrated: string[] = [];
      const baseIntegration = createFakeGitSliceIntegrationPort();
      const ports = fakePorts({
        gitSliceIntegration: createFakeGitSliceIntegrationPort({
          async prepare(args) {
            if (fault === 'workspace' && args.sliceId === 'task-1') {
              throw new Error('workspace exploded');
            }
            const prepared = await baseIntegration.prepare(args);
            if (fault === 'artifact' && args.sliceId === 'task-1') {
              await mkdir(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'), { recursive: true });
            }
            return prepared;
          },
          async integrate(args) {
            integrated.push(args.sliceId);
            return baseIntegration.integrate(args);
          },
        }),
        agentRunner: {
          async run(args) {
            if (fault === 'agent' && args.sliceId === 'task-1') throw new Error('agent exploded');
            return { status: 'completed' };
          },
        },
        testRunner: {
          async run(args) {
            if (fault === 'verifier' && args.worktreeDir.includes('/task-1/')) {
              throw new Error('verifier exploded');
            }
            return { status: 'completed', verdict: 'passed', exitCode: 0 };
          },
        },
      });

      await expect(
        drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
      ).resolves.toMatchObject({ status: 'halted', step, reason: expect.stringContaining(reason) });
      expect(integrated).toEqual(['task-2']);
      await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
        parallelSliceBatch: {
          settlements: [
            {
              sliceId: 'task-1',
              status: 'failed',
              step,
              reason: expect.stringContaining(reason),
            },
            { sliceId: 'task-2', status: 'succeeded' },
          ],
        },
        terminalEventKind: 'net_halted',
        haltedReason: expect.stringContaining(reason),
      });
      await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
        completedSliceIds: ['task-2'],
      });
    },
  );

  it('starts no slice effect when a durable claim cannot reach the marking snapshot', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-claim-marking-failure-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    const markingPath = petriMarkingPath(cwd, 'run-1');
    const preservedMarking = `${markingPath}.preserved`;
    let blocked = false;
    const unsubscribe = subscribePetriEvents({
      cwd,
      runId: 'run-1',
      listener(event) {
        if (blocked || event.kind !== 'transition_fired' || event.transitionId !== 'slice_start:task-1')
          return;
        blocked = true;
        renameSync(markingPath, preservedMarking);
        mkdirSync(markingPath);
      },
    });
    let agentCalls = 0;
    const ports = fakePorts({
      agentRunner: {
        async run() {
          agentCalls += 1;
          return { status: 'completed' };
        },
      },
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'petri_marking_persist_failed',
    });
    unsubscribe();
    expect(agentCalls).toBe(0);
    rmSync(markingPath, { recursive: true });
    renameSync(preservedMarking, markingPath);

    await expect(
      drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'parallel_slice_replan_required',
    });
    expect(agentCalls).toBe(0);
  });

  it('starts no slice effect when the claim journal append fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-claim-journal-failure-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    const preservedJournal = `${petriEventsPath(cwd, 'run-1')}.preserved`;
    let blocked = false;
    const unsubscribe = subscribePetriEvents({
      cwd,
      runId: 'run-1',
      listener(event) {
        if (blocked || event.kind !== 'transition_fired' || event.transitionId !== 'slice_start:task-1')
          return;
        blocked = true;
        renameSync(petriEventsPath(cwd, 'run-1'), preservedJournal);
        mkdirSync(petriEventsPath(cwd, 'run-1'));
      },
    });
    let agentCalls = 0;
    const ports = fakePorts({
      agentRunner: {
        async run() {
          agentCalls += 1;
          return { status: 'completed' };
        },
      },
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports }, petriScheduler, frontierFiringPolicy),
    ).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'petri_journal_append_failed',
    });
    unsubscribe();
    expect(agentCalls).toBe(0);
    await expect(readFile(preservedJournal, 'utf8')).resolves.toContain(
      '"transitionId":"slice_start:task-1"',
    );
  });

  it('serializes fan-in in claimed order and stops at the first conflict', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-fan-in-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2', 'task-3']);
    const calls: string[] = [];
    const cleanTree: string[] = [];
    let activeIntegrations = 0;
    let maximumActiveIntegrations = 0;
    const baseIntegration = createFakeGitSliceIntegrationPort();
    const gitSliceIntegration = createFakeGitSliceIntegrationPort({
      prepare: (args) => baseIntegration.prepare(args),
      async integrate(args) {
        calls.push(args.sliceId);
        activeIntegrations += 1;
        maximumActiveIntegrations = Math.max(maximumActiveIntegrations, activeIntegrations);
        await Promise.resolve();
        activeIntegrations -= 1;
        if (args.sliceId === 'task-2') {
          return { status: 'conflict', message: 'same file', sideEffects: [] };
        }
        cleanTree.push(args.sliceId);
        return {
          status: 'integrated',
          sliceCommitSha: `${args.sliceId}-slice`,
          integrationCommitSha: `${args.sliceId}-integrated`,
          sideEffects: [],
        };
      },
    });

    await expect(
      drive(
        { cwd, runId: 'run-1', ports: fakePorts({ gitSliceIntegration }) },
        petriScheduler,
        frontierFiringPolicy,
      ),
    ).resolves.toEqual({
      status: 'halted',
      step: 'slice_integrate',
      runStatus: 'slice_completed',
      reason: 'slice_integration_conflict',
    });
    expect(calls).toEqual(['task-1', 'task-2']);
    expect(maximumActiveIntegrations).toBe(1);
    expect(cleanTree).toEqual(['task-1']);
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      completedSliceIds: ['task-1'],
      integratedSliceCommits: { 'task-1': 'task-1-integrated' },
    });
  });

  it('replaces a succeeded effect settlement when integration throws and preserves earlier fan-in', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-parallel-fan-in-throw-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    const base = createFakeGitSliceIntegrationPort();
    const gitSliceIntegration = createFakeGitSliceIntegrationPort({
      prepare: (args) => base.prepare(args),
      async integrate(args) {
        if (args.sliceId === 'task-2') throw new Error('integration carrier broke');
        return {
          status: 'integrated',
          sliceCommitSha: 'task-1-slice',
          integrationCommitSha: 'task-1-integrated',
          sideEffects: [],
        };
      },
    });

    await expect(
      drive(
        { cwd, runId: 'run-1', ports: fakePorts({ gitSliceIntegration }) },
        petriScheduler,
        frontierFiringPolicy,
      ),
    ).resolves.toEqual({
      status: 'halted',
      step: 'slice_integrate',
      runStatus: 'slice_completed',
      reason: 'slice_integration_threw: integration carrier broke',
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      completedSliceIds: ['task-1'],
      integratedSliceCommits: { 'task-1': 'task-1-integrated' },
    });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toMatchObject({
      terminalEventKind: 'net_halted',
      haltedReason: 'slice_integration_threw: integration carrier broke',
      parallelSliceBatch: {
        settlements: [
          { sliceId: 'task-1', status: 'succeeded' },
          {
            sliceId: 'task-2',
            status: 'failed',
            step: 'slice_integrate',
            reason: 'slice_integration_threw: integration carrier broke',
          },
        ],
      },
    });
  });

  it('prepares Petrinaut observation before invoking the first lifecycle effect', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-petrinaut-before-effect-'));
    await createRunAtCreated(cwd, ['task-1']);
    let releaseWorktree!: () => void;
    const worktreeReleased = new Promise<void>((resolve) => {
      releaseWorktree = resolve;
    });
    let worktreeStarted!: () => void;
    const worktreeStart = new Promise<void>((resolve) => {
      worktreeStarted = resolve;
    });
    const underlying = createFakeGitWorktreePort();
    const gitWorktree = createFakeGitWorktreePort(async (args) => {
      worktreeStarted();
      await worktreeReleased;
      return underlying.create(args);
    });

    const driven = drive({ cwd, runId: 'run-1', ports: fakePorts({ gitWorktree }) });
    await worktreeStart;

    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(true);
    expect(await pathExists(petriSdcpnPath(cwd, 'run-1'))).toBe(true);
    expect(await readFile(petriEventsPath(cwd, 'run-1'), 'utf8')).toBe('');
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.status).toBe('created');

    await writeFile(planFilePath(cwd, '42'), planJson(['changed-after-publication']), 'utf8');
    releaseWorktree();
    await expect(driven).resolves.toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    const populatedPlan = JSON.parse(await readFile(runPopulatedPlanPath(cwd, 'run-1'), 'utf8'));
    expect(populatedPlan.slices.map((slice: { readonly id: string }) => slice.id)).toEqual(['task-1']);
  });

  it('halts before the first lifecycle effect when Petrinaut observation cannot be prepared', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-petrinaut-prepare-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    await writeFile(join(runDirPath(cwd, 'run-1'), 'petrinaut'), 'not-a-directory', 'utf8');
    let worktreeCalls = 0;
    const gitWorktree = createFakeGitWorktreePort(async (args) => {
      worktreeCalls += 1;
      return createFakeGitWorktreePort().create(args);
    });

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ gitWorktree }) });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'worktree_create',
      runStatus: 'created',
      reason: 'petrinaut_observation_unavailable',
    });
    expect(worktreeCalls).toBe(0);
  });

  it('drives a created run through to run-local promotion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-complete-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('promotion_prepared');
    expect(meta?.completedSliceIds).toEqual(['task-1', 'task-2']);
    expect(meta?.promotionCommitSha).toBe('abc123');
  });

  it('runs dependent slices in stable isolated workspaces and integrates them in dependency order', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-slice-workspaces-'));
    await createRunAtCreated(cwd, ['task-1', { id: 'task-2', dependsOn: ['task-1'] }]);
    const prepared: string[] = [];
    const integrated: string[] = [];
    const agentWorktrees: string[] = [];
    const gitSliceIntegration = createFakeGitSliceIntegrationPort({
      async prepare(args) {
        prepared.push(args.sliceWorktreeDir);
        return {
          status: 'prepared',
          baseSha: `${args.sliceId}-base`,
          sideEffects: [
            { kind: 'git_worktree_add', path: args.sliceWorktreeDir, ref: `${args.sliceId}-base` },
          ],
        };
      },
      async integrate(args) {
        integrated.push(args.sliceId);
        return {
          status: 'integrated',
          sliceCommitSha: `${args.sliceId}-slice`,
          integrationCommitSha: `${args.sliceId}-integrated`,
          sideEffects: [
            { kind: 'git_commit', path: args.sliceWorktreeDir, sha: `${args.sliceId}-slice` },
            { kind: 'git_integrate', path: args.runWorktreeDir, sha: `${args.sliceId}-integrated` },
          ],
        };
      },
    });

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        gitSliceIntegration,
        agentRunner: {
          async run(args) {
            agentWorktrees.push(args.worktreeDir);
            return { status: 'completed' };
          },
        },
      }),
    });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(prepared).toEqual([
      sliceWorkspacePath(cwd, 'run-1', 'task-1'),
      sliceWorkspacePath(cwd, 'run-1', 'task-2'),
    ]);
    expect(agentWorktrees).toEqual(prepared);
    expect(integrated).toEqual(['task-1', 'task-2']);
  });

  it('halts on an integration conflict without firing the integration transition', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-slice-conflict-'));
    await createRunAtCreated(cwd, ['task-1']);
    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        gitSliceIntegration: createFakeGitSliceIntegrationPort({
          async integrate() {
            return { status: 'conflict', message: 'shared.txt conflicts', sideEffects: [] };
          },
        }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'slice_integrate',
      runStatus: 'test_result_ingested',
      reason: 'slice_integration_conflict',
    });
    const events = await readPetriEvents(cwd);
    expect(events).not.toContainEqual(expect.objectContaining({ transitionId: 'slice_integrate:task-1' }));
    expect(events.at(-1)).toMatchObject({
      kind: 'net_halted',
      step: 'slice_integrate',
      reason: 'slice_integration_conflict',
    });
    expect(await readReportEvents(cwd)).toContainEqual(
      expect.objectContaining({ event: 'slice_integration_conflict', message: 'shared.txt conflicts' }),
    );
  });

  it('retries a failed agent attempt in-run and journals every attempt', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-retry-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(2);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(agentRunner.calls()).toBe(3);
    expect(agentRunner.resultPaths()).toEqual([
      expect.stringContaining('/agent-output/task-1/attempt-1/result.json'),
      expect.stringContaining('/agent-output/task-1/attempt-2/result.json'),
      expect.stringContaining('/agent-output/task-1/attempt-3/result.json'),
    ]);
    await expect(readFile(agentStreamPath(cwd, 'run-1', 'task-1', 1), 'utf8')).resolves.toContain(
      'agent attempt 1',
    );
    await expect(readFile(agentStreamPath(cwd, 'run-1', 'task-1', 2), 'utf8')).resolves.toContain(
      'agent attempt 2',
    );
    await expect(readFile(agentStreamPath(cwd, 'run-1', 'task-1', 3), 'utf8')).resolves.toContain(
      'agent attempt 3',
    );
    const events = await readPetriEvents(cwd);
    const attempts = events.filter((event) => event.kind === 'attempt_failed');
    expect(attempts).toEqual([
      expect.objectContaining({
        sliceId: 'task-1',
        epicId: 'frontier-1',
        step: 'agent_result',
        attempt: 1,
        reason: 'agent_run_failed',
        runStatus: 'slice_execution_requested',
      }),
      expect.objectContaining({ sliceId: 'task-1', attempt: 2 }),
    ]);
    expect(
      events.flatMap((event) => {
        if (event.kind === 'attempt_failed') return [`failed:${event.attempt}`];
        if (event.kind === 'transition_fired' && event.transitionId.startsWith('agent_retry:')) {
          return [event.transitionId];
        }
        return [];
      }),
    ).toEqual(['failed:1', 'agent_retry:task-1:1', 'failed:2', 'agent_retry:task-1:2']);
    const agentFiring = events.find(
      (event) => event.kind === 'transition_fired' && event.transitionId.startsWith('agent_result:'),
    );
    expect(agentFiring).toMatchObject({ transitionId: 'agent_result:task-1:attempt:3', attempt: 3 });
    expect(
      (await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.sliceAttemptHistory?.['task-1']?.agent,
    ).toEqual([{ outcome: 'succeeded', attempts: 3 }]);
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBeUndefined();
  });

  it('halts through the existing replan flow when agent attempts exhaust', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-exhaust-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(Number.POSITIVE_INFINITY);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'agent_result',
      runStatus: 'slice_execution_requested',
      reason: 'agent_run_failed',
    });
    expect(agentRunner.calls()).toBe(3);
    const events = await readPetriEvents(cwd);
    expect(events.filter((event) => event.kind === 'attempt_failed').map((event) => event.attempt)).toEqual([
      1, 2, 3,
    ]);
    expect(events.at(-1)).toMatchObject({
      kind: 'net_halted',
      step: 'agent_result',
      reason: 'agent_run_failed',
    });
    expect(events.at(-2)).toMatchObject({
      kind: 'transition_fired',
      transitionId: 'agent_exhausted:task-1',
      consumed: ['slice:task-1:agent_attempt:3'],
      produced: ['slice:task-1:agent_attempts_exhausted'],
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBe(3);
  });

  it('halts fail-closed when the retry transition cannot append after a durable failed-attempt fact', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-retry-journal-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    const seen: ExecutorNetEvent[] = [];
    const preservedJournal = `${petriEventsPath(cwd, 'run-1')}.preserved`;
    const unsubscribe = subscribePetriEvents({
      cwd,
      runId: 'run-1',
      listener(event) {
        seen.push(event);
        if (event.kind !== 'attempt_failed') return;
        renameSync(petriEventsPath(cwd, 'run-1'), preservedJournal);
        mkdirSync(petriEventsPath(cwd, 'run-1'));
      },
    });

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({ agentRunner: flakyAgentRunner(Number.POSITIVE_INFINITY) }),
    });
    unsubscribe();

    expect(outcome).toEqual({
      status: 'halted',
      step: 'agent_result',
      runStatus: 'slice_execution_requested',
      reason: 'petri_journal_append_failed',
    });
    expect(seen.at(-1)).toMatchObject({ kind: 'attempt_failed', attempt: 1 });
    expect(seen).not.toContainEqual(expect.objectContaining({ transitionId: 'agent_retry:task-1:1' }));
    expect(await readFile(preservedJournal, 'utf8')).toContain('"kind":"attempt_failed"');
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBe(1);
  });

  it('retries a crashed verify attempt in-run and journals every attempt', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-verify-attempt-retry-'));
    await createRunAtCreated(cwd, ['task-1']);
    const testRunner = flakyTestRunner(2);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ testRunner }) });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(testRunner.calls()).toBe(3);
    await expect(readFile(verifyStreamPath(cwd, 'run-1', 'task-1', 1), 'utf8')).resolves.toContain(
      'verify attempt 1',
    );
    await expect(readFile(verifyStreamPath(cwd, 'run-1', 'task-1', 2), 'utf8')).resolves.toContain(
      'verify attempt 2',
    );
    await expect(readFile(verifyStreamPath(cwd, 'run-1', 'task-1', 3), 'utf8')).resolves.toContain(
      'verify attempt 3',
    );
    const events = await readPetriEvents(cwd);
    expect(
      events
        .filter((event) => event.kind === 'attempt_failed')
        .map((event) => ({ step: event.step, attempt: event.attempt, reason: event.reason })),
    ).toEqual([
      { step: 'test_result', attempt: 1, reason: 'test_run_failed' },
      { step: 'test_result', attempt: 2, reason: 'test_run_failed' },
    ]);
    expect(
      events
        .filter((event) => event.kind === 'transition_fired')
        .filter((event) => event.transitionId.startsWith('verify_retry:'))
        .map((event) => event.transitionId),
    ).toEqual(['verify_retry:task-1:1', 'verify_retry:task-1:2']);
    const verifyFiring = events.find(
      (event) => event.kind === 'transition_fired' && event.transitionId.startsWith('test_result:'),
    );
    expect(verifyFiring).toMatchObject({ transitionId: 'test_result:task-1:attempt:3', attempt: 3 });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBeUndefined();
  });

  it('keeps terminal run.json projection equivalent to journal replay after successful retries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-terminal-equivalence-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({ agentRunner: flakyAgentRunner(1), testRunner: flakyTestRunner(1) }),
    });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    const state = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
    expect(state.sliceAttemptHistory?.['task-1']).toEqual({
      agent: [{ outcome: 'succeeded', attempts: 2 }],
      verify: [{ outcome: 'succeeded', attempts: 2 }],
    });
    const plan = JSON.parse(await readFile(petriPlanSnapshotPath(cwd, 'run-1'), 'utf8'));
    const projected = projectExecutorPetriTransitionHistory(state, plan)!;
    const events = await readPetriEvents(cwd);
    const journalTransitionIds = events.flatMap((event) =>
      event.kind === 'transition_fired' ? [event.transitionId] : [],
    );
    const replayed = replayPetri({
      net: JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')),
      events,
    });
    const runtime = materializeExecutorPetriRuntime(state, plan);

    expect(projected.transitionIds).toEqual(journalTransitionIds);
    expect(projected.transitionIds).toEqual(
      expect.arrayContaining([
        'agent_retry:task-1:1',
        'agent_result:task-1:attempt:2',
        'verify_retry:task-1:1',
        'test_result:task-1:attempt:2',
      ]),
    );
    expect(replayed).toMatchObject({
      currentMarking: runtime.currentMarking,
      firedTransitionCount: projected.transitionIds.length,
    });
  });

  it('gives verify crashes a fresh bound after agent attempts succeeded', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-per-stage-bound-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(2);
    const testRunner = flakyTestRunner(Number.POSITIVE_INFINITY);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner, testRunner }) });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    expect(agentRunner.calls()).toBe(3);
    expect(testRunner.calls()).toBe(3);
    expect(
      (await readPetriEvents(cwd))
        .filter((event) => event.kind === 'attempt_failed')
        .map((event) => ({ step: event.step, attempt: event.attempt })),
    ).toEqual([
      { step: 'agent_result', attempt: 1 },
      { step: 'agent_result', attempt: 2 },
      { step: 'test_result', attempt: 1 },
      { step: 'test_result', attempt: 2 },
      { step: 'test_result', attempt: 3 },
    ]);
  });

  it('resets the attempt bound on explicit retry so a retried drive gets fresh attempts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-attempt-reset-'));
    await createRunAtCreated(cwd, ['task-1']);
    const agentRunner = flakyAgentRunner(Number.POSITIVE_INFINITY);
    await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });
    expect(agentRunner.calls()).toBe(3);

    await resetActiveSliceAttempts({ cwd, runId: 'run-1' });

    expect(await readRunMetadata(runMetadataPath(cwd, 'run-1'))).toMatchObject({
      activeSliceAttemptReset: { stage: 'agent' },
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.activeSliceAttempts).toBeUndefined();
    const retried = await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner }) });
    expect(retried).toMatchObject({ status: 'halted', reason: 'agent_run_failed' });
    expect(agentRunner.calls()).toBe(6);
    expect(
      (await readPetriEvents(cwd))
        .filter((event) => event.kind === 'attempt_failed')
        .map((event) => event.attempt),
    ).toEqual([1, 2, 3, 1, 2, 3]);
    const state = (await readRunMetadata(runMetadataPath(cwd, 'run-1')))!;
    expect(state.activeSliceAttemptReset).toBeUndefined();
    expect(state.sliceAttemptHistory?.['task-1']?.agent).toEqual([
      { outcome: 'exhausted', attempts: 3 },
      { outcome: 'reset', attempts: 0 },
      { outcome: 'exhausted', attempts: 3 },
    ]);
    const plan = JSON.parse(await readFile(petriPlanSnapshotPath(cwd, 'run-1'), 'utf8'));
    const events = await readPetriEvents(cwd);
    const projected = projectExecutorPetriTransitionHistory(state, plan)!;
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'transition_fired',
        transitionId: 'agent_reset:task-1',
        consumed: ['slice:task-1:agent_attempts_exhausted'],
        produced: ['slice:task-1:agent_attempt:1'],
      }),
    );
    expect(projected.transitionIds).toEqual(
      events.flatMap((event) => (event.kind === 'transition_fired' ? [event.transitionId] : [])),
    );
    const replayed = replayPetri({
      net: JSON.parse(await readFile(petriNetPath(cwd, 'run-1'), 'utf8')),
      events,
    });
    expect(replayed).toMatchObject({
      currentMarking: materializeExecutorPetriRuntime(state, plan).currentMarking,
      firedTransitionCount: projected.transitionIds.length,
    });
  });

  it('halts without lifecycle dispatch when the transition journal becomes unavailable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-journal-append-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    const ports = fakePorts();
    await expect(
      drive({ cwd, runId: 'run-1', ports }, linearScheduler, serialFiringPolicy, { maxFirings: 2 }),
    ).resolves.toEqual({ status: 'completed', runStatus: 'worktree_populated' });

    // Replace the journal file with a directory so every later appendFile fails (EISDIR).
    const journalPath = petriEventsPath(cwd, 'run-1');
    await rm(journalPath);
    await mkdir(journalPath);
    let failureWakeUps = 0;
    const unsubscribe = subscribePetriJournalFailures({
      cwd,
      runId: 'run-1',
      listener: () => {
        failureWakeUps += 1;
      },
    });

    try {
      await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
        status: 'halted',
        step: 'source_policy',
        runStatus: 'worktree_populated',
        reason: 'petri_input_unreadable',
      });
    } finally {
      unsubscribe();
    }
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.status).toBe('worktree_populated');
    expect(failureWakeUps).toBe(1);
    const snapshot = await readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
    expect(snapshot?.terminalEventKind).toBeUndefined();
  });

  it('does not repeat an effect when its metadata advanced before the transition append failed', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-journal-gap-restart-'));
    await createRunAtCreated(cwd, ['task-1']);
    await preparePetriObservation({ cwd, runId: 'run-1' });
    const journalPath = petriEventsPath(cwd, 'run-1');
    const preservedJournalPath = `${journalPath}.preserved`;
    let worktreeCalls = 0;
    const ports = fakePorts({
      gitWorktree: createFakeGitWorktreePort(async ({ worktreeDir, ref }) => {
        worktreeCalls += 1;
        await mkdir(worktreeDir, { recursive: true });
        await writeFile(join(worktreeDir, '.git'), 'gitdir: /tmp/brunch-fake-worktree\n', 'utf8');
        await rename(journalPath, preservedJournalPath);
        await mkdir(journalPath);
        return {
          status: 'created',
          worktreeDir,
          sideEffects: [{ kind: 'git_worktree_add', path: worktreeDir, ref }],
        };
      }),
    });

    await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
      status: 'halted',
      step: 'worktree_create',
      runStatus: 'worktree_created',
      reason: 'petri_journal_append_failed',
    });
    await rm(journalPath, { recursive: true });
    await rename(preservedJournalPath, journalPath);

    await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
      status: 'halted',
      step: 'populate',
      runStatus: 'worktree_created',
      reason: 'petri_journal_gap',
    });
    expect(worktreeCalls).toBe(1);
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'worktree_created',
    });
  });

  it('halts scheduler exhaustion without persisting a terminal snapshot when the terminal append fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-terminal-journal-failure-'));
    await createRunAtCreated(cwd, ['task-1']);
    const ports = fakePorts();
    await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
      status: 'completed',
      runStatus: 'promotion_prepared',
    });

    await rm(petriMarkingPath(cwd, 'run-1'));
    const journalPath = petriEventsPath(cwd, 'run-1');
    await rm(journalPath);
    await mkdir(journalPath);

    await expect(drive({ cwd, runId: 'run-1', ports })).resolves.toEqual({
      status: 'halted',
      step: 'promotion',
      runStatus: 'promotion_prepared',
      reason: 'petri_input_unreadable',
    });
    expect(await pathExists(petriMarkingPath(cwd, 'run-1'))).toBe(false);
  });

  it('defaults greenfield runs to plan-only source policy without copying host source', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-greenfield-plan-only-'));
    await createRunAtCreated(cwd, ['task-1']);

    await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta).toMatchObject({ sourcePolicy: 'plan_only', sourceCopied: false, copiedEntries: [] });
    expect(await readFile(join(cwd, 'src', 'app.ts'), 'utf8')).toBe('export const app = true;\n');
    await expect(readFile(join(meta!.worktreeDir!, 'src', 'app.ts'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('treats omitted plan mode as greenfield when selecting source policy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-omitted-mode-plan-only-'));
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planFilePath(cwd, '42'), planJson(['task-1'], { includeMode: false }), 'utf8');
    await createRun({ cwd, specId: '42', runId: 'run-1' });

    await drive({ cwd, runId: 'run-1', ports: fakePorts() });

    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta).toMatchObject({ sourcePolicy: 'plan_only', sourceCopied: false, copiedEntries: [] });
    await expect(readFile(join(meta!.worktreeDir!, 'src', 'app.ts'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('still copies host source for an explicit host-source policy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-explicit-host-source-'));
    await createRunAtCreated(cwd, ['task-1']);

    await drive({ cwd, runId: 'run-1', ports: fakePorts(), sourcePolicy: 'host_source_deferred' });

    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta).toMatchObject({ sourcePolicy: 'host_source_deferred', sourceCopied: true });
    await expect(readFile(join(meta!.worktreeDir!, 'src', 'app.ts'), 'utf8')).resolves.toBe(
      'export const app = true;\n',
    );
  });

  it('produces the same reports and terminal metadata as hand-cranking the steps', async () => {
    const driven = await mkdtemp(join(tmpdir(), 'brunch-drive-parity-driven-'));
    await createRunAtCreated(driven, ['task-1', 'task-2']);
    await drive({ cwd: driven, runId: 'run-1', ports: fakePorts() });

    const cranked = await mkdtemp(join(tmpdir(), 'brunch-drive-parity-cranked-'));
    await createRunAtCreated(cranked, ['task-1', 'task-2']);
    await crankManually(cranked, fakePorts());

    expect(await readReportEvents(driven)).toEqual(await readReportEvents(cranked));

    const drivenMeta = await readRunMetadata(runMetadataPath(driven, 'run-1'));
    const crankedMeta = await readRunMetadata(runMetadataPath(cranked, 'run-1'));
    expect(drivenMeta?.status).toBe(crankedMeta?.status);
    expect(drivenMeta?.completedSliceIds).toEqual(crankedMeta?.completedSliceIds);
    expect(drivenMeta?.promotionCommitSha).toBe(crankedMeta?.promotionCommitSha);
  });

  it('halts without advancing when a step cannot execute', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-halt-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('agent_result_ingested');
  });

  it('reports started and completed steps, and skips completion for the halted step', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-step-hook-'));
    await createRunAtCreated(cwd, ['task-1']);
    const seen: string[] = [];

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
      }),
      onStepStart: (step, runStatus) => {
        seen.push(`start:${step}:${runStatus}`);
      },
      onStepComplete: (step, runStatus) => {
        seen.push(`complete:${step}:${runStatus}`);
      },
    });

    expect(outcome.status).toBe('halted');
    expect(seen).toEqual([
      'start:worktree_create:created',
      'complete:worktree_create:worktree_created',
      'start:populate:worktree_created',
      'complete:populate:worktree_populated',
      'start:source_policy:worktree_populated',
      'complete:source_policy:source_policy_selected',
      'start:source_copy:source_policy_selected',
      'complete:source_copy:source_copied',
      'start:report_init:source_copied',
      'complete:report_init:reports_initialized',
      'start:slice_start:reports_initialized',
      'complete:slice_start:slice_started',
      'start:slice_execute:slice_started',
      'complete:slice_execute:slice_execution_requested',
      'start:agent_result:slice_execution_requested',
      'complete:agent_result:agent_result_ingested',
      'start:test_result:agent_result_ingested',
      'start:test_result:agent_result_ingested',
      'start:test_result:agent_result_ingested',
    ]);
  });

  it('throwing step observers never halt the drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-step-hook-throw-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
      onStepStart: () => {
        throw new Error('observer bug');
      },
      onStepComplete: () => {
        throw new Error('observer bug');
      },
    });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
  });

  it('halts before Petri export when slice verification fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-verification-failed-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        testRunner: createFakeTestRunnerPort({
          status: 'completed',
          verdict: 'failed',
          exitCode: 1,
          target: 'npm run verify',
        }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'slice_integrate',
      runStatus: 'test_result_ingested',
      reason: 'slice_verification_not_passed',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('test_result_ingested');
    expect((await readReportEvents(cwd)).map((event) => (event as { event?: string }).event)).not.toContain(
      'run_completed',
    );
  });

  it('invokes the agent and test runner exactly once per slice', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-once-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);

    let agentRuns = 0;
    let testRuns = 0;
    const agentRunner: AgentRunnerPort = {
      async run() {
        agentRuns += 1;
        return { status: 'completed' };
      },
    };
    const testRunner: TestRunnerPort = {
      async run() {
        testRuns += 1;
        return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' };
      },
    };

    await drive({ cwd, runId: 'run-1', ports: fakePorts({ agentRunner, testRunner }) });

    expect(agentRuns).toBe(2);
    expect(testRuns).toBe(2);
  });

  it('halts at promotion when the run-local land fails', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-land-fail-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        gitLand: createFakeGitLandPort({ status: 'failed', message: 'land boom', sideEffects: [] }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'promotion',
      runStatus: 'petri_exported',
      reason: 'promotion_failed',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('petri_exported');
  });

  it('halts at promotion when the land reports no changes', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-drive-land-none-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({
      cwd,
      runId: 'run-1',
      ports: fakePorts({
        gitLand: createFakeGitLandPort({ status: 'no_changes', message: 'nothing to land', sideEffects: [] }),
      }),
    });

    expect(outcome).toEqual({
      status: 'halted',
      step: 'promotion',
      runStatus: 'petri_exported',
      reason: 'promotion_no_changes',
    });
    const meta = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(meta?.status).toBe('petri_exported');
  });
});

describe('classifyDriveTerminal', () => {
  it('classifies only terminal runs as completed and nonterminal exhaustion as deadlocked', () => {
    expect(
      classifyDriveTerminal({ kind: 'scheduler_exhausted', runId: 'run-1', runStatus: 'promotion_prepared' }),
    ).toEqual({
      event: { kind: 'net_completed', runId: 'run-1', runStatus: 'promotion_prepared' },
      outcome: { status: 'completed', runStatus: 'promotion_prepared' },
    });

    expect(
      classifyDriveTerminal({ kind: 'scheduler_exhausted', runId: 'run-1', runStatus: 'abandoned' }),
    ).toEqual({
      event: { kind: 'net_halted', runId: 'run-1', runStatus: 'abandoned', reason: 'abandoned' },
      outcome: { status: 'halted', step: 'abandoned', runStatus: 'abandoned', reason: 'abandoned' },
    });

    expect(
      classifyDriveTerminal({
        kind: 'scheduler_exhausted',
        runId: 'run-1',
        runStatus: 'reports_initialized',
      }),
    ).toEqual({
      event: { kind: 'net_deadlocked', runId: 'run-1', runStatus: 'reports_initialized' },
      outcome: {
        status: 'halted',
        step: 'deadlocked',
        runStatus: 'reports_initialized',
        reason: 'petri_deadlocked',
      },
    });
  });

  it('classifies a non-advancing step as a halted terminal with the same reason in the event and outcome', () => {
    expect(
      classifyDriveTerminal({
        kind: 'step_halted',
        runId: 'run-1',
        runStatus: 'agent_result_ingested',
        step: 'test_result',
        reason: 'test_run_failed',
      }),
    ).toEqual({
      event: {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'agent_result_ingested',
        step: 'test_result',
        reason: 'test_run_failed',
      },
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: 'agent_result_ingested',
        reason: 'test_run_failed',
      },
    });
  });
});

describe('petri runtime helpers', () => {
  it('derive enabled transition ids and ready-step transition ids from the same slice-frontier facts', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    expect(
      enabledPetriTransitionIds(metadata('slice_completed', { completedSliceIds: ['task-1'] }), plan),
    ).toEqual(['slice_start:task-2']);
    expect(
      resolvePetriTransitionIdForReadyStep(
        { kind: 'slice_start', sliceId: 'task-2' },
        metadata('slice_completed', { completedSliceIds: ['task-1'] }),
        plan,
      ),
    ).toBe('slice_start:task-2');

    expect(enabledPetriTransitionIds(metadata('agent_result_ingested', {}), plan)).toEqual([
      'test_result:task-1:attempt:1',
    ]);
    expect(
      resolvePetriTransitionIdForReadyStep(
        { kind: 'test_result', sliceId: 'task-1' },
        metadata('agent_result_ingested', {}),
        plan,
      ),
    ).toBe('test_result:task-1:attempt:1');

    expect(
      enabledPetriTransitionIds(
        metadata('promotion_prepared', { completedSliceIds: ['task-1', 'task-2'] }),
        plan,
      ),
    ).toEqual([]);
  });

  it('surfaces every dependency-ready slice start in the Petri frontier while serial policy still picks one', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }, { id: 'task-3' }],
    } as const;
    const runtime = materializeExecutorPetriRuntime(metadata('reports_initialized'), plan);

    const frontier = petriScheduler.ready(metadata('reports_initialized'), plan);

    expect(frontier).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);
    expect(
      serialFiringPolicy.select({ readySteps: frontier, state: metadata('reports_initialized'), plan }),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-1' }]);
    expect(
      frontierFiringPolicy.select({
        readySteps: frontier,
        readyRuntime: {
          currentMarking: runtime.currentMarking,
          enabledTransitions: frontier.map((step) => runtime.transitionForReadyStep(step)),
        },
        state: metadata('reports_initialized'),
        plan,
      }),
    ).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);
  });

  it('surfaces blocked slice starts with unmet dependency ids alongside the ready frontier', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }, { id: 'task-3' }],
    } as const;

    const runtime = materializeExecutorPetriRuntime(metadata('reports_initialized'), plan);

    expect(runtime.blockedSteps).toEqual([
      { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'dependency', sliceId: 'task-1' }] },
    ]);
  });

  it('surfaces dependency-ready slice starts as blocked by the active slice while another slice is in flight', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    const runtime = materializeExecutorPetriRuntime(
      metadata('slice_started', { activeSliceId: 'task-1' }),
      plan,
    );

    expect(runtime.blockedSteps).toEqual([
      { kind: 'slice_start', sliceId: 'task-2', blockers: [{ kind: 'active_slice', sliceId: 'task-1' }] },
    ]);
  });

  it('rejects duplicate slice ids before materializing Petri runtime identity', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-1' }] } as const;

    expect(() => materializeExecutorPetriRuntime(metadata('created'), plan)).toThrow(
      'Duplicate slice id in executor topology: task-1',
    );
  });

  it('rejects self-referential, unknown, and cyclic slice dependencies before materializing runtime identity', () => {
    expect(() =>
      compileExecutorTopology({
        mode: 'greenfield',
        slices: [{ id: 'task-1', depends_on: ['task-1'] }],
      }),
    ).toThrow('Slice cannot depend on itself in executor topology: task-1');

    expect(() =>
      compileExecutorTopology({
        mode: 'greenfield',
        slices: [{ id: 'task-1', depends_on: ['missing'] }],
      }),
    ).toThrow('Unknown slice dependency in executor topology: task-1 -> missing');

    expect(() =>
      compileExecutorTopology({
        mode: 'greenfield',
        slices: [
          { id: 'task-1', depends_on: ['task-2'] },
          { id: 'task-2', depends_on: ['task-1'] },
        ],
      }),
    ).toThrow('Cyclic slice dependency in executor topology: task-1');
  });

  it('rejects duplicate, dangling, self-referential, and cyclic epic topology', () => {
    expect(() =>
      compileExecutorTopology({ epics: [{ id: 'epic-1' }, { id: 'epic-1' }], slices: [] }),
    ).toThrow('Duplicate epic id in executor topology: epic-1');
    expect(() =>
      compileExecutorTopology({
        epics: [{ id: 'epic-1', depends_on: ['missing'] }],
        slices: [{ id: 'task-1', epic_id: 'epic-1' }],
      }),
    ).toThrow('Unknown epic dependency in executor topology: epic-1 -> missing');
    expect(() =>
      compileExecutorTopology({
        epics: [{ id: 'epic-1', depends_on: ['epic-1'] }],
        slices: [{ id: 'task-1', epic_id: 'epic-1' }],
      }),
    ).toThrow('Epic cannot depend on itself in executor topology: epic-1');
    expect(() =>
      compileExecutorTopology({
        epics: [
          { id: 'epic-1', depends_on: ['epic-2'] },
          { id: 'epic-2', depends_on: ['epic-1'] },
        ],
        slices: [
          { id: 'task-1', epic_id: 'epic-1' },
          { id: 'task-2', epic_id: 'epic-2' },
        ],
      }),
    ).toThrow('Cyclic epic dependency in executor topology: epic-1');
    expect(() =>
      compileExecutorTopology({ epics: [{ id: 'epic-1' }], slices: [{ id: 'task-1', epic_id: 'missing' }] }),
    ).toThrow('Unknown slice epic in executor topology: task-1 -> missing');
    expect(() => compileExecutorTopology({ epics: [{ id: 'empty' }], slices: [] })).toThrow(
      'Epic has no member slices in executor topology: empty',
    );
    expect(() =>
      compileExecutorTopology({
        epics: [{ id: 'member' }, { id: 'empty', depends_on: ['member'] }],
        slices: [{ id: 'task-1', epic_id: 'member' }],
      }),
    ).toThrow('Epic has no member slices in executor topology: empty');
  });

  it('rejects completed-slice history that is duplicated or violates dependency order', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }],
    } as const;

    expect(() =>
      materializeExecutorPetriRuntime(metadata('slice_completed', { completedSliceIds: ['task-2'] }), plan),
    ).toThrow('Cannot project Petri transition history for run status slice_completed');
    expect(() =>
      materializeExecutorPetriRuntime(
        metadata('slice_completed', { completedSliceIds: ['task-1', 'task-1'] }),
        plan,
      ),
    ).toThrow('Cannot project Petri transition history for run status slice_completed');
  });

  it('checks the known worktree plan before the source plan throughout post-population statuses', () => {
    const cwd = '/workspace';
    for (const status of [
      'worktree_populated',
      'source_policy_selected',
      'source_copied',
      'reports_initialized',
      'slice_started',
      'slice_execution_requested',
      'agent_result_ingested',
      'test_result_ingested',
      'slice_completed',
      'run_completed',
      'petri_exported',
      'promotion_prepared',
    ] as const) {
      expect(petriRuntimePlanPathCandidates(cwd, metadata(status))).toEqual([
        runPopulatedPlanPath(cwd, 'run-1'),
        petriPlanSnapshotPath(cwd, 'run-1'),
        'plan.yaml',
      ]);
    }
  });

  it('materializes a marking-backed runtime view over the compiled topology for the current serial state', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    const frontierRuntime = materializeExecutorPetriRuntime(
      metadata('slice_completed', { completedSliceIds: ['task-1'] }),
      plan,
    );
    expect(frontierRuntime.currentMarking).toEqual({
      'slice:task-1:completed': 1,
      'slice:task-2:claim': 1,
    });
    expect(frontierRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'slice_start:task-2',
    ]);
    expect(frontierRuntime.readySteps).toEqual([{ kind: 'slice_start', sliceId: 'task-2' }]);

    const inFlightRuntime = materializeExecutorPetriRuntime(metadata('agent_result_ingested', {}), plan);
    expect(inFlightRuntime.currentMarking).toEqual({
      'slice:task-1:verify_attempt:1': 1,
      'slice:task-2:claim': 1,
    });
    expect(inFlightRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'test_result:task-1:attempt:1',
    ]);
    expect(inFlightRuntime.transitionForReadyStep({ kind: 'test_result', sliceId: 'task-1' })?.id).toBe(
      'test_result:task-1:attempt:1',
    );
  });

  it('reconstructs active agent and verify attempt markings from run.json attempt facts', () => {
    const plan = { slices: [{ id: 'task-1' }] } as const;

    const retriedAgent = materializeExecutorPetriRuntime(
      metadata('slice_execution_requested', { activeSliceId: 'task-1', activeSliceAttempts: 1 }),
      plan,
    );
    expect(retriedAgent.currentMarking).toEqual({ 'slice:task-1:agent_attempt:2': 1 });
    expect(retriedAgent.enabledTransitions.map((transition) => transition.id)).toEqual([
      'agent_result:task-1:attempt:2',
    ]);

    const retriedVerify = materializeExecutorPetriRuntime(
      metadata('agent_result_ingested', { activeSliceId: 'task-1', activeSliceAttempts: 1 }),
      plan,
    );
    expect(retriedVerify.currentMarking).toEqual({ 'slice:task-1:verify_attempt:2': 1 });
    expect(retriedVerify.enabledTransitions.map((transition) => transition.id)).toEqual([
      'test_result:task-1:attempt:2',
    ]);

    const exhausted = materializeExecutorPetriRuntime(
      metadata('slice_execution_requested', { activeSliceId: 'task-1', activeSliceAttempts: 3 }),
      plan,
    );
    expect(exhausted.currentMarking).toEqual({ 'slice:task-1:agent_attempts_exhausted': 1 });
    expect(exhausted.enabledTransitions).toEqual([]);
  });

  it('uses Petri input arcs with executor frontier guards, not raw place fan-out, to pick enabled transitions', () => {
    const plan = {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }, { id: 'task-3' }],
    } as const;

    const frontierRuntime = materializeExecutorPetriRuntime(metadata('reports_initialized'), plan);

    expect(frontierRuntime.currentMarking).toEqual({
      'slice:task-1:claim': 1,
      'slice:task-2:claim': 1,
      'slice:task-3:claim': 1,
    });
    expect(frontierRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'slice_start:task-1',
      'slice_start:task-3',
    ]);
    expect(frontierRuntime.enabledTransitions.map((transition) => transition.step)).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);

    const unblockedRuntime = materializeExecutorPetriRuntime(
      metadata('slice_completed', { completedSliceIds: ['task-1'] }),
      plan,
    );
    expect(unblockedRuntime.currentMarking).toEqual({
      'slice:task-1:completed': 1,
      'slice:task-2:claim': 1,
      'slice:task-2:dependency:task-1': 1,
      'slice:task-3:claim': 1,
    });
    expect(unblockedRuntime.enabledTransitions.map((transition) => transition.id)).toEqual([
      'slice_start:task-2',
      'slice_start:task-3',
    ]);
    expect(unblockedRuntime.enabledTransitions.map((transition) => transition.step)).toEqual([
      { kind: 'slice_start', sliceId: 'task-2' },
      { kind: 'slice_start', sliceId: 'task-3' },
    ]);

    const doneRuntime = materializeExecutorPetriRuntime(
      metadata('slice_completed', { completedSliceIds: ['task-1', 'task-2', 'task-3'] }),
      plan,
    );
    expect(doneRuntime.currentMarking).toEqual({
      'slice:task-1:completed': 1,
      'slice:task-2:completed': 1,
      'slice:task-3:completed': 1,
    });
    expect(doneRuntime.enabledTransitions.map((transition) => transition.id)).toEqual(['run_complete']);
  });

  it('derives current marking by replaying the transition history implied by lifecycle facts', () => {
    const plan = { mode: 'greenfield', slices: [{ id: 'task-1' }, { id: 'task-2' }] } as const;

    expect(
      projectExecutorPetriTransitionHistory(
        metadata('agent_result_ingested', {
          completedSliceIds: ['task-1'],
          activeSliceId: 'task-2',
        }),
        plan,
      ),
    ).toEqual({
      currentSliceId: 'task-2',
      transitionIds: [
        'worktree_create',
        'populate',
        'source_policy',
        'source_copy',
        'report_init',
        'slice_start:task-1',
        'slice_execute:task-1',
        'agent_result:task-1:attempt:1',
        'test_result:task-1:attempt:1',
        'slice_integrate:task-1',
        'slice_complete:task-1',
        'slice_start:task-2',
        'slice_execute:task-2',
        'agent_result:task-2:attempt:1',
      ],
    });

    expect(impliedPetriTransitionHistory(metadata('abandoned'), plan)).toBeUndefined();

    const inFlightRuntime = materializeExecutorPetriRuntime(
      metadata('agent_result_ingested', {
        completedSliceIds: ['task-1'],
        activeSliceId: 'task-2',
      }),
      plan,
    );
    expect(inFlightRuntime.currentMarking).toEqual({
      'slice:task-1:completed': 1,
      'slice:task-2:verify_attempt:1': 1,
    });
  });

  it('binds materialized Petri transitions to the existing lifecycle step handlers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-runtime-bindings-'));
    await createRunAtCreated(cwd, ['task-1']);

    const createdState = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    const createdRuntime = materializeExecutorPetriRuntime(createdState!, undefined);
    const createdBindings = bindExecutorPetriRuntime(createdRuntime, {
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
    });

    const worktreeTransition = createdBindings.transitionForReadyStep({ kind: 'worktree_create' });
    expect(worktreeTransition?.transition.id).toBe('worktree_create');
    await expect(worktreeTransition?.execute()).resolves.toMatchObject({
      status: 'worktree_created',
      runStatus: 'worktree_created',
    });

    await populateWorktree({ cwd, runId: 'run-1' });
    await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'plan_only' });
    await copyHostSource({ cwd, runId: 'run-1' });
    await initializeReports({ cwd, runId: 'run-1' });

    const reportsReadyState = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    const reportsReadyRuntime = materializeExecutorPetriRuntime(reportsReadyState!, {
      mode: 'greenfield',
      slices: [{ id: 'task-1' }],
    });
    const reportsReadyBindings = bindExecutorPetriRuntime(reportsReadyRuntime, {
      cwd,
      runId: 'run-1',
      ports: fakePorts(),
    });

    const sliceStartTransition = reportsReadyBindings.transitionForReadyStep({
      kind: 'slice_start',
      sliceId: 'task-1',
    });
    expect(sliceStartTransition?.transition.id).toBe('slice_start:task-1');
    await expect(sliceStartTransition?.execute()).resolves.toMatchObject({
      status: 'slice_started',
      runStatus: 'slice_started',
      sliceId: 'task-1',
    });
  });
});

describe('linearScheduler', () => {
  it('returns exactly one ready step per turn and none once completed', () => {
    const slicePlan = { slices: [{ id: 'task-1' }] };
    const cases: {
      readonly status: RunMetadata['status'];
      readonly extra?: Partial<RunMetadata>;
      readonly plan?: Parameters<typeof linearScheduler.ready>[1];
      readonly expected: readonly ReadyStep[];
    }[] = [
      { status: 'created', expected: [{ kind: 'worktree_create' }] },
      { status: 'worktree_created', expected: [{ kind: 'populate' }] },
      { status: 'worktree_populated', expected: [{ kind: 'source_policy' }] },
      { status: 'source_policy_selected', expected: [{ kind: 'source_copy' }] },
      { status: 'source_copied', expected: [{ kind: 'report_init' }] },
      {
        status: 'slice_started',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'slice_execute', sliceId: 'task-1' }],
      },
      {
        status: 'slice_execution_requested',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'agent_result', sliceId: 'task-1' }],
      },
      {
        status: 'agent_result_ingested',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'test_result', sliceId: 'task-1' }],
      },
      {
        status: 'test_result_ingested',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'slice_integrate', sliceId: 'task-1' }],
      },
      {
        status: 'slice_integrated',
        extra: { activeSliceId: 'task-1' },
        plan: slicePlan,
        expected: [{ kind: 'slice_complete', sliceId: 'task-1' }],
      },
      { status: 'run_completed', expected: [{ kind: 'petri_export' }] },
      { status: 'petri_exported', expected: [{ kind: 'promotion' }] },
      { status: 'promotion_prepared', expected: [] },
    ];
    for (const { status, extra, plan, expected } of cases) {
      expect(linearScheduler.ready(metadata(status, extra), plan)).toEqual(expected);
    }
  });

  it('selects the next incomplete slice from completion facts, not the status', () => {
    const plan = { slices: [{ id: 'task-1' }, { id: 'task-2' }] };

    expect(
      linearScheduler.ready(metadata('slice_completed', { completedSliceIds: ['task-1'] }), plan),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-2' }]);

    expect(linearScheduler.ready(metadata('reports_initialized'), plan)).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
    ]);

    expect(
      linearScheduler.ready(metadata('slice_completed', { completedSliceIds: ['task-1', 'task-2'] }), plan),
    ).toEqual([{ kind: 'run_complete' }]);
  });

  it('starts only slices whose declared dependencies are complete', () => {
    const plan = {
      slices: [
        { id: 'task-2', depends_on: ['task-1'] },
        { id: 'task-1', depends_on: [] },
      ],
    };

    expect(linearScheduler.ready(metadata('reports_initialized'), plan)).toEqual([
      { kind: 'slice_start', sliceId: 'task-1' },
    ]);
    expect(
      linearScheduler.ready(metadata('slice_completed', { completedSliceIds: ['task-1'] }), plan),
    ).toEqual([{ kind: 'slice_start', sliceId: 'task-2' }]);
  });

  it('rejects cyclic slice dependencies before scheduling', () => {
    const plan = {
      slices: [
        { id: 'task-1', depends_on: ['task-2'] },
        { id: 'task-2', depends_on: ['task-1'] },
      ],
    };

    expect(() => linearScheduler.ready(metadata('reports_initialized'), plan)).toThrow(
      'Cyclic slice dependency in executor topology: task-1',
    );
  });
});

describe('compileExecutorTopology', () => {
  it('gives independent slice starts disjoint claims and compiles the FE-1192 attempt bound statically', () => {
    const topology = compileExecutorTopology({
      slices: [{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-3', depends_on: ['task-1'] }],
    });
    const starts = topology.transitions.filter((transition) => transition.id.startsWith('slice_start:'));

    expect(starts.map((transition) => transition.inputArcs.map((arc) => arc.placeId))).toEqual([
      ['slice:task-1:claim'],
      ['slice:task-2:claim'],
      ['slice:task-3:claim', 'slice:task-3:dependency:task-1'],
    ]);
    expect(topology.transitions.find((transition) => transition.id === 'report_init')?.outputArcs).toEqual(
      expect.arrayContaining([
        { placeId: 'slice:task-1:claim', weight: 1 },
        { placeId: 'slice:task-2:claim', weight: 1 },
        { placeId: 'slice:task-3:claim', weight: 1 },
      ]),
    );
    expect(topology.places.map((place) => place.id)).toEqual(
      expect.arrayContaining([
        'slice:task-1:agent_attempt:1',
        'slice:task-1:agent_attempt:2',
        'slice:task-1:agent_attempt:3',
        'slice:task-1:agent_attempts_exhausted',
        'slice:task-1:verify_attempt:1',
        'slice:task-1:verify_attempt:2',
        'slice:task-1:verify_attempt:3',
        'slice:task-1:verify_attempts_exhausted',
      ]),
    );
    expect(topology.transitions.map((transition) => transition.id)).toEqual(
      expect.arrayContaining([
        'agent_retry:task-1:1',
        'agent_retry:task-1:2',
        'agent_exhausted:task-1',
        'verify_retry:task-1:1',
        'verify_retry:task-1:2',
        'verify_exhausted:task-1',
      ]),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_execute:task-1',
        outputArcs: [{ placeId: 'slice:task-1:agent_attempt:1', weight: 1 }],
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'agent_result:task-1:attempt:1',
        inputArcs: [{ placeId: 'slice:task-1:agent_attempt:1', weight: 1 }],
        outputArcs: [{ placeId: 'slice:task-1:verify_attempt:1', weight: 1 }],
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'test_result:task-1:attempt:1',
        inputArcs: [{ placeId: 'slice:task-1:verify_attempt:1', weight: 1 }],
        outputArcs: [{ placeId: 'slice:task-1:test_result_ingested', weight: 1 }],
      }),
    );
  });

  it('preserves one run subnet and one slice subnet per slice, including the source-policy boundary', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      epics: [
        { id: 'frontier-1', summary: 'Build foundation', depends_on: [], verification: [] },
        { id: 'frontier-2', summary: 'Build feature', depends_on: ['frontier-1'], verification: [] },
      ],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'Implement foundation.',
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Foundation works.' }],
          derived_from: ['REQ1'],
        },
        {
          id: 'task-2',
          epic_id: 'frontier-2',
          definition: 'Implement feature.',
          verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'Feature works.' }],
          derived_from: ['REQ2'],
        },
      ],
    });

    expect(topology.epics).toEqual([
      {
        id: 'frontier-1',
        summary: 'Build foundation',
        dependsOn: [],
        verification: [],
        sliceIds: ['task-1'],
      },
      {
        id: 'frontier-2',
        summary: 'Build feature',
        dependsOn: ['frontier-1'],
        verification: [],
        sliceIds: ['task-2'],
      },
    ]);

    expect(
      topology.subnets.filter((subnet) => subnet.kind === 'run_control' || subnet.kind === 'slice_control'),
    ).toEqual([
      {
        id: 'run',
        kind: 'run_control',
        transitionIds: [
          'worktree_create',
          'populate',
          'source_policy',
          'source_copy',
          'report_init',
          'run_complete',
          'petri_export',
          'promotion',
        ],
      },
      {
        id: 'slice:task-1',
        kind: 'slice_control',
        sliceId: 'task-1',
        epicId: 'frontier-1',
        definition: 'Implement foundation.',
        verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Foundation works.' }],
        derivedFrom: ['REQ1'],
        transitionIds: [
          'slice_start:task-1',
          'slice_execute:task-1',
          'slice_integrate:task-1',
          'slice_complete:task-1',
        ],
      },
      {
        id: 'slice:task-2',
        kind: 'slice_control',
        sliceId: 'task-2',
        epicId: 'frontier-2',
        definition: 'Implement feature.',
        verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'Feature works.' }],
        derivedFrom: ['REQ2'],
        transitionIds: [
          'slice_start:task-2',
          'slice_execute:task-2',
          'slice_integrate:task-2',
          'slice_complete:task-2',
        ],
      },
    ]);
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'source_policy',
        subnetId: 'run',
        step: { kind: 'source_policy' },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_start:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
      }),
    );
  });

  it('compiles executor frontier policy into transition guards instead of leaving it implicit in the runtime', () => {
    const topology = compileExecutorTopology({
      mode: 'greenfield',
      slices: [{ id: 'task-1' }, { id: 'task-2', depends_on: ['task-1'] }],
    });

    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_start:task-1',
        guard: { kind: 'slice_ready', sliceId: 'task-1', dependsOn: [] },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'slice_start:task-2',
        guard: { kind: 'slice_ready', sliceId: 'task-2', dependsOn: ['task-1'] },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'run_complete',
        guard: { kind: 'no_remaining_slices' },
      }),
    );
    expect(topology.transitions).toContainEqual(
      expect.objectContaining({
        id: 'test_result:task-2:attempt:1',
        guard: { kind: 'active_slice', sliceId: 'task-2' },
      }),
    );
  });
});

describe('petriScheduler', () => {
  it('keeps linear scheduling as the serial firing-policy view over the Petri frontier', () => {
    const plan = { mode: 'greenfield' as const, slices: [{ id: 'task-1' }, { id: 'task-2' }] };
    const cases: RunMetadata['status'][] = [
      'created',
      'worktree_created',
      'worktree_populated',
      'source_policy_selected',
      'source_copied',
      'reports_initialized',
      'slice_started',
      'slice_execution_requested',
      'agent_result_ingested',
      'test_result_ingested',
      'slice_completed',
      'run_completed',
      'petri_exported',
      'promotion_prepared',
      'abandoned',
    ];

    for (const status of cases) {
      const state =
        status === 'slice_completed'
          ? metadata(status, { completedSliceIds: ['task-1'] })
          : status === 'run_completed' || status === 'petri_exported' || status === 'promotion_prepared'
            ? metadata(status, { completedSliceIds: ['task-1', 'task-2'] })
            : metadata(status);
      expect(
        serialFiringPolicy.select({ readySteps: petriScheduler.ready(state, plan), state, plan }),
      ).toEqual(linearScheduler.ready(state, plan));
    }
  });

  it('drives the run to the same terminal state as the linear scheduler', async () => {
    const linear = await mkdtemp(join(tmpdir(), 'brunch-petri-scheduler-linear-'));
    await createRunAtCreated(linear, ['task-1', 'task-2']);
    const linearOutcome = await drive({ cwd: linear, runId: 'run-1', ports: fakePorts() }, linearScheduler);

    const petri = await mkdtemp(join(tmpdir(), 'brunch-petri-scheduler-petri-'));
    await createRunAtCreated(petri, ['task-1', 'task-2']);
    const petriOutcome = await drive({ cwd: petri, runId: 'run-1', ports: fakePorts() }, petriScheduler);

    expect(petriOutcome).toEqual(linearOutcome);
    expect(await readReportEvents(petri)).toEqual(await readReportEvents(linear));
    expect(await readRunMetadata(runMetadataPath(petri, 'run-1'))).toMatchObject({
      status: 'promotion_prepared',
      completedSliceIds: ['task-1', 'task-2'],
      sourcePolicy: 'plan_only',
      promotionCommitSha: 'abc123',
    });
  });

  it('keeps serial and parallel isolated-slice artifacts and reports equivalent per slice', async () => {
    const serial = await mkdtemp(join(tmpdir(), 'brunch-slice-core-parity-serial-'));
    const parallel = await mkdtemp(join(tmpdir(), 'brunch-slice-core-parity-parallel-'));
    await createRunAtCreated(serial, ['task-1', 'task-2']);
    await createRunAtCreated(parallel, ['task-1', 'task-2']);
    const parityPorts = () =>
      fakePorts({
        agentRunner: {
          async run(args) {
            await args.onUpdate?.({ kind: 'status', message: `agent ${args.sliceId}` });
            return { status: 'completed', summary: `built ${args.sliceId}` };
          },
        },
        testRunner: {
          async run(args) {
            await args.onUpdate?.({
              kind: 'status',
              message: `verify ${args.worktreeDir.split('/').at(-2)}`,
            });
            return { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm test' };
          },
        },
      });
    await drive({ cwd: serial, runId: 'run-1', ports: parityPorts() }, petriScheduler, serialFiringPolicy);
    await drive(
      { cwd: parallel, runId: 'run-1', ports: parityPorts() },
      petriScheduler,
      frontierFiringPolicy,
    );

    const serialReports = await readReportEvents(serial);
    const parallelReports = await readReportEvents(parallel);
    for (const sliceId of ['task-1', 'task-2']) {
      await expect(readFile(sliceExecutionRequestPath(serial, 'run-1', sliceId), 'utf8')).resolves.toBe(
        await readFile(sliceExecutionRequestPath(parallel, 'run-1', sliceId), 'utf8'),
      );
      const serialAgentEvent = JSON.parse(
        await readFile(agentStreamPath(serial, 'run-1', sliceId, 1), 'utf8'),
      ) as Record<string, unknown>;
      const parallelAgentEvent = JSON.parse(
        await readFile(agentStreamPath(parallel, 'run-1', sliceId, 1), 'utf8'),
      ) as Record<string, unknown>;
      delete serialAgentEvent['runSequence'];
      delete parallelAgentEvent['runSequence'];
      expect(serialAgentEvent).toEqual(parallelAgentEvent);
      expect(serialReports.filter((event) => (event as { sliceId?: string }).sliceId === sliceId)).toEqual(
        parallelReports.filter((event) => (event as { sliceId?: string }).sliceId === sliceId),
      );
      expect(await readFile(verifyStreamPath(serial, 'run-1', sliceId, 1), 'utf8')).toContain(
        '"event":"verify_stream"',
      );
      expect(await readFile(verifyStreamPath(parallel, 'run-1', sliceId, 1), 'utf8')).toContain(
        '"event":"verify_stream"',
      );
    }
    const serialMetadata = await readRunMetadata(runMetadataPath(serial, 'run-1'));
    const parallelMetadata = await readRunMetadata(runMetadataPath(parallel, 'run-1'));
    expect(parallelMetadata?.sliceAttemptHistory).toEqual(serialMetadata?.sliceAttemptHistory);
  });

  it('emits policy-independent attempt facts for serial and parallel execution', async () => {
    const serial = await mkdtemp(join(tmpdir(), 'brunch-attempt-fact-parity-serial-'));
    const parallel = await mkdtemp(join(tmpdir(), 'brunch-attempt-fact-parity-parallel-'));
    await createRunAtCreated(serial, ['task-1', 'task-2']);
    await createRunAtCreated(parallel, ['task-1', 'task-2']);
    const flakyPorts = () => {
      const agentCalls = new Map<string, number>();
      const verifyCalls = new Map<string, number>();
      return fakePorts({
        agentRunner: {
          async run(args) {
            const calls = (agentCalls.get(args.sliceId) ?? 0) + 1;
            agentCalls.set(args.sliceId, calls);
            return calls === 1
              ? { status: 'failed', message: 'policy-independent agent failure' }
              : { status: 'completed' };
          },
        },
        testRunner: {
          async run(args) {
            const sliceId = args.worktreeDir.split('/').at(-2)!;
            const calls = (verifyCalls.get(sliceId) ?? 0) + 1;
            verifyCalls.set(sliceId, calls);
            return calls === 1
              ? { status: 'failed', message: 'policy-independent verify failure' }
              : { status: 'completed', verdict: 'passed', exitCode: 0 };
          },
        },
      });
    };

    await drive({ cwd: serial, runId: 'run-1', ports: flakyPorts() }, petriScheduler, serialFiringPolicy);
    await drive({ cwd: parallel, runId: 'run-1', ports: flakyPorts() }, petriScheduler, frontierFiringPolicy);
    const facts = async (cwd: string) =>
      (await readPetriEvents(cwd))
        .filter((event) => event.kind === 'attempt_failed')
        .map(({ kind, sliceId, step, attempt, reason }) => ({ kind, sliceId, step, attempt, reason }))
        .sort((left, right) =>
          `${left.sliceId}:${left.step}`.localeCompare(`${right.sliceId}:${right.step}`),
        );

    expect(await facts(parallel)).toEqual(await facts(serial));
  });

  it('passes the full ready frontier through firing policy selection before each drive step', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-firing-policy-frontier-'));
    await createRunAtCreated(cwd, [
      { id: 'task-1' },
      { id: 'task-2', dependsOn: ['task-1'] },
      { id: 'task-3' },
    ]);
    const seenFrontiers: string[][] = [];

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, {
      select({ readySteps }) {
        seenFrontiers.push(
          readySteps.map((step) =>
            step.kind === 'slice_start' ? `${step.kind}:${step.sliceId}` : step.kind,
          ),
        );
        return readySteps;
      },
    });

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(seenFrontiers).toContainEqual(['slice_start:task-1', 'slice_start:task-3']);
    expect(seenFrontiers).toContainEqual(['slice_start:task-2', 'slice_start:task-3']);
  });

  it('emits transition events in lifecycle order, including the source-policy boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-events-'));
    await createRunAtCreated(cwd, ['task-1']);
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      petriScheduler,
    );
    const seen = await readPetriEvents(cwd);

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(seen.map((event) => event.kind)).toEqual([
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'transition_fired',
      'net_completed',
    ]);
    expect(
      seen
        .filter((event) => event.kind === 'transition_fired')
        .filter((event) => event.contract.lane !== 'epic')
        .map((event) => ({
          transitionId: event.transitionId,
          subnetId: event.subnetId,
          ...(event.epicId === undefined ? {} : { epicId: event.epicId }),
          ...(event.derivedFrom === undefined ? {} : { derivedFrom: event.derivedFrom }),
          contract: event.contract,
          consumed: event.consumed,
          produced: event.produced,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
        })),
    ).toEqual([
      {
        transitionId: 'worktree_create',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:created'],
        produced: ['run:worktree_created'],
        fromStatus: 'created',
        toStatus: 'worktree_created',
      },
      {
        transitionId: 'populate',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:worktree_created'],
        produced: ['run:worktree_populated'],
        fromStatus: 'worktree_created',
        toStatus: 'worktree_populated',
      },
      {
        transitionId: 'source_policy',
        subnetId: 'run',
        contract: { kind: 'structural', lane: 'run' },
        consumed: ['run:worktree_populated'],
        produced: ['run:source_policy_selected'],
        fromStatus: 'worktree_populated',
        toStatus: 'source_policy_selected',
      },
      {
        transitionId: 'source_copy',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:source_policy_selected'],
        produced: ['run:source_copied'],
        fromStatus: 'source_policy_selected',
        toStatus: 'source_copied',
      },
      {
        transitionId: 'report_init',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:source_copied'],
        produced: ['slice:task-1:claim'],
        fromStatus: 'source_copied',
        toStatus: 'reports_initialized',
      },
      {
        transitionId: 'slice_start:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'structural', lane: 'slice' },
        consumed: ['slice:task-1:claim'],
        produced: ['slice:task-1:started'],
        fromStatus: 'reports_initialized',
        toStatus: 'slice_started',
      },
      {
        transitionId: 'slice_execute:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'slice' },
        consumed: ['slice:task-1:started'],
        produced: ['slice:task-1:agent_attempt:1'],
        fromStatus: 'slice_started',
        toStatus: 'slice_execution_requested',
      },
      {
        transitionId: 'agent_result:task-1:attempt:1',
        subnetId: 'attempt:task-1:agent',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'attempt' },
        consumed: ['slice:task-1:agent_attempt:1'],
        produced: ['slice:task-1:verify_attempt:1'],
        fromStatus: 'slice_execution_requested',
        toStatus: 'agent_result_ingested',
      },
      {
        transitionId: 'test_result:task-1:attempt:1',
        subnetId: 'attempt:task-1:verify',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'attempt' },
        consumed: ['slice:task-1:verify_attempt:1'],
        produced: ['slice:task-1:test_result_ingested'],
        fromStatus: 'agent_result_ingested',
        toStatus: 'test_result_ingested',
      },
      {
        transitionId: 'slice_integrate:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'mechanical', lane: 'slice' },
        consumed: ['slice:task-1:test_result_ingested'],
        produced: ['slice:task-1:integrated'],
        fromStatus: 'test_result_ingested',
        toStatus: 'slice_integrated',
      },
      {
        transitionId: 'slice_complete:task-1',
        subnetId: 'slice:task-1',
        epicId: 'frontier-1',
        derivedFrom: ['REQ1'],
        contract: { kind: 'structural', lane: 'slice' },
        consumed: ['slice:task-1:integrated'],
        produced: ['epic:frontier-1:member:task-1'],
        fromStatus: 'slice_integrated',
        toStatus: 'slice_completed',
      },
      {
        transitionId: 'run_complete',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['epic:frontier-1:completed'],
        produced: ['run:run_completed'],
        fromStatus: 'slice_completed',
        toStatus: 'run_completed',
      },
      {
        transitionId: 'petri_export',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:run_completed'],
        produced: ['run:petri_exported'],
        fromStatus: 'run_completed',
        toStatus: 'petri_exported',
      },
      {
        transitionId: 'promotion',
        subnetId: 'run',
        contract: { kind: 'mechanical', lane: 'run' },
        consumed: ['run:petri_exported'],
        produced: ['run:promotion_prepared'],
        fromStatus: 'petri_exported',
        toStatus: 'promotion_prepared',
      },
    ]);
    expect(
      seen
        .filter((event) => event.kind === 'transition_fired')
        .filter((event) => event.contract.lane === 'epic')
        .map((event) => event.transitionId),
    ).toEqual(['epic_integrate:frontier-1', 'epic_complete:frontier-1']);
    expect(seen.at(-1)).toEqual({
      kind: 'net_completed',
      runId: 'run-1',
      runStatus: 'promotion_prepared',
    });
    expect(await readPetriEvents(cwd)).toEqual(seen);
  });

  it('persists a durable marking snapshot alongside the runtime event journal', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-'));
    await createRunAtCreated(cwd, ['task-1']);

    const outcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler);

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toEqual({
      currentMarking: { 'run:promotion_prepared': 1 },
      firedTransitionCount: 16,
      lifecycleProvenance: {
        activeSliceId: 'task-1',
        runStatus: 'promotion_prepared',
        completedSliceIds: ['task-1'],
      },
      terminalEventKind: 'net_completed',
    });
  });

  it('persists every parallel claim before observer progress begins', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-claims-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    let claimedSnapshotPromise: Promise<Awaited<ReturnType<typeof readPetriMarkingSnapshot>>> | undefined;

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onStepStart: (_kind, _runStatus, progress) => {
          if (progress.step.kind !== 'slice_start' || claimedSnapshotPromise) return;
          claimedSnapshotPromise = readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
        },
      },
      petriScheduler,
      frontierFiringPolicy,
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    await expect(claimedSnapshotPromise).resolves.toEqual({
      currentMarking: { 'slice:task-1:started': 1, 'slice:task-2:started': 1 },
      firedTransitionCount: 7,
      lifecycleProvenance: {
        runStatus: 'reports_initialized',
      },
      parallelSliceBatch: {
        claimedSliceIds: ['task-1', 'task-2'],
        settlements: [],
      },
    });
  });

  it('refuses standalone start after one parallel claim journals before batch marking', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-single-journal-claim-'));
    await createRunAtCreated(cwd, ['task-1', 'task-2']);
    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, frontierFiringPolicy, {
        maxFirings: 5,
      }),
    ).resolves.toEqual({ status: 'completed', runStatus: 'reports_initialized' });
    await rm(petriMarkingPath(cwd, 'run-1'));
    await mkdir(petriMarkingPath(cwd, 'run-1'));

    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, frontierFiringPolicy),
    ).resolves.toMatchObject({ status: 'halted', reason: 'petri_marking_persist_failed' });
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      petriReadySteps: [],
      petriBlockedSteps: [
        { kind: 'authority_unreadable', blockers: [{ kind: 'parallel_authority_unreadable' }] },
        {
          kind: 'slice_start',
          sliceId: 'task-1',
          blockers: [{ kind: 'parallel_authority_unreadable' }],
        },
      ],
    });
    await expect(startSlice({ cwd, runId: 'run-1', sliceId: 'task-2' })).resolves.toMatchObject({
      status: 'parallel_batch_active',
      sideEffects: [],
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'reports_initialized',
    });
  });

  it('resumes a matching persisted claim-set before recomputing a fresh frontier selection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-resume-'));
    await prepareRunAtReports(cwd, ['task-1', 'task-2']);
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:task-2'],
        currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

    const startedSteps: ReadyStep[] = [];
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onStepStart: (kind, _runStatus, progress) => {
          if (kind === 'slice_start') startedSteps.push(progress.step);
        },
      },
      petriScheduler,
      frontierFiringPolicy,
      { maxFirings: 1 },
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'slice_started' });
    expect(startedSteps).toMatchObject([{ kind: 'slice_start', sliceId: 'task-2', epicId: 'frontier-1' }]);
    expect(await readRunMetadata(runMetadataPath(cwd, 'run-1'))).toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-2',
      activeEpicId: 'frontier-1',
    });
  });

  it.each([
    {
      label: 'marking',
      currentMarking: { 'run:created': 1 },
      firedTransitionCount: 5,
    },
    {
      label: 'firing count',
      currentMarking: { 'run:slice_frontier': 1 },
      firedTransitionCount: 99,
    },
  ])(
    'ignores a persisted claim-set with a stale $label',
    async ({ currentMarking, firedTransitionCount }) => {
      const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-stale-runtime-'));
      await prepareRunAtReports(cwd, ['task-1', 'task-2']);
      await writePetriMarkingSnapshot({
        cwd,
        runId: 'run-1',
        snapshot: {
          claimedTransitionIds: ['slice_start:task-2'],
          currentMarking,
          firedTransitionCount,
          lifecycleProvenance: { runStatus: 'reports_initialized' },
        },
      });

      await expect(
        drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler, frontierFiringPolicy, {
          maxFirings: 1,
        }),
      ).resolves.toEqual({ status: 'completed', runStatus: 'slice_started' });
      await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
        activeSliceId: 'task-1',
      });
    },
  );

  it('ignores a resumed claim-set when it falls outside the current scheduler frontier', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-resume-linear-'));
    await prepareRunAtReports(cwd, ['task-1', 'task-2']);
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:task-2'],
        currentMarking: { 'run:slice_frontier': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

    await expect(
      drive({ cwd, runId: 'run-1', ports: fakePorts() }, undefined, undefined, { maxFirings: 1 }),
    ).resolves.toEqual({
      status: 'completed',
      runStatus: 'slice_started',
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
    });
  });

  it('stops after the first fired transition when maxFirings limits a parallel frontier batch', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-max-firings-frontier-'));
    await prepareRunAtReports(cwd, ['task-1', 'task-2']);

    const outcome = await drive(
      { cwd, runId: 'run-1', ports: fakePorts() },
      petriScheduler,
      frontierFiringPolicy,
      { maxFirings: 1 },
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'slice_started' });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'slice_started',
      activeSliceId: 'task-1',
    });
  });

  it('fails closed when a persisted claim-set overclaims the current marking', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-claim-overclaim-'));
    await prepareRunAtReports(cwd, ['task-1', 'task-2']);
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-1'],
        currentMarking: { 'slice:task-1:claim': 1, 'slice:task-2:claim': 1 },
        firedTransitionCount: 5,
        lifecycleProvenance: { runStatus: 'reports_initialized' },
      },
    });

    let claimedSnapshotPromise: Promise<Awaited<ReturnType<typeof readPetriMarkingSnapshot>>> | undefined;
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
        onStepStart: (_kind, _runStatus, progress) => {
          if (progress.step.kind !== 'slice_start' || claimedSnapshotPromise) return;
          claimedSnapshotPromise = readPetriMarkingSnapshot({ cwd, runId: 'run-1' });
        },
      },
      petriScheduler,
      frontierFiringPolicy,
      { maxFirings: 1 },
    );

    expect(outcome).toEqual({ status: 'completed', runStatus: 'slice_started' });
    await expect(claimedSnapshotPromise).resolves.toMatchObject({
      claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-2'],
    });
    await expect(claimedSnapshotPromise).resolves.not.toMatchObject({
      claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-1'],
    });
  });

  it('keeps the durable fired-transition count exact after one missed snapshot write in a completed run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-recover-completed-'));
    await createRunAtCreated(cwd, ['task-1']);
    const blockingPath = petriMarkingPath(cwd, 'run-1');
    let netEventCount = 0;
    const unsubscribe = subscribePetriEvents({
      cwd,
      runId: 'run-1',
      listener() {
        netEventCount += 1;
        if (netEventCount === 1) {
          mkdirSync(join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'petrinaut'), { recursive: true });
          mkdirSync(blockingPath, { recursive: true });
          return;
        }
        if (netEventCount === 2) rmSync(blockingPath, { recursive: true, force: true });
      },
    });

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      petriScheduler,
    );
    unsubscribe();

    expect(outcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toEqual({
      currentMarking: { 'run:promotion_prepared': 1 },
      firedTransitionCount: 16,
      lifecycleProvenance: {
        activeSliceId: 'task-1',
        runStatus: 'promotion_prepared',
        completedSliceIds: ['task-1'],
      },
      terminalEventKind: 'net_completed',
    });
  });

  it('keeps the durable fired-transition count exact after one missed snapshot write in a halted run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-marking-recover-halted-'));
    await createRunAtCreated(cwd, ['task-1']);
    const blockingPath = petriMarkingPath(cwd, 'run-1');
    let netEventCount = 0;
    const unsubscribe = subscribePetriEvents({
      cwd,
      runId: 'run-1',
      listener() {
        netEventCount += 1;
        if (netEventCount === 1) {
          mkdirSync(join(cwd, '.brunch', 'cook', 'runs', 'run-1', 'petrinaut'), { recursive: true });
          mkdirSync(blockingPath, { recursive: true });
          return;
        }
        if (netEventCount === 2) rmSync(blockingPath, { recursive: true, force: true });
      },
    });

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
        }),
      },
      petriScheduler,
    );
    unsubscribe();

    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    await expect(readPetriMarkingSnapshot({ cwd, runId: 'run-1' })).resolves.toEqual({
      currentMarking: { 'slice:task-1:verify_attempts_exhausted': 1 },
      firedTransitionCount: 11,
      lifecycleProvenance: {
        activeSliceId: 'task-1',
        runStatus: 'agent_result_ingested',
      },
      haltedReason: 'test_run_failed',
      terminalEventKind: 'net_halted',
    });
  });

  it('emits a halt event instead of a false completion event when a Petri step cannot advance', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-events-halt-'));
    await createRunAtCreated(cwd, ['task-1']);
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts({
          testRunner: createFakeTestRunnerPort({ status: 'failed', message: 'runner exploded' }),
        }),
      },
      petriScheduler,
    );
    const seen = await readPetriEvents(cwd);
    expect(outcome).toEqual({
      status: 'halted',
      step: 'test_result',
      runStatus: 'agent_result_ingested',
      reason: 'test_run_failed',
    });
    expect(seen.some((event) => event.kind === 'net_completed')).toBe(false);
    expect(seen.at(-1)).toEqual({
      kind: 'net_halted',
      runId: 'run-1',
      runStatus: 'agent_result_ingested',
      step: 'test_result',
      reason: 'test_run_failed',
    });
    expect(await readPetriEvents(cwd)).toEqual(seen);
  });

  it('halts instead of reporting a false completion when the frontier plan is unreadable mid-run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-unreadable-frontier-plan-'));
    const planPath = join(cwd, 'broken-plan.json');
    await writeFile(planPath, '{"mode":', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );
    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      petriScheduler,
    );
    const seen = await readPetriEvents(cwd);

    expect(outcome).toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'scheduler_plan_unreadable',
    });
    expect(seen).toEqual([
      {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'reports_initialized',
        step: 'slice_start',
        reason: 'scheduler_plan_unreadable',
      },
    ]);
  });

  it('halts when duplicate slice ids make the Petri runtime unreadable during drive', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-duplicate-slices-'));
    const planPath = join(cwd, 'duplicate-slices.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ id: 'task-1' }, { id: 'task-1' }],
      }),
      'utf8',
    );
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      linearScheduler,
    );

    expect(outcome).toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'petri_input_unreadable',
    });
    expect(await pathExists(petriEventsPath(cwd, 'run-1'))).toBe(false);
  });

  it('fails closed on duplicate slice ids before the first lifecycle side effect', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-created-duplicate-slices-'));
    await createRunAtCreated(cwd, ['task-1', 'task-1']);

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'worktree_create',
      runStatus: 'created',
      reason: 'petri_input_unreadable',
    });
    await expect(readRunMetadata(runMetadataPath(cwd, 'run-1'))).resolves.toMatchObject({
      status: 'created',
    });
  });

  it('fails closed when lifecycle history names a slice outside the runtime plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-foreign-active-slice-'));
    const planPath = join(cwd, 'plan.json');
    await writeFile(planPath, planJson(['task-1']), 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'slice_started',
        activeSliceId: 'foreign-slice',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_execute',
      runStatus: 'slice_started',
      reason: 'petri_input_unreadable',
    });
  });

  it('does not fall back to the source plan when an explicit populated plan is unreadable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-corrupt-populated-plan-'));
    const planPath = join(cwd, 'plan.json');
    const populatedPlanPath = join(cwd, 'worktree-plan.json');
    await writeFile(planPath, planJson(['task-1']), 'utf8');
    await writeFile(populatedPlanPath, '{"mode":', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        populatedPlanPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'scheduler_plan_unreadable',
    });
  });

  it('rejects cyclic slice dependencies as unreadable Petri topology', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-drive-cyclic-plan-'));
    const planPath = join(cwd, 'cyclic-plan.json');
    await writeFile(
      planPath,
      planJson([
        { id: 'task-1', dependsOn: ['task-2'] },
        { id: 'task-2', dependsOn: ['task-1'] },
      ]),
      'utf8',
    );
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'reports_initialized',
        reportsPath: reportsPath(cwd, 'run-1'),
      }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'slice_start',
      runStatus: 'reports_initialized',
      reason: 'petri_input_unreadable',
    });
  });

  it('halts at petri_export when the compiled plan input is unreadable', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-export-unreadable-'));
    const planPath = join(cwd, 'broken-plan.json');
    await writeFile(planPath, '{"mode":', 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'run_completed',
        reportsPath: reportsPath(cwd, 'run-1'),
        completedSliceIds: ['task-1'],
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      petriScheduler,
    );
    expect(outcome).toEqual({
      status: 'halted',
      step: 'petri_export',
      runStatus: 'run_completed',
      reason: 'petri_input_unreadable',
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(await pathExists(petriEventsPath(cwd, 'run-1'))).toBe(false);
  });

  it('halts at petri_export when the compiled plan input parses but is structurally invalid', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-export-invalid-shape-'));
    const planPath = join(cwd, 'broken-plan.json');
    await writeFile(
      planPath,
      JSON.stringify({
        mode: 'greenfield',
        slices: [{ epic_id: 'frontier-1' }],
      }),
      'utf8',
    );
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'run_completed',
        reportsPath: reportsPath(cwd, 'run-1'),
        completedSliceIds: ['task-1'],
      }),
      'utf8',
    );

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      petriScheduler,
    );
    expect(outcome).toEqual({
      status: 'halted',
      step: 'petri_export',
      runStatus: 'run_completed',
      reason: 'petri_input_unreadable',
    });
    expect(await pathExists(petriNetPath(cwd, 'run-1'))).toBe(false);
    expect(await pathExists(petriEventsPath(cwd, 'run-1'))).toBe(false);
  });

  it('treats an abandoned run as a halted terminal at both the driver and journal boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-abandoned-terminal-'));
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.yaml',
        status: 'abandoned',
        abandonedAt: '2026-07-09T00:00:00.000Z',
      }),
      'utf8',
    );
    await writePetriMarkingSnapshot({
      cwd,
      runId: 'run-1',
      snapshot: {
        currentMarking: {},
        firedTransitionCount: 0,
        lifecycleProvenance: { runStatus: 'abandoned' },
        parallelSliceBatch: { claimedSliceIds: ['task-1'], settlements: [] },
      },
    });

    const outcome = await drive(
      {
        cwd,
        runId: 'run-1',
        ports: fakePorts(),
      },
      petriScheduler,
    );
    const seen = await readPetriEvents(cwd);

    expect(outcome).toEqual({
      status: 'halted',
      step: 'abandoned',
      runStatus: 'abandoned',
      reason: 'abandoned',
    });
    expect(seen).toEqual([
      {
        kind: 'net_halted',
        runId: 'run-1',
        runStatus: 'abandoned',
        reason: 'abandoned',
      },
    ]);
  });

  it('returns the abandoned halt even when the abandoned run plan has invalid topology', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-abandoned-invalid-topology-'));
    const planPath = join(cwd, 'duplicate-slices.json');
    await writeFile(planPath, planJson(['task-1', 'task-1']), 'utf8');
    await mkdir(join(cwd, '.brunch', 'cook', 'runs', 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath, status: 'abandoned' }),
      'utf8',
    );

    await expect(drive({ cwd, runId: 'run-1', ports: fakePorts() })).resolves.toEqual({
      status: 'halted',
      step: 'abandoned',
      runStatus: 'abandoned',
      reason: 'abandoned',
    });
  });

  it('does not append duplicate terminal journal events when a completed run is driven again', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-petri-terminal-dedup-'));
    await createRunAtCreated(cwd, ['task-1']);

    await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler);
    const firstPass = await readPetriEvents(cwd);

    const secondOutcome = await drive({ cwd, runId: 'run-1', ports: fakePorts() }, petriScheduler);
    const secondPass = await readPetriEvents(cwd);

    expect(secondOutcome).toEqual({ status: 'completed', runStatus: 'promotion_prepared' });
    expect(secondPass).toEqual(firstPass);
    expect(secondPass.filter((event) => event.kind === 'net_completed')).toHaveLength(1);
  });
});
