import { useReducer, type ActionDispatch } from 'react';

/**
 * Produces a union of keys across every member of the provided union type.
 * Useful for preserving discriminated unions while extracting permissive key sets.
 */
type AnyKeyOf<T> = T extends unknown ? keyof T : never;

/**
 * React hook that wires up an ergonomic finite state machine for stringly-typed flows.
 * Dispatch events by name and the hook will transition to the configured next state, defaulting to the
 * current state if the event is not mapped (e.g. due to dynamic updates).
 *
 * @param machine Mapping object describing valid transitions for each state.
 * @param initialState Starting state key; must exist on the `machine` definition.
 * @returns Tuple of `[state, dispatch]` mirroring `useReducer`, where `dispatch(event)` advances the state.
 */

export function useStringStateMachine<M extends Record<string, Record<string, string>>, S extends keyof M>(
  ...[machine, initialState]: [
    M & {
      [K1 in S]: {
        [K2 in keyof M[K1]]: S;
      };
    },
    NoInfer<S>,
  ]
): [S, ActionDispatch<[AnyKeyOf<M[S]>]>] {
  return useReducer<S, [AnyKeyOf<M[S]>]>((state, event): S => machine[state][event] ?? state, initialState);
}
