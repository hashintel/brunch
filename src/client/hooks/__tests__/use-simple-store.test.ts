// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStore, useStore, useStoreState } from '../use-simple-store';

describe('useStoreState', () => {
  it('reflects external store updates and exposes the live getter/setter pair', async () => {
    const store = createStore<{ count: number; status: 'idle' | 'done' }>({ count: 0, status: 'idle' });
    const { result } = renderHook(() => useStoreState(store));

    expect(result.current[0]).toEqual({ count: 0, status: 'idle' });
    expect(result.current[2]()).toEqual({ count: 0, status: 'idle' });

    act(() => {
      store.set((state) => ({ ...state, count: state.count + 1 }));
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual({ count: 1, status: 'idle' });
    });

    act(() => {
      result.current[1]((state) => ({ ...state, status: 'done' }));
    });

    await waitFor(() => {
      expect(result.current[0]).toEqual({ count: 1, status: 'done' });
      expect(result.current[2]()).toEqual({ count: 1, status: 'done' });
    });
  });
});

describe('useStore', () => {
  it('creates a store once and keeps the same instance across rerenders', () => {
    const { result, rerender } = renderHook(({ initialCount }) => useStore({ count: initialCount }), {
      initialProps: { initialCount: 0 },
    });

    const firstStore = result.current;

    act(() => {
      firstStore.set({ count: 3 });
    });

    rerender({ initialCount: 99 });

    expect(result.current).toBe(firstStore);
    expect(result.current.get()).toEqual({ count: 3 });
    expect(result.current.getInitial()).toEqual({ count: 0 });
  });
});
