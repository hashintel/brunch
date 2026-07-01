import { describe, expect, it } from 'vitest';

import { parseWheelEvent } from '../mouse-wheel.js';

describe('parseWheelEvent', () => {
  it('recognizes SGR wheel down and wheel up events', () => {
    expect(parseWheelEvent('\x1b[<65;10;5M')).toBe('down');
    expect(parseWheelEvent('\x1b[<64;10;5M')).toBe('up');
  });

  it('ignores non-wheel SGR mouse events', () => {
    expect(parseWheelEvent('\x1b[<0;10;5M')).toBeUndefined();
    expect(parseWheelEvent('\x1b[<96;10;5M')).toBeUndefined();
    expect(parseWheelEvent('\x1b[<66;10;5M')).toBeUndefined();
  });

  it('ignores mouse release and non-mouse input', () => {
    expect(parseWheelEvent('\x1b[<65;10;5m')).toBeUndefined();
    expect(parseWheelEvent('\x1b[B')).toBeUndefined();
    expect(parseWheelEvent('plain')).toBeUndefined();
  });
});
