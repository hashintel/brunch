import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import { composeContextSeedContent } from '../context-seed.js';

const specId = 7;

function node(kind: string, title: string, kindOrdinal = 1) {
  return { id: kindOrdinal * 10 + kind.length, plane: 'intent', kind, kindOrdinal, title } as never;
}

function gap(question: string, overrides: Partial<ElicitationGap> = {}): ElicitationGap {
  return {
    id: overrides.id ?? `gap-${question.length}-${question.slice(0, 8)}`,
    specId,
    refersTo: overrides.refersTo ?? 'goal',
    question,
    rationale: 'fixture',
    basis: 'explicit',
    band: overrides.band ?? 'grounding',
    predicate: { kind: 'presence', nodeKind: overrides.refersTo ?? 'goal' },
    importance: overrides.importance ?? 1,
    coverage: overrides.coverage ?? 0,
    answered: overrides.answered ?? false,
    disposition: overrides.disposition ?? 'open',
    createdAtLsn: overrides.createdAtLsn ?? 1,
  } as ElicitationGap;
}

describe('composeContextSeedContent', () => {
  it('renders the full graph overview (codes, titles, edges) and the top-ranked open gaps', () => {
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
      gaps: [
        gap('What is the primary goal?', { importance: 5 }),
        gap('Who are the users?', { importance: 3 }),
      ],
      workspaceContext: 'Workspace overview\n- specs: 1',
    });

    expect(content).toContain('Issue tracker');
    expect(content).toContain('LSN 9');
    // Full overview — the same render read_graph emits: node codes + titles + edges,
    // never a counts-only summary (D78-L revised: first question needs no tool call).
    expect(content).toContain('[G1]');
    expect(content).toContain('"Ship tracker"');
    expect(content).toContain('[REQ1]');
    expect(content).toContain('—[dependency]→');
    // Ranked order: higher importance first within the same band.
    expect(content.indexOf('What is the primary goal?')).toBeLessThan(content.indexOf('Who are the users?'));
  });

  it('places the workspace overview section ahead of the graph section', () => {
    const content = composeContextSeedContent({
      specId,
      specName: 'Issue tracker',
      slice: { nodes: [], edges: [], lsn: 1 },
      gaps: [],
      workspaceContext: 'Workspace overview\n- specs: 2\n- sessions: 1',
    });
    expect(content).toContain('Workspace overview');
    // Workspace section precedes the graph section.
    expect(content.indexOf('Workspace overview')).toBeLessThan(content.indexOf('Graph'));
  });

  it('caps the gap framing at the top five and excludes ineligible gaps', () => {
    const gaps = [
      gap('Answered question', { answered: true }),
      gap('Dismissed question', { disposition: 'irrelevant' }),
      ...Array.from({ length: 7 }, (_, index) =>
        gap(`Open question ${index + 1}?`, { importance: 7 - index }),
      ),
    ];
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 1 },
      gaps,
      workspaceContext: '',
    });

    expect(content).not.toContain('Answered question');
    expect(content).not.toContain('Dismissed question');
    expect(content).toContain('Open question 1?');
    expect(content).toContain('Open question 5?');
    expect(content).not.toContain('Open question 6?');
  });

  it('renders an honest empty state for a fresh spec with no graph and no gaps', () => {
    const content = composeContextSeedContent({
      specId,
      slice: { nodes: [], edges: [], lsn: 0 },
      gaps: [],
      workspaceContext: '',
    });

    expect(content).toContain('empty');
    expect(content).not.toContain('undefined');
  });
});
