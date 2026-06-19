/**
 * React Flow custom node for the graph view.
 *
 * Colored by knowledge kind and sized by degree (via nodeStyle helpers), with
 * CSS-driven highlight/dim state classes used for selection-neighbor emphasis,
 * and source/target handles so edges can attach.
 */

import type { CSSProperties } from 'react';

import { Handle, Position, type NodeProps } from '@xyflow/react';

import { cn } from '@/client/lib/utils';
import { nodeColor, nodeSize } from '@/views/graph/nodeStyle';
import type { GraphNodeData } from '@/views/graph/types';

export function GraphNode({ data }: NodeProps & { data: GraphNodeData }) {
  const { kind, degree, selected, dimmed } = data;
  const size = nodeSize(degree);
  const accent = nodeColor(kind);

  const style: CSSProperties & Record<'--graph-node-accent', string> = {
    '--graph-node-accent': accent,
    width: size,
    height: size,
    backgroundColor: 'var(--graph-node-accent)',
    borderColor: 'var(--graph-node-accent)',
  };

  return (
    <div
      className={cn(
        'graph-node rounded-full border',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
      )}
      style={style}
    >
      <Handle type="target" position={Position.Top} isConnectable />
      <Handle type="source" position={Position.Bottom} isConnectable />
    </div>
  );
}
