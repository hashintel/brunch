import { useLoaderData, useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCreateProjectMutation } from '@/mutations/project-mutations';

import type { ProjectListItem } from '../../shared/api-types.js';

const phaseLabels: Array<{ key: keyof ProjectListItem['workflowSummary']; label: string }> = [
  { key: 'scope', label: 'Scope' },
  { key: 'design', label: 'Design' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'criteria', label: 'Criteria' },
];

const statusStyles: Record<string, string> = {
  closed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  unstarted: 'bg-muted text-muted-foreground',
};

export function ProjectList() {
  const projects = useLoaderData({ from: '/' });
  const navigate = useNavigate();
  const createProjectMutation = useCreateProjectMutation();

  const handleCreate = async () => {
    const name = prompt('Project name:');
    if (!name?.trim()) return;

    try {
      await createProjectMutation.createProject(name.trim());
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
                <div className="mt-2 flex gap-1.5">
                  {phaseLabels.map(({ key, label }) => (
                    <span
                      key={key}
                      className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${statusStyles[p.workflowSummary[key]]}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
