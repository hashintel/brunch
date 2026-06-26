import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openWorkspaceGraphRuntime } from '../../graph/index.js';
import { applyDevGraphMutation } from '../graph-curation.js';

describe('applyDevGraphMutation', () => {
  it('applies create, patch, and delete curation ops through the shared mutation seam', async () => {
    const fixture = await createFixture();

    const created = await applyDevGraphMutation(fixture.cwd, {
      specId: fixture.specAId,
      createBasis: 'explicit',
      ops: [
        { op: 'create_node', ref: 'thesis', plane: 'intent', kind: 'thesis', title: 'Curated thesis' },
        {
          op: 'create_edge',
          category: 'rationale',
          support: { existingCode: 'REQ1' },
          claim: 'thesis',
          stance: 'for',
          rationale: 'Existing requirement supports the thesis.',
        },
      ],
    });

    expect(created).toMatchObject({
      status: 'success',
      createdNodes: { thesis: { code: 'TH1' } },
      createdEdges: [expect.any(Number)],
    });
    if (created.status !== 'success') throw new Error('expected create success');
    const thesis = created.createdNodes.thesis;
    if (!thesis) throw new Error('expected thesis node');

    const patched = await applyDevGraphMutation(fixture.cwd, {
      specId: fixture.specAId,
      ops: [
        {
          op: 'patch_node',
          node: { existingCode: 'TH1' },
          patch: { title: 'Patched thesis', body: 'Patch through the shared curation seam.' },
        },
        {
          op: 'patch_edge',
          edgeId: created.createdEdges[0]!,
          patch: { rationale: 'Patched rationale' },
        },
      ],
    });

    expect(patched).toMatchObject({
      status: 'success',
      updatedNodes: [thesis.id],
      updatedEdges: [created.createdEdges[0]],
    });

    const graph = await openWorkspaceGraphRuntime(fixture.cwd);
    const overview = graph.forSpec(fixture.specAId).queryGraph();
    expect(overview.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Patched thesis' })]),
    );
    expect(overview.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'rationale', rationale: 'Patched rationale' }),
      ]),
    );

    const deleted = await applyDevGraphMutation(fixture.cwd, {
      specId: fixture.specAId,
      ops: [
        { op: 'delete_edge', edgeId: created.createdEdges[0]! },
        { op: 'delete_node', node: { existingCode: 'TH1' } },
      ],
    });

    expect(deleted).toMatchObject({
      status: 'success',
      deletedEdges: [created.createdEdges[0]],
      deletedNodes: [thesis.id],
    });
    const afterDelete = graph.forSpec(fixture.specAId).queryGraph();
    expect(afterDelete.nodes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Patched thesis' })]),
    );
  });

  it('returns structural diagnostics without persisting invalid curation ops', async () => {
    const fixture = await createFixture();

    const invalidCode = await applyDevGraphMutation(fixture.cwd, {
      specId: fixture.specAId,
      ops: [{ op: 'patch_node', node: { existingCode: 'not-a-code' }, patch: { title: 'Bad patch' } }],
    });
    expect(invalidCode).toMatchObject({
      status: 'structural_illegal',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('malformed graph node code') }),
      ]),
    });

    const crossSpec = await applyDevGraphMutation(fixture.cwd, {
      specId: fixture.specAId,
      createBasis: 'explicit',
      ops: [
        { op: 'create_node', ref: 'thesis', plane: 'intent', kind: 'thesis', title: 'Sibling code thesis' },
        {
          op: 'create_edge',
          category: 'rationale',
          support: { existingCode: 'G1' },
          claim: 'thesis',
          stance: 'for',
        },
      ],
    });
    expect(crossSpec).toMatchObject({
      status: 'structural_illegal',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('does not resolve in the selected spec'),
        }),
      ]),
    });

    const graph = await openWorkspaceGraphRuntime(fixture.cwd);
    const overview = graph.forSpec(fixture.specAId).queryGraph();
    expect(overview.lsn).toBe(fixture.specALsn);
    expect(JSON.stringify(overview)).not.toContain('Sibling code thesis');
  });
});

async function createFixture(): Promise<{
  cwd: string;
  specAId: number;
  specALsn: number;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-dev-curation-'));
  const graph = await openWorkspaceGraphRuntime(cwd);
  const specA = graph.commandExecutor.createSpec({ name: 'Spec A', slug: 'spec-a' });
  const specB = graph.commandExecutor.createSpec({ name: 'Spec B', slug: 'spec-b' });
  if (specA.status !== 'success' || specB.status !== 'success') {
    throw new Error('failed to create graph-curation fixture specs');
  }

  const commitA = graph.commandExecutor.mutateGraph({
    specId: specA.specId,
    createBasis: 'explicit',
    ops: [
      {
        op: 'create_node',
        ref: 'requirement',
        plane: 'intent',
        kind: 'requirement',
        title: 'Spec A requirement',
      },
    ],
  });
  const commitB = graph.commandExecutor.mutateGraph({
    specId: specB.specId,
    createBasis: 'explicit',
    ops: [{ op: 'create_node', ref: 'goal', plane: 'intent', kind: 'goal', title: 'Spec B goal' }],
  });
  if (commitA.status !== 'success' || commitB.status !== 'success') {
    throw new Error('failed to create graph-curation fixture graph');
  }

  return { cwd, specAId: specA.specId, specALsn: commitA.lsn };
}
