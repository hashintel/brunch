import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';
import { createForceCloseActivePhaseCommand } from '@/shared/phase-close.js';

import {
  advanceHead,
  applyTurnResponseSelections,
  confirmPhaseOutcome,
  createKnowledgeItem,
  createOption,
  createPhaseOutcome,
  createConfirmedPhaseOutcome,
  createSpecification,
  createTurn,
  getOptionsForTurn,
  linkKnowledgeItemToTurn,
  updateTurn,
  type DB,
  type WorkflowPhaseStatus,
} from '../db.js';
import { serializeParts } from '../parts.js';
import {
  createFixtureReviewQuestionInput,
  serializeFixtureAcceptedReviewUserParts,
  serializeFixtureConfirmationUserParts,
  serializeFixtureGroundingCardAssistantParts,
  serializeFixturePhaseConfirmationUserParts,
  serializeFixturePhaseProposalAssistantParts,
  serializeFixtureQuestionAssistantParts,
  serializeFixtureTurnResponseUserParts,
} from './helpers.js';

const code = createKnowledgeReferenceCode;

const issueTrackerRequirementCrudContent =
  'Create, edit, and close tickets with required fields: title, description, priority, and assignee';
const issueTrackerRequirementAuditContent =
  'Every status change records the actor identity and ISO 8601 timestamp in the audit log';
const issueTrackerRequirementPermissionsContent =
  'Role-based visibility: admins see all tickets and settings, developers see assigned and unassigned tickets, viewers have read-only access';
const issueTrackerCriterionAuditContent =
  'Changing a ticket status creates an audit log entry with actor, previous status, new status, and timestamp';
const issueTrackerCriterionPermissionsContent =
  'A viewer cannot edit a ticket and receives a clear authorization failure without mutating data';
const issueTrackerCriterionPerformanceContent =
  'Filtering 500 tickets by status or assignee returns visible results within two seconds on the seeded fixture';

function seedIssueTrackerSupportingKnowledge(db: DB, projectId: number, turnId: number) {
  const goalLifecycle = createKnowledgeItem(
    db,
    projectId,
    'goal',
    'Launch a lightweight issue tracker that covers the core ticket lifecycle for day-one teams',
  );
  const goalRoles = createKnowledgeItem(
    db,
    projectId,
    'goal',
    'Keep ticket visibility and role-specific actions clear for admins, developers, and viewers',
  );
  const contextFields = createKnowledgeItem(
    db,
    projectId,
    'context',
    'Tickets move through a workflow that always includes title, description, priority, and assignee',
  );
  const contextAudit = createKnowledgeItem(
    db,
    projectId,
    'context',
    'The team needs a trustworthy audit trail whenever ticket status changes',
  );
  const constraintAudit = createKnowledgeItem(
    db,
    projectId,
    'constraint',
    'Audit history must be retained as immutable actor-and-timestamp records',
  );
  const constraintPermissions = createKnowledgeItem(
    db,
    projectId,
    'constraint',
    'Viewer access must stay read-only and must not mutate ticket data or settings',
  );
  const decisionWorkflow = createKnowledgeItem(
    db,
    projectId,
    'decision',
    'Model the first release around one shared ticket record with role-aware actions',
  );
  for (const item of [
    goalLifecycle,
    goalRoles,
    contextFields,
    contextAudit,
    constraintAudit,
    constraintPermissions,
    decisionWorkflow,
  ]) {
    linkKnowledgeItemToTurn(db, item.id, turnId, 'captured');
  }

  return {
    goalLifecycle,
    goalRoles,
    contextFields,
    contextAudit,
    constraintAudit,
    constraintPermissions,
    decisionWorkflow,
  };
}

function seedIssueTrackerPerformanceAssumption(db: DB, projectId: number, turnId: number) {
  const assumption = createKnowledgeItem(
    db,
    projectId,
    'assumption',
    'A seeded workspace of 500 tickets is representative enough for the first performance walkthrough',
  );
  linkKnowledgeItemToTurn(db, assumption.id, turnId, 'captured');
  return assumption;
}

function seedAcceptedIssueTrackerRequirements(db: DB, projectId: number) {
  const seededRequirements = seedRequirementsReviewReady(db, projectId);
  const requirementsAcceptOption = getOptionsForTurn(db, seededRequirements.reviewTurn.id).find(
    (option) => option.position === 0,
  );

  if (!requirementsAcceptOption) {
    throw new Error('Issue-tracker requirements review seed is missing the accept option');
  }

  applyTurnResponseSelections(db, seededRequirements.reviewTurn.id, [0]);
  updateTurn(db, seededRequirements.reviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: seededRequirements.reviewTurn.id,
      selectedOptionIds: [requirementsAcceptOption.id],
    }),
  });

  const requirementCrud = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    issueTrackerRequirementCrudContent,
  );
  const requirementAudit = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    issueTrackerRequirementAuditContent,
  );
  const requirementPermissions = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    issueTrackerRequirementPermissionsContent,
  );
  for (const requirement of [requirementCrud, requirementAudit, requirementPermissions]) {
    linkKnowledgeItemToTurn(db, requirement.id, seededRequirements.reviewTurn.id, 'reviewed');
  }

  createConfirmedPhaseOutcome(db, {
    projectId,
    phase: 'requirements',
    proposal_turn_id: seededRequirements.reviewTurn.id,
    confirmation_turn_id: seededRequirements.reviewTurn.id,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });
  advanceHead(db, projectId, seededRequirements.reviewTurn.id);

  return {
    ...seededRequirements,
    requirementCrud,
    requirementAudit,
    requirementPermissions,
    requirementsConfirmationTurn: seededRequirements.reviewTurn,
  };
}

export function seedClosedGrounding(db: DB, projectId: number) {
  const groundingTurn = createTurn(db, projectId, {
    phase: 'grounding',
    question: 'What platform?',
    answer: 'Web',
  });
  advanceHead(db, projectId, groundingTurn.id);

  const groundingProposalTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingTurn.id,
    question: '',
    answer: 'We have enough grounding context',
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: groundingTurn.id + 1,
      phase: 'grounding',
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    }),
  });
  advanceHead(db, projectId, groundingProposalTurn.id);

  const groundingOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: 'Goals, terms, context, and constraints are sufficiently captured.',
  });

  const groundingConfirmationTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingProposalTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'grounding',
      proposalTurnId: groundingProposalTurn.id,
    }),
  });
  confirmPhaseOutcome(db, groundingOutcome.id, groundingConfirmationTurn.id);
  advanceHead(db, projectId, groundingConfirmationTurn.id);

  return { groundingTurn, groundingProposalTurn, groundingConfirmationTurn };
}

export function seedGroundingClosurePending(db: DB, projectId: number) {
  const groundingTurn = createTurn(db, projectId, {
    phase: 'grounding',
    question: 'What platform?',
    answer: 'Web',
  });
  advanceHead(db, projectId, groundingTurn.id);

  const groundingProposalTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingTurn.id,
    question: '',
    answer: 'We have enough grounding context',
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: groundingTurn.id + 1,
      phase: 'grounding',
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    }),
  });
  advanceHead(db, projectId, groundingProposalTurn.id);

  createPhaseOutcome(db, {
    projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: 'Goals, terms, context, and constraints are sufficiently captured.',
  });

  return { groundingTurn, groundingProposalTurn };
}

export function seedActiveDesign(db: DB, projectId: number) {
  const seededGrounding = seedClosedGrounding(db, projectId);

  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededGrounding.groundingConfirmationTurn.id,
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  advanceHead(db, projectId, designTurn.id);

  return { ...seededGrounding, designTurn };
}

export function seedRequirementsReady(db: DB, projectId: number) {
  const seededDesign = seedActiveDesign(db, projectId);

  const designOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'design',
    proposal_turn_id: seededDesign.designTurn.id,
    summary: 'The main architectural commitments are captured well enough to review requirements.',
  });

  const designConfirmationTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededDesign.designTurn.id,
    question: '',
    answer: 'Confirm elicitation closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'design',
      proposalTurnId: seededDesign.designTurn.id,
    }),
  });
  confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
  advanceHead(db, projectId, designConfirmationTurn.id);

  return { ...seededDesign, designConfirmationTurn };
}

export function seedRequirementsReviewReady(db: DB, projectId: number) {
  const seededRequirements = seedRequirementsReady(db, projectId);
  seedIssueTrackerSupportingKnowledge(db, projectId, seededRequirements.designConfirmationTurn.id);
  const requirementCrudContent = issueTrackerRequirementCrudContent;
  const requirementAuditContent = issueTrackerRequirementAuditContent;
  const requirementPermissionsContent = issueTrackerRequirementPermissionsContent;

  const reviewTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: seededRequirements.designConfirmationTurn.id,
    question: 'Please review the current requirement set.',
    why: 'Review the whole requirement set before moving forward.',
    impact: 'high',
    answer: null,
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-requirements-review',
      input: createFixtureReviewQuestionInput({
        phase: 'requirements',
        title: 'Requirements',
        prompt: 'Please review the current requirement set.',
        why: 'Review the whole requirement set before moving forward.',
        items: [
          {
            reviewItemId: 'requirements:1',
            referenceCode: code('requirement', 1),
            content: requirementCrudContent,
            rationale: 'Captures the core ticket lifecycle the tool must support from day one.',
            grounding: [
              { code: code('goal', 1) },
              { code: code('context', 1) },
              { code: code('decision', 1) },
            ],
          },
          {
            reviewItemId: 'requirements:2',
            referenceCode: code('requirement', 2),
            content: requirementAuditContent,
            rationale: 'Protects accountability and traceability for regulated workflows.',
            grounding: [{ code: code('context', 2) }, { code: code('constraint', 1) }],
          },
          {
            reviewItemId: 'requirements:3',
            referenceCode: code('requirement', 3),
            content: requirementPermissionsContent,
            rationale: 'Ensures each role sees only the operations appropriate to its responsibility.',
            grounding: [{ code: code('goal', 2) }, { code: code('constraint', 2) }],
            isRevised: true,
          },
        ],
      }),
    }),
  });
  createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, reviewTurn.id, {
    position: 1,
    content: 'Request changes',
  });
  advanceHead(db, projectId, reviewTurn.id);

  return {
    ...seededRequirements,
    reviewTurn,
    requirementCrudContent,
    requirementAuditContent,
    requirementPermissionsContent,
  };
}

function seedClosedRequirementsReview(db: DB, projectId: number, parentTurnId: number) {
  const approvedRequirement = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Resume the interview from SQLite after restart',
  );
  const supportingRequirement = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Keep the local-first persistence seam simple for restart and resume',
  );

  const reviewTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: parentTurnId,
    question: 'Please review the current requirement set.',
    why: 'Review the whole requirement set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-requirements-review',
      input: createFixtureReviewQuestionInput({
        phase: 'requirements',
        title: 'Requirements',
        prompt: 'Please review the current requirement set.',
        why: 'Review the whole requirement set before moving forward.',
        items: [
          {
            reviewItemId: 'requirements:1',
            referenceCode: code('requirement', 1),
            content: approvedRequirement.content,
            rationale: 'Keeps resume behavior explicit in the accepted requirement set.',
            grounding: [{ code: code('goal', 1) }, { code: code('context', 1) }],
          },
          {
            reviewItemId: 'requirements:2',
            referenceCode: code('requirement', 2),
            content: supportingRequirement.content,
            rationale: 'Preserves the local-first persistence seam as a first-order concern.',
            grounding: [{ code: code('decision', 1) }, { code: code('assumption', 1) }],
          },
        ],
      }),
    }),
  });
  const acceptOption = createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, reviewTurn.id, {
    position: 1,
    content: 'Request changes',
    is_recommended: false,
  });
  applyTurnResponseSelections(db, reviewTurn.id, [0]);
  updateTurn(db, reviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: reviewTurn.id,
      selectedOptionIds: [acceptOption.id],
    }),
  });
  linkKnowledgeItemToTurn(db, approvedRequirement.id, reviewTurn.id, 'reviewed');
  linkKnowledgeItemToTurn(db, supportingRequirement.id, reviewTurn.id, 'reviewed');
  createConfirmedPhaseOutcome(db, {
    projectId,
    phase: 'requirements',
    proposal_turn_id: reviewTurn.id,
    confirmation_turn_id: reviewTurn.id,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });
  advanceHead(db, projectId, reviewTurn.id);

  return {
    approvedRequirement,
    supportingRequirement,
    reviewTurn,
    requirementsConfirmationTurn: reviewTurn,
  };
}

export function seedCriteriaReady(db: DB, projectId: number) {
  const seededRequirements = seedRequirementsReady(db, projectId);
  const reviewedRequirements = seedClosedRequirementsReview(
    db,
    projectId,
    seededRequirements.designConfirmationTurn.id,
  );

  return { ...seededRequirements, ...reviewedRequirements };
}

export function seedCriteriaReviewReady(db: DB, projectId: number) {
  const seededCriteria = seedAcceptedIssueTrackerRequirements(db, projectId);
  seedIssueTrackerPerformanceAssumption(db, projectId, seededCriteria.requirementsConfirmationTurn.id);

  const criterionAuditContent = issueTrackerCriterionAuditContent;
  const criterionPermissionsContent = issueTrackerCriterionPermissionsContent;
  const criterionPerformanceContent = issueTrackerCriterionPerformanceContent;

  const reviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
    question: 'Please review the current criterion set.',
    why: 'Review the whole criterion set before moving forward.',
    impact: 'high',
    answer: null,
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-criteria-review',
      input: createFixtureReviewQuestionInput({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        prompt: 'Please review the current criterion set.',
        why: 'Review the whole criterion set before moving forward.',
        items: [
          {
            reviewItemId: 'criteria:1',
            referenceCode: code('criterion', 1),
            content: criterionAuditContent,
            rationale: 'Makes the audit requirement observable in a seeded acceptance check.',
            grounding: [{ code: code('requirement', 1) }, { code: code('context', 2) }],
          },
          {
            reviewItemId: 'criteria:2',
            referenceCode: code('criterion', 2),
            content: criterionPermissionsContent,
            rationale: 'Verifies role-based visibility through a concrete denial path.',
            grounding: [{ code: code('requirement', 1) }, { code: code('constraint', 2) }],
            isUserCreated: true,
          },
          {
            reviewItemId: 'criteria:3',
            referenceCode: code('criterion', 3),
            content: criterionPerformanceContent,
            rationale: 'Pins the seeded demo to a legible performance target.',
            grounding: [{ code: code('requirement', 1) }, { code: code('assumption', 1) }],
            isRevised: true,
          },
        ],
      }),
    }),
  });
  createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, reviewTurn.id, {
    position: 1,
    content: 'Request changes',
  });
  advanceHead(db, projectId, reviewTurn.id);

  return {
    ...seededCriteria,
    reviewTurn,
    criterionAuditContent,
    criterionPermissionsContent,
    criterionPerformanceContent,
  };
}

function seedClosedCriteriaReview(db: DB, projectId: number, parentTurnId: number) {
  const criterion = createKnowledgeItem(db, projectId, 'criterion', 'Verify SQLite resume');
  const supportingCriterion = createKnowledgeItem(
    db,
    projectId,
    'criterion',
    'Restarting the browser restores the active path from local persistence',
  );
  const criterionReviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: parentTurnId,
    question: 'Please review the current criterion set.',
    why: 'Review the whole criterion set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-criteria-review',
      input: createFixtureReviewQuestionInput({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        prompt: 'Please review the current criterion set.',
        why: 'Review the whole criterion set before moving forward.',
        items: [
          {
            reviewItemId: 'criteria:1',
            referenceCode: code('criterion', 1),
            content: criterion.content,
            rationale: 'Provides a concise seeded acceptance check for the resume path.',
            grounding: [{ code: code('requirement', 1) }],
          },
          {
            reviewItemId: 'criteria:2',
            referenceCode: code('criterion', 2),
            content: supportingCriterion.content,
            rationale: 'Shows the user-visible reload behavior that proves persistence worked.',
            grounding: [{ code: code('requirement', 1) }, { code: code('context', 1) }],
          },
        ],
      }),
    }),
  });
  const acceptOption = createOption(db, criterionReviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, criterionReviewTurn.id, {
    position: 1,
    content: 'Request changes',
    is_recommended: false,
  });
  applyTurnResponseSelections(db, criterionReviewTurn.id, [0]);
  updateTurn(db, criterionReviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: criterionReviewTurn.id,
      selectedOptionIds: [acceptOption.id],
    }),
  });
  linkKnowledgeItemToTurn(db, criterion.id, criterionReviewTurn.id, 'reviewed');
  linkKnowledgeItemToTurn(db, supportingCriterion.id, criterionReviewTurn.id, 'reviewed');
  createConfirmedPhaseOutcome(db, {
    projectId,
    phase: 'criteria',
    proposal_turn_id: criterionReviewTurn.id,
    confirmation_turn_id: criterionReviewTurn.id,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });
  advanceHead(db, projectId, criterionReviewTurn.id);

  return {
    criterion,
    supportingCriterion,
    criterionReviewTurn,
    criteriaConfirmationTurn: criterionReviewTurn,
  };
}

export function seedAllPhasesClosed(db: DB, projectId: number) {
  const seededCriteria = seedCriteriaReady(db, projectId);
  const reviewedCriteria = seedClosedCriteriaReview(
    db,
    projectId,
    seededCriteria.requirementsConfirmationTurn.id,
  );

  return { ...seededCriteria, ...reviewedCriteria };
}

export function seedAllPhasesClosedWithForcedDesign(db: DB, projectId: number) {
  const seededGrounding = seedClosedGrounding(db, projectId);

  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededGrounding.groundingConfirmationTurn.id,
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  advanceHead(db, projectId, designTurn.id);

  const designForceCloseTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designTurn.id,
    question: '',
    answer: 'Force elicitation closure',
    user_parts: serializeFixtureConfirmationUserParts(
      createForceCloseActivePhaseCommand('design'),
      'Force elicitation closure',
    ),
  });
  advanceHead(db, projectId, designForceCloseTurn.id);

  const designOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'design',
    proposal_turn_id: designForceCloseTurn.id,
    summary: 'Elicitation closed by user without an interviewer recommendation.',
  });
  confirmPhaseOutcome(db, designOutcome.id, designForceCloseTurn.id);

  const reviewedRequirements = seedClosedRequirementsReview(db, projectId, designForceCloseTurn.id);
  const reviewedCriteria = seedClosedCriteriaReview(
    db,
    projectId,
    reviewedRequirements.requirementsConfirmationTurn.id,
  );

  return {
    ...seededGrounding,
    designTurn,
    designForceCloseTurn,
    ...reviewedRequirements,
    ...reviewedCriteria,
  };
}

export function seedAllPhasesClosedWithLowReadinessGrounding(db: DB, projectId: number) {
  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  advanceHead(db, projectId, designTurn.id);

  const groundingClosureTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'grounding',
      proposalTurnId: designTurn.id,
    }),
  });
  advanceHead(db, projectId, groundingClosureTurn.id);

  createConfirmedPhaseOutcome(db, {
    projectId,
    phase: 'grounding',
    proposal_turn_id: groundingClosureTurn.id,
    confirmation_turn_id: groundingClosureTurn.id,
    summary:
      'Grounding was closed from a minimal downstream checkpoint to exercise low-readiness export caveats.',
  });

  const designProposalTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: groundingClosureTurn.id,
    question: '',
    answer: 'The main architectural commitments are captured well enough to review requirements.',
  });
  advanceHead(db, projectId, designProposalTurn.id);

  const designConfirmationTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designProposalTurn.id,
    question: '',
    answer: 'Confirm elicitation closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'design',
      proposalTurnId: designProposalTurn.id,
    }),
  });
  advanceHead(db, projectId, designConfirmationTurn.id);

  const designOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'design',
    proposal_turn_id: designProposalTurn.id,
    summary: 'The main architectural commitments are captured well enough to review requirements.',
  });
  confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);

  const reviewedRequirements = seedClosedRequirementsReview(db, projectId, designConfirmationTurn.id);
  const reviewedCriteria = seedClosedCriteriaReview(
    db,
    projectId,
    reviewedRequirements.requirementsConfirmationTurn.id,
  );

  return {
    designTurn,
    groundingClosureTurn,
    designProposalTurn,
    designConfirmationTurn,
    ...reviewedRequirements,
    ...reviewedCriteria,
  };
}

export function seedIssueTrackerAllPhasesClosed(db: DB, projectId: number) {
  const seededRequirements = seedAcceptedIssueTrackerRequirements(db, projectId);
  seedIssueTrackerPerformanceAssumption(db, projectId, seededRequirements.requirementsConfirmationTurn.id);

  const criterionAuditContent = issueTrackerCriterionAuditContent;
  const criterionPermissionsContent = issueTrackerCriterionPermissionsContent;
  const criterionPerformanceContent = issueTrackerCriterionPerformanceContent;

  const criteriaReviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: seededRequirements.reviewTurn.id,
    question: 'Please review the current criterion set.',
    why: 'Review the whole criterion set before moving forward.',
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: 'fixture-criteria-review',
      input: createFixtureReviewQuestionInput({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        prompt: 'Please review the current criterion set.',
        why: 'Review the whole criterion set before moving forward.',
        items: [
          {
            reviewItemId: 'criteria:1',
            referenceCode: code('criterion', 1),
            content: criterionAuditContent,
            rationale: 'Makes the audit requirement observable in a seeded acceptance check.',
            grounding: [{ code: code('requirement', 1) }, { code: code('context', 2) }],
          },
          {
            reviewItemId: 'criteria:2',
            referenceCode: code('criterion', 2),
            content: criterionPermissionsContent,
            rationale: 'Verifies role-based visibility through a concrete denial path.',
            grounding: [{ code: code('requirement', 1) }, { code: code('constraint', 2) }],
            isUserCreated: true,
          },
          {
            reviewItemId: 'criteria:3',
            referenceCode: code('criterion', 3),
            content: criterionPerformanceContent,
            rationale: 'Pins the seeded demo to a legible performance target.',
            grounding: [{ code: code('requirement', 1) }, { code: code('assumption', 1) }],
            isRevised: true,
          },
        ],
      }),
    }),
  });
  const criteriaAcceptOption = createOption(db, criteriaReviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, criteriaReviewTurn.id, {
    position: 1,
    content: 'Request changes',
  });
  applyTurnResponseSelections(db, criteriaReviewTurn.id, [0]);
  updateTurn(db, criteriaReviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: criteriaReviewTurn.id,
      selectedOptionIds: [criteriaAcceptOption.id],
    }),
  });
  const criterionAudit = createKnowledgeItem(db, projectId, 'criterion', criterionAuditContent);
  const criterionPermissions = createKnowledgeItem(db, projectId, 'criterion', criterionPermissionsContent);
  const criterionPerformance = createKnowledgeItem(db, projectId, 'criterion', criterionPerformanceContent);
  linkKnowledgeItemToTurn(db, criterionAudit.id, criteriaReviewTurn.id, 'reviewed');
  linkKnowledgeItemToTurn(db, criterionPermissions.id, criteriaReviewTurn.id, 'reviewed');
  linkKnowledgeItemToTurn(db, criterionPerformance.id, criteriaReviewTurn.id, 'reviewed');
  createConfirmedPhaseOutcome(db, {
    projectId,
    phase: 'criteria',
    proposal_turn_id: criteriaReviewTurn.id,
    confirmation_turn_id: criteriaReviewTurn.id,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });
  advanceHead(db, projectId, criteriaReviewTurn.id);

  return {
    ...seededRequirements,
    criterionAudit,
    criterionPermissions,
    criterionPerformance,
    criteriaConfirmationTurn: criteriaReviewTurn,
    criteriaReviewTurn,
    requirementsConfirmationTurn: seededRequirements.requirementsConfirmationTurn,
  };
}

export function seedBrownfieldReusableGroundingReplay(db: DB, projectId: number) {
  const firstGroundingTurn = createTurn(db, projectId, {
    phase: 'grounding',
    question: '',
    answer: 'Continue — Focus on the routed workspace stream seam.',
    assistant_parts: serializeFixtureGroundingCardAssistantParts({
      summary: 'The repo already uses SQLite-backed local persistence.',
      detail: 'This provisional brief grounds the first brownfield move.',
      continueLabel: 'Continue',
    }),
  });
  const firstContinueOption = createOption(db, firstGroundingTurn.id, {
    position: 0,
    content: 'Continue',
    is_recommended: true,
  });
  updateTurn(db, firstGroundingTurn.id, {
    user_parts: serializeFixtureTurnResponseUserParts({
      text: 'Continue — Focus on the routed workspace stream seam.',
      data: {
        turnId: firstGroundingTurn.id,
        selectedOptionIds: [firstContinueOption.id],
        freeText: 'Focus on the routed workspace stream seam.',
      },
    }),
  });
  applyTurnResponseSelections(db, firstGroundingTurn.id, [0]);
  advanceHead(db, projectId, firstGroundingTurn.id);

  const substantiveTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: firstGroundingTurn.id,
    question: 'Which seam needs another grounding pass before we keep going?',
    answer: 'The chat-runtime finalization path and replay seam.',
    user_parts: serializeParts([
      { type: 'text', text: 'The chat-runtime finalization path and replay seam.' },
    ]),
  });
  advanceHead(db, projectId, substantiveTurn.id);

  const laterGroundingTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: substantiveTurn.id,
    question: '',
    answer: null,
    assistant_parts: serializeFixtureGroundingCardAssistantParts({
      summary: 'Later context gathering narrowed the work to turn-finalization ownership.',
      detail: 'Continue to move from replay evidence back into the next substantive question.',
      continueLabel: 'Continue',
    }),
  });
  createOption(db, laterGroundingTurn.id, {
    position: 0,
    content: 'Continue',
    is_recommended: true,
  });
  advanceHead(db, projectId, laterGroundingTurn.id);

  return {
    firstGroundingTurn,
    substantiveTurn,
    laterGroundingTurn,
  };
}

export type ScenarioFn = (db: DB, projectName?: string) => number;

type WalkthroughWorkflowSummary = Record<
  'grounding' | 'design' | 'requirements' | 'criteria',
  WorkflowPhaseStatus
>;

export interface WalkthroughScenarioMatrixEntry {
  scenarioName: string;
  seedScenario: ScenarioFn;
  label: string;
  inspectionFocus: string;
  expectedWorkflowSummary: WalkthroughWorkflowSummary;
}

function createWorkflowSummary(
  grounding: WorkflowPhaseStatus,
  design: WorkflowPhaseStatus,
  requirements: WorkflowPhaseStatus,
  criteria: WorkflowPhaseStatus,
): WalkthroughWorkflowSummary {
  return { grounding, design, requirements, criteria };
}

export const scenarios: Record<string, ScenarioFn> = {
  'grounding-closed': (db, name = 'Grounding Closed') => {
    const project = createSpecification(db, name);
    seedClosedGrounding(db, project.id);
    return project.id;
  },
  'design-active': (db, name = 'Design Active') => {
    const project = createSpecification(db, name);
    seedActiveDesign(db, project.id);
    return project.id;
  },
  'requirements-ready': (db, name = 'Requirements Ready') => {
    const project = createSpecification(db, name);
    seedRequirementsReviewReady(db, project.id);
    return project.id;
  },
  'criteria-ready': (db, name = 'Criteria Ready') => {
    const project = createSpecification(db, name);
    seedCriteriaReviewReady(db, project.id);
    return project.id;
  },
  'all-phases-closed': (db, name = 'All Phases Closed') => {
    const project = createSpecification(db, name);
    seedAllPhasesClosed(db, project.id);
    return project.id;
  },
  'forced-close-all-phases-closed': (db, name = 'Forced-Close All Phases Closed') => {
    const project = createSpecification(db, name);
    seedAllPhasesClosedWithForcedDesign(db, project.id);
    return project.id;
  },
  'low-readiness-all-phases-closed': (db, name = 'Low-Readiness All Phases Closed') => {
    const project = createSpecification(db, name);
    seedAllPhasesClosedWithLowReadinessGrounding(db, project.id);
    return project.id;
  },
};

const phaseTransitionScenarios: Record<string, ScenarioFn> = {
  'brownfield-grounding-replay': (db, name = 'Brownfield reusable grounding replay') => {
    const project = createSpecification(db, name, {
      mode: 'brownfield',
    });
    seedBrownfieldReusableGroundingReplay(db, project.id);
    return project.id;
  },
  'issue-tracker-kickoff-ready': (db, name = 'Issue Tracker (kickoff ready)') => {
    const project = createSpecification(db, name);
    return project.id;
  },
  'issue-tracker-grounding-closure-pending': (db, name = 'Issue Tracker (grounding closure pending)') => {
    const project = createSpecification(db, name);
    seedGroundingClosurePending(db, project.id);
    return project.id;
  },
  'issue-tracker-design-kickoff-ready': (db, name = 'Issue Tracker (design kickoff ready)') => {
    const project = createSpecification(db, name);
    seedClosedGrounding(db, project.id);
    return project.id;
  },
  'issue-tracker-design-recovery': (db, name = 'Issue Tracker (design recovery)') => {
    const project = createSpecification(db, name);
    seedActiveDesign(db, project.id);
    return project.id;
  },
  'issue-tracker-requirements-kickoff-ready': (db, name = 'Issue Tracker (requirements kickoff ready)') => {
    const project = createSpecification(db, name);
    seedRequirementsReady(db, project.id);
    return project.id;
  },
  'issue-tracker-criteria-kickoff-ready': (db, name = 'Issue Tracker (criteria kickoff ready)') => {
    const project = createSpecification(db, name);
    seedCriteriaReady(db, project.id);
    return project.id;
  },
  'issue-tracker-requirements-ready': (db, name = 'Issue Tracker (requirements review ready)') => {
    const project = createSpecification(db, name);
    seedRequirementsReviewReady(db, project.id);
    return project.id;
  },
  'issue-tracker-criteria-ready': (db, name = 'Issue Tracker (criteria review ready)') => {
    const project = createSpecification(db, name);
    seedCriteriaReviewReady(db, project.id);
    return project.id;
  },
  'issue-tracker-all-phases-closed': (db, name = 'Issue Tracker (all phases closed)') => {
    const project = createSpecification(db, name);
    seedIssueTrackerAllPhasesClosed(db, project.id);
    return project.id;
  },
};

export const walkthroughScenarioMatrix: readonly WalkthroughScenarioMatrixEntry[] = [
  {
    scenarioName: 'brownfield-grounding-replay',
    seedScenario: phaseTransitionScenarios['brownfield-grounding-replay']!,
    label: 'Brownfield reusable grounding replay',
    inspectionFocus:
      'Brownfield kickoff, answered grounding-card continue, later reusable context gathering, and resume all stay legible through the same replay seam.',
    expectedWorkflowSummary: createWorkflowSummary('in_progress', 'unstarted', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-kickoff-ready',
    seedScenario: phaseTransitionScenarios['issue-tracker-kickoff-ready']!,
    label: 'Kickoff workspace',
    inspectionFocus: 'Blank greenfield kickoff, empty workspace rendering, and resume after seeding.',
    expectedWorkflowSummary: createWorkflowSummary('in_progress', 'unstarted', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-grounding-closure-pending',
    seedScenario: phaseTransitionScenarios['issue-tracker-grounding-closure-pending']!,
    label: 'Grounding closure pending',
    inspectionFocus: 'Closure proposal summary is visible and waiting for explicit confirmation.',
    expectedWorkflowSummary: createWorkflowSummary('in_progress', 'unstarted', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-design-kickoff-ready',
    seedScenario: phaseTransitionScenarios['issue-tracker-design-kickoff-ready']!,
    label: 'Design kickoff ready',
    inspectionFocus:
      'Grounding handoff has landed and the next phase opens with an explicit kickoff frontier.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'in_progress', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-design-recovery',
    seedScenario: phaseTransitionScenarios['issue-tracker-design-recovery']!,
    label: 'Design recovery frontier',
    inspectionFocus:
      'A completed design turn has no successor, so the exceptional recovery frontier is visible.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'in_progress', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-requirements-kickoff-ready',
    seedScenario: phaseTransitionScenarios['issue-tracker-requirements-kickoff-ready']!,
    label: 'Requirements kickoff ready',
    inspectionFocus: 'Design closure hands off into the requirements phase with a fresh kickoff frontier.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'in_progress', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-requirements-ready',
    seedScenario: phaseTransitionScenarios['issue-tracker-requirements-ready']!,
    label: 'Requirements review ready',
    inspectionFocus:
      'The requirements phase shows the current full-set review frontier with explicit review actions.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'in_progress', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-criteria-kickoff-ready',
    seedScenario: phaseTransitionScenarios['issue-tracker-criteria-kickoff-ready']!,
    label: 'Criteria kickoff ready',
    inspectionFocus: 'Requirements closure hands off into criteria with an explicit kickoff frontier.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'in_progress'),
  },
  {
    scenarioName: 'issue-tracker-criteria-ready',
    seedScenario: phaseTransitionScenarios['issue-tracker-criteria-ready']!,
    label: 'Criteria review ready',
    inspectionFocus:
      'The criteria phase shows the current full-set review frontier before export becomes available.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'in_progress'),
  },
  {
    scenarioName: 'issue-tracker-all-phases-closed',
    seedScenario: phaseTransitionScenarios['issue-tracker-all-phases-closed']!,
    label: 'Export-ready walkthrough',
    inspectionFocus: 'Full active-path export, final transcript review, and resume into a completed project.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'closed'),
  },
  {
    scenarioName: 'forced-close-all-phases-closed',
    seedScenario: scenarios['forced-close-all-phases-closed']!,
    label: 'Forced-close export caveat',
    inspectionFocus: 'Manual inspection of export caveats when design was closed via user-forced closure.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'closed'),
  },
  {
    scenarioName: 'low-readiness-all-phases-closed',
    seedScenario: scenarios['low-readiness-all-phases-closed']!,
    label: 'Low-readiness export caveat',
    inspectionFocus: 'Manual inspection of export caveats when grounding closed with low readiness.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'closed'),
  },
] as const;

export const walkthroughScenarioNames = walkthroughScenarioMatrix.map((entry) => entry.scenarioName);
const walkthroughScenarioNameSet = new Set<string>(walkthroughScenarioNames);

export const publicScenarios: Record<string, ScenarioFn> = {
  ...scenarios,
  ...phaseTransitionScenarios,
};
export const publicScenarioNames = [
  ...walkthroughScenarioNames.filter((name) => name in publicScenarios),
  ...Object.keys(publicScenarios).filter((name) => !walkthroughScenarioNameSet.has(name)),
];
export const scenarioNames = publicScenarioNames;
