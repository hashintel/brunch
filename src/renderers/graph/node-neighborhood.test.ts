import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

import { readNodeNeighborhoodFixture } from './fixture-reads.test-support.js';
import { formatNeighborhood } from './node-neighborhood.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '__previews__');
const GOLDEN_PATH = resolve(PREVIEWS_DIR, 'neighborhood-code-health-REQ1.md');

test('locks graph neighborhood preview for code-health REQ1 and preserves projected invariants', async () => {
  const rendered = formatNeighborhood(
    readNodeNeighborhoodFixture({
      set: 'bilal-port',
      fixture: 'code-health',
      anchorCode: 'REQ1',
    }),
  );
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(GOLDEN_PATH);
  expect(rendered).toContain('anchor: [REQ1] intent/requirement:');
  expect(rendered).not.toContain('#');
  // REQ1 is the dependency (source) of dependency edges → neighbors are
  // downstream and labelled from REQ1's perspective, no raw role tokens.
  expect(rendered).toContain('downstream (reconcile if anchor changes):');
  expect(rendered).toContain('required by [D11] intent/decision:');
  expect(rendered).not.toContain('-[dependency]->');
});
