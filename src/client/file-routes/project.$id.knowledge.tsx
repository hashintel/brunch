import { createFileRoute } from '@tanstack/react-router';

import { KnowledgeWorkspaceSkeleton } from '../components/route-skeletons.js';
import { KnowledgeWorkspace } from '../routes/KnowledgeWorkspace.js';
import { fetchKnowledgeWorkspaceLoaderData } from '../workspace/workspace-loader.js';

export const Route = createFileRoute('/project/$id/knowledge')({
  loader: ({ params }) => fetchKnowledgeWorkspaceLoaderData(params.id),
  component: KnowledgeWorkspace,
  pendingComponent: KnowledgeWorkspaceSkeleton,
});
