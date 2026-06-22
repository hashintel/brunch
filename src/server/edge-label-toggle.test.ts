import { describe, expect, it } from 'vitest';

/**
 * Contract for the global edge relationship label toggle control.
 *
 * The graph canvas shows edge relationship labels only on selection by default
 * (see GraphEdge). This control flips a *global* switch so every edge reveals
 * its relationship label at once, and persists that choice in a URL search
 * param so it survives refresh and deep-linking (`?edgeLabels=on`), mirroring
 * the sibling list/graph `ViewToggle`.
 *
 * The `EdgeLabelToggle.tsx` module owns the pure read/write logic backing the
 * control:
 *
 *   - the search param key (`edgeLabels`)
 *   - the default visibility when the param is absent or invalid (hidden)
 *   - parsing a raw param value into a boolean (read)
 *   - serialising a boolean into a search object (write)
 *   - toggling the current visibility
 *   - the `EdgeLabelToggle` React control that wires those helpers to the router
 *
 * These pure helpers are the unit-testable surface; the React component wires
 * them to the router's `useSearch`/`useNavigate`.
 */
import {
  DEFAULT_EDGE_LABELS_VISIBLE,
  EDGE_LABELS_PARAM,
  EdgeLabelToggle,
  edgeLabelsToSearch,
  parseEdgeLabelsVisible,
  toggleEdgeLabels,
} from '@/views/graph/EdgeLabelToggle.js';

describe('EdgeLabelToggle module', () => {
  it('exports an EdgeLabelToggle control component', () => {
    expect(typeof EdgeLabelToggle).toBe('function');
  });
});

describe('edge label toggle search-param state', () => {
  it('uses the "edgeLabels" search param key so deep links read ?edgeLabels=on', () => {
    expect(EDGE_LABELS_PARAM).toBe('edgeLabels');
  });

  it('hides edge relationship labels by default (revealed only on selection)', () => {
    expect(DEFAULT_EDGE_LABELS_VISIBLE).toBe(false);
  });

  describe('parseEdgeLabelsVisible (reading the global toggle from the URL)', () => {
    it('falls back to hidden when the param is absent', () => {
      expect(parseEdgeLabelsVisible(undefined)).toBe(false);
    });

    it('falls back to hidden for an unrecognised param value', () => {
      expect(parseEdgeLabelsVisible('totally-bogus')).toBe(false);
    });

    it('always returns a boolean', () => {
      expect(typeof parseEdgeLabelsVisible('on')).toBe('boolean');
      expect(typeof parseEdgeLabelsVisible(undefined)).toBe('boolean');
    });
  });

  describe('toggleEdgeLabels (flipping the global control)', () => {
    it('reveals labels when currently hidden', () => {
      expect(toggleEdgeLabels(false)).toBe(true);
    });

    it('hides labels when currently revealed', () => {
      expect(toggleEdgeLabels(true)).toBe(false);
    });
  });

  describe('edgeLabelsToSearch (writing the global toggle back to the URL)', () => {
    it('serialises under the edgeLabels search param key', () => {
      expect(Object.keys(edgeLabelsToSearch(true))).toContain(EDGE_LABELS_PARAM);
    });

    it('serialises the revealed and hidden states to distinct param values', () => {
      const shown = edgeLabelsToSearch(true)[EDGE_LABELS_PARAM];
      const hidden = edgeLabelsToSearch(false)[EDGE_LABELS_PARAM];
      expect(shown).not.toBe(hidden);
    });

    it('round-trips the revealed state through the URL so the choice survives refresh', () => {
      expect(parseEdgeLabelsVisible(edgeLabelsToSearch(true)[EDGE_LABELS_PARAM])).toBe(true);
    });

    it('round-trips the hidden state through the URL so the choice survives refresh', () => {
      expect(parseEdgeLabelsVisible(edgeLabelsToSearch(false)[EDGE_LABELS_PARAM])).toBe(false);
    });
  });
});
