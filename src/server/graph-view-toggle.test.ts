import { describe, expect, it } from 'vitest';

/**
 * Contract for the header-level list/graph view toggle.
 *
 * The toggle reads and writes the active view from a URL search param so the
 * choice survives refresh, browser back/forward, and deep-linking. The
 * `ViewToggle.tsx` module owns the pure read/write logic that backs the control:
 *
 *   - the search param key (`view`, matching the `?view=graph` deep link)
 *   - the default view when the param is absent or invalid (`list`)
 *   - parsing a raw param value into a view mode (read)
 *   - serialising a view mode into a search object (write)
 *   - toggling between the two views
 *
 * These pure helpers are the unit-testable surface of the control; the React
 * component wires them to the router's `useSearch`/`useNavigate`.
 */
import {
  DEFAULT_VIEW_MODE,
  GRAPH_VIEW_PARAM,
  parseViewMode,
  toggleViewMode,
  viewModeToSearch,
} from '@/views/graph/ViewToggle.js';

describe('graph view toggle search-param state', () => {
  it('uses the "view" search param key so deep links read ?view=graph', () => {
    expect(GRAPH_VIEW_PARAM).toBe('view');
  });

  it('defaults to the list view', () => {
    expect(DEFAULT_VIEW_MODE).toBe('list');
  });

  describe('parseViewMode (reading the active view from the URL)', () => {
    it('reads the graph view from ?view=graph', () => {
      expect(parseViewMode('graph')).toBe('graph');
    });

    it('reads the list view from ?view=list', () => {
      expect(parseViewMode('list')).toBe('list');
    });

    it('falls back to the list view when the param is absent', () => {
      expect(parseViewMode(undefined)).toBe('list');
    });

    it('falls back to the list view for an unrecognised param value', () => {
      expect(parseViewMode('totally-bogus')).toBe('list');
    });
  });

  describe('toggleViewMode (switching from the header control)', () => {
    it('switches from list to graph', () => {
      expect(toggleViewMode('list')).toBe('graph');
    });

    it('switches from graph to list', () => {
      expect(toggleViewMode('graph')).toBe('list');
    });
  });

  describe('viewModeToSearch (writing the active view back to the URL)', () => {
    it('writes the graph view as ?view=graph for deep-linking', () => {
      expect(viewModeToSearch('graph').view).toBe('graph');
    });

    it('round-trips the graph view through the URL so the choice survives refresh', () => {
      expect(parseViewMode(viewModeToSearch('graph').view)).toBe('graph');
    });

    it('round-trips the list view through the URL so the choice survives refresh', () => {
      expect(parseViewMode(viewModeToSearch('list').view)).toBe('list');
    });
  });
});
