import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

import { readGraphSliceFixture } from './fixture-reads.test-support.js';
import { formatGraphSlice } from './graph-slice.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '__previews__');
const SMALL_COMPACT_PATH = resolve(PREVIEWS_DIR, 'graph-slice-alpha-grounding-compact-summary.md');
const LARGE_COMPACT_PATH = resolve(PREVIEWS_DIR, 'graph-slice-code-health-compact-summary.md');
const LARGE_GROUPED_PATH = resolve(PREVIEWS_DIR, 'graph-slice-code-health-grouped-list.md');

test('locks compact GraphSlice summary for a small graph', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({
      set: 'workspace-spread',
      fixture: 'alpha-grounding',
    }),
    { heading: 'Selected-spec graph: workspace-spread/alpha-grounding' },
  );
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(SMALL_COMPACT_PATH);
  expect(rendered).toContain('totals: 4 node(s), 2 edge(s)');
  expect(rendered).toContain('intent/goal: 1');
  expect(rendered).toContain('[G1] intent/goal: Help a user orient inside one workspace');
});

test('keeps compact GraphSlice summary bounded for a large graph', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({
      set: 'bilal-port',
      fixture: 'code-health',
    }),
    { heading: 'Selected-spec graph: bilal-port/code-health' },
  );
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(LARGE_COMPACT_PATH);
  expect(rendered).toContain('totals: 277 node(s), 446 edge(s)');
  expect(rendered).toContain('oracle/evidence: 38');
  expect(rendered).toContain('dependency: 333');
  expect(rendered).toContain('…269 more node(s) omitted');
  expect(rendered.split('\n').length).toBeLessThan(40);
});

test('locks grouped GraphSlice list as capped per-kind output', async () => {
  const rendered = formatGraphSlice(
    readGraphSliceFixture({
      set: 'bilal-port',
      fixture: 'code-health',
    }),
    { heading: 'Selected-spec graph: bilal-port/code-health', variant: 'grouped-list' },
  );
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(LARGE_GROUPED_PATH);
  expect(rendered).toContain('intent/context (84):');
  expect(rendered).toContain('…81 more node(s) omitted');
  expect(rendered).toContain('oracle/evidence (38):');
  expect(rendered.split('\n').length).toBeLessThan(60);
});
