// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useGraphPositions } from '@/client/components/graph/graphPositions';

beforeEach(() => globalThis.localStorage.clear());
afterEach(() => globalThis.localStorage.clear());

describe('useGraphPositions', () => {
  it('returns no overrides for a mode with nothing saved', () => {
    const { result } = renderHook(() => useGraphPositions('spec-1'));
    expect(result.current.overridesFor('free').size).toBe(0);
  });

  it('remembers a saved position and returns it as an override', () => {
    const { result } = renderHook(() => useGraphPositions('spec-1'));
    act(() => result.current.save('free', 'node-a', { x: 120, y: -40 }));

    const overrides = result.current.overridesFor('free');
    expect(overrides.get('node-a')).toEqual({ x: 120, y: -40 });
  });

  it('keeps positions separate per mode', () => {
    const { result } = renderHook(() => useGraphPositions('spec-1'));
    act(() => result.current.save('free', 'node-a', { x: 10, y: 10 }));
    act(() => result.current.save('workflow', 'node-a', { x: 99, y: 99 }));

    expect(result.current.overridesFor('free').get('node-a')).toEqual({ x: 10, y: 10 });
    expect(result.current.overridesFor('workflow').get('node-a')).toEqual({ x: 99, y: 99 });
  });

  it('keeps positions separate per scope', () => {
    const { result: one } = renderHook(() => useGraphPositions('spec-1'));
    act(() => one.current.save('free', 'node-a', { x: 5, y: 5 }));

    const { result: two } = renderHook(() => useGraphPositions('spec-2'));
    expect(two.current.overridesFor('free').size).toBe(0);
  });

  it('survives a remount by rehydrating from storage', () => {
    const first = renderHook(() => useGraphPositions('spec-1'));
    act(() => first.result.current.save('free', 'node-a', { x: 7, y: 8 }));
    first.unmount();

    const { result } = renderHook(() => useGraphPositions('spec-1'));
    expect(result.current.overridesFor('free').get('node-a')).toEqual({ x: 7, y: 8 });
  });

  it('forgets every saved position for a mode on reset', () => {
    const { result } = renderHook(() => useGraphPositions('spec-1'));
    act(() => result.current.save('free', 'node-a', { x: 1, y: 2 }));
    act(() => result.current.reset('free'));

    expect(result.current.overridesFor('free').size).toBe(0);
  });
});
