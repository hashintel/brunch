// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useRecordState } from './use-record-state';

describe('useRecordState', () => {
  it('initializes with the provided record and merges object patches', () => {
    const { result } = renderHook(() => useRecordState({ count: 0, status: 'idle' }));
    const [, setState] = result.current;

    expect(result.current[0]).toEqual({ count: 0, status: 'idle' });

    act(() => {
      setState({ status: 'loading' });
    });

    expect(result.current[0]).toEqual({ count: 0, status: 'loading' });
  });

  it('merges functional patches with access to the latest state', () => {
    const { result } = renderHook(() => useRecordState({ count: 0, status: 'idle' }));
    const [, setState] = result.current;

    act(() => {
      setState((state) => ({ count: state.count + 1 }));
      setState((state) => ({ count: state.count + 1 }));
    });

    expect(result.current[0]).toEqual({ count: 2, status: 'idle' });
  });

  it('preserves existing keys when partial updates omit them', () => {
    const { result } = renderHook(() => useRecordState({ count: 5, status: 'ready', message: 'hi' }));
    const [, setState] = result.current;

    act(() => {
      setState({ status: 'done' });
    });

    expect(result.current[0]).toEqual({ count: 5, status: 'done', message: 'hi' });
  });
});
