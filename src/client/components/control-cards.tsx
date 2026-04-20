import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@/client/components/app-shell';
import { cn } from '@/client/lib/utils';
import type { WorkflowPhase } from '@/shared/api-types.js';
import {
  groundingStrategyChoices,
  groundingStrategyKickoffDescription,
  groundingStrategyKickoffQuestion,
} from '@/shared/grounding-strategy.js';
import { getPhaseClosureCommandText } from '@/shared/phase-close.js';
import { getWorkflowPhaseLabel } from '@/shared/phase-descriptors.js';
import type { SpecificationMode, SpecificationTurn } from '@/shared/specification.js';

function isReviewPhase(phase: WorkflowPhase) {
  return phase === 'requirements' || phase === 'criteria';
}

export function TranscriptMetaPlaceholder({
  label,
  detail,
  testId,
}: {
  label: string;
  detail?: string | null;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="my-2 rounded-lg border border-dashed border-rule bg-tint px-3 py-2 text-xs text-sub"
    >
      <p className="font-medium text-ink">{label}</p>
      {detail ? <p className="mt-1 leading-relaxed">{detail}</p> : null}
    </div>
  );
}

export function WorkspaceStateCard({
  eyebrow,
  title,
  description,
  children,
  testId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="border-b border-rule py-3"
      {...(testId ? { 'data-testid': testId } : { 'data-testid': 'workspace-state-card' })}
    >
      <p className="text-xxs text-hint">{eyebrow}</p>
      <h2 className="mt-0.5 text-sm font-medium text-ink">{title}</h2>
      <p className="mt-1 text-xs-plus leading-relaxed text-sub">{description}</p>
      {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function ReviewPhaseBanner({ phase }: { phase: WorkflowPhase }) {
  return (
    <TranscriptMetaPlaceholder
      testId="review-phase-banner"
      label={`${getWorkflowPhaseLabel(phase)} workspace`}
      detail="This phase is staged as a structured review, not a freeform chat transcript."
    />
  );
}

function PhaseTransitionArtifactCard({
  eyebrow,
  title,
  description,
  children,
  testId,
  tone,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  testId?: string;
  tone: 'completion' | 'handoff';
}) {
  const isCompletion = tone === 'completion';

  return (
    <div
      className={cn(
        'border-t py-3',
        isCompletion ? 'border-[rgba(22,163,74,0.25)]' : 'border-[rgba(32,112,230,0.22)]',
      )}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full',
            isCompletion ? 'bg-[rgba(22,163,74,0.12)]' : 'bg-[rgba(32,112,230,0.12)]',
          )}
        >
          {isCompletion ? (
            <Check className="size-3.5 text-[#16a34a]" />
          ) : (
            <ArrowRight className="size-3.5 text-[#2070e6]" />
          )}
        </div>
        <div className="flex flex-col">
          <p className="text-xxs text-hint">{eyebrow}</p>
          <h2 className="mt-0.5 text-sm font-medium text-ink">{title}</h2>
          <p className="mt-1 text-xs-plus leading-relaxed text-sub">{description}</p>
          {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function getReviewPhaseControlCopy(phase: WorkflowPhase) {
  if (phase === 'requirements') {
    return {
      kickoffTitle: 'Requirements review',
      kickoffDescription: 'This phase is ready to assemble the current requirement set for review.',
      recoveryTitle: 'Restore the current requirements review',
      recoveryDescription: 'The current requirements review frontier is missing. Continue to restore it.',
      proposalTitle: 'Requirements review ready to accept',
      confirmLabel: 'Accept reviewed requirements',
    };
  }

  if (phase === 'criteria') {
    return {
      kickoffTitle: 'Acceptance Criteria review',
      kickoffDescription: 'This phase is ready to assemble the current acceptance criteria set for review.',
      recoveryTitle: 'Restore the current acceptance criteria review',
      recoveryDescription:
        'The current acceptance criteria review frontier is missing. Continue to restore it.',
      proposalTitle: 'Acceptance Criteria review ready to accept',
      confirmLabel: 'Accept reviewed criteria',
    };
  }

  return null;
}

export function KickoffControlCard({
  phase,
  mode,
  onProceed,
  onSelectStrategy,
  disabled,
}: {
  phase: WorkflowPhase;
  mode: 'start' | 'continue';
  onProceed: () => void;
  onSelectStrategy?: (mode: SpecificationMode) => void;
  disabled: boolean;
}) {
  const phaseLabel = getWorkflowPhaseLabel(phase);
  const showsGroundingStrategyChoice = phase === 'scope' && mode === 'start' && Boolean(onSelectStrategy);
  const reviewCopy = getReviewPhaseControlCopy(phase);

  return (
    <WorkspaceStateCard
      testId="kickoff-control-card"
      eyebrow={mode === 'start' ? 'Phase kickoff' : 'Continue phase'}
      title={
        showsGroundingStrategyChoice
          ? groundingStrategyKickoffQuestion
          : reviewCopy
            ? reviewCopy.kickoffTitle
            : `${phaseLabel} phase`
      }
      description={
        showsGroundingStrategyChoice
          ? groundingStrategyKickoffDescription
          : reviewCopy
            ? reviewCopy.kickoffDescription
            : mode === 'start'
              ? `This phase is ready to begin. Proceed to generate the first ${isReviewPhase(phase) ? 'review step' : 'interview turn'}.`
              : `This phase is open but has no current frontier turn. Proceed to generate the next ${isReviewPhase(phase) ? 'review step' : 'interview turn'}.`
      }
    >
      {showsGroundingStrategyChoice ? (
        <div className="flex w-full flex-col gap-3">
          {groundingStrategyChoices.map((choice) => (
            <button
              key={choice.mode}
              type="button"
              data-testid={`kickoff-strategy-option-${choice.mode}`}
              onClick={() => onSelectStrategy?.(choice.mode)}
              disabled={disabled}
              className={cn(
                'rounded-lg border border-rule p-4 text-left transition-colors',
                disabled ? 'cursor-not-allowed bg-wash text-hint' : 'bg-white hover:bg-tint',
              )}
            >
              <div className="text-sm-plus font-medium text-ink">{choice.title}</div>
              <div className="mt-1 text-xs-plus text-sub">{choice.description}</div>
            </button>
          ))}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={onProceed} disabled={disabled}>
          Proceed
        </Button>
      )}
    </WorkspaceStateCard>
  );
}

export function RecoveryControlCard({
  phase,
  onRecover,
  disabled,
}: {
  phase: WorkflowPhase;
  onRecover: () => void;
  disabled: boolean;
}) {
  const reviewCopy = getReviewPhaseControlCopy(phase);

  return (
    <WorkspaceStateCard
      eyebrow="Recovery needed"
      title={reviewCopy ? reviewCopy.recoveryTitle : `Restore the next interview turn`}
      description={
        reviewCopy
          ? reviewCopy.recoveryDescription
          : `The last ${getWorkflowPhaseLabel(phase).toLowerCase()} turn is complete, but the next frontier is missing. Continue to recover it.`
      }
    >
      <Button
        variant="outline"
        size="sm"
        data-testid="recovery-control-card"
        onClick={onRecover}
        disabled={disabled}
      >
        Continue
      </Button>
    </WorkspaceStateCard>
  );
}

export function PhaseSummaryCard({
  phase,
  summary,
  onConfirm,
  disabled,
}: {
  phase: SpecificationTurn['phase'];
  summary: string;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const reviewCopy = getReviewPhaseControlCopy(phase);

  return (
    <div className="border-t border-rule py-3">
      <div className="text-sm font-medium text-ink">
        {reviewCopy ? reviewCopy.proposalTitle : `${getWorkflowPhaseLabel(phase)} closure proposal`}
      </div>
      <p className="mt-1 text-xs-plus leading-relaxed text-sub">{summary}</p>
      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onConfirm} disabled={disabled}>
          {reviewCopy
            ? reviewCopy.confirmLabel
            : getPhaseClosureCommandText({ kind: 'confirm-proposed-phase-closure', phase })}
        </Button>
      </div>
    </div>
  );
}

export function AcceptedClosureCard({ phase, summary }: { phase: WorkflowPhase; summary: string }) {
  return (
    <PhaseTransitionArtifactCard
      eyebrow="Phase closure confirmed"
      title={`${getWorkflowPhaseLabel(phase)} closure confirmed`}
      description={summary}
      tone="completion"
    />
  );
}

export function PhaseHandoffCard({
  phase,
  nextPhase,
  summary,
  children,
}: {
  phase: WorkflowPhase;
  nextPhase: WorkflowPhase;
  summary: string | null;
  children?: React.ReactNode;
}) {
  return (
    <PhaseTransitionArtifactCard
      testId="phase-handoff-card"
      eyebrow="Phase handoff"
      title={`${getWorkflowPhaseLabel(phase)} complete — next: ${getWorkflowPhaseLabel(nextPhase)}`}
      description={
        summary ??
        `${getWorkflowPhaseLabel(phase)} is closed. Continue to ${getWorkflowPhaseLabel(nextPhase)} when you are ready.`
      }
      tone="handoff"
    >
      {children}
    </PhaseTransitionArtifactCard>
  );
}
