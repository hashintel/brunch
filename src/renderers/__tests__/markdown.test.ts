import { expect, test } from 'vitest';

import {
  inlineCode,
  joinMarkdownBlocks,
  markdownBlockquote,
  markdownBullet,
  markdownCodeBlock,
  markdownEscape,
  markdownHeading,
  markdownTable,
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
  expect(markdownEscape('**not bold**')).toBe('\\*\\*not bold\\*\\*');
  expect(joinMarkdownBlocks(' A ', false, undefined, 'B')).toBe('A\n\nB');
});
