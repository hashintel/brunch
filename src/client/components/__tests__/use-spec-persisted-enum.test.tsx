// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  specPersistedEnumStorageKey,
  useSpecPersistedEnum,
  type SpecPersistedEnumConfig,
} from '../use-spec-persisted-enum.js';

type Sample = 'a' | 'b' | 'c';

const SAMPLE_CONFIG: SpecPersistedEnumConfig<Sample> = {
  slug: 'sample',
  fallback: 'a',
  decode: (raw) => (raw === 'a' || raw === 'b' || raw === 'c' ? raw : null),
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('useSpecPersistedEnum', () => {
  it('builds the per-spec key as brunch:<slug>:<specificationId>', () => {
    expect(specPersistedEnumStorageKey('sample', 7)).toBe('brunch:sample:7');
    expect(specPersistedEnumStorageKey('sample', '7')).toBe('brunch:sample:7');
  });

  it('falls back when nothing is stored', () => {
    const { result } = renderHook(() => useSpecPersistedEnum(1, SAMPLE_CONFIG));
    expect(result.current[0]).toBe('a');
  });

  it('reads the persisted value on mount', () => {
    window.localStorage.setItem(specPersistedEnumStorageKey('sample', 1), 'b');
    const { result } = renderHook(() => useSpecPersistedEnum(1, SAMPLE_CONFIG));
    expect(result.current[0]).toBe('b');
  });

  it('falls back when the stored value is not a valid member', () => {
    window.localStorage.setItem(specPersistedEnumStorageKey('sample', 1), 'garbage');
    const { result } = renderHook(() => useSpecPersistedEnum(1, SAMPLE_CONFIG));
    expect(result.current[0]).toBe('a');
  });

  it('persists on set and the value round-trips to a fresh mount', () => {
    const { result, unmount } = renderHook(() => useSpecPersistedEnum(1, SAMPLE_CONFIG));
    act(() => result.current[1]('c'));
    expect(result.current[0]).toBe('c');
    expect(window.localStorage.getItem(specPersistedEnumStorageKey('sample', 1))).toBe('c');
    unmount();

    const { result: next } = renderHook(() => useSpecPersistedEnum(1, SAMPLE_CONFIG));
    expect(next.current[0]).toBe('c');
  });

  it('rehydrates from the new slot when specificationId changes', () => {
    window.localStorage.setItem(specPersistedEnumStorageKey('sample', 1), 'b');
    window.localStorage.setItem(specPersistedEnumStorageKey('sample', 2), 'c');
    const { result, rerender } = renderHook(({ id }) => useSpecPersistedEnum(id, SAMPLE_CONFIG), {
      initialProps: { id: 1 },
    });
    expect(result.current[0]).toBe('b');
    rerender({ id: 2 });
    expect(result.current[0]).toBe('c');
  });
});
