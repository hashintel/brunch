import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { GENERATED_ONTOLOGY_PATH, renderOntologyReference } from '../generate-ontology-ref.js';
import { NODE_KINDS } from '../kinds.js';
import { bandsForKind } from '../nodes.js';

describe('ontology reference generator', () => {
  const markdown = renderOntologyReference();
  const rows = markdown.split('\n').filter((line) => line.startsWith('| '));

  it('lists every node kind with its exact bands from the typed source', () => {
    for (const kind of NODE_KINDS) {
      const bands = bandsForKind(kind);
      const expected = bands.length > 0 ? bands.join(', ') : '—';
      const row = rows.find((line) => line.startsWith(`| ${kind} |`));
      expect(row, `row for kind ${kind}`).toBeDefined();
      expect(row).toContain(expected);
    }
  });

  it('keeps the committed generated file in sync with the typed source (drift guard)', () => {
    const committed = readFileSync(GENERATED_ONTOLOGY_PATH, 'utf8');
    expect(committed).toBe(markdown);
  });
});
