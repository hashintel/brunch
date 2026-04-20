// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useStringStateMachine } from '../use-string-state-machine';

describe('useStringStateMachine', () => {
  const trafficMachine = {
    red: { timer: 'green' },
    green: { timer: 'yellow', emergency: 'red' },
    yellow: { timer: 'red' },
  } as const;

  it('transitions between states using configured events', () => {
    const { result } = renderHook(() => useStringStateMachine(trafficMachine, 'red'));
    const [, dispatch] = result.current;

    act(() => {
      dispatch('timer');
    });
    expect(result.current[0]).toBe('green');

    act(() => {
      dispatch('timer');
    });
    expect(result.current[0]).toBe('yellow');

    act(() => {
      dispatch('timer');
    });
    expect(result.current[0]).toBe('red');
  });

  it('honors state-specific events', () => {
    const { result } = renderHook(() => useStringStateMachine(trafficMachine, 'green'));
    const [, dispatch] = result.current;

    act(() => {
      dispatch('emergency');
    });
    expect(result.current[0]).toBe('red');

    act(() => {
      dispatch('timer');
    });
    expect(result.current[0]).toBe('green');
  });

  it('falls back to the current state for unmapped events', () => {
    const mutableMachine: Record<string, Record<string, string>> = {
      idle: { start: 'running' },
      running: { stop: 'idle' },
    };

    const { result } = renderHook(() => useStringStateMachine(mutableMachine, 'idle'));
    const [, dispatch] = result.current;

    act(() => {
      dispatch('start');
    });
    expect(result.current[0]).toBe('running');

    delete mutableMachine.running?.stop;

    act(() => {
      dispatch('stop');
    });
    expect(result.current[0]).toBe('running');
  });
});
