import { createFileRoute } from '@tanstack/react-router';

import { KnowledgeWorkspaceSkeleton } from '../components/route-skeletons.js';
import { fetchKnowledgeWorkspaceLoaderData } from '../workspace/workspace-loader.js';
import { KnowledgeWorkspace } from './-knowledge-workspace.js';

export const Route = createFileRoute('/project_/$id/knowledge')({
  loader: ({ params }) => fetchKnowledgeWorkspaceLoaderData(params.id),
  component: KnowledgeWorkspace,
  pendingComponent: KnowledgeWorkspaceSkeleton,
});
