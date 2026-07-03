import { describe, expect, it } from 'vitest';

import { COMPONENT_PREVIEW_REGISTRY } from '../registry.js';

describe('component preview registry', () => {
  it('includes the present_candidates transcript render preview', () => {
    expect(COMPONENT_PREVIEW_REGISTRY.map((entry) => entry.id)).toContain('present-candidates');
  });
});
