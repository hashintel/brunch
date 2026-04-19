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
  createProject,
  createTurn,
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
  serializeFixtureQuestionAssistantParts,
  serializeFixtureTurnResponseUserParts,
} from './helpers.js';
import { loadManifest, loadManifestScenarios, seedFromManifest, type ManifestScenario } from './manifest.js';

const issueTrackerManifest = loadManifest('issue-tracker');
const code = createKnowledgeReferenceCode;

function sliceManifestScenario(scenario: ManifestScenario, turnCount: number): ManifestScenario {
  const turns = scenario.turns.slice(0, turnCount);
  const itemIndexMap = new Map<number, number>();

  const knowledgeItems = scenario.knowledgeItems.flatMap((item, itemIndex) => {
    if (item.capturedAtTurn >= turnCount) {
      return [];
    }

    const nextItem = {
      kind: item.kind,
      content: item.content,
      rationale: item.rationale ?? null,
      capturedAtTurn: item.capturedAtTurn,
      ...(item.reviewAction && item.reviewedAtTurn != null && item.reviewedAtTurn < turnCount
        ? {
            reviewAction: item.reviewAction,
            reviewedAtTurn: item.reviewedAtTurn,
          }
        : {}),
    };
    itemIndexMap.set(itemIndex, itemIndexMap.size);
    return [nextItem];
  });

  const edges = scenario.edges.flatMap((edge) => {
    const fromItemIndex = itemIndexMap.get(edge.fromItemIndex);
    const toItemIndex = itemIndexMap.get(edge.toItemIndex);
    if (fromItemIndex == null || toItemIndex == null) {
      return [];
    }

    return [
      {
        fromItemIndex,
        toItemIndex,
        relation: edge.relation,
      },
    ];
  });

  return { turns, knowledgeItems, edges };
}

function createManifestScenarioSeeder(scenario: ManifestScenario, defaultName: string): ScenarioFn {
  return (db, projectName = defaultName) => seedFromManifest(db, scenario, projectName);
}

export function seedClosedScope(db: DB, projectId: number) {
  const scopeTurn = createTurn(db, projectId, {
    phase: 'scope',
    question: 'What platform?',
    answer: 'Web',
  });
  advanceHead(db, projectId, scopeTurn.id);

  const scopeProposalTurn = createTurn(db, projectId, {
    phase: 'scope',
    parent_turn_id: scopeTurn.id,
    question: '',
    answer: 'We have enough scope context',
  });
  advanceHead(db, projectId, scopeProposalTurn.id);

  const scopeOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'scope',
    proposal_turn_id: scopeProposalTurn.id,
    summary: 'Goals, terms, context, and constraints are sufficiently captured.',
  });

  const scopeConfirmationTurn = createTurn(db, projectId, {
    phase: 'scope',
    parent_turn_id: scopeProposalTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'scope',
      proposalTurnId: scopeProposalTurn.id,
    }),
  });
  confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
  advanceHead(db, projectId, scopeConfirmationTurn.id);

  return { scopeTurn, scopeProposalTurn, scopeConfirmationTurn };
}

export function seedActiveDesign(db: DB, projectId: number) {
  const seededScope = seedClosedScope(db, projectId);

  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededScope.scopeConfirmationTurn.id,
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  advanceHead(db, projectId, designTurn.id);

  return { ...seededScope, designTurn };
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

  const requirementCrud = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Create, edit, and close tickets with required fields: title, description, priority, and assignee',
  );
  const requirementAudit = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Every status change records the actor identity and ISO 8601 timestamp in the audit log',
  );
  const requirementPermissions = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Role-based visibility: admins see all tickets and settings, developers see assigned and unassigned tickets, viewers have read-only access',
  );

  for (const requirement of [requirementCrud, requirementAudit, requirementPermissions]) {
    linkKnowledgeItemToTurn(db, requirement.id, seededRequirements.designConfirmationTurn.id, 'captured');
  }

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
            referenceCode: code('requirement', 1),
            content: requirementCrud.content,
            rationale: 'Captures the core ticket lifecycle the tool must support from day one.',
            grounding: [
              { code: code('goal', 1) },
              { code: code('context', 1) },
              { code: code('decision', 1) },
            ],
          },
          {
            referenceCode: code('requirement', 2),
            content: requirementAudit.content,
            rationale: 'Protects accountability and traceability for regulated workflows.',
            grounding: [{ code: code('context', 2) }, { code: code('constraint', 1) }],
          },
          {
            referenceCode: code('requirement', 3),
            content: requirementPermissions.content,
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
    requirementCrud,
    requirementAudit,
    requirementPermissions,
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
            referenceCode: code('requirement', 1),
            content: approvedRequirement.content,
            rationale: 'Keeps resume behavior explicit in the accepted requirement set.',
            grounding: [{ code: code('goal', 1) }, { code: code('context', 1) }],
          },
          {
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
  const seededCriteria = seedCriteriaReady(db, projectId);

  const approvedRequirement = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Create, edit, and close tickets with required fields: title, description, priority, and assignee',
  );
  linkKnowledgeItemToTurn(
    db,
    approvedRequirement.id,
    seededCriteria.requirementsConfirmationTurn.id,
    'reviewed',
  );

  const criterionAudit = createKnowledgeItem(
    db,
    projectId,
    'criterion',
    'Changing a ticket status creates an audit log entry with actor, previous status, new status, and timestamp',
  );
  const criterionPermissions = createKnowledgeItem(
    db,
    projectId,
    'criterion',
    'A viewer cannot edit a ticket and receives a clear authorization failure without mutating data',
  );
  const criterionPerformance = createKnowledgeItem(
    db,
    projectId,
    'criterion',
    'Filtering 500 tickets by status or assignee returns visible results within two seconds on the seeded fixture',
  );

  for (const criterion of [criterionAudit, criterionPermissions, criterionPerformance]) {
    linkKnowledgeItemToTurn(db, criterion.id, seededCriteria.requirementsConfirmationTurn.id, 'captured');
  }

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
            referenceCode: code('criterion', 1),
            content: criterionAudit.content,
            rationale: 'Makes the audit requirement observable in a seeded acceptance check.',
            grounding: [{ code: code('requirement', 1) }, { code: code('context', 2) }],
          },
          {
            referenceCode: code('criterion', 2),
            content: criterionPermissions.content,
            rationale: 'Verifies role-based visibility through a concrete denial path.',
            grounding: [{ code: code('requirement', 1) }, { code: code('constraint', 2) }],
            isUserCreated: true,
          },
          {
            referenceCode: code('criterion', 3),
            content: criterionPerformance.content,
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
    approvedRequirement,
    reviewTurn,
    criterionAudit,
    criterionPermissions,
    criterionPerformance,
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
            referenceCode: code('criterion', 1),
            content: criterion.content,
            rationale: 'Provides a concise seeded acceptance check for the resume path.',
            grounding: [{ code: code('requirement', 1) }],
          },
          {
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
  const seededScope = seedClosedScope(db, projectId);

  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: seededScope.scopeConfirmationTurn.id,
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
    ...seededScope,
    designTurn,
    designForceCloseTurn,
    ...reviewedRequirements,
    ...reviewedCriteria,
  };
}

export function seedAllPhasesClosedWithLowReadinessScope(db: DB, projectId: number) {
  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    question: 'Which tradeoff matters most?',
    answer: 'Keep the repository seam small',
  });
  advanceHead(db, projectId, designTurn.id);

  const scopeClosureTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'scope',
      proposalTurnId: designTurn.id,
    }),
  });
  advanceHead(db, projectId, scopeClosureTurn.id);

  createConfirmedPhaseOutcome(db, {
    projectId,
    phase: 'scope',
    proposal_turn_id: scopeClosureTurn.id,
    confirmation_turn_id: scopeClosureTurn.id,
    summary:
      'Scope was closed from a minimal downstream checkpoint to exercise low-readiness export caveats.',
  });

  const designProposalTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: scopeClosureTurn.id,
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
    scopeClosureTurn,
    designProposalTurn,
    designConfirmationTurn,
    ...reviewedRequirements,
    ...reviewedCriteria,
  };
}

export function seedBrownfieldReusableGroundingReplay(db: DB, projectId: number) {
  const firstGroundingTurn = createTurn(db, projectId, {
    phase: 'scope',
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
    phase: 'scope',
    parent_turn_id: firstGroundingTurn.id,
    question: 'Which seam needs another grounding pass before we keep going?',
    answer: 'The chat-runtime finalization path and replay seam.',
    user_parts: serializeParts([
      { type: 'text', text: 'The chat-runtime finalization path and replay seam.' },
    ]),
  });
  advanceHead(db, projectId, substantiveTurn.id);

  const laterGroundingTurn = createTurn(db, projectId, {
    phase: 'scope',
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
  'scope' | 'design' | 'requirements' | 'criteria',
  WorkflowPhaseStatus
>;

export interface WalkthroughScenarioMatrixEntry {
  scenarioName: string;
  label: string;
  source: 'manifest' | 'synthetic';
  inspectionFocus: string;
  expectedWorkflowSummary: WalkthroughWorkflowSummary;
  manifestScenarioKey?: string;
}

function createWorkflowSummary(
  scope: WorkflowPhaseStatus,
  design: WorkflowPhaseStatus,
  requirements: WorkflowPhaseStatus,
  criteria: WorkflowPhaseStatus,
): WalkthroughWorkflowSummary {
  return { scope, design, requirements, criteria };
}

export const scenarios: Record<string, ScenarioFn> = {
  'scope-closed': (db, name = 'Scope Closed') => {
    const project = createProject(db, name);
    seedClosedScope(db, project.id);
    return project.id;
  },
  'design-active': (db, name = 'Design Active') => {
    const project = createProject(db, name);
    seedActiveDesign(db, project.id);
    return project.id;
  },
  'requirements-ready': (db, name = 'Requirements Ready') => {
    const project = createProject(db, name);
    seedRequirementsReviewReady(db, project.id);
    return project.id;
  },
  'criteria-ready': (db, name = 'Criteria Ready') => {
    const project = createProject(db, name);
    seedCriteriaReviewReady(db, project.id);
    return project.id;
  },
  'all-phases-closed': (db, name = 'All Phases Closed') => {
    const project = createProject(db, name);
    seedAllPhasesClosed(db, project.id);
    return project.id;
  },
  'forced-close-all-phases-closed': (db, name = 'Forced-Close All Phases Closed') => {
    const project = createProject(db, name);
    seedAllPhasesClosedWithForcedDesign(db, project.id);
    return project.id;
  },
  'low-readiness-all-phases-closed': (db, name = 'Low-Readiness All Phases Closed') => {
    const project = createProject(db, name);
    seedAllPhasesClosedWithLowReadinessScope(db, project.id);
    return project.id;
  },
};

export const testOnlyScenarios: Record<string, ScenarioFn> = {};

export const manifestScenarios = loadManifestScenarios('issue-tracker');

const publicManifestAnchorScenarios: Record<string, ScenarioFn> = {
  'issue-tracker-kickoff-ready': createManifestScenarioSeeder(
    issueTrackerManifest.scenarios['kickoff-ready']!,
    'Issue Tracker (kickoff ready)',
  ),
  'issue-tracker-all-phases-closed': createManifestScenarioSeeder(
    issueTrackerManifest.scenarios['all-phases-closed']!,
    'Issue Tracker (all phases closed)',
  ),
};

const phaseTransitionScenarios: Record<string, ScenarioFn> = {
  'brownfield-grounding-replay': (db, name = 'Brownfield reusable grounding replay') => {
    const project = createProject(db, name, {
      mode: 'brownfield',
      cwd: '/tmp/repo',
    });
    seedBrownfieldReusableGroundingReplay(db, project.id);
    return project.id;
  },
  'issue-tracker-scope-closure-pending': createManifestScenarioSeeder(
    sliceManifestScenario(issueTrackerManifest.scenarios['scope-closed']!, 6),
    'Issue Tracker (scope closure pending)',
  ),
  'issue-tracker-design-kickoff-ready': createManifestScenarioSeeder(
    sliceManifestScenario(issueTrackerManifest.scenarios['scope-closed']!, 7),
    'Issue Tracker (design kickoff ready)',
  ),
  'issue-tracker-design-recovery': createManifestScenarioSeeder(
    issueTrackerManifest.scenarios['design-active']!,
    'Issue Tracker (design recovery)',
  ),
  'issue-tracker-requirements-kickoff-ready': (db, name = 'Issue Tracker (requirements kickoff ready)') => {
    const project = createProject(db, name);
    seedRequirementsReady(db, project.id);
    return project.id;
  },
  'issue-tracker-criteria-kickoff-ready': (db, name = 'Issue Tracker (criteria kickoff ready)') => {
    const project = createProject(db, name);
    seedCriteriaReady(db, project.id);
    return project.id;
  },
  'issue-tracker-requirements-ready': (db, name = 'Issue Tracker (requirements review ready)') => {
    const project = createProject(db, name);
    seedRequirementsReviewReady(db, project.id);
    return project.id;
  },
  'issue-tracker-criteria-ready': (db, name = 'Issue Tracker (criteria review ready)') => {
    const project = createProject(db, name);
    seedCriteriaReviewReady(db, project.id);
    return project.id;
  },
};

export const walkthroughScenarioMatrix: readonly WalkthroughScenarioMatrixEntry[] = [
  {
    scenarioName: 'brownfield-grounding-replay',
    label: 'Brownfield reusable grounding replay',
    source: 'synthetic',
    inspectionFocus:
      'Brownfield kickoff, answered grounding-card continue, later reusable context gathering, and resume all stay legible through the same replay seam.',
    expectedWorkflowSummary: createWorkflowSummary('in_progress', 'unstarted', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-kickoff-ready',
    label: 'Kickoff workspace',
    source: 'manifest',
    inspectionFocus: 'Blank greenfield kickoff, empty workspace rendering, and resume after seeding.',
    expectedWorkflowSummary: createWorkflowSummary('in_progress', 'unstarted', 'unstarted', 'unstarted'),
    manifestScenarioKey: 'kickoff-ready',
  },
  {
    scenarioName: 'issue-tracker-scope-closure-pending',
    label: 'Scope closure pending',
    source: 'synthetic',
    inspectionFocus: 'Closure proposal summary is visible and waiting for explicit confirmation.',
    expectedWorkflowSummary: createWorkflowSummary('in_progress', 'unstarted', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-design-kickoff-ready',
    label: 'Design kickoff ready',
    source: 'synthetic',
    inspectionFocus: 'Scope handoff has landed and the next phase opens with an explicit kickoff frontier.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'in_progress', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-design-recovery',
    label: 'Design recovery frontier',
    source: 'synthetic',
    inspectionFocus:
      'A completed design turn has no successor, so the exceptional recovery frontier is visible.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'in_progress', 'unstarted', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-requirements-kickoff-ready',
    label: 'Requirements kickoff ready',
    source: 'synthetic',
    inspectionFocus: 'Design closure hands off into the requirements phase with a fresh kickoff frontier.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'in_progress', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-requirements-ready',
    label: 'Requirements review ready',
    source: 'synthetic',
    inspectionFocus:
      'The requirements phase shows the current full-set review frontier with explicit review actions.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'in_progress', 'unstarted'),
  },
  {
    scenarioName: 'issue-tracker-criteria-kickoff-ready',
    label: 'Criteria kickoff ready',
    source: 'synthetic',
    inspectionFocus: 'Requirements closure hands off into criteria with an explicit kickoff frontier.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'in_progress'),
  },
  {
    scenarioName: 'issue-tracker-criteria-ready',
    label: 'Criteria review ready',
    source: 'synthetic',
    inspectionFocus:
      'The criteria phase shows the current full-set review frontier before export becomes available.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'in_progress'),
  },
  {
    scenarioName: 'issue-tracker-all-phases-closed',
    label: 'Export-ready walkthrough',
    source: 'manifest',
    inspectionFocus: 'Full active-path export, final transcript review, and resume into a completed project.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'closed'),
    manifestScenarioKey: 'all-phases-closed',
  },
  {
    scenarioName: 'forced-close-all-phases-closed',
    label: 'Forced-close export caveat',
    source: 'synthetic',
    inspectionFocus: 'Manual inspection of export caveats when design was closed via user-forced closure.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'closed'),
  },
  {
    scenarioName: 'low-readiness-all-phases-closed',
    label: 'Low-readiness export caveat',
    source: 'synthetic',
    inspectionFocus: 'Manual inspection of export caveats when scope closed with low readiness.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'closed'),
  },
] as const;

export const walkthroughScenarioNames = walkthroughScenarioMatrix.map((entry) => entry.scenarioName);
const walkthroughScenarioNameSet = new Set<string>(walkthroughScenarioNames);

export const publicScenarios: Record<string, ScenarioFn> = {
  ...scenarios,
  ...publicManifestAnchorScenarios,
  ...phaseTransitionScenarios,
};
export const publicScenarioNames = [
  ...walkthroughScenarioNames.filter((name) => name in publicScenarios),
  ...Object.keys(publicScenarios).filter((name) => !walkthroughScenarioNameSet.has(name)),
];
export const allScenarios: Record<string, ScenarioFn> = {
  ...publicScenarios,
  ...manifestScenarios,
  ...testOnlyScenarios,
};
export const scenarioNames = publicScenarioNames;
