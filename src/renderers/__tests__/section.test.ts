import { expect, test } from 'vitest';

import { section } from '../section.js';

test('section wraps content with the house newline convention', () => {
  expect(section('workspace', '\nProject: Brunch\n')).toBe('<workspace>\nProject: Brunch\n</workspace>');
});
