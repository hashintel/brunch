/**
 * The zoom control pill.
 *
 * A small pill rendered center-bottom inside the React Flow canvas with the
 * composition [−] [percentage] [+]. The percentage readout is the *live* zoom
 * level, sourced reactively from React Flow's transform scale. Clicking the
 * percentage re-frames all nodes to fill the viewport via `fitView` (matching
 * mount behavior) rather than snapping zoom back to 100%.
 *
 * Designed to render inside <ReactFlow>, which provides the store and the
 * imperative actions consumed via `useStore` / `useReactFlow`.
 */

import { useReactFlow, useStore, type ReactFlowState } from '@xyflow/react';
import type { ReactElement } from 'react';

export function ZoomControl(): ReactElement {
  const scale = useStore((s: ReactFlowState) => s.transform[2]);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

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
        onClick={() => zoomOut()}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
      >
        −
      </button>
      <button
        type="button"
        data-zoom-percentage=""
        aria-label="Fit view"
        onClick={() => fitView()}
        className="min-w-12 rounded-full px-2 text-center text-sm tabular-nums hover:bg-muted"
      >
        {percentage}
      </button>
      <button
        type="button"
        data-zoom-in=""
        aria-label="Zoom in"
        onClick={() => zoomIn()}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
      >
        +
      </button>
    </div>
  );
}
