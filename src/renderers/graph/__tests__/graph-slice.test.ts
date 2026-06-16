/**
 * graph-slice render coverage. Each case renders a fixture through
 * `formatGraphSlice` and locks the full output as a markdown preview under the
 * sibling `__previews__/`. The locked file IS the assertion: review the diff
 * when output changes, accept with `--update`.
 *
 * Inline assertions stay limited to cross-cutting contract invariants a
 * careless snapshot update could hide (bounded output; the debug view keeps raw
 * arrows but never endpoint role tokens). Positive "looks like X" checks live in
 * the snapshot.
 */

import { expect, test } from 'vitest';

import { readGraphSliceFixture } from '../../../graph/__tests__/support/fixture-reads.js';
import { formatGraphSlice } from '../graph-slice.js';

test('graph-slice: compact summary for a small graph', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({ set: 'workspace-spread', fixture: 'alpha-grounding' }),
    { heading: 'Selected-spec graph: workspace-spread/alpha-grounding' },
  );
  await expect(rendered).toMatchFileSnapshot(
    '../__previews__/graph-slice-alpha-grounding-compact-summary.md',
  );
});

test('graph-slice: compact summary stays bounded for a large graph', async () => {
  const rendered = formatGraphSlice(readGraphSliceFixture({ set: 'bilal-port', fixture: 'code-health' }), {
    heading: 'Selected-spec graph: bilal-port/code-health',
  });
  await expect(rendered).toMatchFileSnapshot('../__previews__/graph-slice-code-health-compact-summary.md');
  expect(rendered.split('\n').length).toBeLessThan(40);
});

test('graph-slice: grouped list is capped per kind', async () => {
  const rendered = formatGraphSlice(readGraphSliceFixture({ set: 'bilal-port', fixture: 'code-health' }), {
    heading: 'Selected-spec graph: bilal-port/code-health',
    variant: 'grouped-list',
  });
  await expect(rendered).toMatchFileSnapshot('../__previews__/graph-slice-code-health-grouped-list.md');
  expect(rendered.split('\n').length).toBeLessThan(60);
});

test('graph-slice: full-debug shows raw arrows by design but no role tokens', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({ set: 'edge-spread', fixture: 'category-directions' }),
    {
      heading: 'Selected-spec graph: edge-spread/category-directions',
      variant: 'full-debug',
      maxEdges: 20,
      maxNodes: 40,
    },
  );
  await expect(rendered).toMatchFileSnapshot('../__previews__/graph-slice-category-directions-full-debug.md');
  // The debug view deliberately keeps the flat arrow form; perspective-relative
  // projection applies only to anchored neighborhoods. Role tokens stay out
  // even here (guards the reverted inline-role-token regression).
  expect(rendered).toContain('-[');
  expect(rendered).not.toContain('(dependency)');
  expect(rendered).not.toContain('(dependent)');
});

// ── Faithful spec graph derived from this repo's own prose ────────────────────
// `brunch-self/spec-graph` is hand-derived from memory/SPEC.md + memory/PLAN.md.
// Seeding it here also proves structural legality: readGraphSliceFixture commits
// through the real CommandExecutor and throws on any illegal node/edge.

test('brunch-self: whole-spec grouped list across all four planes', async () => {
  const rendered = formatGraphSlice(readGraphSliceFixture({ set: 'brunch-self', fixture: 'spec-graph' }), {
    heading: 'Selected-spec graph: brunch-self (self-described)',
    variant: 'grouped-list',
    maxNodes: 60,
  });
  await expect(rendered).toMatchFileSnapshot('../__previews__/graph-slice-brunch-self-grouped-list.md');
});
