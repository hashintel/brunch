/**
 * Graph renderer previews — the single home for graph context-render coverage.
 *
 * Each case renders a fixture through a graph renderer and locks the full
 * output as a markdown preview under `__previews__/`. The locked file IS the
 * assertion: review the diff when output changes, accept with `--update`.
 *
 * The only inline assertions kept are cross-cutting *contract invariants* that
 * a careless snapshot update could silently hide:
 *  - anchored neighborhood projections never leak raw structural vocabulary
 *    (category arrows, endpoint role tokens, internal numeric ids) into context;
 *  - large-graph slices stay bounded regardless of graph size.
 * Positive "the output looks like X" checks live in the snapshot, not here.
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

async function lockPreview(fileName: string, rendered: string): Promise<void> {
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;
  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(resolve(PREVIEWS_DIR, fileName));
}

/**
 * Anchored projections must read in plain language — never the raw structural
 * vocabulary that lives in storage. This guard runs on every neighborhood
 * render so a snapshot update can't quietly reintroduce leakage.
 */
function expectNoStructuralLeak(rendered: string): void {
  expect(rendered).not.toContain('-['); // raw "A -[category]-> B" arrows
  expect(rendered).not.toContain('(dependency)'); // endpoint role tokens
  expect(rendered).not.toContain('(dependent)');
  expect(rendered).not.toContain('#'); // internal numeric ids
}

// ── GraphSlice (anchorless, whole-spec) ──────────────────────────────────────

test('graph-slice: compact summary for a small graph', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({ set: 'workspace-spread', fixture: 'alpha-grounding' }),
    { heading: 'Selected-spec graph: workspace-spread/alpha-grounding' },
  );
  await lockPreview('graph-slice-alpha-grounding-compact-summary.md', rendered);
});

test('graph-slice: compact summary stays bounded for a large graph', async () => {
  const rendered = formatGraphSlice(readGraphSliceFixture({ set: 'bilal-port', fixture: 'code-health' }), {
    heading: 'Selected-spec graph: bilal-port/code-health',
  });
  await lockPreview('graph-slice-code-health-compact-summary.md', rendered);
  expect(rendered.split('\n').length).toBeLessThan(40);
});

test('graph-slice: grouped list is capped per kind', async () => {
  const rendered = formatGraphSlice(readGraphSliceFixture({ set: 'bilal-port', fixture: 'code-health' }), {
    heading: 'Selected-spec graph: bilal-port/code-health',
    variant: 'grouped-list',
  });
  await lockPreview('graph-slice-code-health-grouped-list.md', rendered);
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
  await lockPreview('graph-slice-category-directions-full-debug.md', rendered);
  // The debug view deliberately keeps the flat arrow form; perspective-relative
  // projection applies only to anchored neighborhoods. Role tokens stay out
  // even here (guards the reverted inline-role-token regression).
  expect(rendered).toContain('-[');
  expect(rendered).not.toContain('(dependency)');
  expect(rendered).not.toContain('(dependent)');
});

// ── Neighborhood (anchored, perspective-relative projection) ──────────────────

test('neighborhood: real-port anchor (code-health REQ1)', async () => {
  const rendered = formatNeighborhood(
    readNodeNeighborhoodFixture({ set: 'bilal-port', fixture: 'code-health', anchorCode: 'REQ1' }),
  );
  await lockPreview('neighborhood-code-health-REQ1.md', rendered);
  expectNoStructuralLeak(rendered);
});

const HUB = { set: 'edge-spread', fixture: 'hub-neighborhood', anchorCode: 'REQ1' } as const;

test('neighborhood: every edge category projected from one anchor (hub REQ1)', async () => {
  // The hub fixture wires REQ1 to naturally-typed neighbors across every
  // relation direction, both proof/support stances, the three realization
  // refinements, hard vs soft impact, and a lateral association. The snapshot
  // is the full label + directional-grouping matrix; the per-cell mapping is
  // proven by the projection unit tests.
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture(HUB), { maxEdges: 20 });
  await lockPreview('neighborhood-hub-REQ1.md', rendered);
  expectNoStructuralLeak(rendered);
});

test('neighborhood: hops=2 collapses ambient edges to a count (hub REQ1)', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture({ ...HUB, hops: 2 }), {
    maxEdges: 30,
  });
  await lockPreview('neighborhood-hub-REQ1-hops2.md', rendered);
  expectNoStructuralLeak(rendered);
});

test('neighborhood: maxEdges bounds output and notes omissions (hub REQ1)', async () => {
  const rendered = formatNeighborhood(readNodeNeighborhoodFixture(HUB), { maxEdges: 1 });
  await lockPreview('neighborhood-hub-REQ1-bounded.md', rendered);
  expectNoStructuralLeak(rendered);
});

test('neighborhood: missing anchor renders a clear miss', () => {
  expect(formatNeighborhood({ selector: { id: 404 }, status: 'not_found', related: [], edges: [] })).toBe(
    '[Selected-spec node context]\n- node: not found in selected spec',
  );
});
