import { ArrowheadShape } from '@/client/components/graph/edgeArrowhead';
import { edgeColor, edgeDash } from '@/client/components/graph/graphStyle';
import type { GraphEdgeRelationship } from '@/client/components/graph/types';

const RELATIONSHIP_ORDER: GraphEdgeRelationship[] = [
  'depends_on',
  'derived_from',
  'constrains',
  'verifies',
  'refines',
];

function humanize(relationship: GraphEdgeRelationship): string {
  return relationship.replace(/_/g, ' ');
}

export function GraphArrowLegend({ relationships }: { relationships: ReadonlySet<GraphEdgeRelationship> }) {
  const present = RELATIONSHIP_ORDER.filter((relationship) => relationships.has(relationship));
  if (present.length === 0) return null;

  return (
    <div
      data-graph-arrow-legend=""
      className="flex flex-col gap-1 rounded-lg border border-rule bg-white/90 px-2.5 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm"
    >
      {present.map((relationship) => {
        const color = edgeColor(relationship);
        return (
          <div
            key={relationship}
            data-graph-arrow-legend-item={relationship}
            className="flex items-center gap-1.5"
          >
            <svg width={24} height={8} viewBox="0 0 24 8" aria-hidden="true" className="shrink-0">
              <line
                x1={0}
                y1={4}
                x2={16}
                y2={4}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={edgeDash(relationship)}
              />
              <g transform="translate(16,0)">
                <ArrowheadShape size={8} color={color} />
              </g>
            </svg>
            <span className="text-xxs font-medium text-sub">{humanize(relationship)}</span>
          </div>
        );
      })}
    </div>
  );
}
