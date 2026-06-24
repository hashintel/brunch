import { useCallback, useMemo, useRef } from 'react';

import type { LayoutMode } from '@/client/components/graph/graphForces';

export interface NodePosition {
  x: number;
  y: number;
}

type PositionMap = Record<string, NodePosition>;

const STORAGE_PREFIX = 'brunch:graph-positions';

/**
 * Local (client-only) persistence of manually-arranged node positions, keyed by
 * graph scope and layout mode. This is display state, never part of the knowledge
 * model (SPEC D128): a separate arrangement is remembered per mode, so switching
 * between Workflow and Free — or reloading — restores how the user left each one.
 */
export interface GraphPositions {
  /** The saved manual positions for a mode, as a fresh map (empty when none). */
  overridesFor(mode: LayoutMode): Map<string, NodePosition>;
  /** Remember where a node was dropped in a mode. */
  save(mode: LayoutMode, id: string, position: NodePosition): void;
  /** Forget every saved position for a mode. */
  reset(mode: LayoutMode): void;
}

function storageKey(scope: string, mode: LayoutMode): string {
  return `${STORAGE_PREFIX}:${scope}:${mode}`;
}

function isPosition(value: unknown): value is NodePosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as NodePosition).x === 'number' &&
    typeof (value as NodePosition).y === 'number'
  );
}

function read(key: string): PositionMap {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const map: PositionMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (isPosition(value)) map[id] = { x: value.x, y: value.y };
    }
    return map;
  } catch {
    return {};
  }
}

function write(key: string, map: PositionMap): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(map));
  } catch {
    // Storage unavailable or full: persistence is best-effort, so drop silently.
  }
}

export function useGraphPositions(scope: string): GraphPositions {
  // In-memory cache, keyed by the full storage key so a scope change can't read
  // another graph's positions. Lazily hydrated from localStorage on first touch.
  const cacheRef = useRef<Map<string, PositionMap>>(new Map());

  const mapFor = useCallback(
    (mode: LayoutMode): PositionMap => {
      const key = storageKey(scope, mode);
      let map = cacheRef.current.get(key);
      if (map === undefined) {
        map = read(key);
        cacheRef.current.set(key, map);
      }
      return map;
    },
    [scope],
  );

  const overridesFor = useCallback((mode: LayoutMode) => new Map(Object.entries(mapFor(mode))), [mapFor]);

  const save = useCallback(
    (mode: LayoutMode, id: string, position: NodePosition) => {
      const key = storageKey(scope, mode);
      const next = { ...mapFor(mode), [id]: { x: position.x, y: position.y } };
      cacheRef.current.set(key, next);
      write(key, next);
    },
    [mapFor, scope],
  );

  const reset = useCallback(
    (mode: LayoutMode) => {
      const key = storageKey(scope, mode);
      cacheRef.current.set(key, {});
      write(key, {});
    },
    [scope],
  );

  return useMemo(() => ({ overridesFor, save, reset }), [overridesFor, save, reset]);
}
