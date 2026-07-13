import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectExecuteGraph } from '../../../../executor/execute-projection.js';
import type { CapabilityRequirement } from '../../../../executor/execution-contract.js';
import { writePlanFile } from '../../../../executor/plan-file.js';
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
) {
  const projection = projectExecuteGraph({
    specId: 7,
    graphLsn: 9,
    nodes: nodes as never,
    edges: [],
    mode,
    detectedCapabilities,
  });
  await writePlanFile({ cwd, preview: projection.planPreview, source: projection.source });
}

async function runMetadata(cwd: string, runId: string) {
  return JSON.parse(await readFile(runMetadataPath(cwd, runId), 'utf8')) as {
    readonly verifyTarget?: { readonly command: string; readonly args: readonly string[] };
  };
}

describe('createExecuteRunCreateTool', () => {
  it('exposes no verification-profile choice in the tool schema', () => {
    const schema = tool().parameters as { properties?: Record<string, unknown> };

    expect(Object.keys(schema.properties ?? {})).toEqual(['runId', 'substrate', 'mode']);
  });

  it('writes the greenfield default-provenance contract verify target into run metadata', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-greenfield-'));
    await writePlan(cwd);

    const result = await tool().execute('t1', { runId: 'run-1' }, undefined, undefined, { cwd } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).verifyTarget).toEqual({
      command: 'npm',
      args: ['run', 'verify'],
    });
  });

  it('reuses detected brownfield conventions for the run verify target', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-brownfield-'));
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ name: 'host', scripts: { test: 'vitest run' } }),
      'utf8',
    );
    await writePlan(cwd, 'brownfield', [
      { id: 'node.npm', source: { kind: 'detected', path: 'package.json' } },
      { id: 'node.npm-test', source: { kind: 'detected', path: 'package.json' } },
    ]);

    const result = await tool().execute('t1', { runId: 'run-1', mode: 'brownfield' }, undefined, undefined, {
      cwd,
    } as never);

    expect((result.details as { result: { status: string } }).result.status).toBe('created');
    expect((await runMetadata(cwd, 'run-1')).verifyTarget).toEqual({ command: 'npm', args: ['test'] });
  });

  it('rejects run creation when the contract resolves no verification action', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-create-blocked-'));
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: 'host', scripts: {} }), 'utf8');

    const result = await tool().execute('t1', { runId: 'run-1', mode: 'brownfield' }, undefined, undefined, {
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
});
