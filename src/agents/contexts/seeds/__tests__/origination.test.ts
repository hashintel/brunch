import { describe, expect, it } from 'vitest';

import type { ElicitationScratchpadItem } from '../../../../session/elicitation-scratchpad.js';
import {
  SESSION_ORIENTATION_CHOICES,
  type SessionOrientationDirectiveChoice,
} from '../../../../session/session-orientation.js';
import { composeContextSeedContent } from '../origination.js';

// The inert `dismissed` never renders a directive section; only directive
// choices participate in seed composition.
const DIRECTIVE_CHOICES = SESSION_ORIENTATION_CHOICES.filter(
  (choice): choice is SessionOrientationDirectiveChoice => choice !== 'dismissed',
);

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

  it('omits the orientation section when no fresh choice exists', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [],
      workspaceContext: '',
    });

    expect(content).not.toContain('SESSION ORIENTATION');
  });

  it.each(DIRECTIVE_CHOICES)('emits a distinct orientation section for choice %s', (choice) => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [],
      workspaceContext: '',
      orientation: choice,
    });

    expect(content).toContain('SESSION ORIENTATION');
    expect(content).toContain(`chosen: ${choice}`);
  });

  it('carries a resumed spec’s established posture (D118-L: resume is not a blank restart)', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [],
      workspaceContext: '',
      posture: { kind: 'feature', origin: 'brownfield', relatesToSpecId: 3 },
    });

    expect(content).toContain('SPEC POSTURE');
    expect(content).toContain('kind: feature');
    expect(content).toContain('origin: brownfield');
    expect(content).toContain('relates-to-spec: spec 3');
  });

  it('renders no relates-to-spec claim when there is none (A41-L reference-only shape)', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [],
      workspaceContext: '',
      posture: { kind: 'product', origin: 'greenfield', relatesToSpecId: null },
    });

    expect(content).toContain('relates-to-spec: none');
  });

  it('omits the posture section (not blank) when posture is unestablished', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      scratchpad: [],
      workspaceContext: '',
      posture: { kind: 'product', origin: null, relatesToSpecId: null },
    });

    expect(content).not.toContain('SPEC POSTURE');
  });
});
