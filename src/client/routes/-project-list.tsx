import { Link, getRouteApi, useNavigate } from '@tanstack/react-router';
import { SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { useState } from 'react';

import { Button, EmptyCard } from '@/client/components/app-shell';
import { Button as ShadcnButton } from '@/client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog';
import { useCreateProjectMutation } from '@/client/mutations/project-mutations';
import type { ProjectListItem, ReadinessBand, WorkflowPhaseStatus } from '@/shared/api-types.js';
import { workflowPhaseLabels } from '@/shared/phase-display.js';
import { phaseOrder } from '@/shared/phase-routes.js';

const projectListRouteApi = getRouteApi('/');

function getCurrentPhaseInfo(summary: ProjectListItem['workflowSummary']): {
  label: string;
  number: number;
} {
  for (let i = 0; i < phaseOrder.length; i++) {
    if (summary[phaseOrder[i]!] === 'in_progress') {
      return { label: workflowPhaseLabels[phaseOrder[i]!], number: i + 1 };
    }
  }
  if (phaseOrder.every((p) => summary[p] === 'closed')) {
    return { label: 'Complete', number: phaseOrder.length };
  }
  return { label: workflowPhaseLabels[phaseOrder[0]!], number: 1 };
}

function PhaseDot({ status }: { status: WorkflowPhaseStatus }) {
  if (status === 'closed') {
    return <span className="size-2 rounded-full bg-[#2070e6]" />;
  }
  if (status === 'in_progress') {
    return <span className="size-2 rounded-full border border-[#2070e6] bg-background" />;
  }
  return (
    <span className="size-2 rounded-full border border-dashed border-[rgba(32,32,32,0.3)] bg-background" />
  );
}

function ReadinessIcon({ readiness }: { readiness: ReadinessBand }) {
  const iconClass = {
    high: 'text-emerald-600',
    medium: 'text-amber-500',
    low: 'text-zinc-400',
  }[readiness];
  const Icon = { high: SignalHigh, medium: SignalMedium, low: SignalLow }[readiness];
  return <Icon className={`size-3.5 ${iconClass}`} />;
}

type DialogStep = 'closed' | 'name';

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

  const handleNameSubmit = async () => {
    if (!projectName.trim()) return;
    setDialogStep('closed');
    try {
      const project = await createProjectMutation.createProject({ name: projectName.trim() });
      navigateToProject(project.id);
    } catch {
      setDialogStep('name');
      // The shared mutation hook surfaces the failure state in the UI.
    }
  };

  const handleClose = () => {
    setDialogStep('closed');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        {createProjectMutation.errorMessage && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {createProjectMutation.errorMessage}
          </p>
        )}

        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-rule bg-[#f7f7f7] px-8 py-16 text-center">
            <p className="text-base font-medium tracking-[-0.015em] text-sub">No specifications yet</p>
            <p className="max-w-sm text-sm leading-relaxed text-sub">
              Create your first specification to start the interview process.
            </p>
            <div className="mt-2">
              <Button
                variant="primary"
                onClick={handleOpen}
                disabled={createProjectMutation.isPending}
                className="h-10 px-5 text-base"
              >
                {createProjectMutation.isPending ? 'Creating...' : 'New specification'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <EmptyCard
              title="Specification"
              description="Start the interview to generate your next spec draft."
              className="mb-4"
            >
              <div className="mt-3">
                <Button variant="primary" onClick={handleOpen} disabled={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? 'Creating...' : 'New specification'}
                </Button>
              </div>
            </EmptyCard>

            <div className="grid grid-cols-2 gap-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to="/project/$id"
                  params={{ id: String(project.id) }}
                  className="block"
                >
                  <div className="cursor-pointer overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-tint">
                    <div className="text-sm-plus leading-snug font-medium text-ink">{project.name}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-hint">Phase</span>
                      <span className="text-xs font-medium text-[#2070e6]">
                        {getCurrentPhaseInfo(project.workflowSummary).number}/{phaseOrder.length} –{' '}
                        {getCurrentPhaseInfo(project.workflowSummary).label}
                      </span>
                      <span className="flex items-center gap-1">
                        {phaseOrder.map((phase) => (
                          <PhaseDot key={phase} status={project.workflowSummary[phase]} />
                        ))}
                      </span>
                      {project.workflowSummary.currentReadiness ? (
                        <ReadinessIcon readiness={project.workflowSummary.currentReadiness} />
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-hint">
                      Updated: {new Date(project.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <Dialog open={dialogStep !== 'closed'} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent>
            {dialogStep === 'name' && (
              <>
                <DialogHeader>
                  <DialogTitle>New specification</DialogTitle>
                  <DialogDescription>Give your specification a name.</DialogDescription>
                </DialogHeader>
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleNameSubmit()}
                  placeholder="Specification name"
                  autoFocus
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <DialogFooter>
                  <ShadcnButton onClick={() => void handleNameSubmit()} disabled={!projectName.trim()}>
                    Create specification
                  </ShadcnButton>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
