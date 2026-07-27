import { useCallback, useEffect, useRef, useState } from 'react';

import type { LayoutMode } from '@/client/components/graph/graphForces';

const STORAGE_PREFIX = 'brunch:graph-layout-mode';
const DEFAULT_MODE: LayoutMode = 'force';
const VALID_MODES = new Set<LayoutMode>(['force', 'workflow', 'free']);

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

function read(scope: string): LayoutMode {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(scope));
    if (raw !== null && raw !== undefined && VALID_MODES.has(raw as LayoutMode)) return raw as LayoutMode;
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return DEFAULT_MODE;
}

/**
 * Remembers the last layout mode the user picked, locally and per graph (scoped by
 * the same key as saved node positions). Client-only view preference — never part
 * of the knowledge model.
 */
export function useGraphLayoutMode(scope: string): [LayoutMode, (mode: LayoutMode) => void] {
  const [mode, setMode] = useState<LayoutMode>(() => read(scope));

  // Re-read when the graph scope changes without a remount (e.g. navigating
  // between specifications), so each graph restores its own last mode.
  const scopeRef = useRef(scope);
  useEffect(() => {
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      setMode(read(scope));
    }
  }, [scope]);

  const update = useCallback(
    (next: LayoutMode) => {
      setMode(next);
      try {
        globalThis.localStorage?.setItem(storageKey(scope), next);
      } catch {
        // Storage unavailable or full: persistence is best-effort, so drop silently.
      }
    },
    [scope],
  );

  return [mode, update];
}
