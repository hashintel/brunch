import { useLoaderData, useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useClientMutation, postJsonMutation } from '@/mutations/client-mutation';

import type { ProjectListItem } from '../../shared/api-types.js';

export function ProjectList() {
  const projects = useLoaderData({ from: '/' });
  const navigate = useNavigate();
  const createProjectMutation = useClientMutation((variables: { name: string }) =>
    postJsonMutation<ProjectListItem, { name: string }>(
      '/api/projects',
      variables,
      'Failed to create project',
    ),
  );

  const handleCreate = async () => {
    const name = prompt('Project name:');
    if (!name?.trim()) return;

    try {
      const project = await createProjectMutation.run({ name: name.trim() });
      void navigate({ to: '/project/$id', params: { id: String(project.id) } });
    } catch {
      // The shared mutation hook surfaces the failure state in the UI.
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Brunch</h1>
      <p className="mt-1 text-muted-foreground">AI-guided spec elicitation</p>

      <Button onClick={handleCreate} disabled={createProjectMutation.isPending} className="mt-6 mb-2">
        {createProjectMutation.isPending ? 'Creating...' : 'New project'}
      </Button>

      {createProjectMutation.errorMessage && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {createProjectMutation.errorMessage}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate({ to: '/project/$id', params: { id: String(p.id) } })}
            >
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>Created: {new Date(p.created_at).toLocaleDateString()}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
