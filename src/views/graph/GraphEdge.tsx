import { getBezierPath, Position } from '@xyflow/react';
import { useId, type ReactElement } from 'react';

import { ArrowheadShape } from '@/views/graph/edgeArrowhead';
import { arrowheadConfig, edgeStyle } from '@/views/graph/graphStyle';
import type { GraphEdgeRelationship } from '@/views/graph/types';

import './graphEdge.css';

interface Point {
  x: number;
  y: number;
}

interface GraphEdgeProps {
  relationship: GraphEdgeRelationship;
  source: Point;
  target: Point;
  sourcePosition?: Position;
  targetPosition?: Position;
  selected?: boolean;
  labelsShown?: boolean;
  dimmed?: boolean;
}

function relationshipLabel(relationship: GraphEdgeRelationship): string {
  return relationship.replace(/_/g, ' ');
}

export function GraphEdge({
  relationship,
  source,
  target,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  selected = false,
  labelsShown = false,
  dimmed = false,
}: GraphEdgeProps): ReactElement {
  const markerId = `graph-edge-arrowhead-${useId()}`;
  const label = relationshipLabel(relationship);
  const tooltip = `${label} relationship`;
  const stroke = edgeStyle.stroke;
  const className = ['graph-edge', selected && 'graph-edge--selected', dimmed && 'graph-edge--dimmed']
    .filter(Boolean)
    .join(' ');

  const [path, labelX, labelY] = getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition,
    targetX: target.x,
    targetY: target.y,
    targetPosition,
  });

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
          <ArrowheadShape relationship={relationship} size={arrowheadConfig.width} color={stroke} />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={edgeStyle.strokeWidth}
        markerEnd={`url(#${markerId})`}
      />
      {labelsShown || selected ? (
        <text
          data-edge-label=""
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fill={stroke}
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
