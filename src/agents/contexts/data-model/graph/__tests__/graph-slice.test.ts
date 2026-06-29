import { expect, test } from 'vitest';

import { readGraphSliceFixture } from '../../../../../graph/__tests__/support/fixture-reads.js';
import type { GraphSlice } from '../../../../../graph/index.js';
import { formatGraphOverview } from '../graph-slice.js';

const slice: GraphSlice = {
  lsn: 12,
  nodes: [
    node({ id: 4, kind: 'requirement', kindOrdinal: 1, title: 'Render stable graph-node codes' }),
    node({ id: 3, kind: 'criterion', kindOrdinal: 1, title: 'Golden diff is reviewable' }),
    node({ id: 2, kind: 'constraint', kindOrdinal: 1, title: 'No cloud dependency' }),
    node({ id: 1, kind: 'goal', kindOrdinal: 1, title: 'Ship offline-first sync' }),
    node({ id: 5, plane: 'oracle', kind: 'evidence', kindOrdinal: 1, title: 'Preview file records output' }),
  ],
  edges: [
    edge({ id: 7, category: 'witness', sourceId: 5, targetId: 3, stance: 'for' }),
    edge({ id: 5, category: 'exclusion', sourceId: 2, targetId: 4 }),
  ],
};

test('overview renders G-D dual markdown tables with impact-normalized edges', () => {
  expect(formatGraphOverview(slice)).toBe(`Graph overview (LSN 12): 5 nodes, 2 edges

legend: G=goal, REQ=requirement, CON=constraint, AC=criterion, E=evidence

nodes — intent · grounding (2)
| code | id | title |
| - | - | - |
| G1 | 1 | Ship offline-first sync |
| CON1 | 2 | No cloud dependency |

nodes — intent · commitment (2)
| code | id | title |
| - | - | - |
| REQ1 | 4 | Render stable graph-node codes |
| AC1 | 3 | Golden diff is reviewable |

nodes — oracle · projection (1)
| code | id | title |
| - | - | - |
| E1 | 5 | Preview file records output |

edges (sorted by upstream)
| id | upstream | relation | downstream |
| - | - | - | - |
| 7 | AC1 | witnessed by | E1 |
| 5 | CON1 | bounds | REQ1 |`);
});

test('band-filtered render groups dual-band nodes by the requested band that admitted them', () => {
  expect(
    formatGraphOverview({ ...slice, nodes: [slice.nodes[2]!], edges: [] }, 'Graph slice by readiness band', {
      requestedReadinessBands: ['elicitation'],
    }),
  ).toContain('nodes — intent · elicitation (1)');
});

test('overview renders projection and keeps band-less nodes in a trailing bucket', () => {
  const rendered = formatGraphOverview({
    ...slice,
    nodes: [
      node({ id: 6, kind: 'example', kindOrdinal: 1, title: 'Reference example' }),
      slice.nodes[0]!,
      slice.nodes[4]!,
    ],
    edges: [],
  });

  expect(rendered).toContain('nodes — oracle · projection (1)');
  expect(rendered).toContain('nodes — intent · commitment (1)');
  expect(rendered).toContain('nodes — intent · unbanded (1)');
  expect(rendered).toContain('| EX1 | 6 | Reference example |');
});

test('band-filtered render fails loud when a node matches none of the requested bands', () => {
  expect(() =>
    formatGraphOverview({ ...slice, nodes: [slice.nodes[0]!], edges: [] }, 'Graph slice by readiness band', {
      requestedReadinessBands: ['grounding'],
    }),
  ).toThrow('Node kind requirement does not belong to requested readiness bands: grounding');
});

test('overview preserves caller heading for read_graph list modes and seed', () => {
  expect(
    formatGraphOverview(
      { ...slice, nodes: slice.nodes.slice(0, 1), edges: [] },
      'Graph slice by kind',
    ).startsWith('Graph slice by kind (LSN 12): 1 nodes, 0 edges'),
  ).toBe(true);
});

test('overview includes LSN on empty selected-spec graph', () => {
  expect(formatGraphOverview({ lsn: 3, nodes: [], edges: [] })).toBe(
    'Graph overview (LSN 3): empty (no nodes or edges).',
  );
});

test('overview: kind-coverage fixture golden stays uncapped and sectioned', async () => {
  const rendered = formatGraphOverview(
    readGraphSliceFixture({ name: 'kind-coverage-matrix', variant: 'base' }),
  );
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/graph-overview-kind-coverage-matrix.md');
  expect(rendered).toContain('Graph overview (LSN 2): 24 nodes, 7 edges');
  expect(rendered).toContain('| S1 | 24 | Lock one neighborhood preview |');
});

function node(input: {
  readonly id: number;
  readonly plane?: GraphSlice['nodes'][number]['plane'];
  readonly kind: GraphSlice['nodes'][number]['kind'];
  readonly kindOrdinal: number;
  readonly title: string;
}): GraphSlice['nodes'][number] {
  return {
    specId: 1,
    plane: input.plane ?? 'intent',
    id: input.id,
    kind: input.kind,
    kindOrdinal: input.kindOrdinal,
    title: input.title,
    basis: 'explicit',
    createdAtLsn: 1,
    updatedAtLsn: 1,
  };
}

function edge(input: {
  readonly id: number;
  readonly category: GraphSlice['edges'][number]['category'];
  readonly sourceId: number;
  readonly targetId: number;
  readonly stance?: GraphSlice['edges'][number]['stance'];
}): GraphSlice['edges'][number] {
  return {
    specId: 1,
    id: input.id,
    category: input.category,
    sourceId: input.sourceId,
    targetId: input.targetId,
    ...(input.stance ? { stance: input.stance } : {}),
    basis: 'explicit',
    createdAtLsn: 1,
    updatedAtLsn: 1,
  };
}
