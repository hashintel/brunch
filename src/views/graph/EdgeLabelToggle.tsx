/**
 * Global edge relationship label toggle control.
 *
 * The graph canvas reveals an edge's relationship label only when the edge is
 * selected (see GraphEdge). This control flips a *global* switch so every edge
 * shows its relationship label at once, and persists that choice in a URL
 * search param so it survives refresh and deep-linking (`?edgeLabels=on`),
 * mirroring the sibling list/graph `ViewToggle`.
 *
 * This module owns the pure read/write logic that backs the control; the React
 * component wires those helpers to the router's `useSearch`/`useNavigate`.
 */
import { useNavigate, useSearch } from '@tanstack/react-router';

import { Button } from '@/client/components/ui/button';

/** The search param key backing the `?edgeLabels=on` deep link. */
export const EDGE_LABELS_PARAM = 'edgeLabels';

/** Whether edge relationship labels are visible when the param is absent. */
export const DEFAULT_EDGE_LABELS_VISIBLE = false;

const EDGE_LABELS_ON = 'on';
const EDGE_LABELS_OFF = 'off';

/** Read the global edge label visibility from a raw search param value. */
export function parseEdgeLabelsVisible(raw: string | undefined): boolean {
  if (raw === EDGE_LABELS_ON) return true;
  if (raw === EDGE_LABELS_OFF) return false;
  return DEFAULT_EDGE_LABELS_VISIBLE;
}

/** Flip the global edge label visibility. */
export function toggleEdgeLabels(current: boolean): boolean {
  return !current;
}

/** Serialise edge label visibility into a search object for writing to the URL. */
export function edgeLabelsToSearch(visible: boolean): { [EDGE_LABELS_PARAM]: string } {
  return { [EDGE_LABELS_PARAM]: visible ? EDGE_LABELS_ON : EDGE_LABELS_OFF };
}

/** Graph-canvas control that reveals or hides all edge relationship labels. */
export function EdgeLabelToggle() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { [EDGE_LABELS_PARAM]?: string };
  const visible = parseEdgeLabelsVisible(search[EDGE_LABELS_PARAM]);

  const handleToggle = () => {
    void navigate({
      to: '.',
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        ...edgeLabelsToSearch(toggleEdgeLabels(visible)),
      })) as never,
    });
  };

  return (
    <Button variant="outline" onClick={handleToggle} aria-pressed={visible}>
      {visible ? 'Hide edge labels' : 'Show edge labels'}
    </Button>
  );
}
