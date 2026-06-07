import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

import { renderNeighborhoodPreview } from '../../graph/render-preview.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '__previews__');
const GOLDEN_PATH = resolve(PREVIEWS_DIR, 'neighborhood-code-health-R1.md');

test('locks graph neighborhood preview for code-health R1 and preserves projected invariants', async () => {
  const rendered = renderNeighborhoodPreview({
    set: 'bilal-port',
    fixture: 'code-health',
    anchorCode: 'R1',
  });
  const locked = rendered.endsWith('\n') ? rendered : `${rendered}\n`;

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(locked).toMatchFileSnapshot(GOLDEN_PATH);
  expect(rendered).toContain('anchor: [R1] intent/requirement:');
  expect(rendered).not.toContain('#');
  expect(rendered).toContain('R1 -[dependency]-> D11');
});
