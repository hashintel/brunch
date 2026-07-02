import { expect, test } from 'vitest';

import { joinMarkdownBlocks } from '../markdown.js';

test('joinMarkdownBlocks keeps house block-composition semantics', () => {
  expect(joinMarkdownBlocks(' A ', false, undefined, 'B')).toBe('A\n\nB');
  expect(joinMarkdownBlocks('', '  ', null, 'Kept')).toBe('Kept');
});
