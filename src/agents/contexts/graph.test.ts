import { describe, expect, it } from 'vitest';

import type { GraphOverview } from '../../graph/snapshot.js';
import { renderGraphContext } from './graph.js';

const overview: GraphOverview = {
  lsn: 7,
  nodeCount: 4,
  edgeCount: 2,
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

describe('renderGraphContext', () => {
  it('renders the same selected-spec overview with lens-specific emphasis', () => {
    const intent = renderGraphContext(overview, { lens: 'intent' });
    const design = renderGraphContext(overview, { lens: 'design' });
    const oracle = renderGraphContext(overview, { lens: 'oracle' });

    expect(intent).toContain('[Selected-spec graph context · intent lens]');
    expect(design).toContain('[Selected-spec graph context · design lens]');
    expect(oracle).toContain('[Selected-spec graph context · oracle lens]');
    expect(intent).toContain('intent claims, terms, assumptions');
    expect(design).toContain('design modules/interfaces');
    expect(oracle).toContain('verification checks, evidence');
    expect(intent.indexOf('intent/goal')).toBeLessThan(intent.indexOf('design/module'));
    expect(design.indexOf('design/module')).toBeLessThan(design.indexOf('intent/goal'));
    expect(oracle.indexOf('oracle/check')).toBeLessThan(oracle.indexOf('intent/goal'));
    expect(overview.nodes[0]?.title).toBe('Fast local specification');
  });

  it('bounds rendered node and edge output', () => {
    const rendered = renderGraphContext(overview, { lens: 'intent', maxNodes: 2, maxEdges: 1 });

    expect(rendered).toContain('…2 more node(s) omitted');
    expect(rendered).toContain('…1 more edge(s) omitted');
  });
});

function node(
  id: number,
  plane: GraphOverview['nodes'][number]['plane'],
  kind: GraphOverview['nodes'][number]['kind'],
  title: string,
): GraphOverview['nodes'][number] {
  return {
    id,
    specId: 1,
    plane,
    kind,
    title,
    basis: 'explicit',
    createdAtLsn: id,
    updatedAtLsn: id,
  };
}
