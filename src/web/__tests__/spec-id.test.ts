import { describe, expect, it } from 'vitest';

import { parseSpecId, parseSpecPathname } from '../spec-id.js';

describe('parseSpecId', () => {
  it('accepts positive integers', () => {
    expect(parseSpecId('1')).toBe(1);
    expect(parseSpecId('42')).toBe(42);
  });

  it('rejects 0, leading-zero, and non-numeric tokens', () => {
    expect(parseSpecId('0')).toBeUndefined();
    expect(parseSpecId('01')).toBeUndefined();
    expect(parseSpecId('-1')).toBeUndefined();
    expect(parseSpecId('1.5')).toBeUndefined();
    expect(parseSpecId('abc')).toBeUndefined();
    expect(parseSpecId('')).toBeUndefined();
  });
});

describe('parseSpecPathname', () => {
  it('parses the id from a /spec/<id> pathname', () => {
    expect(parseSpecPathname('/spec/7')).toBe(7);
    expect(parseSpecPathname('/spec/7/')).toBe(7);
  });

  it('matches the route parser: /spec/0 is not a valid spec route', () => {
    expect(parseSpecPathname('/spec/0')).toBeUndefined();
  });

  it('returns undefined for non-spec paths', () => {
    expect(parseSpecPathname('/')).toBeUndefined();
    expect(parseSpecPathname('/spec')).toBeUndefined();
    expect(parseSpecPathname('/spec/1/extra')).toBeUndefined();
  });
});
