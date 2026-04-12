import { useLoaderData, useParams } from '@tanstack/react-router';

import { KnowledgeWorkspaceScreen } from '../screens/KnowledgeWorkspaceScreen.js';
import type { KnowledgeWorkspaceLoaderData } from '../workspace/workspace-loader.js';

export function KnowledgeWorkspace() {
  const { id } = useParams({ from: '/project/$id/knowledge' });
  const { entitySnapshot } = useLoaderData({
    from: '/project/$id/knowledge',
  }) as KnowledgeWorkspaceLoaderData;

  return <KnowledgeWorkspaceScreen projectId={id} entities={entitySnapshot} />;
}
