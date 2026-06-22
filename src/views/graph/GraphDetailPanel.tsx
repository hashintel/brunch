/** Detail-on-demand side panel for the selected node; reuses the knowledge-card visual language. */

import { X } from 'lucide-react';

import { KindBadge } from '@/client/components/knowledge-card';
import { knowledgeKindRegistryByKind } from '@/shared/knowledge.js';
import type { GraphEdgeRelationship, GraphNodeKind } from '@/views/graph/types';

/** One connection incident to the selected node, oriented from its point of view. */
export interface GraphDetailConnection {
  direction: 'outgoing' | 'incoming';
  relationship: GraphEdgeRelationship;
  otherKind: GraphNodeKind;
  otherReference: string;
  otherContent: string;
}

/** Everything the panel renders for the selected node. */
export interface GraphDetail {
  kind: GraphNodeKind;
  referenceCode: string;
  content: string;
  rationale: string;
  connections: GraphDetailConnection[];
}

function humanizeRelationship(relationship: GraphEdgeRelationship): string {
  return relationship.replace(/_/g, ' ');
}

/** Phrase a connection from the selected node's perspective. */
function connectionPhrase(connection: GraphDetailConnection): string {
  const rel = humanizeRelationship(connection.relationship);
  return connection.direction === 'outgoing' ? rel : `${rel} by`;
}

export function GraphDetailPanel({ detail, onClose }: { detail: GraphDetail; onClose: () => void }) {
  const kindLabel = knowledgeKindRegistryByKind[detail.kind].label;
  const hasRationale = detail.rationale.trim().length > 0;

  return (
    <aside
      data-graph-detail-panel=""
      className="flex h-full w-80 flex-col overflow-hidden border-l border-rule bg-tint"
    >
      <div className="flex items-start justify-between gap-2 border-b border-rule bg-white px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <KindBadge kind={detail.kind} />
            <span className="font-mono text-xxs font-medium text-hint">{detail.referenceCode}</span>
            <span className="text-xxs text-hint">{kindLabel}</span>
          </div>
          <p className="text-xs-plus leading-snug text-ink">{detail.content}</p>
        </div>
        <button
          type="button"
          data-graph-detail-close=""
          aria-label="Close detail"
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <X className="size-3.5" />
        </button>
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
                <li
                  key={`${connection.direction}-${connection.otherKind}-${connection.otherReference}-${index}`}
                  className="rounded-lg bg-white p-2.5 text-xs shadow-[var(--shadow-card-ring)]"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <KindBadge kind={connection.otherKind} />
                    <span className="font-mono text-xxs font-medium text-hint">
                      {connection.otherReference}
                    </span>
                    <span className="text-xxs text-sub">{connectionPhrase(connection)}</span>
                  </div>
                  <p className="line-clamp-2 leading-snug text-ink">{connection.otherContent}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
