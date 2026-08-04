import { describe, expect, it } from 'vitest';

import { petriMarkingsEqual, stringArraysEqual } from '../petri-state-predicates.js';

// The consolidated owner replaced four `stringArraysEqual` copies that carried two
// signatures — undefined-tolerant (reader/replay) and non-nullable (writer/lifecycle).
// The surviving predicate is the tolerant one, so these pin the tolerance semantics
// that the strict copies never had to state.
describe('stringArraysEqual', () => {
  it('compares ordered id lists element-wise', () => {
    expect(stringArraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(stringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(stringArraysEqual(['a'], ['a', 'b'])).toBe(false);
    expect(stringArraysEqual([], [])).toBe(true);
  });

  it('treats absent as equal only to absent, never to empty', () => {
    expect(stringArraysEqual(undefined, undefined)).toBe(true);
    expect(stringArraysEqual(undefined, [])).toBe(false);
    expect(stringArraysEqual([], undefined)).toBe(false);
    expect(stringArraysEqual(undefined, ['a'])).toBe(false);
  });
});

describe('petriMarkingsEqual', () => {
  it('compares place counts irrespective of key order', () => {
    expect(petriMarkingsEqual({ p1: 1, p2: 0 }, { p2: 0, p1: 1 })).toBe(true);
    expect(petriMarkingsEqual({}, {})).toBe(true);
  });

  it('rejects differing counts, extra places, and missing places', () => {
    expect(petriMarkingsEqual({ p1: 1 }, { p1: 2 })).toBe(false);
    expect(petriMarkingsEqual({ p1: 1 }, { p1: 1, p2: 1 })).toBe(false);
    expect(petriMarkingsEqual({ p1: 1, p2: 1 }, { p1: 1 })).toBe(false);
  });

  // A place present with count 0 is not the same marking as an absent place:
  // same-cardinality markings still compare their key sets through the count lookup.
  it('does not conflate a zero-count place with an absent place', () => {
    expect(petriMarkingsEqual({ p1: 0 }, { p2: 0 })).toBe(false);
  });
});
