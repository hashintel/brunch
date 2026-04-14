import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/client/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/client/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog';
import { useCreateProjectMutation } from '@/client/mutations/project-mutations';
import type { ProjectListItem, ProjectMode, WorkflowPhaseStatus } from '@/shared/api-types.js';

const projectListRouteApi = getRouteApi('/');

const phaseLabels: Array<{ key: keyof ProjectListItem['workflowSummary']; label: string }> = [
  { key: 'scope', label: 'Scope' },
  { key: 'design', label: 'Design' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'criteria', label: 'Criteria' },
];

const statusStyles = {
  closed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  unstarted: 'bg-muted text-muted-foreground',
} satisfies Record<WorkflowPhaseStatus, string>;

type DialogStep = 'closed' | 'name' | 'mode';

export async function fetchProjectListLoaderData(): Promise<ProjectListItem[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to load projects');
  }

  return response.json() as Promise<ProjectListItem[]>;
}

export function ProjectList() {
  const projects = projectListRouteApi.useLoaderData();
  const navigate = useNavigate();
  const createProjectMutation = useCreateProjectMutation();
  const [dialogStep, setDialogStep] = useState<DialogStep>('closed');
  const [projectName, setProjectName] = useState('');

  const navigateToProject = (projectId: number) => {
    void navigate({ to: '/project/$id', params: { id: String(projectId) } });
  };

  const handleOpen = () => {
    setProjectName('');
    createProjectMutation.clearError();
    setDialogStep('name');
  };

  const handleNameSubmit = () => {
    if (!projectName.trim()) return;
    setDialogStep('mode');
  };

  const handleModeSelect = async (mode: ProjectMode) => {
    setDialogStep('closed');
    try {
      const project = await createProjectMutation.createProject({ name: projectName.trim(), mode });
      navigateToProject(project.id);
    } catch {
      // The shared mutation hook surfaces the failure state in the UI.
    }
  };

  const handleClose = () => {
    setDialogStep('closed');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">Brunch</h1>
        <p className="mt-1 text-muted-foreground">AI-guided spec elicitation</p>

        <Button onClick={handleOpen} disabled={createProjectMutation.isPending} className="mt-6 mb-2">
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
            {projects.map((project) => (
              <Link key={project.id} to="/project/$id" params={{ id: String(project.id) }} className="block">
                <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </CardDescription>
                    <div className="mt-2 flex gap-1.5">
                      {phaseLabels.map(({ key, label }) => (
                        <span
                          key={key}
                          className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${statusStyles[project.workflowSummary[key]]}`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <Dialog open={dialogStep !== 'closed'} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent>
            {dialogStep === 'name' && (
              <>
                <DialogHeader>
                  <DialogTitle>New project</DialogTitle>
                  <DialogDescription>Give your project a name.</DialogDescription>
                </DialogHeader>
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleNameSubmit()}
                  placeholder="Project name"
                  autoFocus
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <DialogFooter>
                  <Button onClick={handleNameSubmit} disabled={!projectName.trim()}>
                    Next
                  </Button>
                </DialogFooter>
              </>
            )}
            {dialogStep === 'mode' && (
              <>
                <DialogHeader>
                  <DialogTitle>What kind of project?</DialogTitle>
                  <DialogDescription>Choose how to start your spec elicitation.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => handleModeSelect('greenfield')}
                    className="rounded-lg border border-input p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="font-medium">New concept from scratch</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Start with a blank slate and define everything fresh
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSelect('brownfield')}
                    className="rounded-lg border border-input p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="font-medium">Feature within existing codebase</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      The agent will explore your code before the first interview question
                    </div>
                  </button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
