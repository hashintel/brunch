import { useReducer } from 'react';

/**
 * React state helper that merges partial record updates, similar to `setState` in class components.
 * Accepts either a partial object or a function that derives a partial from the latest state.
 * @param initialState Initial record used to seed the reducer; should include every tracked key.
 * @returns A tuple `[state, setState]` mirroring `useReducer`, where `setState` merges partial updates into the current state.
 */
export function useRecordState<S extends Record<string, unknown>>(initialState: S) {
  return useReducer<S, [Partial<S> | ((s: S) => Partial<S>)]>(
    (state, patch): S => ({ ...state, ...(patch instanceof Function ? patch(state) : patch) }),
    initialState,
  );
}
