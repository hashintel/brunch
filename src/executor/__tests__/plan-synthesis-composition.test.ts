import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CandidatePlan } from '../candidate-plan.js';
import { defaultCapabilityProviders } from '../capability-providers.js';
import type { AgentRunnerPort, ExecutionPorts, TestRunnerPort } from '../execution-ports.js';
import { drive, frontierFiringPolicy, petriScheduler } from '../orchestrate.js';
import { planFilePath, planFilePayload } from '../plan-file.js';
import { previewPlan } from '../plan-preview.js';
import { synthesizePlan } from '../plan-synthesis.js';
import { reportsPath } from '../report.js';
import { createRun, readRunMetadata, runMetadataPath } from '../run.js';
import { sliceExecutionRequestPath } from '../slice-execute.js';
import {
  createFakeGitHostPromotionPort,
  createFakeGitLandPort,
  createFakeGitSliceIntegrationPort,
  createFakeGitWorktreePort,
} from './fake-ports.js';
import { projection, PYTEST_PROVIDER } from './plan-synthesis-fixture.js';

const providers = [...defaultCapabilityProviders(), PYTEST_PROVIDER];

function independentCandidate(): CandidatePlan {
  return {
    schemaVersion: 1,
    specId: '42',
    epics: [{ id: 'F1', title: 'Deliver feature', dependsOn: [], verificationCriterionIds: ['AC2'] }],
    slices: [
      {
        id: 'task-a',
        epicId: 'F1',
        scopeId: 'SCP1',
        title: 'Build feature',
        goal: 'Build the feature core.',
        doneCriteria: ['Feature core exists.'],
        requirementIds: ['REQ1', 'REQ2'],
        criterionIds: ['AC1', 'AC2'],
        dependsOn: [],
        designItemIds: ['MOD1'],
        verificationItemIds: ['CH1'],
      },
      {
        id: 'task-b',
        epicId: 'F1',
        scopeId: 'SCP1',
        title: 'Document feature',
        goal: 'Document the feature surface.',
        doneCriteria: ['Docs cover the feature.'],
        requirementIds: ['REQ1'],
        criterionIds: ['AC1'],
        dependsOn: [],
        designItemIds: ['MOD1'],
        verificationItemIds: ['CH1'],
      },
    ],
    requiredCapabilities: [{ id: 'python.pytest', sourceItemId: 'DEC1' }],
  };
}

async function writeSynthesizedRun(
  cwd: string,
): Promise<{ verifyTarget: { command: string; args: readonly string[] } }> {
  const synthesis = await synthesizePlan({
    projection: { ...projection, specId: '42' },
    detected: [],
    providers,
    planner: { synthesize: async () => ({ status: 'synthesized', candidate: independentCandidate() }) },
  });
  expect(synthesis.status).toBe('admitted');
  if (synthesis.status !== 'admitted') throw new Error('unreachable');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  const preview = previewPlan(synthesis.draft, { executionContract: synthesis.executionContract });
  await writeFile(planFilePath(cwd, '42'), `${JSON.stringify(planFilePayload(preview), null, 2)}\n`, 'utf8');
  const action = synthesis.executionContract.resolvedActions.verify[0]!;
  const verifyTarget = { command: action.command, args: action.args };
  await createRun({ cwd, specId: '42', runId: 'run-1', verifyTarget });
  return { verifyTarget };
}

function witnessPorts(args: {
  readonly verifyCommands: { command: string; args: readonly string[]; dir: string }[];
  readonly overlap: { bothInFlight: boolean };
  readonly verdict?: 'passed' | 'failed';
}): ExecutionPorts {
  const inFlight = new Set<string>();
  let release: (() => void) | undefined;
  const bothStarted = new Promise<void>((resolve) => {
    release = resolve;
  });
  const agentRunner: AgentRunnerPort = {
    async run(runArgs) {
      inFlight.add(runArgs.sliceId);
      if (inFlight.size === 2) {
        args.overlap.bothInFlight = true;
        release?.();
      }
      // Hold the first slice until the second is in flight: completion order then
      // proves overlapping isolated effects rather than serial interleaving.
      await bothStarted;
      await mkdir(dirname(runArgs.resultPath), { recursive: true });
      await writeFile(
        runArgs.resultPath,
        `${JSON.stringify({ status: 'completed', summary: runArgs.sliceId })}\n`,
        'utf8',
      );
      inFlight.delete(runArgs.sliceId);
      return { status: 'completed', summary: `built ${runArgs.sliceId}` };
    },
  };
  const testRunner: TestRunnerPort = {
    async run(runArgs) {
      if (!runArgs.verifyTarget) return { status: 'failed', message: 'no verify target' };
      args.verifyCommands.push({
        command: runArgs.verifyTarget.command,
        args: runArgs.verifyTarget.args,
        dir: runArgs.worktreeDir,
      });
      return {
        status: 'completed',
        verdict: args.verdict ?? 'passed',
        exitCode: args.verdict === 'failed' ? 1 : 0,
        target: [runArgs.verifyTarget.command, ...runArgs.verifyTarget.args].join(' '),
      };
    },
  };
  return {
    gitWorktree: createFakeGitWorktreePort(),
    gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    agentRunner,
    testRunner,
    gitLand: createFakeGitLandPort(),
    gitHostPromotion: createFakeGitHostPromotionPort({}),
  };
}

describe('synthesized plan through the frozen Petri topology (oracle 8)', () => {
  it('executes overlapping independent slices, ordered fan-in, and contract-only verification to promotion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-synth-composition-'));
    const { verifyTarget } = await writeSynthesizedRun(cwd);
    expect(verifyTarget).toEqual({ command: 'pytest', args: [] });
    const verifyCommands: { command: string; args: readonly string[]; dir: string }[] = [];
    const overlap = { bothInFlight: false };

    const outcome = await drive(
      { cwd, runId: 'run-1', ports: witnessPorts({ verifyCommands, overlap }) },
      petriScheduler,
      frontierFiringPolicy,
    );

    expect(outcome.status).toBe('completed');
    const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(metadata?.status).toBe('promotion_prepared');
    expect(metadata?.verifyTarget).toEqual({ command: 'pytest', args: [] });
    expect(overlap.bothInFlight).toBe(true);
    expect(verifyCommands.length).toBeGreaterThanOrEqual(3);
    for (const invocation of verifyCommands) {
      expect({ command: invocation.command, args: invocation.args }).toEqual({
        command: 'pytest',
        args: [],
      });
    }

    const request = JSON.parse(
      await readFile(sliceExecutionRequestPath(cwd, 'run-1', 'task-a'), 'utf8'),
    ) as Record<string, unknown>;
    expect(request['scopeId']).toBe('SCP1');
    expect(request['definition']).toContain('Build the feature core.');
    expect(request['definition']).toContain('Done when:');

    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { event?: string; epicId?: string });
    const events = reports.map((entry) => entry.event);
    expect(events).toEqual(
      expect.arrayContaining(['slice_integrated', 'epic_integrated', 'epic_test_result', 'epic_completed']),
    );
  });

  it('cannot complete or promote when verification fails (gate witness)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-synth-composition-failed-'));
    await writeSynthesizedRun(cwd);
    const verifyCommands: { command: string; args: readonly string[]; dir: string }[] = [];
    const overlap = { bothInFlight: false };

    await drive(
      { cwd, runId: 'run-1', ports: witnessPorts({ verifyCommands, overlap, verdict: 'failed' }) },
      petriScheduler,
      frontierFiringPolicy,
    );

    const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(metadata?.status).not.toBe('promotion_prepared');
    expect(metadata?.status).not.toBe('run_completed');
    expect(metadata?.completedSliceIds ?? []).toEqual([]);
  });
});
