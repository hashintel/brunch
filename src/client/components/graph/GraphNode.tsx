/** React Flow node rendered as a knowledge card, reusing the knowledge-card visual language. */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessagesSquare, Pencil } from 'lucide-react';
import type { CSSProperties } from 'react';

import { cardFootprint } from '@/client/components/graph/cardFootprint';
import { useGraphNodeActions } from '@/client/components/graph/graphNodeActions';
import { nodeColor } from '@/client/components/graph/graphStyle';
import type { GraphNodeData } from '@/client/components/graph/types';
import { KindBadge } from '@/client/components/knowledge-card';
import { useSecondaryChatTrigger } from '@/client/components/secondary-chat-trigger';
import { cn } from '@/client/lib/utils';

import './graphNode.css';

export function GraphNode({ id, data }: NodeProps & { data: GraphNodeData }) {
  const { kind, selected, dimmed, highlighted, referenceCode, content } = data;
  const itemId = Number(id.split(':')[1]);
  const { requestEdit } = useGraphNodeActions();
  const chatTrigger = useSecondaryChatTrigger();

  const cardStyle: CSSProperties & Record<'--graph-node-accent', string> = {
    width: cardFootprint.width,
    height: cardFootprint.height,
    '--graph-node-accent': nodeColor(kind),
  };

  const canChat = chatTrigger?.canCreate ?? false;

  return (
    <div
      className={cn(
        'graph-node group flex overflow-hidden rounded-xl border border-rule bg-white text-left shadow-[var(--shadow-card)]',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
        highlighted && 'is-highlighted',
      )}
      style={cardStyle}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <span className="graph-node__bar" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <KindBadge kind={kind} />
          <span className="font-mono text-xxs font-medium text-hint">{referenceCode}</span>
          <div className="nodrag ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              data-graph-node-edit=""
              aria-label="Edit"
              onClick={(event) => {
                event.stopPropagation();
                requestEdit(id);
              }}
              className="flex size-5 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              data-graph-node-chat=""
              aria-label="Open chat"
              disabled={!canChat}
              onClick={(event) => {
                event.stopPropagation();
                void chatTrigger?.create({ kind, id: itemId });
              }}
              className={cn(
                'flex size-5 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30',
                !canChat && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-hint',
              )}
            >
              <MessagesSquare className="size-3" />
            </button>
          </div>
        </div>
        <span className="graph-node__name line-clamp-3 text-xs-plus leading-snug text-ink">{content}</span>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
