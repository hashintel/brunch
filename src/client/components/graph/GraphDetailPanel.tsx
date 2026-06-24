/** Detail-on-demand side panel for the selected node; reuses the knowledge-card visual language. */

import { Pencil, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { edgeColor, nodeColor } from '@/client/components/graph/graphStyle';
import type { GraphDetail, GraphEdgeRelationship } from '@/client/components/graph/types';
import { KindBadge } from '@/client/components/knowledge-card';

function humanizeRelationship(relationship: GraphEdgeRelationship): string {
  return relationship.replace(/_/g, ' ');
}

export function GraphDetailPanel({
  detail,
  editing,
  onClose,
  onSelect,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  detail: GraphDetail;
  editing: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (content: string) => void;
}) {
  const hasRationale = detail.rationale.trim().length > 0;
  const [draft, setDraft] = useState(detail.content);

  const commit = () => {
    const next = draft.trim();
    if (next.length === 0 || next === detail.content) {
      onCancelEdit();
      return;
    }
    onSave(next);
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancelEdit();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  };

  return (
    <aside
      data-graph-detail-panel=""
      className="flex h-full w-80 flex-col overflow-hidden border-l border-rule bg-tint"
    >
      <div className="flex items-start justify-between gap-2 border-b border-rule bg-white px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <KindBadge kind={detail.kind} />
            <span className="font-mono text-xxs font-medium text-hint">{detail.referenceCode}</span>
          </div>
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                autoFocus
                data-graph-detail-edit-input=""
                rows={4}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onEditKeyDown}
                className="w-full resize-none rounded border border-rule bg-white px-2 py-1.5 text-xs-plus leading-snug text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-graph-detail-save=""
                  onClick={commit}
                  style={{ backgroundColor: nodeColor(detail.kind) }}
                  className="rounded px-2 py-0.5 text-xxs font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                >
                  Save
                </button>
                <button
                  type="button"
                  data-graph-detail-cancel=""
                  onClick={onCancelEdit}
                  className="rounded px-2 py-0.5 text-xxs font-medium text-hint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs-plus leading-snug text-ink">{detail.content}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!editing && (
            <button
              type="button"
              data-graph-detail-edit=""
              aria-label="Edit"
              onClick={onStartEdit}
              className="flex size-6 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            data-graph-detail-close=""
            aria-label="Close detail"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xxs font-medium tracking-wide text-hint uppercase">Rationale</h3>
          {hasRationale ? (
            <p className="text-xs leading-relaxed text-sub">{detail.rationale}</p>
          ) : (
            <p className="text-xs text-hint italic">No reasoning recorded</p>
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="text-xxs font-medium tracking-wide text-hint uppercase">
            Connections
            {detail.connections.length > 0 ? (
              <span className="ml-1 font-mono text-hint">({detail.connections.length})</span>
            ) : null}
          </h3>
          {detail.connections.length === 0 ? (
            <p className="text-xs text-hint italic">No connections</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {detail.connections.map((connection, index) => (
                <li key={`${connection.direction}-${connection.otherId}-${connection.relationship}-${index}`}>
                  <button
                    type="button"
                    data-graph-detail-connection={connection.otherId}
                    onClick={() => onSelect(connection.otherId)}
                    className="w-full cursor-pointer rounded-lg bg-white p-2.5 text-left text-xs shadow-[var(--shadow-card-ring)] outline-none hover:bg-wash focus-visible:ring-2 focus-visible:ring-foreground/30"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <KindBadge kind={connection.otherKind} />
                      <span className="font-mono text-xxs font-medium text-hint">
                        {connection.otherReference}
                      </span>
                      <span
                        className="ml-auto text-xxs font-medium"
                        style={{ color: edgeColor(connection.relationship) }}
                      >
                        {humanizeRelationship(connection.relationship)}
                      </span>
                    </div>
                    <p className="line-clamp-2 leading-snug text-ink">{connection.otherContent}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
