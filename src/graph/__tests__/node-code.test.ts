import { describe, expect, it } from 'vitest';

import { formatGraphNodeCode, type NodeKind } from '../schema/nodes.js';

describe('formatGraphNodeCode', () => {
  it('formats a known kind as label + ordinal', () => {
    expect(formatGraphNodeCode('goal', 3)).toMatch(/^[A-Z]+3$/);
  });

  it('fails loudly with the reseed remedy for a persisted out-of-enum kind', () => {
    // Persisted rows can carry kinds retired from the schema (e.g. `slice`,
    // dropped by D103-L). No migration bridge under prototype posture — the
    // contract is a descriptive error, not a raw TypeError.
    expect(() => formatGraphNodeCode('slice' as NodeKind, 1)).toThrow(
      /unknown graph node kind "slice".*reseed/i,
    );
  });
});
