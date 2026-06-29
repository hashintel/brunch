import { describe, expect, it } from 'vitest';

import type { GraphNode } from '../../../../../graph/schema/nodes.js';
import { renderSpecMarkdownOutput } from '../spec-output.js';

const base = {
  specId: 1,
  basis: 'explicit',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

describe('renderSpecMarkdownOutput', () => {
  it('flattens non-plan graph nodes into a markdown specification document', async () => {
    const nodes: GraphNode[] = [
      {
        ...base,
        id: 3,
        plane: 'plan',
        kind: 'frontier',
        kindOrdinal: 1,
        title: 'Do not include planning nodes',
      },
      {
        ...base,
        id: 1,
        plane: 'intent',
        kind: 'goal',
        kindOrdinal: 1,
        title: 'Capture decisions',
        body: 'The product records specification decisions as graph truth.',
        source: 'stakeholder',
      },
      {
        ...base,
        id: 2,
        plane: 'design',
        kind: 'module',
        kindOrdinal: 1,
        title: 'Context renderer',
        body: 'Renderer code owns model-facing context text.',
      },
    ];

    const rendered = renderSpecMarkdownOutput({ title: 'Widget Spec', nodes });

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/spec-output.md');
  });
});
