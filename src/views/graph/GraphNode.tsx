/**
 * React Flow custom node rendered as a rectangular *card*.
 *
 * Collapsed, the card draws on the single uniform `cardFootprint` and shows the
 * knowledge item's reference code and name, accented by kind via `nodeColor`.
 * Clicking the card expands it, revealing the item's rationale in a z-raised
 * overlay that floats above neighbours without changing the collapsed footprint
 * (so no layout reflow / no simulation re-run). Assumption nodes with no
 * rationale show a "no reasoning recorded" affordance instead. Source/target
 * handles are retained so edges can attach.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState, type CSSProperties } from 'react';

import { cn } from '@/client/lib/utils';
import { cardFootprint } from '@/views/graph/cardFootprint';
import { nodeColor } from '@/views/graph/nodeColor';
import type { GraphNodeData } from '@/views/graph/types';

import './graphNode.css';

export function GraphNode({ data }: NodeProps & { data: GraphNodeData }) {
  const { kind, selected, dimmed, referenceCode, content, rationale } = data;
  const [expanded, setExpanded] = useState(false);

  const accent = nodeColor(kind);
  const hasRationale = rationale.trim().length > 0;
  const showNoReasoning = kind === 'assumption' && !hasRationale;

  const rootStyle: CSSProperties & Record<'--graph-node-accent', string> = {
    '--graph-node-accent': accent,
    position: 'relative',
    ...(expanded ? { zIndex: 10 } : {}),
  };

  const cardStyle: CSSProperties = {
    width: cardFootprint.width,
    height: cardFootprint.height,
    borderColor: accent,
  };

  return (
    <div
      className={cn(
        'graph-node',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
        expanded && 'is-expanded',
      )}
      style={rootStyle}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <Handle type="target" position={Position.Top} isConnectable />

      <div className="graph-node__card border" style={cardStyle}>
        <span className="graph-node__reference" style={{ color: accent }}>
          {referenceCode}
        </span>
        <span className="graph-node__name">{content}</span>
      </div>

      <div className="graph-node__card-overlay">
        {showNoReasoning ? (
          <span className="graph-node__no-reasoning">No reasoning recorded</span>
        ) : (
          <span className="graph-node__rationale">{rationale}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable />
    </div>
  );
}
