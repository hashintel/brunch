/**
 * Edge-category coverage for the projected neighborhood renderer.
 *
 * Uses the synthetic `edge-spread/hub-neighborhood` fixture: one requirement
 * anchor wired to naturally-typed neighbors across every relation direction,
 * both proof/support stances, the three realization refinements, hard vs soft
 * impact, a lateral association, and (at hops=2) an ambient edge among
 * neighbors. This locks the integrated render; the per-cell label/direction
 * matrix is covered by the projection unit tests.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

import { readGraphSliceFixture, readNodeNeighborhoodFixture } from './fixture-reads.test-support.js';
import { formatGraphSlice } from './graph-slice.js';
import { formatNeighborhood } from './node-neighborhood.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '__previews__');
const HOPS1_PATH = resolve(PREVIEWS_DIR, 'neighborhood-hub-REQ1.md');
const HOPS2_PATH = resolve(PREVIEWS_DIR, 'neighborhood-hub-REQ1-hops2.md');
const SLICE_DEBUG_PATH = resolve(PREVIEWS_DIR, 'graph-slice-category-directions-full-debug.md');

const HUB = { set: 'edge-spread', fixture: 'hub-neighborhood', anchorCode: 'REQ1' } as const;

test('projects every edge category from a single anchor with semantic + directional grouping', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture(HUB), { maxEdges: 20 });
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(HOPS1_PATH);

  // No raw structural vocabulary leaks into context.
  expect(rendered).not.toContain('-[');
  expect(rendered).not.toContain('(dependency)');
  expect(rendered).not.toContain('#');

  // Section grouping by the reconciliation-impact axis.
  expect(rendered).toContain('upstream (review anchor if these change):');
  expect(rendered).toContain('downstream (reconcile if anchor changes):');
  expect(rendered).toContain('lateral (related):');

  // Upstream labels (anchor sits at the downstream end).
  expect(rendered).toContain('depends on [A1] intent/assumption:');
  expect(rendered).toContain('expresses [INV1] intent/invariant:'); // realization refine invariant→requirement
  expect(rendered).toContain('bounded by [CON1] intent/constraint:');

  // Downstream labels with hard/soft strength tags.
  expect(rendered).toContain('required by [D1] intent/decision:');
  expect(rendered).toMatch(/required by \[D1\][^\n]*\{hard\}/);
  expect(rendered).toContain('implemented by [MOD1] design/module:'); // refine requirement→module
  expect(rendered).toContain('established by [S1] plan/slice:'); // refine requirement→slice
  expect(rendered).toMatch(/implemented by \[MOD1\][^\n]*\{soft\}/);

  // Stance-bearing labels.
  expect(rendered).toContain('witnessed by [AC1] intent/criterion:');
  expect(rendered).toContain('challenged by [EX1] intent/example:');
  expect(rendered).toContain('motivated by [CTX1] intent/context:');
  expect(rendered).toContain('opposed by [CTX2] intent/context:');

  // Whole/part and supersession lineage.
  expect(rendered).toContain('part of [F1] plan/frontier:');
  expect(rendered).toContain('superseded by [REQ2] intent/requirement:');

  // Lateral.
  expect(rendered).toContain('related to [G1] intent/goal:');
});

test('counts ambient edges among neighbors that are not incident on the anchor', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture({ ...HUB, hops: 2 }), {
    maxEdges: 30,
  });
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(HOPS2_PATH);

  // The assumption↔constraint association does not touch REQ1.
  expect(rendered).toContain('edge(s) among neighbors, not incident on anchor');
});

test('renders anchorless full-debug edges flat across every category, no role tokens', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({ set: 'edge-spread', fixture: 'category-directions' }),
    {
      heading: 'Selected-spec graph: edge-spread/category-directions',
      variant: 'full-debug',
      maxEdges: 20,
      maxNodes: 40,
    },
  );
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(SLICE_DEBUG_PATH);

  // Anchorless slice keeps the flat arrow form; perspective-relative
  // projection (labels/direction) applies only to anchored neighborhoods.
  expect(rendered).toContain('-[dependency]->');
  expect(rendered).toContain('-[proof/against]->');
  expect(rendered).not.toContain('(dependency)');
  expect(rendered).not.toContain('(dependent)');
});
