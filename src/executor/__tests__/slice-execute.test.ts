import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import { populatedPlanPath, populateWorktree } from '../populate.js';
import { initializeReports, reportsPath } from '../report.js';
import { runDirPath, runMetadataPath, createRun, readRunMetadata } from '../run.js';
import { requestSliceExecution, sliceExecutionRequestPath } from '../slice-execute.js';
import { startSlice } from '../slice-start.js';
import { sliceWorkspacePath } from '../slice-workspace.js';
import { copyHostSource } from '../source-copy.js';
import { selectSourcePolicy } from '../source-policy.js';
import { createWorktree } from '../worktree.js';
import { createFakeGitSliceIntegrationPort, createFakeGitWorktreePort } from './fake-ports.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createSliceStartedRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'greenfield',
      epics: [{ id: 'frontier-1', summary: 'Build feature', depends_on: [], verification: [] }],
      slices: [
        {
          id: 'task-1',
          scope_id: 'SCP1',
          epic_id: 'frontier-1',
          definition: 'Build the first task.',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'Feature passes smoke.' }],
          derived_from: ['REQ1'],
          design_context: [{ item_id: 'MOD1', content: 'Canvas route module' }],
          verification_context: [{ item_id: 'CH1', content: 'Canvas smoke test' }],
        },
      ],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
  await startSlice({ cwd, runId: 'run-1' });
}

async function createSecondScopeSliceStartedRun(cwd: string): Promise<void> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, 'src'), { recursive: true });
  await writeFile(join(cwd, 'src', 'app.ts'), 'export const app = true;\n', 'utf8');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(
    planPath,
    JSON.stringify({
      mode: 'brownfield',
      epics: [
        { id: 'F1', summary: 'Execution handoff', depends_on: [], verification: [] },
        {
          id: 'frontier-unscoped-requirements',
          summary: 'Implement unscoped requirements',
          depends_on: [],
          verification: [],
        },
      ],
      slices: [
        {
          id: 'task-1',
          scope_id: 'SCP1',
          epic_id: 'F1',
          definition: 'Wire feature',
          depends_on: ['task-3'],
          verification: [{ kind: 'criterion', target: 'Feature is visible' }],
          derived_from: ['REQ1'],
          design_context: [{ item_id: 'MOD1', content: 'Feature module' }],
          verification_context: [{ item_id: 'CH1', content: 'Feature smoke test' }],
        },
        {
          id: 'task-2',
          scope_id: 'SCP1',
          epic_id: 'F1',
          definition: 'Ship keyboard shortcut',
          depends_on: ['task-1'],
          verification: [{ kind: 'criterion', target: 'Shortcut opens feature' }],
          derived_from: ['REQ2'],
          design_context: [{ item_id: 'MOD1', content: 'Feature module' }],
          verification_context: [{ item_id: 'CH1', content: 'Feature smoke test' }],
        },
        {
          id: 'task-3',
          epic_id: 'frontier-unscoped-requirements',
          definition: 'Build foundation',
          depends_on: [],
          verification: [],
          derived_from: ['REQ3'],
        },
      ],
    }),
    'utf8',
  );
  await createRun({ cwd, specId: '42', runId: 'run-1' });
  await createWorktree({ cwd, runId: 'run-1', gitWorktree: createFakeGitWorktreePort() });
  await populateWorktree({ cwd, runId: 'run-1' });
  await selectSourcePolicy({ cwd, runId: 'run-1', policy: 'host_source_deferred' });
  await copyHostSource({ cwd, runId: 'run-1' });
  await initializeReports({ cwd, runId: 'run-1' });
  await startSlice({ cwd, runId: 'run-1', sliceId: 'task-1' });
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      ...(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8')) as object),
      status: 'slice_completed',
      completedSliceIds: ['task-1'],
    }),
    'utf8',
  );
  await startSlice({ cwd, runId: 'run-1', sliceId: 'task-2' });
}

describe('requestSliceExecution', () => {
  it('does not request execution before a slice is active', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-missing-run-'));
    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('writes an execution request and report for the active slice without invoking an agent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-ready-'));
    await createSliceStartedRun(cwd);

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toEqual({
      status: 'slice_execution_requested',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      requestPath: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
      sideEffects: [
        {
          kind: 'git_worktree_add',
          path: sliceWorkspacePath(cwd, 'run-1', 'task-1'),
          ref: 'base123',
        },
        { kind: 'mkdir', path: join(runDirPath(cwd, 'run-1'), 'agent-output', 'task-1') },
        {
          kind: 'write_file',
          path: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
          ifExists: 'overwrite',
        },
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      scopeId: 'SCP1',
      action: 'execute_slice',
      status: 'requested',
      definition: 'Build the first task.',
      criteria: [{ kind: 'criterion', target: 'Feature passes smoke.' }],
      derivedFrom: ['REQ1'],
      designContext: [{ itemId: 'MOD1', content: 'Canvas route module' }],
      verificationContext: [{ itemId: 'CH1', content: 'Canvas smoke test' }],
      instruction: 'Make the minimum change that satisfies every criterion.',
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toEqual({
      event: 'slice_execution_requested',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      status: 'slice_execution_requested',
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'agent-output', 'task-1', 'result.json'))).toBe(
      false,
    );
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
  });

  it('writes the next scope-derived slice request with its own lowered requirement brief', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-next-scope-slice-'));
    await createSecondScopeSliceStartedRun(cwd);

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'slice_execution_requested',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      sliceId: 'task-2',
      epicId: 'F1',
    });
    expect(JSON.parse(await readFile(sliceExecutionRequestPath(cwd, 'run-1', 'task-2'), 'utf8'))).toEqual({
      runId: 'run-1',
      sliceId: 'task-2',
      epicId: 'F1',
      scopeId: 'SCP1',
      action: 'execute_slice',
      status: 'requested',
      definition: 'Ship keyboard shortcut',
      criteria: [{ kind: 'criterion', target: 'Shortcut opens feature' }],
      derivedFrom: ['REQ2'],
      designContext: [{ itemId: 'MOD1', content: 'Feature module' }],
      verificationContext: [{ itemId: 'CH1', content: 'Feature smoke test' }],
      instruction: 'Make the minimum change that satisfies every criterion.',
    });
  });

  it('rejects active slice ids that would escape the agent-output directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-unsafe-slice-'));
    const runDir = runDirPath(cwd, 'run-1');
    const reportPath = reportsPath(cwd, 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'slice_started',
        reportsPath: reportPath,
        activeSliceId: '../../escape',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );

    await expect(
      requestSliceExecution({
        cwd,
        runId: 'run-1',
        gitSliceIntegration: createFakeGitSliceIntegrationPort(),
      }),
    ).rejects.toThrow('invalid sliceId');
    expect(await pathExists(join(runDir, '..', 'escape', 'request.json'))).toBe(false);
  });

  it('leaves run metadata unadvanced when the populated plan cannot supply the active slice brief', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-invalid-plan-'));
    await createSliceStartedRun(cwd);
    await writeFile(populatedPlanPath(cwd, 'run-1'), '{"slices":[]}', 'utf8');

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toEqual({
      status: 'plan_slice_invalid',
      runStatus: 'slice_started',
      runId: 'run-1',
      sliceId: 'task-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'Populated plan does not contain active slice task-1.',
      sideEffects: [],
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.status).toBe('slice_started');
    expect(await pathExists(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'))).toBe(false);
  });

  it('rejects a scope slice whose worker context is incomplete', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-incomplete-scope-'));
    await createSliceStartedRun(cwd);
    await writeFile(
      populatedPlanPath(cwd, 'run-1'),
      JSON.stringify({
        slices: [
          {
            id: 'task-1',
            scope_id: 'SCP1',
            epic_id: 'frontier-1',
            definition: 'Build it.',
            verification: [],
            derived_from: ['REQ1'],
            design_context: [],
            verification_context: [],
          },
        ],
      }),
      'utf8',
    );

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'plan_slice_invalid',
      runStatus: 'slice_started',
      message: 'Scope slice task-1 is missing valid verification, design_context, verification_context.',
      sideEffects: [],
    });
    expect((await readRunMetadata(runMetadataPath(cwd, 'run-1')))?.status).toBe('slice_started');
  });

  it('rejects a serialized scope plan whose active slice omits scope identity', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-missing-scope-id-'));
    await createSliceStartedRun(cwd);
    await writeFile(
      populatedPlanPath(cwd, 'run-1'),
      JSON.stringify({
        scope_handoff_required: true,
        slices: [
          {
            id: 'task-1',
            epic_id: 'frontier-1',
            definition: 'Build it.',
            verification: [{ kind: 'criterion', target: 'It works.' }],
            derived_from: ['REQ1'],
            design_context: [{ item_id: 'MOD1', content: 'Module' }],
            verification_context: [{ item_id: 'CH1', content: 'Check' }],
          },
        ],
      }),
      'utf8',
    );

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'plan_slice_invalid',
      message: 'Scope slice task-1 is missing valid scope_id.',
      sideEffects: [],
    });
  });

  it('treats blank scope enrichment values as missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-blank-scope-'));
    await createSliceStartedRun(cwd);
    await writeFile(
      populatedPlanPath(cwd, 'run-1'),
      JSON.stringify({
        scope_handoff_required: true,
        slices: [
          {
            id: 'task-1',
            scope_id: '   ',
            epic_id: 'frontier-1',
            definition: '   ',
            verification: [{ kind: 'criterion', target: '   ' }],
            derived_from: ['   '],
            design_context: [{ item_id: 'MOD1', content: '   ' }],
            verification_context: [{ item_id: '   ', content: 'Check' }],
          },
        ],
      }),
      'utf8',
    );

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'plan_slice_invalid',
      message:
        'Scope slice task-1 is missing valid scope_id, definition, verification, derived_from, design_context, verification_context.',
      sideEffects: [],
    });
  });
});
