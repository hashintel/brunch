import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
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
      scope_handoff_required: true,
      spec: {
        requirements: [{ item_id: 'REQ1', title: 'Build feature', content: 'Build exact feature.' }],
      },
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
      scope_handoff_required: true,
      spec: {
        requirements: [
          { item_id: 'REQ1', title: 'Wire feature', content: 'Wire the shared feature.' },
          { item_id: 'REQ2', title: 'Add shortcut', content: 'Ship the exact keyboard shortcut.' },
          { item_id: 'REQ3', title: 'Build foundation', content: 'Preserve the shared foundation.' },
        ],
      },
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
      scopeHandoffRequired: true,
      scopeId: 'SCP1',
      action: 'execute_slice',
      status: 'requested',
      definition: 'Build the first task.',
      criteria: [{ kind: 'criterion', target: 'Feature passes smoke.' }],
      derivedFrom: ['REQ1'],
      requirements: [{ itemId: 'REQ1', title: 'Build feature', content: 'Build exact feature.' }],
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
      scopeHandoffRequired: true,
      scopeId: 'SCP1',
      action: 'execute_slice',
      status: 'requested',
      definition: 'Ship keyboard shortcut',
      criteria: [{ kind: 'criterion', target: 'Shortcut opens feature' }],
      derivedFrom: ['REQ2'],
      requirements: [
        { itemId: 'REQ1', title: 'Wire feature', content: 'Wire the shared feature.' },
        { itemId: 'REQ2', title: 'Add shortcut', content: 'Ship the exact keyboard shortcut.' },
        { itemId: 'REQ3', title: 'Build foundation', content: 'Preserve the shared foundation.' },
      ],
      designContext: [{ itemId: 'MOD1', content: 'Feature module' }],
      verificationContext: [{ itemId: 'CH1', content: 'Feature smoke test' }],
      instruction: 'Make the minimum change that satisfies every criterion.',
    });
  });

  it('stages only the verified target-visible public packet into the sealed slice workspace', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-public-packet-'));
    const specification = '# Exact specification\n';
    const contract = '{"schemaVersion":1}\n';
    const { publicDir, files, packetSha256 } = await writePublicPacket(cwd, specification, contract);
    await writeFile(join(publicDir, 'controller-oracle.json'), '{"hidden":true}\n', 'utf8');
    await createSliceStartedRun(cwd);

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result.status).toBe('slice_execution_requested');
    const request = JSON.parse(
      await readFile(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'), 'utf8'),
    ) as Record<string, unknown>;
    expect(request['publicPacket']).toEqual({
      path: '.brunch/execution-comparison/public',
      packetSha256,
      files,
    });
    const stagedDir = join(
      sliceWorkspacePath(cwd, 'run-1', 'task-1'),
      '.brunch',
      'execution-comparison',
      'public',
    );
    await expect(readFile(join(stagedDir, 'spec.md'), 'utf8')).resolves.toBe(specification);
    await expect(readFile(join(stagedDir, 'public-contract.json'), 'utf8')).resolves.toBe(contract);
    await expect(readFile(join(stagedDir, 'packet-manifest.json'), 'utf8')).resolves.toContain(packetSha256);
    expect(await pathExists(join(stagedDir, 'controller-oracle.json'))).toBe(false);
  });

  it('stages the run-pinned packet when the target packet changes after run creation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-changed-packet-'));
    const specification = '# Approved specification\n';
    const contract = '{"schemaVersion":1}\n';
    const original = await writePublicPacket(cwd, specification, contract);
    await createSliceStartedRun(cwd);
    await writePublicPacket(cwd, `${specification}changed\n`, contract);

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result.status).toBe('slice_execution_requested');
    const request = JSON.parse(await readFile(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'), 'utf8')) as {
      publicPacket: { packetSha256: string };
    };
    expect(request.publicPacket.packetSha256).toBe(original.packetSha256);
    await expect(
      readFile(
        join(
          sliceWorkspacePath(cwd, 'run-1', 'task-1'),
          '.brunch',
          'execution-comparison',
          'public',
          'spec.md',
        ),
        'utf8',
      ),
    ).resolves.toBe(specification);
  });

  it('refuses a symlinked packet destination without writing outside the slice worktree', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-packet-symlink-'));
    await writePublicPacket(cwd, '# Approved\n', '{"schemaVersion":1}\n');
    await createSliceStartedRun(cwd);
    const outside = await mkdtemp(join(tmpdir(), 'brunch-slice-packet-outside-'));
    const gitSliceIntegration = createFakeGitSliceIntegrationPort({
      async prepare({ sliceWorktreeDir }) {
        await mkdir(sliceWorktreeDir, { recursive: true });
        await writeFile(join(sliceWorktreeDir, '.git'), 'gitdir: /tmp/fake\n', 'utf8');
        await symlink(outside, join(sliceWorktreeDir, '.brunch'));
        return {
          status: 'prepared',
          baseSha: 'base123',
          sideEffects: [{ kind: 'git_worktree_add', path: sliceWorktreeDir, ref: 'base123' }],
        };
      },
    });

    await expect(requestSliceExecution({ cwd, runId: 'run-1', gitSliceIntegration })).rejects.toThrow(
      'public packet destination .brunch is not a regular directory',
    );
    expect(await pathExists(join(outside, 'spec.md'))).toBe(false);
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
    await writeFile(populatedPlanPath(cwd, 'run-1'), '{"scope_handoff_required":false,"slices":[]}', 'utf8');

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
        scope_handoff_required: true,
        spec: {
          requirements: [{ item_id: 'REQ1', title: 'Build feature', content: 'Build exact feature.' }],
        },
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
        spec: {
          requirements: [{ item_id: 'REQ1', title: 'Build feature', content: 'Build exact feature.' }],
        },
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
        spec: { requirements: [] },
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

  it('rejects a scoped slice when a derived requirement cannot be resolved exactly', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-unknown-requirement-'));
    await createSliceStartedRun(cwd);
    const plan = JSON.parse(await readFile(populatedPlanPath(cwd, 'run-1'), 'utf8')) as {
      slices: Array<{ derived_from: string[] }>;
    };
    plan.slices[0]!.derived_from = ['REQ-missing'];
    await writeFile(populatedPlanPath(cwd, 'run-1'), JSON.stringify(plan), 'utf8');

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'plan_slice_invalid',
      runStatus: 'slice_started',
      message: 'Scope slice task-1 cannot resolve exact requirement content for REQ-missing.',
      sideEffects: [],
    });
    expect(await pathExists(sliceExecutionRequestPath(cwd, 'run-1', 'task-1'))).toBe(false);
  });

  it('rejects duplicate requirement ids instead of selecting one body', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-duplicate-requirement-'));
    await createSliceStartedRun(cwd);
    const plan = JSON.parse(await readFile(populatedPlanPath(cwd, 'run-1'), 'utf8')) as {
      spec: { requirements: Array<{ item_id: string; title: string; content: string }> };
    };
    plan.spec.requirements.push({ item_id: 'REQ1', title: 'Rival', content: 'Rival body' });
    await writeFile(populatedPlanPath(cwd, 'run-1'), JSON.stringify(plan), 'utf8');

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'plan_slice_invalid',
      message: 'Populated plan contains duplicate requirement ids.',
      sideEffects: [],
    });
  });

  it('rejects malformed scope markers instead of treating scoped work as unscoped', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-malformed-scope-marker-'));
    await createSliceStartedRun(cwd);
    const plan = JSON.parse(await readFile(populatedPlanPath(cwd, 'run-1'), 'utf8')) as Record<
      string,
      unknown
    >;
    plan['scope_handoff_required'] = 'false';
    await writeFile(populatedPlanPath(cwd, 'run-1'), JSON.stringify(plan), 'utf8');

    const result = await requestSliceExecution({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: createFakeGitSliceIntegrationPort(),
    });

    expect(result).toMatchObject({
      status: 'plan_slice_invalid',
      message: 'Populated plan has an invalid scope_handoff_required marker.',
      sideEffects: [],
    });
  });

  it('rejects malformed slice arrays and duplicate requirement references', async () => {
    const malformed = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-malformed-array-'));
    await createSliceStartedRun(malformed);
    await writeFile(
      populatedPlanPath(malformed, 'run-1'),
      JSON.stringify({ scope_handoff_required: true, slices: {} }),
      'utf8',
    );
    await expect(
      requestSliceExecution({
        cwd: malformed,
        runId: 'run-1',
        gitSliceIntegration: createFakeGitSliceIntegrationPort(),
      }),
    ).resolves.toMatchObject({
      status: 'plan_slice_invalid',
      message: 'Populated plan has malformed requirement or slice arrays.',
      sideEffects: [],
    });

    const duplicate = await mkdtemp(join(tmpdir(), 'brunch-slice-execute-duplicate-reference-'));
    await createSliceStartedRun(duplicate);
    const plan = JSON.parse(await readFile(populatedPlanPath(duplicate, 'run-1'), 'utf8')) as {
      slices: Array<{ derived_from: string[] }>;
    };
    plan.slices[0]!.derived_from = ['REQ1', 'REQ1'];
    await writeFile(populatedPlanPath(duplicate, 'run-1'), JSON.stringify(plan), 'utf8');
    await expect(
      requestSliceExecution({
        cwd: duplicate,
        runId: 'run-1',
        gitSliceIntegration: createFakeGitSliceIntegrationPort(),
      }),
    ).resolves.toMatchObject({
      status: 'plan_slice_invalid',
      message: 'Scope slice task-1 has duplicate dependency or requirement references at task-1.',
      sideEffects: [],
    });
  });
});

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function writePublicPacket(cwd: string, specification: string, contract: string) {
  const publicDir = join(cwd, '.brunch', 'execution-comparison', 'public');
  const files = [
    { path: 'public-contract.json', sha256: digest(contract) },
    { path: 'spec.md', sha256: digest(specification) },
  ];
  const packetSha256 = digest(files.map((file) => `${file.path}:${file.sha256}\n`).join(''));
  await mkdir(publicDir, { recursive: true });
  await writeFile(join(publicDir, 'spec.md'), specification, 'utf8');
  await writeFile(join(publicDir, 'public-contract.json'), contract, 'utf8');
  await writeFile(
    join(publicDir, 'packet-manifest.json'),
    JSON.stringify({ schemaVersion: 1, caseId: 'case-1', packetSha256, files }),
    'utf8',
  );
  return { publicDir, files, packetSha256 };
}
