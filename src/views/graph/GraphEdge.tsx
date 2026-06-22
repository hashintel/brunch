/**
 * A single graph edge.
 *
 * Renders a uniform neutral line with a directional arrowhead, deliberately
 * untinted by any node kind accent color. The specific relationship type is
 * hidden by default and revealed only on selection (a visible label) while
 * always remaining available as a hover tooltip and a machine-readable data
 * attribute. Dim/highlight states are expressed through CSS classes and data
 * attributes so callers can style them.
 */

import { useId, type ReactElement } from 'react';

import { arrowheadConfig, edgeStyle } from '@/views/graph/nodeStyle';
import type { GraphEdgeRelationship } from '@/views/graph/types';

interface Point {
  x: number;
  y: number;
}

interface GraphEdgeProps {
  /** The relationship type this edge represents. */
  relationship: GraphEdgeRelationship;
  /** Edge start point. */
  source: Point;
  /** Edge end point. */
  target: Point;
  /** Whether the edge is currently selected (reveals its label, highlights). */
  selected?: boolean;
  /**
   * When true the relationship label is shown unconditionally. When false (the
   * default) the label falls back to selection-gated reveal.
   */
  labelsShown?: boolean;
  /** Whether the edge is visually de-emphasized. */
  dimmed?: boolean;
}

/** Human-readable form of a relationship key, e.g. `derived from`. */
function relationshipLabel(relationship: GraphEdgeRelationship): string {
  return relationship.replace(/_/g, ' ');
}

export function GraphEdge({
  relationship,
  source,
  target,
  selected = false,
  labelsShown = false,
  dimmed = false,
}: GraphEdgeProps): ReactElement {
  const markerId = `graph-edge-arrowhead-${useId()}`;
  const label = relationshipLabel(relationship);
  const tooltip = `${label} relationship`;
  const className = ['graph-edge', selected && 'graph-edge--selected', dimmed && 'graph-edge--dimmed']
    .filter(Boolean)
    .join(' ');

  return (
    <g
      data-graph-edge=""
      data-relationship={relationship}
      data-selected={String(selected)}
      data-dimmed={String(dimmed)}
      className={className}
    >
      <title>{tooltip}</title>
      <defs>
        <marker
          id={markerId}
          markerWidth={arrowheadConfig.width}
          markerHeight={arrowheadConfig.height}
          refX={arrowheadConfig.width}
          refY={arrowheadConfig.height / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon
            points={`0,0 ${arrowheadConfig.width},${arrowheadConfig.height / 2} 0,${arrowheadConfig.height}`}
            fill={arrowheadConfig.color}
          />
        </marker>
      </defs>
      <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke={edgeStyle.stroke}
        strokeWidth={edgeStyle.strokeWidth}
        markerEnd={`url(#${markerId})`}
      />
      {labelsShown || selected ? (
        <text
          data-edge-label=""
          x={(source.x + target.x) / 2}
          y={(source.y + target.y) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fill={edgeStyle.stroke}
          // White halo under the glyphs keeps the label legible over lines/cards without a sized rect.
          stroke="white"
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
