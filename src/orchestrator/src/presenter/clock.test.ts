import { describe, expect, it } from 'vitest';

import { formatElapsed } from './clock.js';

describe('formatElapsed', () => {
  it('renders whole seconds under a minute — no decimals', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(2500)).toBe('2s'); // floors, doesn't round
    expect(formatElapsed(18_600)).toBe('18s');
    expect(formatElapsed(59_900)).toBe('59s');
  });

  it('renders m:ss at and beyond a minute', () => {
    expect(formatElapsed(60_000)).toBe('1m00s');
    expect(formatElapsed(62_000)).toBe('1m02s');
    expect(formatElapsed(305_000)).toBe('5m05s');
  });

  it('clamps negatives to 0s', () => {
    expect(formatElapsed(-100)).toBe('0s');
  });
});
