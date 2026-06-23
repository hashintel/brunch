/**
 * The zoom control pill.
 *
 * A small pill rendered center-bottom inside the React Flow canvas with the
 * composition [−] [percentage] [+]. The percentage readout is the *live* zoom
 * level. [−]/[+] step the zoom by 10% (clamped); clicking the percentage fits
 * all nodes into the viewport (capped at 100%).
 *
 * Designed to render inside <ReactFlow>, which provides the store and the
 * imperative actions consumed via `useStore` / `useReactFlow`.
 */

import { useReactFlow, useStore, type ReactFlowState } from '@xyflow/react';
import type { ReactElement } from 'react';

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;

/** Snap to the nearest 10% mark, stepped by `delta`, clamped to the zoom range. */
function steppedZoom(scale: number, delta: number): number {
  const next = Math.round((scale + delta) * 10) / 10;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
}

export function ZoomControl(): ReactElement {
  const scale = useStore((s: ReactFlowState) => s.transform[2]);
  const { zoomTo, fitView } = useReactFlow();

  const percentage = `${Math.round(scale * 100)}%`;

  return (
    <div
      data-zoom-control=""
      className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur"
    >
      <button
        type="button"
        data-zoom-out=""
        aria-label="Zoom out"
        onClick={() => zoomTo(steppedZoom(scale, -ZOOM_STEP))}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
      >
        −
      </button>
      <button
        type="button"
        data-zoom-percentage=""
        aria-label="Fit view"
        onClick={() => fitView({ minZoom: MIN_ZOOM, maxZoom: 1 })}
        className="min-w-12 rounded-full px-2 text-center text-sm tabular-nums hover:bg-muted"
      >
        {percentage}
      </button>
      <button
        type="button"
        data-zoom-in=""
        aria-label="Zoom in"
        onClick={() => zoomTo(steppedZoom(scale, ZOOM_STEP))}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
      >
        +
      </button>
    </div>
  );
}
