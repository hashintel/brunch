/**
 * Edge styling helpers for the graph view.
 *
 * Provides neutral edge styling plus directional arrowhead config. Node accent
 * colors now live in `nodeColor.ts` and the uniform card box in
 * `cardFootprint.ts` (superseding the old degree-based node sizing).
 */

/** Neutral edge styling, deliberately untinted by any kind accent color. */
export const edgeStyle = {
  stroke: '#94a3b8',
  strokeWidth: 1,
} as const;

/** Directional arrowhead configuration for edges. */
export const arrowheadConfig = {
  width: 8,
  height: 8,
  color: '#94a3b8',
} as const;
