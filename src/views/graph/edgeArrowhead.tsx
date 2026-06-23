import type { ReactElement } from 'react';

import type { GraphEdgeRelationship } from '@/views/graph/types';

export function ArrowheadShape({
  relationship,
  size,
  color,
}: {
  relationship: GraphEdgeRelationship;
  size: number;
  color: string;
}): ReactElement {
  const s = size;
  const mid = s / 2;
  switch (relationship) {
    case 'depends_on':
      return <polygon points={`0,0 ${s},${mid} 0,${s}`} fill={color} />;
    case 'derived_from':
      return <polyline points={`0,0 ${s},${mid} 0,${s}`} fill="none" stroke={color} strokeWidth={1.2} />;
    case 'constrains':
      return <polygon points={`0,${mid} ${mid},0 ${s},${mid} ${mid},${s}`} fill={color} />;
    case 'verifies':
      return <circle cx={mid} cy={mid} r={mid} fill={color} />;
    case 'refines':
      return <rect x={s - 2} y={0} width={2} height={s} fill={color} />;
  }
}
