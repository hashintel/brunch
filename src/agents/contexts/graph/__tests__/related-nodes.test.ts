import { expect, test } from 'vitest';

import { readNodeNeighborhoodFixture } from '../../../../graph/__tests__/support/fixture-reads.js';
import { formatRelatedNodesResult } from '../related-nodes.js';

function expectNoStructuralLeak(rendered: string): void {
  expect(rendered).not.toContain('-[');
  expect(rendered).not.toMatch(/\bdependency\b|\bwitness\b|\brationale\b|\brealization\b/);
  expect(rendered).not.toMatch(/\bincoming\b|\boutgoing\b/);
  expect(rendered).not.toContain('#');
  expect(rendered).not.toContain('intent/');
  expect(rendered).not.toContain('oracle/');
  expect(rendered).not.toContain('design/');
  expect(rendered).not.toContain('plan/');
}

test('related nodes uses semantic relation labels instead of raw graph internals', async () => {
  const rendered = formatRelatedNodesResult({
    status: 'success',
    anchors: [
      readNodeNeighborhoodFixture({ name: 'edge-hub-neighborhood', variant: 'base', anchorCode: 'REQ1' }),
    ],
  });

  await expect(rendered).toMatchFileSnapshot('../__snapshots__/related-hub-REQ1.md');
  expectNoStructuralLeak(rendered);
});

test('related nodes missing anchors renders a clear miss', () => {
  expect(formatRelatedNodesResult({ status: 'not_found' })).toBe(
    'One or more anchor nodes were not found in the selected spec.',
  );
});
