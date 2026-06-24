/** React Flow node rendered as a knowledge card, reusing the knowledge-card visual language. */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessagesSquare, Pencil } from 'lucide-react';
import { useState, type CSSProperties, type KeyboardEvent } from 'react';

import { cardFootprint } from '@/client/components/graph/cardFootprint';
import { nodeColor } from '@/client/components/graph/graphStyle';
import type { GraphNodeData } from '@/client/components/graph/types';
import { KindBadge } from '@/client/components/knowledge-card';
import { usePatchList } from '@/client/components/patch-list-host';
import { useSecondaryChatTrigger } from '@/client/components/secondary-chat-trigger';
import { cn } from '@/client/lib/utils';

import './graphNode.css';

export function GraphNode({ id, data }: NodeProps & { data: GraphNodeData }) {
  const { kind, selected, dimmed, highlighted, referenceCode, content } = data;
  const itemId = Number(id.split(':')[1]);
  const patchList = usePatchList();
  const chatTrigger = useSecondaryChatTrigger();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  const cardStyle: CSSProperties & Record<'--graph-node-accent', string> = {
    width: cardFootprint.width,
    height: cardFootprint.height,
    '--graph-node-accent': nodeColor(kind),
  };

  const startEdit = () => {
    setDraft(content);
    setEditing(true);
  };

  const saveEdit = () => {
    setEditing(false);
    const next = draft.trim();
    if (patchList === null || next.length === 0 || next === content) return;
    patchList.stage({
      kind: 'edit',
      producerChatId: null,
      anchor: { kind, itemId },
      anchorReferenceCode: referenceCode,
      summary: `Edit ${referenceCode}`,
      currentContent: content,
      newContent: next,
    });
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveEdit();
    }
  };

  const canChat = chatTrigger?.canCreate ?? false;

  return (
    <div
      className={cn(
        'graph-node group flex overflow-hidden rounded-xl border border-rule bg-white text-left shadow-[var(--shadow-card)]',
        selected && 'is-selected',
        dimmed && 'is-dimmed',
        highlighted && 'is-highlighted',
        editing && 'is-editing',
      )}
      style={cardStyle}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <span className="graph-node__bar" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <KindBadge kind={kind} />
          <span className="font-mono text-xxs font-medium text-hint">{referenceCode}</span>
          {!editing && (
            <div className="nodrag ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                data-graph-node-edit=""
                aria-label="Edit"
                onClick={(event) => {
                  event.stopPropagation();
                  startEdit();
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
          )}
        </div>
        {editing ? (
          <textarea
            autoFocus
            data-graph-node-edit-input=""
            className="nodrag nowheel min-h-0 flex-1 resize-none rounded bg-transparent text-xs-plus leading-snug text-ink outline-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onEditKeyDown}
            onBlur={saveEdit}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="graph-node__name line-clamp-2 text-xs-plus leading-snug text-ink">{content}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
