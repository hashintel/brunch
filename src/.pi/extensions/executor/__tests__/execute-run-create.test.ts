import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectExecuteGraph } from '../../../../executor/execute-projection.js';
import type { CapabilityRequirement } from '../../../../executor/execution-contract.js';
import { planFilePath, writePlanFile } from '../../../../executor/plan-file.js';
import { runMetadataPath } from '../../../../executor/run.js';
import { createExecuteRunCreateTool } from '../execute-run-create/index.js';

const base = {
  specId: 7,
  basis: 'explicit',
  settlement: 'settled',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

const nodes = [
  { ...base, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Build feature' },
];

function tool() {
  return createExecuteRunCreateTool({
    specId: 7,
    reads: { queryGraph: () => ({ lsn: 9, nodes, edges: [] }) } as never,
  });
}

async function writePlan(
  cwd: string,
  mode: 'greenfield' | 'brownfield' = 'greenfield',
  detectedCapabilities: readonly CapabilityRequirement[] = [],
  verifyTarget?: { readonly command: string; readonly args: readonly string[] } | null,
  executionActions?: {
    readonly setup: readonly { readonly command: string; readonly args: readonly string[] }[];
    readonly build: readonly { readonly command: string; readonly args: readonly string[] }[];
    readonly verify: readonly { readonly command: string; readonly args: readonly string[] }[];
  },
) {
  const projection = projectExecuteGraph({
    specId: 7,
    graphLsn: 9,
    nodes: nodes as never,
    edges: [],
    mode,
    detectedCapabilities,
  });
  const preview =
    verifyTarget !== undefined
      ? {
          ...projection.planPreview,
          execution_contract: {
            ...projection.executionContract,
            resolvedActions: executionActions
              ? {
                  setup: executionActions.setup.map((action) => ({
                    capabilityId: 'test.setup',
                    providerId: 'test-persisted',
                    command: action.command,
                    args: action.args,
                  })),
                  build: executionActions.build.map((action) => ({
                    capabilityId: 'test.build',
                    providerId: 'test-persisted',
                    command: action.command,
                    args: action.args,
                  })),
                  verify: executionActions.verify.map((action) => ({
                    capabilityId: 'test.verify',
                    providerId: 'test-persisted',
                    command: action.command,
                    args: action.args,
                  })),
                }
              : {
                  ...projection.executionContract.resolvedActions,
                  verify: verifyTarget
                    ? [
                        {
                          capabilityId: 'test.persisted',
                          providerId: 'test-persisted',
                          command: verifyTarget.command,
                          args: verifyTarget.args,
                        },
                      ]
                    : [],
                },
          },
        }
      : projection.planPreview;
  await writePlanFile({ cwd, preview, source: projection.source });
}

async function runMetadata(cwd: string, runId: string) {
  return JSON.parse(await readFile(runMetadataPath(cwd, runId), 'utf8')) as {
    readonly verifyTarget?: { readonly command: string; readonly args: readonly string[] };
    readonly executionActions?: {
      readonly setup: readonly { readonly command: string; readonly args: readonly string[] }[];
      readonly build: readonly { readonly command: string; readonly args: readonly string[] }[];
      readonly verify: readonly { readonly command: string; readonly args: readonly string[] }[];
    };
  };
}

describe('createExecuteRunCreateTool', () => {
  it('exposes no verification-profile choice in the tool schema', () => {
    const schema = tool().parameters as { properties?: Record<string, unknown> };

    expect(Object.keys(schema.properties ?? {})).toEqual(['runId']);
  });

  it('reports a missing plan before attempting execution-contract admission', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-missing-plan-'));

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, { cwd } as never);

    expect(result.details).toEqual({
      result: {
        status: 'missing_plan',
        runStatus: 'not_started',
        planPath: planFilePath(cwd, '7'),
        sideEffects: [],
      },
      sideEffects: [],
    });
  });

  it('writes the persisted authored verify target into greenfield run metadata', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-greenfield-'));
    await writePlan(cwd, 'greenfield', [], { command: 'npm', args: ['run', 'verify'] });

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, { cwd } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).verifyTarget).toEqual({
      command: 'npm',
      args: ['run', 'verify'],
    });
  });

  it('persists the complete authored action contract without dropping setup or build', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-full-gate-'));
    await writePlan(
      cwd,
      'greenfield',
      [],
      { command: 'npm', args: ['test'] },
      {
        setup: [{ command: 'npm', args: ['install'] }],
        build: [{ command: 'npm', args: ['run', 'build'] }],
        verify: [{ command: 'npm', args: ['test'] }],
      },
    );

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, { cwd } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).executionActions).toEqual({
      setup: [
        {
          capabilityId: 'test.setup',
          providerId: 'test-persisted',
          command: 'npm',
          args: ['install'],
        },
      ],
      build: [
        {
          capabilityId: 'test.build',
          providerId: 'test-persisted',
          command: 'npm',
          args: ['run', 'build'],
        },
      ],
      verify: [
        {
          capabilityId: 'test.verify',
          providerId: 'test-persisted',
          command: 'npm',
          args: ['test'],
        },
      ],
    });
  });

  it('uses the persisted plan contract instead of re-projecting verification from the graph', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-persisted-contract-'));
    await writePlan(cwd, 'greenfield', [], { command: 'pytest', args: ['-q'] });

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, { cwd } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).verifyTarget).toEqual({ command: 'pytest', args: ['-q'] });
  });

  it('uses the persisted authored target while retaining brownfield evidence', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-brownfield-'));
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'host', scripts: { test: 'vitest run' } }),
      'utf8',
    );
    await writePlan(
      cwd,
      'brownfield',
      [
        { id: 'node.package-json', source: { kind: 'detected', path: 'package.json' } },
        { id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } },
      ],
      { command: 'npm', args: ['test'] },
    );

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, {
      cwd,
    } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).verifyTarget).toEqual({ command: 'npm', args: ['test'] });
  });

  it('rejects run creation when the contract resolves no verification action', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-blocked-'));
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: 'host', scripts: {} }), 'utf8');
    await writePlan(cwd, 'brownfield', [], null);

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, {
      cwd,
    } as never);

    expect(result.details).toEqual({
      result: {
        status: 'execution_contract_blocked',
        reasons: ['the admitted plan resolves no verification action'],
      },
      sideEffects: [],
    });
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects a malformed persisted execution contract without creating run artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-malformed-contract-'));
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '7'), { recursive: true });
    await writeFile(
      planFilePath(cwd, '7'),
      JSON.stringify({ mode: 'greenfield', epics: [], slices: [], execution_contract: {} }),
      'utf8',
    );

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, { cwd } as never);

    expect(result.details).toEqual({
      result: {
        status: 'execution_contract_blocked',
        reasons: ['the persisted plan execution contract is malformed'],
      },
      sideEffects: [],
    });
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('writes the spec-recipe verify target for a greenfield run', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-recipe-'));
    const recipeTool = createExecuteRunCreateTool({
      specId: 7,
      reads: {
        queryGraph: () => ({
          lsn: 9,
          nodes: [
            ...nodes,
            {
              ...base,
              id: 30,
              plane: 'oracle',
              kind: 'vv_method',
              kindOrdinal: 1,
              title: 'Project execution harness',
              body: 'execute.verify: cargo test',
            },
          ],
          edges: [],
        }),
      } as never,
    });
    const projection = projectExecuteGraph({
      specId: 7,
      graphLsn: 9,
      nodes: [
        ...nodes,
        {
          ...base,
          id: 30,
          plane: 'oracle',
          kind: 'vv_method',
          kindOrdinal: 1,
          title: 'Project execution harness',
          body: 'execute.verify: cargo test',
        },
      ] as never,
      edges: [],
    });
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '7'), { recursive: true });
    await writePlanFile({ cwd, preview: projection.planPreview, source: projection.source });

    const result = await recipeTool.execute('t1', { runId: 'run-1' }, undefined, undefined, {
      cwd,
    } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).verifyTarget).toEqual({ command: 'cargo', args: ['test'] });
  });
});
