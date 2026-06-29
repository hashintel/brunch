import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../../../../graph/queries.js';
import { presenceGap } from '../../../../graph/schema/elicitation-gap-fixtures.js';
import { composeAgentContextSeed, renderGraphSeed, renderWorkspaceSeed } from '../turn-context.js';

describe('renderWorkspaceSeed', () => {
  it('renders selected-spec/session/posture facts without ambient resource discovery', async () => {
    const rendered = renderWorkspaceSeed({
      spec: { id: 42, name: 'Payments Spec' },
      workspace: {
        cwd: '/repo/product',
        posture: {
          certainty: 'proving',
          stakes: 'high',
          migration: 'free-rewrite',
        },
      },
      session: { id: 'session-7', label: 'Grounding' },
      gaps: [
        presenceGap({ refersTo: 'context', coverage: 0.5, band: 'grounding', specId: 42 }),
        presenceGap({ refersTo: 'requirement', coverage: 1, band: 'elicitation', specId: 42 }),
      ],
    });

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/turn-context-workspace-seed.md');
    expect(rendered).not.toContain('readiness_grade=');
    expect(rendered).not.toContain('.pi/context');
  });
});

const overview: GraphSlice = {
  lsn: 7,
  nodes: [
    node(1, 'intent', 'goal', 'Fast local specification'),
    node(2, 'design', 'module', 'Prompt composer'),
    node(3, 'oracle', 'check', 'Prompt posture fixture'),
    node(4, 'intent', 'constraint', 'No ambient Pi discovery'),
  ],
  edges: [
    {
      id: 10,
      specId: 1,
      category: 'realization',
      sourceId: 2,
      targetId: 1,
      basis: 'explicit',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
    {
      id: 11,
      specId: 1,
      category: 'witness',
      sourceId: 3,
      targetId: 4,
      stance: 'for',
      basis: 'explicit',
      createdAtLsn: 7,
      updatedAtLsn: 7,
    },
  ],
};

describe('renderGraphSeed', () => {
  it('renders the same selected-spec overview with lens-specific emphasis', async () => {
    const intent = renderGraphSeed(overview, { lens: 'intent' });
    const design = renderGraphSeed(overview, { lens: 'design' });
    const oracle = renderGraphSeed(overview, { lens: 'oracle' });

    await expect(intent).toMatchFileSnapshot('../__snapshots__/turn-context-graph-intent.md');
    await expect(design).toMatchFileSnapshot('../__snapshots__/turn-context-graph-design.md');
    await expect(oracle).toMatchFileSnapshot('../__snapshots__/turn-context-graph-oracle.md');
    expect(intent).not.toContain('-[realization]->');
    expect(intent).not.toContain('[G1] intent/goal');
  });

  it('bounds rendered node and edge output', () => {
    const rendered = renderGraphSeed(overview, { lens: 'intent', maxNodes: 2, maxEdges: 1 });

    expect(rendered).toContain('Omitted: 2 node(s), 1 edge(s).');
  });
});

describe('composeAgentContextSeed', () => {
  it('composes the workspace and graph blocks from already-read world state', () => {
    const blocks = composeAgentContextSeed({
      spec: { id: 42, name: 'Payments Spec' },
      workspace: { cwd: '/repo/product' },
      session: { id: 'session-7', label: 'Grounding' },
      gaps: [presenceGap({ refersTo: 'context', coverage: 0.5, band: 'grounding', specId: 42 })],
      graph: overview,
      lens: 'design',
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('[Selected workspace context]');
    expect(blocks[1]).toContain('Selected-spec graph overview · design lens');
  });
});

function node(
  id: number,
  plane: GraphSlice['nodes'][number]['plane'],
  kind: GraphSlice['nodes'][number]['kind'],
  title: string,
): GraphSlice['nodes'][number] {
  return {
    id,
    specId: 1,
    plane,
    kind,
    kindOrdinal: id,
    title,
    basis: 'explicit',
    createdAtLsn: id,
    updatedAtLsn: id,
  };
}
