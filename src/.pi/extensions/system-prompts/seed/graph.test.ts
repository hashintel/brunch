import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../../../../graph/queries.js';
import { renderGraphSeed } from './graph.js';

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
      category: 'proof',
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
  it('renders the same selected-spec overview with lens-specific emphasis', () => {
    const intent = renderGraphSeed(overview, { lens: 'intent' });
    const design = renderGraphSeed(overview, { lens: 'design' });
    const oracle = renderGraphSeed(overview, { lens: 'oracle' });

    expect(intent).toContain('[Selected-spec graph context · intent lens]');
    expect(design).toContain('[Selected-spec graph context · design lens]');
    expect(oracle).toContain('[Selected-spec graph context · oracle lens]');
    expect(intent).toContain('- selected-spec lsn: 7; nodes: 4; edges: 2');
    expect(intent).toContain('intent claims, terms, assumptions');
    expect(design).toContain('design modules/interfaces');
    expect(oracle).toContain('verification checks, evidence');
    expect(intent.indexOf('intent/goal')).toBeLessThan(intent.indexOf('design/module'));
    expect(design.indexOf('design/module')).toBeLessThan(design.indexOf('intent/goal'));
    expect(oracle.indexOf('oracle/check')).toBeLessThan(oracle.indexOf('intent/goal'));
    expect(overview.nodes[0]?.title).toBe('Fast local specification');
  });

  it('bounds rendered node and edge output', () => {
    const rendered = renderGraphSeed(overview, { lens: 'intent', maxNodes: 2, maxEdges: 1 });

    expect(rendered).toContain('…2 more node(s) omitted');
    expect(rendered).toContain('…1 more edge(s) omitted');
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
