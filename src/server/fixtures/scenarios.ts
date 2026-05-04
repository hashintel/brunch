import type { BrunchAssistantPart } from '@/shared/chat.js';
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
  serializeFixturePrefaceAssistantParts,
  serializeFixturePhaseConfirmationUserParts,
  serializeFixturePhaseProposalAssistantParts,
  serializeFixtureQuestionAssistantParts,
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

async function seedIssueTrackerSupportingKnowledge(db: DB, projectId: number, turnId: number) {
  const goalLifecycle = await createKnowledgeItem(
    db,
    projectId,
    'goal',
    'Launch a lightweight issue tracker that covers the core ticket lifecycle for day-one teams',
  );
  const goalRoles = await createKnowledgeItem(
    db,
    projectId,
    'goal',
    'Keep ticket visibility and role-specific actions clear for admins, developers, and viewers',
  );
  const contextFields = await createKnowledgeItem(
    db,
    projectId,
    'context',
    'Tickets move through a workflow that always includes title, description, priority, and assignee',
  );
  const contextAudit = await createKnowledgeItem(
    db,
    projectId,
    'context',
    'The team needs a trustworthy audit trail whenever ticket status changes',
  );
  const constraintAudit = await createKnowledgeItem(
    db,
    projectId,
    'constraint',
    'Audit history must be retained as immutable actor-and-timestamp records',
  );
  const constraintPermissions = await createKnowledgeItem(
    db,
    projectId,
    'constraint',
    'Viewer access must stay read-only and must not mutate ticket data or settings',
  );
  const decisionWorkflow = await createKnowledgeItem(
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
    await linkKnowledgeItemToTurn(db, item.id, turnId, 'captured');
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

async function seedIssueTrackerPerformanceAssumption(db: DB, projectId: number, turnId: number) {
  const assumption = await createKnowledgeItem(
    db,
    projectId,
    'assumption',
    'A seeded workspace of 500 tickets is representative enough for the first performance walkthrough',
  );
  await linkKnowledgeItemToTurn(db, assumption.id, turnId, 'captured');
  return assumption;
}

async function seedAcceptedIssueTrackerRequirements(db: DB, projectId: number) {
  const seededRequirements = await seedRequirementsReviewReady(db, projectId);
  const requirementsAcceptOption = (await getOptionsForTurn(db, seededRequirements.reviewTurn.id)).find(
    (option) => option.position === 0,
  );

  if (!requirementsAcceptOption) {
    throw new Error('Issue-tracker requirements review seed is missing the accept option');
  }

  await applyTurnResponseSelections(db, seededRequirements.reviewTurn.id, [0]);
  await updateTurn(db, seededRequirements.reviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: seededRequirements.reviewTurn.id,
      selectedOptionIds: [requirementsAcceptOption.id],
    }),
  });

  const requirementCrud = await createKnowledgeItem(
    db,
    projectId,
    'requirement',
    issueTrackerRequirementCrudContent,
  );
  const requirementAudit = await createKnowledgeItem(
    db,
    projectId,
    'requirement',
    issueTrackerRequirementAuditContent,
  );
  const requirementPermissions = await createKnowledgeItem(
    db,
    projectId,
    'requirement',
    issueTrackerRequirementPermissionsContent,
  );
  for (const requirement of [requirementCrud, requirementAudit, requirementPermissions]) {
    await linkKnowledgeItemToTurn(db, requirement.id, seededRequirements.reviewTurn.id, 'reviewed');
  }

  await createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'requirements',
    proposal_turn_id: seededRequirements.reviewTurn.id,
    confirmation_turn_id: seededRequirements.reviewTurn.id,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });
  await advanceHead(db, projectId, seededRequirements.reviewTurn.id);

  return {
    ...seededRequirements,
    requirementCrud,
    requirementAudit,
    requirementPermissions,
    requirementsConfirmationTurn: seededRequirements.reviewTurn,
  };
}

export async function seedClosedGrounding(db: DB, projectId: number) {
  const groundingTurn = await createTurn(db, projectId, {
    phase: 'grounding',
    question: 'What platform?',
    answer: 'Web',
  });
  await advanceHead(db, projectId, groundingTurn.id);

  const groundingProposalTurn = await createTurn(db, projectId, {
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
  await advanceHead(db, projectId, groundingProposalTurn.id);

  const groundingOutcome = await createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: 'Goals, terms, context, and constraints are sufficiently captured.',
  });

  const groundingConfirmationTurn = await createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingProposalTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'grounding',
      proposalTurnId: groundingProposalTurn.id,
    }),
  });
  await confirmPhaseOutcome(db, groundingOutcome.id, groundingConfirmationTurn.id);
  await advanceHead(db, projectId, groundingConfirmationTurn.id);

  return { groundingTurn, groundingProposalTurn, groundingConfirmationTurn };
}

export async function seedGroundingClosurePending(db: DB, projectId: number) {
  const groundingTurn = await createTurn(db, projectId, {
    phase: 'grounding',
    question: 'What platform?',
    answer: 'Web',
  });
  await advanceHead(db, projectId, groundingTurn.id);

  const groundingProposalTurn = await createTurn(db, projectId, {
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
  await advanceHead(db, projectId, groundingProposalTurn.id);

  await createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: 'Goals, terms, context, and constraints are sufficiently captured.',
  });

  return { groundingTurn, groundingProposalTurn };
}

export async function seedActiveDesign(db: DB, projectId: number) {
  const seededGrounding = await seedClosedGrounding(db, projectId);

  const designTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededGrounding.groundingConfirmationTurn.id,
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  await advanceHead(db, projectId, designTurn.id);

  return { ...seededGrounding, designTurn };
}

export async function seedRequirementsReady(db: DB, projectId: number) {
  const seededDesign = await seedActiveDesign(db, projectId);

  const designOutcome = await createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'design',
    proposal_turn_id: seededDesign.designTurn.id,
    summary: 'The main architectural commitments are captured well enough to review requirements.',
  });

  const designConfirmationTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededDesign.designTurn.id,
    question: '',
    answer: 'Confirm elicitation closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'design',
      proposalTurnId: seededDesign.designTurn.id,
    }),
  });
  await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
  await advanceHead(db, projectId, designConfirmationTurn.id);

  return { ...seededDesign, designConfirmationTurn };
}

export async function seedRequirementsReviewReady(db: DB, projectId: number) {
  const seededRequirements = await seedRequirementsReady(db, projectId);
  await seedIssueTrackerSupportingKnowledge(db, projectId, seededRequirements.designConfirmationTurn.id);
  const requirementCrudContent = issueTrackerRequirementCrudContent;
  const requirementAuditContent = issueTrackerRequirementAuditContent;
  const requirementPermissionsContent = issueTrackerRequirementPermissionsContent;

  const reviewTurn = await createTurn(db, projectId, {
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
  await createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  await createOption(db, reviewTurn.id, {
    position: 1,
    content: 'Request changes',
  });
  await advanceHead(db, projectId, reviewTurn.id);

  return {
    ...seededRequirements,
    reviewTurn,
    requirementCrudContent,
    requirementAuditContent,
    requirementPermissionsContent,
  };
}

async function seedClosedRequirementsReview(db: DB, projectId: number, parentTurnId: number) {
  const approvedRequirement = await createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Resume the interview from SQLite after restart',
  );
  const supportingRequirement = await createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Keep the local-first persistence seam simple for restart and resume',
  );

  const reviewTurn = await createTurn(db, projectId, {
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
  const acceptOption = await createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  await createOption(db, reviewTurn.id, {
    position: 1,
    content: 'Request changes',
    is_recommended: false,
  });
  await applyTurnResponseSelections(db, reviewTurn.id, [0]);
  await updateTurn(db, reviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: reviewTurn.id,
      selectedOptionIds: [acceptOption.id],
    }),
  });
  await linkKnowledgeItemToTurn(db, approvedRequirement.id, reviewTurn.id, 'reviewed');
  await linkKnowledgeItemToTurn(db, supportingRequirement.id, reviewTurn.id, 'reviewed');
  await createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'requirements',
    proposal_turn_id: reviewTurn.id,
    confirmation_turn_id: reviewTurn.id,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });
  await advanceHead(db, projectId, reviewTurn.id);

  return {
    approvedRequirement,
    supportingRequirement,
    reviewTurn,
    requirementsConfirmationTurn: reviewTurn,
  };
}

export async function seedCriteriaReady(db: DB, projectId: number) {
  const seededRequirements = await seedRequirementsReady(db, projectId);
  const reviewedRequirements = await seedClosedRequirementsReview(
    db,
    projectId,
    seededRequirements.designConfirmationTurn.id,
  );

  return { ...seededRequirements, ...reviewedRequirements };
}

export async function seedCriteriaReviewReady(db: DB, projectId: number) {
  const seededCriteria = await seedAcceptedIssueTrackerRequirements(db, projectId);
  await seedIssueTrackerPerformanceAssumption(db, projectId, seededCriteria.requirementsConfirmationTurn.id);

  const criterionAuditContent = issueTrackerCriterionAuditContent;
  const criterionPermissionsContent = issueTrackerCriterionPermissionsContent;
  const criterionPerformanceContent = issueTrackerCriterionPerformanceContent;

  const reviewTurn = await createTurn(db, projectId, {
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
  await createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  await createOption(db, reviewTurn.id, {
    position: 1,
    content: 'Request changes',
  });
  await advanceHead(db, projectId, reviewTurn.id);

  return {
    ...seededCriteria,
    reviewTurn,
    criterionAuditContent,
    criterionPermissionsContent,
    criterionPerformanceContent,
  };
}

async function seedClosedCriteriaReview(db: DB, projectId: number, parentTurnId: number) {
  const criterion = await createKnowledgeItem(db, projectId, 'criterion', 'Verify SQLite resume');
  const supportingCriterion = await createKnowledgeItem(
    db,
    projectId,
    'criterion',
    'Restarting the browser restores the active path from local persistence',
  );
  const criterionReviewTurn = await createTurn(db, projectId, {
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
  const acceptOption = await createOption(db, criterionReviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  await createOption(db, criterionReviewTurn.id, {
    position: 1,
    content: 'Request changes',
    is_recommended: false,
  });
  await applyTurnResponseSelections(db, criterionReviewTurn.id, [0]);
  await updateTurn(db, criterionReviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: criterionReviewTurn.id,
      selectedOptionIds: [acceptOption.id],
    }),
  });
  await linkKnowledgeItemToTurn(db, criterion.id, criterionReviewTurn.id, 'reviewed');
  await linkKnowledgeItemToTurn(db, supportingCriterion.id, criterionReviewTurn.id, 'reviewed');
  await createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'criteria',
    proposal_turn_id: criterionReviewTurn.id,
    confirmation_turn_id: criterionReviewTurn.id,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });
  await advanceHead(db, projectId, criterionReviewTurn.id);

  return {
    criterion,
    supportingCriterion,
    criterionReviewTurn,
    criteriaConfirmationTurn: criterionReviewTurn,
  };
}

export async function seedAllPhasesClosed(db: DB, projectId: number) {
  const seededCriteria = await seedCriteriaReady(db, projectId);
  const reviewedCriteria = await seedClosedCriteriaReview(
    db,
    projectId,
    seededCriteria.requirementsConfirmationTurn.id,
  );

  return { ...seededCriteria, ...reviewedCriteria };
}

export async function seedAllPhasesClosedWithForcedDesign(db: DB, projectId: number) {
  const seededGrounding = await seedClosedGrounding(db, projectId);

  const designTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededGrounding.groundingConfirmationTurn.id,
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  await advanceHead(db, projectId, designTurn.id);

  const designForceCloseTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designTurn.id,
    question: '',
    answer: 'Force elicitation closure',
    user_parts: serializeFixtureConfirmationUserParts(
      createForceCloseActivePhaseCommand('design'),
      'Force elicitation closure',
    ),
  });
  await advanceHead(db, projectId, designForceCloseTurn.id);

  const designOutcome = await createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'design',
    proposal_turn_id: designForceCloseTurn.id,
    summary: 'Elicitation closed by user without an interviewer recommendation.',
  });
  await confirmPhaseOutcome(db, designOutcome.id, designForceCloseTurn.id);

  const reviewedRequirements = await seedClosedRequirementsReview(db, projectId, designForceCloseTurn.id);
  const reviewedCriteria = await seedClosedCriteriaReview(
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

export async function seedAllPhasesClosedWithLowReadinessGrounding(db: DB, projectId: number) {
  const designTurn = await createTurn(db, projectId, {
    phase: 'design',
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  await advanceHead(db, projectId, designTurn.id);

  const groundingClosureTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'grounding',
      proposalTurnId: designTurn.id,
    }),
  });
  await advanceHead(db, projectId, groundingClosureTurn.id);

  await createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'grounding',
    proposal_turn_id: groundingClosureTurn.id,
    confirmation_turn_id: groundingClosureTurn.id,
    summary:
      'Grounding was closed from a minimal downstream checkpoint to exercise low-readiness export caveats.',
  });

  const designProposalTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: groundingClosureTurn.id,
    question: '',
    answer: 'The main architectural commitments are captured well enough to review requirements.',
  });
  await advanceHead(db, projectId, designProposalTurn.id);

  const designConfirmationTurn = await createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designProposalTurn.id,
    question: '',
    answer: 'Confirm elicitation closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'design',
      proposalTurnId: designProposalTurn.id,
    }),
  });
  await advanceHead(db, projectId, designConfirmationTurn.id);

  const designOutcome = await createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'design',
    proposal_turn_id: designProposalTurn.id,
    summary: 'The main architectural commitments are captured well enough to review requirements.',
  });
  await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);

  const reviewedRequirements = await seedClosedRequirementsReview(db, projectId, designConfirmationTurn.id);
  const reviewedCriteria = await seedClosedCriteriaReview(
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

export async function seedIssueTrackerAllPhasesClosed(db: DB, projectId: number) {
  const seededRequirements = await seedAcceptedIssueTrackerRequirements(db, projectId);
  await seedIssueTrackerPerformanceAssumption(
    db,
    projectId,
    seededRequirements.requirementsConfirmationTurn.id,
  );

  const criterionAuditContent = issueTrackerCriterionAuditContent;
  const criterionPermissionsContent = issueTrackerCriterionPermissionsContent;
  const criterionPerformanceContent = issueTrackerCriterionPerformanceContent;

  const criteriaReviewTurn = await createTurn(db, projectId, {
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
  const criteriaAcceptOption = await createOption(db, criteriaReviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  await createOption(db, criteriaReviewTurn.id, {
    position: 1,
    content: 'Request changes',
  });
  await applyTurnResponseSelections(db, criteriaReviewTurn.id, [0]);
  await updateTurn(db, criteriaReviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: criteriaReviewTurn.id,
      selectedOptionIds: [criteriaAcceptOption.id],
    }),
  });
  const criterionAudit = await createKnowledgeItem(db, projectId, 'criterion', criterionAuditContent);
  const criterionPermissions = await createKnowledgeItem(
    db,
    projectId,
    'criterion',
    criterionPermissionsContent,
  );
  const criterionPerformance = await createKnowledgeItem(
    db,
    projectId,
    'criterion',
    criterionPerformanceContent,
  );
  await linkKnowledgeItemToTurn(db, criterionAudit.id, criteriaReviewTurn.id, 'reviewed');
  await linkKnowledgeItemToTurn(db, criterionPermissions.id, criteriaReviewTurn.id, 'reviewed');
  await linkKnowledgeItemToTurn(db, criterionPerformance.id, criteriaReviewTurn.id, 'reviewed');
  await createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'criteria',
    proposal_turn_id: criteriaReviewTurn.id,
    confirmation_turn_id: criteriaReviewTurn.id,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });
  await advanceHead(db, projectId, criteriaReviewTurn.id);

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

export async function seedBrownfieldReusableGroundingReplay(db: DB, projectId: number) {
  const groundedQuestionTurn = await createTurn(db, projectId, {
    phase: 'grounding',
    question: 'Which seam needs another grounding pass before we keep going?',
    answer: 'The chat-runtime finalization path and replay seam.',
    assistant_parts: serializeParts([
      ...JSON.parse(
        serializeFixturePrefaceAssistantParts({
          observation: 'The repo already uses SQLite-backed local persistence.',
          elaboration: 'This provisional brief grounds the first brownfield move.',
        }),
      ),
      {
        type: 'tool-ask_question',
        toolCallId: 'fixture-grounded-question-1',
        state: 'output-available',
        input: {
          question: 'Which seam needs another grounding pass before we keep going?',
          why: 'Narrows the next brownfield move.',
          impact: 'medium',
          options: [
            { content: 'The chat-runtime finalization path and replay seam.', is_recommended: true },
            { content: 'The workspace persistence layer.', is_recommended: false },
          ],
        },
        output: { ok: true, turnId: 0, optionCount: 2 },
      },
      { type: 'text', text: 'Which seam needs another grounding pass before we keep going?' },
    ] satisfies BrunchAssistantPart[]),
    user_parts: serializeParts([
      { type: 'text', text: 'The chat-runtime finalization path and replay seam.' },
    ]),
  });
  await advanceHead(db, projectId, groundedQuestionTurn.id);

  const followUpTurn = await createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundedQuestionTurn.id,
    question: 'What does the finalization path need to handle for replay consistency?',
    answer: null,
    assistant_parts: serializeParts([
      ...JSON.parse(
        serializeFixturePrefaceAssistantParts({
          observation: 'Later context gathering narrowed the work to turn-finalization ownership.',
          elaboration: 'Continue to move from replay evidence back into the next substantive question.',
        }),
      ),
      {
        type: 'tool-ask_question',
        toolCallId: 'fixture-grounded-question-2',
        state: 'output-available',
        input: {
          question: 'What does the finalization path need to handle for replay consistency?',
          why: 'Clarifies turn-finalization ownership.',
          impact: 'medium',
          options: [
            { content: 'Ordering guarantees on concurrent writes.', is_recommended: true },
            { content: 'Idempotent replay of partial turns.', is_recommended: false },
          ],
        },
        output: { ok: true, turnId: 0, optionCount: 2 },
      },
      { type: 'text', text: 'What does the finalization path need to handle for replay consistency?' },
    ] satisfies BrunchAssistantPart[]),
  });
  await createOption(db, followUpTurn.id, {
    position: 0,
    content: 'Ordering guarantees on concurrent writes.',
    is_recommended: true,
  });
  await createOption(db, followUpTurn.id, {
    position: 1,
    content: 'Idempotent replay of partial turns.',
    is_recommended: false,
  });
  await advanceHead(db, projectId, followUpTurn.id);

  return {
    groundedQuestionTurn,
    followUpTurn,
  };
}

export type ScenarioFn = (db: DB, projectName?: string) => Promise<number>;

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
  'grounding-closed': async (db, name = 'Grounding Closed') => {
    const project = await createSpecification(db, name);
    await seedClosedGrounding(db, project.id);
    return project.id;
  },
  'design-active': async (db, name = 'Design Active') => {
    const project = await createSpecification(db, name);
    await seedActiveDesign(db, project.id);
    return project.id;
  },
  'requirements-ready': async (db, name = 'Requirements Ready') => {
    const project = await createSpecification(db, name);
    await seedRequirementsReviewReady(db, project.id);
    return project.id;
  },
  'criteria-ready': async (db, name = 'Criteria Ready') => {
    const project = await createSpecification(db, name);
    await seedCriteriaReviewReady(db, project.id);
    return project.id;
  },
  'all-phases-closed': async (db, name = 'All Phases Closed') => {
    const project = await createSpecification(db, name);
    await seedAllPhasesClosed(db, project.id);
    return project.id;
  },
  'forced-close-all-phases-closed': async (db, name = 'Forced-Close All Phases Closed') => {
    const project = await createSpecification(db, name);
    await seedAllPhasesClosedWithForcedDesign(db, project.id);
    return project.id;
  },
  'low-readiness-all-phases-closed': async (db, name = 'Low-Readiness All Phases Closed') => {
    const project = await createSpecification(db, name);
    await seedAllPhasesClosedWithLowReadinessGrounding(db, project.id);
    return project.id;
  },
};

const phaseTransitionScenarios: Record<string, ScenarioFn> = {
  'brownfield-grounding-replay': async (db, name = 'Brownfield reusable grounding replay') => {
    const project = await createSpecification(db, name, {
      mode: 'brownfield',
    });
    await seedBrownfieldReusableGroundingReplay(db, project.id);
    return project.id;
  },
  'issue-tracker-kickoff-ready': async (db, name = 'Issue Tracker (kickoff ready)') => {
    const project = await createSpecification(db, name);
    return project.id;
  },
  'issue-tracker-grounding-closure-pending': async (
    db,
    name = 'Issue Tracker (grounding closure pending)',
  ) => {
    const project = await createSpecification(db, name);
    await seedGroundingClosurePending(db, project.id);
    return project.id;
  },
  'issue-tracker-design-kickoff-ready': async (db, name = 'Issue Tracker (design kickoff ready)') => {
    const project = await createSpecification(db, name);
    await seedClosedGrounding(db, project.id);
    return project.id;
  },
  'issue-tracker-design-recovery': async (db, name = 'Issue Tracker (design recovery)') => {
    const project = await createSpecification(db, name);
    await seedActiveDesign(db, project.id);
    return project.id;
  },
  'issue-tracker-requirements-kickoff-ready': async (
    db,
    name = 'Issue Tracker (requirements kickoff ready)',
  ) => {
    const project = await createSpecification(db, name);
    await seedRequirementsReady(db, project.id);
    return project.id;
  },
  'issue-tracker-criteria-kickoff-ready': async (db, name = 'Issue Tracker (criteria kickoff ready)') => {
    const project = await createSpecification(db, name);
    await seedCriteriaReady(db, project.id);
    return project.id;
  },
  'issue-tracker-requirements-ready': async (db, name = 'Issue Tracker (requirements review ready)') => {
    const project = await createSpecification(db, name);
    await seedRequirementsReviewReady(db, project.id);
    return project.id;
  },
  'issue-tracker-criteria-ready': async (db, name = 'Issue Tracker (criteria review ready)') => {
    const project = await createSpecification(db, name);
    await seedCriteriaReviewReady(db, project.id);
    return project.id;
  },
  'issue-tracker-all-phases-closed': async (db, name = 'Issue Tracker (all phases closed)') => {
    const project = await createSpecification(db, name);
    await seedIssueTrackerAllPhasesClosed(db, project.id);
    return project.id;
  },
};

export const walkthroughScenarioMatrix: readonly WalkthroughScenarioMatrixEntry[] = [
  {
    scenarioName: 'brownfield-grounding-replay',
    seedScenario: phaseTransitionScenarios['brownfield-grounding-replay']!,
    label: 'Brownfield reusable grounding replay',
    inspectionFocus:
      'Brownfield kickoff, answered preface continue, later reusable context gathering, and resume all stay legible through the same replay seam.',
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
