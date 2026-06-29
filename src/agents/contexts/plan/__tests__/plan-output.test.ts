import { describe, expect, it } from 'vitest';

import type { GraphNode } from '../../../../graph/schema/nodes.js';
import { renderPlanMarkdownOutput } from '../plan-output.js';

const base = {
  specId: 1,
  basis: 'explicit',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

describe('renderPlanMarkdownOutput', () => {
  it('flattens plan-plane nodes into a markdown plan document', async () => {
    const nodes: GraphNode[] = [
      {
        ...base,
        id: 1,
        plane: 'intent',
        kind: 'goal',
        kindOrdinal: 1,
        title: 'Do not include spec nodes',
      },
      {
        ...base,
        id: 2,
        plane: 'plan',
        kind: 'milestone',
        kindOrdinal: 1,
        title: 'Renderer coverage',
        body: 'Close remaining renderer and prompt assembly rows.',
      },
      {
        ...base,
        id: 3,
        plane: 'plan',
        kind: 'frontier',
        kindOrdinal: 1,
        title: 'Golden lock',
        body: 'Lock output with snapshots and semantic invariants.',
      },
      {
        ...base,
        id: 4,
        plane: 'plan',
        kind: 'slice',
        kindOrdinal: 1,
        title: 'Spec output',
        source: 'renderer-golden-coverage',
      },
    ];

    const rendered = renderPlanMarkdownOutput({ title: 'Widget Plan', nodes });

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/plan-output.md');
  });
});
