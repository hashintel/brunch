import { expect, test } from 'vitest';

import {
  inlineCode,
  joinMarkdownBlocks,
  markdownBlockquote,
  markdownBullet,
  markdownCodeBlock,
  markdownHeading,
  markdownOl,
  markdownTable,
  markdownTaskList,
  markdownUl,
} from '../markdown.js';

test('markdown primitives are md-pen backed while preserving current bullet output', () => {
  expect(markdownHeading(2, '  Renderer substrate  ')).toBe('## Renderer substrate');
  expect(markdownBullet('keeps graph goldens stable')).toBe('- keeps graph goldens stable');
  expect(markdownBlockquote('one\ntwo')).toBe('> one\n> two');
  expect(markdownCodeBlock('const x = 1;', 'ts')).toBe('```ts\nconst x = 1;\n```');
  expect(
    markdownTable([
      ['Name', 'Count'],
      ['Alpha', 2],
    ]),
  ).toBe('| Name | Count |\n| - | - |\n| Alpha | 2 |');
  expect(markdownUl(['alpha', 'beta'])).toBe('- alpha\n- beta');
  expect(inlineCode('a `tick`')).toBe('`` a `tick` ``');
  expect(joinMarkdownBlocks(' A ', false, undefined, 'B')).toBe('A\n\nB');
});

test('list helpers keep multiline markdown inside the owning list item', () => {
  expect(markdownOl(['Model-facing **alpha**\n1. still same item', 'Beta*'])).toBe(
    '1. Model-facing **alpha**\n   1. still same item\n2. Beta*',
  );
  expect(markdownTaskList([[true, 'Other: `code`\n- still same item']])).toBe(
    '- [x] Other: `code`\n  - still same item',
  );
});
