/**
 * node-neighborhood render coverage. Each case renders a fixture through
 * `formatNeighborhood` and locks the full output as a markdown preview under the
 * sibling `__snapshots__/`. The locked file IS the assertion: review the diff
 * when output changes, accept with `--update`.
 *
 * The one cross-cutting invariant kept inline is that anchored projections never
 * leak raw structural vocabulary (category arrows, endpoint role tokens,
 * internal numeric ids) into context — a careless snapshot update must not
 * quietly reintroduce leakage. Positive "looks like X" checks live in the
 * snapshot.
 */

import { expect, test } from 'vitest';

import { readNodeNeighborhoodFixture } from '../../../../../graph/__tests__/support/fixture-reads.js';
import { formatNeighborhood } from '../node-neighborhood.js';

function expectNoStructuralLeak(rendered: string): void {
  expect(rendered).not.toContain('-['); // raw "A -[category]-> B" arrows
  expect(rendered).not.toContain('(dependency)'); // endpoint role tokens
  expect(rendered).not.toContain('(dependent)');
  expect(rendered).not.toContain('#'); // internal numeric ids
  expect(rendered).not.toContain('{soft}'); // advisory is the default and stays unmarked
  expect(rendered).not.toContain('[Selected-spec node context]'); // old bracket header dialect
}

const HUB = { name: 'edge-hub-neighborhood', variant: 'base', anchorCode: 'REQ1' } as const;
const SELF = { name: 'brunch-self', variant: 'base' } as const;

test('neighborhood: real-port anchor (code-health REQ1)', async () => {
  const rendered = formatNeighborhood(
    readNodeNeighborhoodFixture({ name: 'bilal-code-health', variant: 'base', anchorCode: 'REQ1' }),
  );
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/neighborhood-code-health-REQ1.md');
  expectNoStructuralLeak(rendered);
});

test('neighborhood: every edge category projected from one anchor (hub REQ1)', async () => {
  // The hub fixture wires REQ1 to naturally-typed neighbors across every
  // relation direction, both proof/support stances, the three realization
  // refinements, hard vs soft impact, and a lateral association. The snapshot
  // is the full label + directional-grouping matrix; the per-cell mapping is
  // proven by the projection unit tests.
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture(HUB), { maxExpandedEdges: 20 });
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/neighborhood-hub-REQ1.md');
  expectNoStructuralLeak(rendered);
});

test('neighborhood: hops=2 collapses ambient edges to a count (hub REQ1)', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture({ ...HUB, hops: 2 }), {
    maxExpandedEdges: 30,
  });
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/neighborhood-hub-REQ1-hops2.md');
  expectNoStructuralLeak(rendered);
});

test('neighborhood: maxExpandedEdges compacts oversized sections without omissions (hub REQ1)', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture(HUB), { maxExpandedEdges: 3 });
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/neighborhood-hub-REQ1-compact.md');
  expect(rendered).not.toContain('omitted');
  expectNoStructuralLeak(rendered);
});

test('brunch-self: requirement anchor neighborhood (REQ1 one-authority)', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture({ ...SELF, anchorCode: 'REQ1' }), {
    maxExpandedEdges: 20,
  });
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/neighborhood-brunch-self-REQ1.md');
  expectNoStructuralLeak(rendered);
});

test('brunch-self: module anchor neighborhood (MOD1 CommandExecutor)', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture({ ...SELF, anchorCode: 'MOD1', hops: 2 }), {
    maxExpandedEdges: 20,
  });
  await expect(rendered).toMatchFileSnapshot('../__snapshots__/neighborhood-brunch-self-MOD1-hops2.md');
  expectNoStructuralLeak(rendered);
});

test('neighborhood: missing anchor renders a clear miss', () => {
  expect(formatNeighborhood({ selector: { id: 404 }, status: 'not_found', related: [], edges: [] })).toBe(
    'Node not found in selected spec.',
  );
});
