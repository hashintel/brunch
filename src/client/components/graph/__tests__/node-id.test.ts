import { describe, expect, it } from 'vitest';

import { encodeNodeId, parseNodeId } from '@/client/components/graph/nodeId';

describe('node id codec', () => {
  it('encodes kind + numeric id into a single string', () => {
    expect(encodeNodeId('requirement', 7)).toBe('requirement:7');
  });

  it('round-trips encode → parse', () => {
    const parsed = parseNodeId(encodeNodeId('goal', 42));
    expect(parsed).toEqual({ kind: 'goal', id: 42 });
  });

  it('parses the numeric id back out', () => {
    expect(parseNodeId('criterion:3').id).toBe(3);
  });
});
