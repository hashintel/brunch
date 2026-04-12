import { Link, useLoaderData, useParams } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';

import type { EntitiesData } from '../../shared/api-types.js';
import { knowledgeKindRegistry } from '../../shared/knowledge.js';
import type { KnowledgeWorkspaceLoaderData } from '../workspace/workspace-loader.js';

function entityKey(collection: string, id: number) {
  return `${collection}:${id}`;
}

function buildContentMap(entities: EntitiesData) {
  const map = new Map<string, string>();
  for (const entry of knowledgeKindRegistry) {
    for (const item of entities[entry.collectionKey]) {
      map.set(entityKey(entry.entityCollection, item.id), item.content);
    }
  }
  return map;
}

function getDependencies(
  entities: EntitiesData,
  contentMap: Map<string, string>,
  sourceCollection: string,
  sourceId: number,
) {
  return entities.relationships
    .filter(
      (r) => r.type === 'depends_on' && r.source.collection === sourceCollection && r.source.id === sourceId,
    )
    .map((r) => {
      const key = entityKey(r.target.collection, r.target.id);
      const label = contentMap.get(key);
      return label ? { key, label } : null;
    })
    .filter((d): d is { key: string; label: string } => d !== null);
}

function ReviewBadge({ status }: { status: 'approved' | 'rejected' | 'pending' }) {
  return (
    <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'}>
      {status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending'}
    </Badge>
  );
}

export function KnowledgeWorkspaceView({ entities }: { entities: EntitiesData }) {
  const contentMap = buildContentMap(entities);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex flex-col gap-8">
        {knowledgeKindRegistry.map((entry) => {
          const items = entities[entry.collectionKey];
          return (
            <section key={entry.collectionKey}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold">{entry.label}</h2>
                {items.length > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                    {items.length}
                  </Badge>
                )}
              </div>

              {items.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">{entry.emptyStateCopy}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const reviewStatus = 'reviewStatus' in item ? item.reviewStatus : undefined;
                    const rationale = 'rationale' in item ? item.rationale : undefined;
                    const subtype = 'subtype' in item ? item.subtype : undefined;
                    const deps = getDependencies(entities, contentMap, entry.entityCollection, item.id);

                    return (
                      <div key={item.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm">{item.content}</p>
                          {reviewStatus && <ReviewBadge status={reviewStatus} />}
                        </div>
                        {subtype && <p className="mt-1 text-xs text-muted-foreground">{subtype}</p>}
                        {rationale && <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>}
                        {deps.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Depends on</p>
                            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                              {deps.map((d) => (
                                <li key={d.key}>{d.label}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function KnowledgeWorkspace() {
  const { id } = useParams({ from: '/project/$id/knowledge' });
  const { entitySnapshot } = useLoaderData({
    from: '/project/$id/knowledge',
  }) as KnowledgeWorkspaceLoaderData;

  return (
    <div>
      <div className="mx-auto max-w-3xl p-6 pb-0">
        <Link
          to="/project/$id"
          params={{ id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to interview
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Knowledge</h1>
        <p className="mt-1 text-muted-foreground">Review captured knowledge items and relationships.</p>
      </div>
      <KnowledgeWorkspaceView entities={entitySnapshot} />
    </div>
  );
}
