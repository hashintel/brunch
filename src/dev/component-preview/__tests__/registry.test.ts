import { describe, expect, it } from 'vitest';

import { COMPONENT_PREVIEW_REGISTRY } from '../registry.js';

describe('component preview registry', () => {
  it('covers the deterministic orientation availability matrix', () => {
    expect(
      COMPONENT_PREVIEW_REGISTRY.filter(({ id }) => id.startsWith('orientation-')).map(({ id }) => id),
    ).toEqual([
      'orientation-specify-current',
      'orientation-specify-move',
      'orientation-execute-fallback',
      'orientation-execute-full',
    ]);
  });
});
