/** Header-level list/graph view toggle, backed by the `?view=` URL param so the choice deep-links and survives refresh. */
import { useNavigate, useSearch } from '@tanstack/react-router';
import { List, Network } from 'lucide-react';
import type { ComponentType } from 'react';

import { cn } from '@/client/lib/utils';

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

const SEGMENTS: readonly { mode: ViewMode; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { mode: 'list', label: 'List view', Icon: List },
  { mode: 'graph', label: 'Graph view', Icon: Network },
];

/** Segmented icon control that switches between the list and graph views. */
export function ViewToggle() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { [GRAPH_VIEW_PARAM]?: string };
  const view = parseViewMode(search[GRAPH_VIEW_PARAM]);

  const select = (mode: ViewMode) => {
    if (mode === view) return;
    void navigate({
      to: '.',
      search: ((prev: Record<string, unknown>) => ({ ...prev, ...viewModeToSearch(mode) })) as never,
    });
  };

  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex items-center gap-0.5 rounded-md border border-rule bg-tint p-0.5"
    >
      {SEGMENTS.map(({ mode, label, Icon }) => {
        const active = view === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => select(mode)}
            className={cn(
              'flex size-6 items-center justify-center rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
              active ? 'bg-white text-ink shadow-[var(--shadow-card)]' : 'text-hint hover:text-ink',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
