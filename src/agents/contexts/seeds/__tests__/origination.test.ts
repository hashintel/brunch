import { describe, expect, it } from 'vitest';

import type { ElicitationScratchpadItem } from '../../../../session/elicitation-scratchpad.js';
import { composeContextSeedContent } from '../origination.js';

const specId = 7;

function node(kind: string, title: string, kindOrdinal = 1) {
  return { id: kindOrdinal * 10 + kind.length, plane: 'intent', kind, kindOrdinal, title } as never;
}

function scratchpadItem(
  id: string,
  obligation: string,
  overrides: Partial<ElicitationScratchpadItem> = {},
): ElicitationScratchpadItem {
  return { id, obligation, disposition: overrides.disposition ?? 'open', ...overrides };
}

describe('composeContextSeedContent', () => {
  it('renders the full graph overview (codes, titles, edges), graph facts, and the scratchpad', async () => {
    const goal = node('goal', 'Ship tracker', 1);
    const requirement = node('requirement', 'Fast search', 1);
    const content = composeContextSeedContent({
      specId,
      specName: 'Issue tracker',
      slice: {
        nodes: [goal, node('goal', 'Second goal', 2), requirement],
        edges: [
          {
            id: 1,
            sourceId: (requirement as { id: number }).id,
            targetId: (goal as { id: number }).id,
            category: 'dependency',
          } as never,
        ],
        lsn: 9,
      },
      scratchpad: [scratchpadItem('gap-1', 'What is the primary goal?')],
      workspaceContext: 'Workspace overview\n- specs: 1',
    });

    await expect(content).toMatchFileSnapshot('../__snapshots__/origination-full-overview.md');
    expect(content).not.toMatch(/readiness|score|coverage|importance|rank/i);
  });

  it('places the workspace overview section ahead of the graph section', () => {
    const content = composeContextSeedContent({
      specId,
      specName: 'Issue tracker',
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [],
      workspaceContext: 'Workspace overview\n- specs: 2\n- sessions: 1',
    });

    expect(content.indexOf('Workspace overview')).toBeLessThan(content.indexOf('Graph'));
  });

  it('renders the full scratchpad, never a persisted agenda row', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [
        scratchpadItem('gap-1', 'Open question 1?'),
        scratchpadItem('gap-2', 'Open question 2?', { disposition: 'resolved' }),
      ],
      workspaceContext: '',
    });

    expect(content).toContain('ELICITATION SCRATCHPAD');
    expect(content).toContain('Open question 1?');
    expect(content).toContain('Open question 2?');
  });

  it('renders an honest empty state for a fresh spec with no graph and no scratchpad items', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 0 },
      scratchpad: [],
      workspaceContext: '',
    });

    expect(content).toContain('empty');
    expect(content).not.toContain('undefined');
  });
});
