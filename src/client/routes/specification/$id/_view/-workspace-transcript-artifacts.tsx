import {
  AcceptedClosureCard,
  KickoffControlCard,
  PhaseHandoffCard,
  PhaseSummaryCard,
  RecoveryControlCard,
  TranscriptMetaPlaceholder,
} from '@/client/components/control-cards';
import {
  ActiveGroundingCard,
  ActiveQuestionCard,
  ActiveReviewSetCard,
  AnsweredGroundingCard,
  AnsweredQuestionCard,
  AnsweredReviewSetCard,
  CollapsedReviewCard,
  GeneratingTurnPlaceholder,
  RevisionCard,
} from '@/client/components/question-cards';
import { ReviewPhaseCompletionCard } from '@/client/components/review-set-card';
import type { ActivitySummary } from '@/shared/chat.js';
import { getPhaseRoutePath, getWorkflowPhaseLabel } from '@/shared/phase-descriptors.js';
import { getReviewRevisionNumber } from '@/shared/review-diffing.js';
import {
  getPersistedReviewSet,
  getPersistedSelectedPositions,
  getPersistedTurnResponse,
  getReviewPositionForAction,
  turnHasCompletedAnswer,
} from '@/shared/specification-state.js';
import type { SpecificationTurn } from '@/shared/specification.js';

import {
  WorkspaceArtifactActionLink,
  WorkspaceArtifactRow,
  WorkspaceWorkflowCompleteCard,
} from './-workspace-artifact-primitives.js';
import type { WorkspaceStreamArtifact } from './-workspace-stream-projector.js';

function getReviewPhaseCompletionDescription(
  phase: SpecificationTurn['phase'],
  summary: string | null,
  nextPhase: SpecificationTurn['phase'] | null,
) {
  if (summary) {
    return summary;
  }

  if (phase === 'requirements' && nextPhase) {
    return `The reviewed requirement set is accepted and ready for ${getWorkflowPhaseLabel(nextPhase).toLowerCase()}.`;
  }

  return 'The accepted criteria set is ready for export.';
}

function renderWorkspaceHistoryArtifact({
  artifact,
  captureStatusByTurnId,
  renderPersistedActivity,
}: {
  artifact: Extract<
    WorkspaceStreamArtifact,
    | { kind: 'phase-section-header' }
    | { kind: 'phase-marker' }
    | { kind: 'control-marker' }
    | { kind: 'answered-turn' }
    | { kind: 'answered-grounding-card' }
    | { kind: 'answered-grounding-question' }
    | { kind: 'answered-review-turn' }
    | { kind: 'answered-revision-review' }
    | { kind: 'collapsed-review-turn' }
    | { kind: 'accepted-closure' }
    | { kind: 'divider' }
  >;
  captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>;
  renderPersistedActivity: (turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined) => React.ReactNode;
}) {
  switch (artifact.kind) {
    case 'phase-section-header':
      return (
        <TranscriptMetaPlaceholder
          key={`phase-section-header-${artifact.phase}`}
          label={artifact.purpose}
          detail={artifact.knowledgeKinds}
          testId={`phase-section-header-${artifact.phase}`}
        />
      );
    case 'phase-marker':
    case 'control-marker':
      return (
        <TranscriptMetaPlaceholder
          key={`${artifact.kind}-${artifact.marker.label}`}
          label={artifact.marker.label}
          detail={artifact.marker.detail}
          testId={artifact.marker.testId}
        />
      );
    case 'answered-turn':
      return (
        <WorkspaceArtifactRow
          key={`answered-turn-${artifact.turn.id}`}
          activity={renderPersistedActivity(artifact.turn)}
        >
          <AnsweredQuestionCard
            turn={artifact.turn}
            questionCode={artifact.questionCode}
            captureStatus={captureStatusByTurnId.get(artifact.turn.id)}
          />
        </WorkspaceArtifactRow>
      );
    case 'answered-grounding-card':
      return (
        <WorkspaceArtifactRow
          key={`answered-grounding-card-${artifact.turn.id}`}
          activity={renderPersistedActivity(artifact.turn)}
        >
          <AnsweredGroundingCard groundingCard={artifact.groundingCard} turn={artifact.turn} />
        </WorkspaceArtifactRow>
      );
    case 'answered-grounding-question':
      return (
        <WorkspaceArtifactRow
          key={`answered-grounding-question-${artifact.turn.id}`}
          activity={renderPersistedActivity(artifact.turn)}
        >
          <AnsweredGroundingCard groundingCard={artifact.groundingCard} turn={artifact.turn} />
          <AnsweredQuestionCard
            turn={artifact.turn}
            questionCode={artifact.questionCode}
            captureStatus={captureStatusByTurnId.get(artifact.turn.id)}
          />
        </WorkspaceArtifactRow>
      );
    case 'answered-review-turn':
      return (
        <WorkspaceArtifactRow
          key={`answered-review-turn-${artifact.turn.id}`}
          activity={renderPersistedActivity(artifact.turn)}
        >
          <AnsweredReviewSetCard
            turn={artifact.turn}
            reviewSet={artifact.reviewSet}
            revisionNumber={artifact.revisionNumber}
          />
        </WorkspaceArtifactRow>
      );
    case 'answered-revision-review':
      return (
        <WorkspaceArtifactRow
          key={`answered-revision-review-${artifact.turn.id}`}
          activity={renderPersistedActivity(artifact.turn)}
        >
          <RevisionCard revisionNumber={artifact.revisionNumber} changeSummary={artifact.changeSummary} />
          <AnsweredReviewSetCard
            turn={artifact.turn}
            reviewSet={artifact.reviewSet}
            revisionNumber={artifact.revisionNumber}
          />
        </WorkspaceArtifactRow>
      );
    case 'collapsed-review-turn':
      return (
        <div key={`collapsed-review-turn-${artifact.turn.id}`}>
          <CollapsedReviewCard
            revisionNumber={artifact.revisionNumber}
            reviewAction={artifact.reviewAction}
          />
        </div>
      );
    case 'accepted-closure':
      return (
        <WorkspaceArtifactRow
          key={`accepted-closure-${artifact.acceptedClosure.turnId}`}
          activity={renderPersistedActivity(artifact.turn)}
          testId="accepted-closure-card"
        >
          <AcceptedClosureCard
            phase={artifact.acceptedClosure.phase}
            summary={artifact.acceptedClosure.summary}
          />
        </WorkspaceArtifactRow>
      );
    case 'divider':
      return <hr key="workspace-stream-divider" className="my-6 border-rule" />;
  }
}

function renderWorkspaceInteractiveArtifact({
  artifact,
  showLockedState,
  phaseTurns,
  renderPersistedActivity,
  renderLiveActivity,
}: {
  artifact: Extract<
    WorkspaceStreamArtifact,
    | { kind: 'persisted-turn' }
    | { kind: 'persisted-grounding-card' }
    | { kind: 'persisted-grounding-question' }
    | { kind: 'pending-question' }
    | { kind: 'kickoff' }
    | { kind: 'recovery' }
    | { kind: 'phase-summary' }
    | { kind: 'generating' }
  >;
  showLockedState: boolean;
  phaseTurns: readonly SpecificationTurn[];
  renderPersistedActivity: (turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined) => React.ReactNode;
  renderLiveActivity: (activitySummary: ActivitySummary | null | undefined) => React.ReactNode;
}) {
  switch (artifact.kind) {
    case 'persisted-turn': {
      const reviewSet = getPersistedReviewSet(artifact.artifact.turn);

      return (
        <WorkspaceArtifactRow
          key={`persisted-turn-${artifact.artifact.turn.id}`}
          activity={
            artifact.artifact.liveActivity
              ? renderLiveActivity(artifact.artifact.liveActivity)
              : renderPersistedActivity(artifact.artifact.turn)
          }
          errorMessage={artifact.artifact.errorMessage}
        >
          {reviewSet ? (
            <ActiveReviewSetCard
              question={artifact.artifact.turn.question}
              why={artifact.artifact.turn.why}
              onSubmitReviewAction={(reviewAction, freeText, itemComments) => {
                const position = getReviewPositionForAction(artifact.artifact.turn, reviewAction);
                if (position === null) {
                  return;
                }

                return artifact.artifact.submitTurnResponse([position], freeText, reviewAction, itemComments);
              }}
              persistedFreeText={getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''}
              hasPersistedResponse={
                artifact.artifact.state === 'submitted' && turnHasCompletedAnswer(artifact.artifact.turn)
              }
              disabled={artifact.artifact.disabled}
              state={artifact.artifact.state}
              reviewSet={reviewSet}
              revisionNumber={getReviewRevisionNumber(artifact.artifact.turn, phaseTurns)}
            />
          ) : (
            <ActiveQuestionCard
              id={`persisted-turn-${artifact.artifact.turn.id}`}
              questionCode={artifact.questionCode}
              question={artifact.artifact.turn.question}
              why={artifact.artifact.turn.why}
              impact={artifact.artifact.turn.impact}
              options={artifact.artifact.turn.options ?? []}
              onSubmitResponse={artifact.artifact.submitTurnResponse}
              persistedSelectedPositions={getPersistedSelectedPositions(artifact.artifact.turn)}
              persistedFreeText={getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''}
              hasPersistedResponse={
                artifact.artifact.state === 'submitted' && turnHasCompletedAnswer(artifact.artifact.turn)
              }
              disabled={artifact.artifact.disabled}
              state={artifact.artifact.state}
            />
          )}
        </WorkspaceArtifactRow>
      );
    }
    case 'persisted-grounding-card':
      return (
        <WorkspaceArtifactRow
          key={`persisted-grounding-card-${artifact.artifact.turn.id}`}
          activity={
            artifact.artifact.liveActivity
              ? renderLiveActivity(artifact.artifact.liveActivity)
              : renderPersistedActivity(artifact.artifact.turn)
          }
          errorMessage={artifact.artifact.errorMessage}
        >
          <ActiveGroundingCard
            groundingCard={artifact.groundingCard}
            onSubmitResponse={artifact.artifact.submitTurnResponse}
            persistedFreeText={getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''}
            hasPersistedResponse={
              artifact.artifact.state === 'submitted' && turnHasCompletedAnswer(artifact.artifact.turn)
            }
            disabled={artifact.artifact.disabled}
            state={artifact.artifact.state}
            continuePosition={artifact.artifact.turn.options?.[0]?.position}
          />
        </WorkspaceArtifactRow>
      );
    case 'persisted-grounding-question':
      return (
        <WorkspaceArtifactRow
          key={`persisted-grounding-question-${artifact.artifact.turn.id}`}
          activity={
            artifact.artifact.liveActivity
              ? renderLiveActivity(artifact.artifact.liveActivity)
              : renderPersistedActivity(artifact.artifact.turn)
          }
          errorMessage={artifact.artifact.errorMessage}
        >
          <AnsweredGroundingCard groundingCard={artifact.groundingCard} turn={artifact.artifact.turn} />
          <ActiveQuestionCard
            id={`persisted-grounding-question-${artifact.artifact.turn.id}`}
            questionCode={artifact.questionCode}
            question={artifact.artifact.turn.question}
            why={artifact.artifact.turn.why}
            impact={artifact.artifact.turn.impact}
            options={artifact.artifact.turn.options ?? []}
            onSubmitResponse={artifact.artifact.submitTurnResponse}
            persistedSelectedPositions={getPersistedSelectedPositions(artifact.artifact.turn)}
            persistedFreeText={getPersistedTurnResponse(artifact.artifact.turn)?.freeText?.trim() ?? ''}
            hasPersistedResponse={
              artifact.artifact.state === 'submitted' && turnHasCompletedAnswer(artifact.artifact.turn)
            }
            disabled={artifact.artifact.disabled}
            state={artifact.artifact.state}
          />
        </WorkspaceArtifactRow>
      );
    case 'pending-question': {
      const pendingReviewSet = artifact.artifact.pendingQuestion.reviewSet;
      return (
        <WorkspaceArtifactRow
          key={artifact.artifact.pendingQuestion.id}
          activity={renderLiveActivity(artifact.artifact.liveActivity)}
        >
          {pendingReviewSet ? (
            <ActiveReviewSetCard
              question={artifact.artifact.pendingQuestion.question}
              why={artifact.artifact.pendingQuestion.why}
              persistedFreeText=""
              hasPersistedResponse={false}
              disabled={artifact.artifact.disabled}
              state="active"
              reviewSet={pendingReviewSet}
              revisionNumber={
                phaseTurns.filter(
                  (t) => getPersistedReviewSet(t) && getPersistedTurnResponse(t)?.reviewAction,
                ).length + 1
              }
            />
          ) : (
            <ActiveQuestionCard
              id={artifact.artifact.pendingQuestion.id}
              questionCode={artifact.questionCode}
              question={artifact.artifact.pendingQuestion.question}
              why={artifact.artifact.pendingQuestion.why}
              impact={artifact.artifact.pendingQuestion.impact}
              options={artifact.artifact.pendingQuestion.options}
              persistedSelectedPositions={[]}
              persistedFreeText=""
              hasPersistedResponse={false}
              disabled={artifact.artifact.disabled}
              state="active"
            />
          )}
        </WorkspaceArtifactRow>
      );
    }
    case 'kickoff':
      return !showLockedState ? (
        <WorkspaceArtifactRow
          key={`kickoff-${artifact.artifact.kickoff.phase}-${artifact.artifact.kickoff.mode}`}
          errorMessage={artifact.artifact.errorMessage}
        >
          <KickoffControlCard
            phase={artifact.artifact.kickoff.phase}
            mode={artifact.artifact.kickoff.mode}
            onProceed={() => artifact.artifact.submitKickoff()}
            onSelectStrategy={(mode) => artifact.artifact.submitKickoff(mode)}
            disabled={artifact.artifact.disabled}
          />
        </WorkspaceArtifactRow>
      ) : null;
    case 'recovery':
      return !showLockedState ? (
        <WorkspaceArtifactRow
          key={`recovery-${artifact.artifact.recovery.phase}`}
          errorMessage={artifact.artifact.errorMessage}
        >
          <RecoveryControlCard
            phase={artifact.artifact.recovery.phase}
            onRecover={artifact.artifact.submitRecovery}
            disabled={artifact.artifact.disabled}
          />
        </WorkspaceArtifactRow>
      ) : null;
    case 'phase-summary':
      return (
        <WorkspaceArtifactRow
          key={`phase-summary-${artifact.artifact.phaseSummary.turnId}`}
          activity={renderPersistedActivity(
            phaseTurns.find((turn) => turn.id === artifact.artifact.phaseSummary.turnId),
          )}
        >
          <PhaseSummaryCard
            phase={artifact.artifact.phaseSummary.phase}
            summary={artifact.artifact.phaseSummary.summary}
            disabled={artifact.artifact.disabled}
            onConfirm={artifact.artifact.confirmPhaseSummary}
          />
        </WorkspaceArtifactRow>
      );
    case 'generating':
      return (
        <GeneratingTurnPlaceholder
          key="generating-turn-placeholder"
          liveActivity={artifact.artifact.liveActivity}
          liveReasoningText={artifact.artifact.liveReasoningText}
        />
      );
  }
}

function renderWorkspaceTransitionArtifact({
  artifact,
  specificationId,
}: {
  artifact: Extract<WorkspaceStreamArtifact, { kind: 'phase-handoff' } | { kind: 'workflow-complete' }>;
  specificationId: string;
}) {
  if (artifact.artifact.isReviewPhase) {
    return (
      <ReviewPhaseCompletionCard
        key={`${artifact.kind}-${artifact.artifact.phase}`}
        testId="review-phase-completion-card"
        eyebrow={artifact.kind === 'workflow-complete' ? 'Workflow complete' : 'Review phase complete'}
        title={`${getWorkflowPhaseLabel(artifact.artifact.phase)} review is complete`}
        description={getReviewPhaseCompletionDescription(
          artifact.artifact.phase,
          artifact.artifact.summary,
          artifact.kind === 'phase-handoff' ? artifact.artifact.nextPhase : null,
        )}
        action={
          artifact.kind === 'workflow-complete' ? (
            <WorkspaceArtifactActionLink
              specificationId={specificationId}
              to="/specification/$id/export"
              className="mt-3"
            >
              Open export preview
            </WorkspaceArtifactActionLink>
          ) : (
            <WorkspaceArtifactActionLink
              specificationId={specificationId}
              to={getPhaseRoutePath(artifact.artifact.nextPhase)}
              className="mt-3"
            >
              Continue to {getWorkflowPhaseLabel(artifact.artifact.nextPhase)}
            </WorkspaceArtifactActionLink>
          )
        }
      />
    );
  }

  if (artifact.kind === 'phase-handoff') {
    return (
      <PhaseHandoffCard
        key={`${artifact.kind}-${artifact.artifact.phase}`}
        phase={artifact.artifact.phase}
        nextPhase={artifact.artifact.nextPhase}
        summary={artifact.artifact.summary}
      >
        <WorkspaceArtifactActionLink
          specificationId={specificationId}
          to={getPhaseRoutePath(artifact.artifact.nextPhase)}
          className="mt-1"
        >
          Continue to {getWorkflowPhaseLabel(artifact.artifact.nextPhase)}
        </WorkspaceArtifactActionLink>
      </PhaseHandoffCard>
    );
  }

  return (
    <WorkspaceWorkflowCompleteCard
      key={`${artifact.kind}-${artifact.artifact.phase}`}
      specificationId={specificationId}
      summary={artifact.artifact.summary}
    />
  );
}

export function WorkspaceTranscriptArtifacts({
  streamArtifacts,
  specificationId,
  phaseTurns,
  captureStatusByTurnId,
  showLockedState,
  renderPersistedActivity,
  renderLiveActivity,
}: {
  streamArtifacts: readonly WorkspaceStreamArtifact[];
  specificationId: string;
  phaseTurns: readonly SpecificationTurn[];
  captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>;
  showLockedState: boolean;
  renderPersistedActivity: (turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined) => React.ReactNode;
  renderLiveActivity: (activitySummary: ActivitySummary | null | undefined) => React.ReactNode;
}) {
  return streamArtifacts.map((artifact, index) => {
    const artifactNode = (() => {
      switch (artifact.kind) {
        case 'phase-section-header':
        case 'phase-marker':
        case 'control-marker':
        case 'answered-turn':
        case 'answered-grounding-card':
        case 'answered-grounding-question':
        case 'answered-review-turn':
        case 'answered-revision-review':
        case 'collapsed-review-turn':
        case 'accepted-closure':
        case 'divider':
          return renderWorkspaceHistoryArtifact({
            artifact,
            captureStatusByTurnId,
            renderPersistedActivity,
          });
        case 'persisted-turn':
        case 'persisted-grounding-card':
        case 'persisted-grounding-question':
        case 'pending-question':
        case 'kickoff':
        case 'recovery':
        case 'phase-summary':
        case 'generating':
          return renderWorkspaceInteractiveArtifact({
            artifact,
            showLockedState,
            phaseTurns,
            renderPersistedActivity,
            renderLiveActivity,
          });
        case 'phase-handoff':
        case 'workflow-complete':
          return renderWorkspaceTransitionArtifact({ artifact, specificationId });
      }
    })();

    if (artifact.kind === 'divider') {
      return <div key={`${artifact.kind}-${index}`}>{artifactNode}</div>;
    }

    return (
      <div key={`${artifact.kind}-${index}`} className="mx-auto w-full max-w-2xl">
        {artifactNode}
      </div>
    );
  });
}
