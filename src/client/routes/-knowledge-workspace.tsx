import { getRouteApi } from '@tanstack/react-router';

import { KnowledgeWorkspaceScreen } from '../screens/KnowledgeWorkspaceScreen.js';

const knowledgeWorkspaceRouteApi = getRouteApi('/project_/$id/knowledge');

export function KnowledgeWorkspace() {
  const { id } = knowledgeWorkspaceRouteApi.useParams();
  const { entitySnapshot } = knowledgeWorkspaceRouteApi.useLoaderData();

  return <KnowledgeWorkspaceScreen projectId={id} entities={entitySnapshot} />;
}
