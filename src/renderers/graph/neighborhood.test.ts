import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

import { renderNeighborhoodPreview } from '../../graph/render-preview.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_DIR = resolve(HERE, '__previews__');
const GOLDEN_PATH = resolve(PREVIEWS_DIR, 'neighborhood-code-health-R1.md');

expect.extend({
  toMatchFileSnapshot(received: string, filePath: string) {
    const expected = readFileSync(filePath, 'utf8').replace(/\n$/, '');
    const normalizedReceived = received.replace(/\n$/, '');
    const pass = normalizedReceived === expected;

    return {
      pass,
      actual: normalizedReceived,
      expected,
      message: () =>
        pass
          ? `expected rendered output not to match file snapshot ${filePath}`
          : `expected rendered output to match file snapshot ${filePath}`,
    };
  },
});

test('locks graph neighborhood preview for code-health R1 and preserves projected invariants', async () => {
  const rendered = renderNeighborhoodPreview({
    set: 'bilal-port',
    fixture: 'code-health',
    anchorCode: 'R1',
  });

  mkdirSync(PREVIEWS_DIR, { recursive: true });
  await expect(rendered).toMatchFileSnapshot(GOLDEN_PATH);
  expect(rendered).toContain('anchor: [R1] intent/requirement:');
  expect(rendered).not.toContain('#');
  expect(rendered).toContain('R1 -[dependency]-> D11');
});
