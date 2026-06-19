/**
 * Header-level list/graph view toggle.
 *
 * The toggle reads and writes the active view from a URL search param (`view`)
 * so the choice survives refresh, browser back/forward, and deep-linking
 * (`?view=graph`). This module owns the pure read/write logic that backs the
 * control; the React component wires those helpers to the router's
 * `useSearch`/`useNavigate`.
 */
import { useNavigate, useSearch } from '@tanstack/react-router';

import { Button } from '@/client/components/ui/button';

/** The available view modes for the knowledge surface. */
export type ViewMode = 'list' | 'graph';

/** The search param key backing the `?view=graph` deep link. */
export const GRAPH_VIEW_PARAM = 'view';

/** The view used when the param is absent or unrecognised. */
export const DEFAULT_VIEW_MODE: ViewMode = 'list';

const VIEW_MODES: readonly ViewMode[] = ['list', 'graph'];

/** Read the active view from a raw search param value. */
export function parseViewMode(raw: string | undefined): ViewMode {
  return VIEW_MODES.includes(raw as ViewMode) ? (raw as ViewMode) : DEFAULT_VIEW_MODE;
}

/** Switch between the two views. */
export function toggleViewMode(current: ViewMode): ViewMode {
  return current === 'graph' ? 'list' : 'graph';
}

/** Serialise a view mode into a search object for writing back to the URL. */
export function viewModeToSearch(view: ViewMode): { view: ViewMode } {
  return { view };
}

/** Header control that switches between the list and graph views. */
export function ViewToggle() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { [GRAPH_VIEW_PARAM]?: string };
  const view = parseViewMode(search[GRAPH_VIEW_PARAM]);

  const handleToggle = () => {
    void navigate({
      to: '.',
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        ...viewModeToSearch(toggleViewMode(view)),
      })) as never,
    });
  };

  return (
    <Button variant="outline" onClick={handleToggle} aria-pressed={view === 'graph'}>
      {view === 'graph' ? 'List view' : 'Graph view'}
    </Button>
  );
}
