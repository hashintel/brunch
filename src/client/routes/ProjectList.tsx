import { useLoaderData, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/client/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/client/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog';
import { useCreateProjectMutation } from '@/client/mutations/project-mutations';
import type { ProjectListItem, ProjectMode } from '@/shared/api-types.js';

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

type DialogStep = 'closed' | 'name' | 'mode';

export function ProjectList() {
  const projects = useLoaderData({ from: '/' });
  const navigate = useNavigate();
  const createProjectMutation = useCreateProjectMutation();

  const [dialogStep, setDialogStep] = useState<DialogStep>('closed');
  const [projectName, setProjectName] = useState('');

  const handleOpen = () => {
    setProjectName('');
    setDialogStep('name');
  };

  const handleNameSubmit = () => {
    if (!projectName.trim()) return;
    setDialogStep('mode');
  };

  const handleModeSelect = async (mode: ProjectMode) => {
    setDialogStep('closed');
    try {
      await createProjectMutation.createProject({ name: projectName.trim(), mode });
    } catch {
      // The shared mutation hook surfaces the failure state in the UI.
    }
  };

  const handleClose = () => {
    setDialogStep('closed');
  };

  return (
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
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
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
  );
}
