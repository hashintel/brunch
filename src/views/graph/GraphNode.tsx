/** React Flow node rendered as a knowledge card, reusing the knowledge-card visual language. */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';

import { KindBadge } from '@/client/components/knowledge-card';
import { cn } from '@/client/lib/utils';
import { cardFootprint } from '@/views/graph/cardFootprint';
import { nodeColor } from '@/views/graph/graphStyle';
import type { GraphNodeData } from '@/views/graph/types';

import './graphNode.css';

export function GraphNode({ data }: NodeProps & { data: GraphNodeData }) {
  const { kind, selected, dimmed, referenceCode, content } = data;

  // Accent rides on a CSS var so the stylesheet tints ring/bar from the node's own kind.
  const cardStyle: CSSProperties & Record<'--graph-node-accent', string> = {
    width: cardFootprint.width,
    height: cardFootprint.height,
    '--graph-node-accent': nodeColor(kind),
  };

  return (
    <div
      className={cn(
        'graph-node flex overflow-hidden rounded-xl border border-rule bg-white text-left shadow-[var(--shadow-card)]',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
      )}
      style={cardStyle}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <span className="graph-node__bar" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <KindBadge kind={kind} />
          <span className="font-mono text-xxs font-medium text-hint">{referenceCode}</span>
        </div>
        <span className="graph-node__name line-clamp-2 text-xs-plus leading-snug text-ink">{content}</span>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
