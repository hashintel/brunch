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
import { useCreateSpecificationMutation } from '@/client/mutations/project-mutations';
import type { ProjectListItem, ReadinessBand, WorkflowPhaseStatus } from '@/shared/api-types.js';
import { groundingPhaseLabel, workflowPhaseLabels } from '@/shared/phase-display.js';
import { phaseOrder } from '@/shared/phase-routes.js';

const specificationListRouteApi = getRouteApi('/');

type SpecificationListItem = ProjectListItem;

type DialogStep = 'closed' | 'name';

function getCurrentPhaseInfo(summary: SpecificationListItem['workflowSummary']): {
  label: string;
  number: number;
} {
  for (let i = 0; i < phaseOrder.length; i++) {
    if (summary[phaseOrder[i]!] === 'in_progress') {
      return { label: workflowPhaseLabels[phaseOrder[i]!], number: i + 1 };
    }
  }
  if (phaseOrder.every((phase) => summary[phase] === 'closed')) {
    return { label: 'Complete', number: phaseOrder.length };
  }
  return { label: groundingPhaseLabel, number: 1 };
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

export async function fetchSpecificationListLoaderData(): Promise<SpecificationListItem[]> {
  const response = await fetch('/api/projects');
  if (!response.ok) {
    throw new Error('Failed to load specifications');
  }

  return response.json() as Promise<SpecificationListItem[]>;
}

export function SpecificationList() {
  const specifications = specificationListRouteApi.useLoaderData();
  const navigate = useNavigate();
  const createSpecificationMutation = useCreateSpecificationMutation();
  const [dialogStep, setDialogStep] = useState<DialogStep>('closed');
  const [specificationName, setSpecificationName] = useState('');

  const navigateToSpecification = (specificationId: number) => {
    void navigate({ to: '/project/$id', params: { id: String(specificationId) } });
  };

  const handleOpen = () => {
    setSpecificationName('');
    createSpecificationMutation.clearError();
    setDialogStep('name');
  };

  const handleNameSubmit = async () => {
    if (!specificationName.trim()) return;
    setDialogStep('closed');
    try {
      const specification = await createSpecificationMutation.createSpecification({
        name: specificationName.trim(),
      });
      navigateToSpecification(specification.id);
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
        {createSpecificationMutation.errorMessage && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {createSpecificationMutation.errorMessage}
          </p>
        )}

        {specifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-rule bg-[#f7f7f7] px-8 py-16 text-center">
            <p className="text-base font-medium tracking-[-0.015em] text-sub">No specifications yet</p>
            <p className="max-w-sm text-sm leading-relaxed text-sub">
              Create your first specification to start the interview process.
            </p>
            <div className="mt-2">
              <Button
                variant="primary"
                onClick={handleOpen}
                disabled={createSpecificationMutation.isPending}
                className="h-10 px-5 text-base"
              >
                {createSpecificationMutation.isPending ? 'Creating...' : 'New specification'}
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
                <Button
                  variant="primary"
                  onClick={handleOpen}
                  disabled={createSpecificationMutation.isPending}
                >
                  {createSpecificationMutation.isPending ? 'Creating...' : 'New specification'}
                </Button>
              </div>
            </EmptyCard>

            <div className="grid grid-cols-2 gap-3">
              {specifications.map((specification) => (
                <Link
                  key={specification.id}
                  to="/project/$id"
                  params={{ id: String(specification.id) }}
                  className="block"
                >
                  <div className="cursor-pointer overflow-hidden rounded-xl border border-rule bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-tint">
                    <div className="text-sm-plus leading-snug font-medium text-ink">{specification.name}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-hint">Phase</span>
                      <span className="text-xs font-medium text-[#2070e6]">
                        {getCurrentPhaseInfo(specification.workflowSummary).number}/{phaseOrder.length} –{' '}
                        {getCurrentPhaseInfo(specification.workflowSummary).label}
                      </span>
                      <span className="flex items-center gap-1">
                        {phaseOrder.map((phase) => (
                          <PhaseDot key={phase} status={specification.workflowSummary[phase]} />
                        ))}
                      </span>
                      {specification.workflowSummary.currentReadiness ? (
                        <ReadinessIcon readiness={specification.workflowSummary.currentReadiness} />
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-hint">
                      Updated: {new Date(specification.updated_at).toLocaleDateString()}
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
                  value={specificationName}
                  onChange={(event) => setSpecificationName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleNameSubmit()}
                  placeholder="Specification name"
                  autoFocus
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <DialogFooter>
                  <ShadcnButton onClick={() => void handleNameSubmit()} disabled={!specificationName.trim()}>
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
