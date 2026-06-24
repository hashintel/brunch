// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useGraphLayoutMode } from '@/client/components/graph/graphLayoutMode';

beforeEach(() => globalThis.localStorage.clear());
afterEach(() => globalThis.localStorage.clear());

describe('useGraphLayoutMode', () => {
  it('defaults to force when nothing is saved', () => {
    const { result } = renderHook(() => useGraphLayoutMode('spec-1'));
    expect(result.current[0]).toBe('force');
  });

  it('persists the selected mode and restores it on remount', () => {
    const first = renderHook(() => useGraphLayoutMode('spec-1'));
    act(() => first.result.current[1]('workflow'));
    expect(first.result.current[0]).toBe('workflow');
    first.unmount();

    const { result } = renderHook(() => useGraphLayoutMode('spec-1'));
    expect(result.current[0]).toBe('workflow');
  });

  it('keeps the selected mode separate per graph scope', () => {
    const one = renderHook(() => useGraphLayoutMode('spec-1'));
    act(() => one.result.current[1]('free'));

    const { result } = renderHook(() => useGraphLayoutMode('spec-2'));
    expect(result.current[0]).toBe('force');
  });

  it('falls back to force when the stored value is not a valid mode', () => {
    globalThis.localStorage.setItem('brunch:graph-layout-mode:spec-1', 'spiral');
    const { result } = renderHook(() => useGraphLayoutMode('spec-1'));
    expect(result.current[0]).toBe('force');
  });

  it('restores each graph’s own mode when the scope changes without a remount', () => {
    globalThis.localStorage.setItem('brunch:graph-layout-mode:spec-2', 'free');
    const { result, rerender } = renderHook(({ scope }) => useGraphLayoutMode(scope), {
      initialProps: { scope: 'spec-1' },
    });
    expect(result.current[0]).toBe('force');

    rerender({ scope: 'spec-2' });
    expect(result.current[0]).toBe('free');
  });
});
