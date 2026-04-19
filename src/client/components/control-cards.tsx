import { ArrowRight, Check } from 'lucide-react';

import { cn } from '@/client/lib/utils';
import type { ProjectMode, ProjectStateTurn, WorkflowPhase } from '@/shared/api-types.js';
import {
  groundingStrategyChoices,
  groundingStrategyKickoffDescription,
  groundingStrategyKickoffQuestion,
} from '@/shared/grounding-strategy.js';
import { getPhaseClosureCommandText } from '@/shared/phase-close.js';
import { getWorkflowPhaseLabel } from '@/shared/phase-display.js';

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
      className="my-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      <p className="font-medium text-foreground/80">{label}</p>
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
      className="my-3 rounded-xl border bg-card p-4 shadow-sm"
      {...(testId ? { 'data-testid': testId } : { 'data-testid': 'workspace-state-card' })}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
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
        'my-3 overflow-hidden rounded-xl border p-5 shadow-[var(--shadow-card-ring)]',
        isCompletion
          ? 'border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.06)]'
          : 'border-[rgba(32,112,230,0.18)] bg-[rgba(32,112,230,0.05)]',
      )}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <div className="flex items-center gap-2">
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
        <p className="text-xs font-semibold uppercase tracking-wide text-sub">{eyebrow}</p>
      </div>
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-sub">{description}</p>
      {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
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
  onSelectStrategy?: (mode: ProjectMode) => void;
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
                'rounded-lg border border-input p-4 text-left transition-colors',
                disabled
                  ? 'cursor-not-allowed bg-muted text-muted-foreground'
                  : 'bg-background hover:bg-muted/50',
              )}
            >
              <div className="font-medium">{choice.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{choice.description}</div>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onProceed}
          disabled={disabled}
          className={cn(
            'rounded-md border px-3 py-2 text-sm transition-colors',
            disabled
              ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
              : 'border-border bg-background hover:bg-muted',
          )}
        >
          Proceed
        </button>
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
      <button
        type="button"
        data-testid="recovery-control-card"
        onClick={onRecover}
        disabled={disabled}
        className={cn(
          'rounded-md border px-3 py-2 text-sm transition-colors',
          disabled
            ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
            : 'border-border bg-background hover:bg-muted',
        )}
      >
        Continue
      </button>
    </WorkspaceStateCard>
  );
}

export function PhaseSummaryCard({
  phase,
  summary,
  onConfirm,
  disabled,
}: {
  phase: ProjectStateTurn['phase'];
  summary: string;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const reviewCopy = getReviewPhaseControlCopy(phase);

  return (
    <div className="my-3 rounded-lg border bg-card p-4">
      <div className="mb-2 text-[15px] font-semibold">
        {reviewCopy ? reviewCopy.proposalTitle : `${getWorkflowPhaseLabel(phase)} closure proposal`}
      </div>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={cn(
            'rounded-md border px-3 py-2 text-sm transition-colors',
            disabled
              ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
              : 'border-border bg-background hover:bg-muted',
          )}
        >
          {reviewCopy
            ? reviewCopy.confirmLabel
            : getPhaseClosureCommandText({ kind: 'confirm-proposed-phase-closure', phase })}
        </button>
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
