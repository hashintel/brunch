import { expect, test } from 'vitest';

import { renderToonBlock, renderToonRecords } from '../toon.js';

test('TOON wrapper encodes uniform records and fences them for LLM context', () => {
  const rows = [
    { id: 'S1', title: 'Alpha', nodes: 2 },
    { id: 'S2', title: 'Beta', nodes: 0 },
  ];

  expect(renderToonRecords(rows)).toBe('[2]{id,title,nodes}:\n  S1,Alpha,2\n  S2,Beta,0');
  expect(renderToonBlock(rows)).toBe('```toon\n[2]{id,title,nodes}:\n  S1,Alpha,2\n  S2,Beta,0\n```');
});
