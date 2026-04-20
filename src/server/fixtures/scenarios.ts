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
import { loadManifest, loadManifestScenarios, seedFromManifest, type ManifestScenario } from './manifest.js';

function createReviewSetAssistantParts({
  phase,
  title,
  prompt,
  items,
}: {
  phase: 'requirements' | 'criteria';
  title: string;
  prompt: string;
  items: Array<{
    referenceCode: string;
    content: string;
    rationale?: string;
    grounding?: Array<{ code: string }>;
    isUserCreated?: boolean;
    isRevised?: boolean;
  }>;
}): string {
  return serializeParts([
    { type: 'text', text: prompt },
    {
      type: 'data-review-set',
      data: {
        phase,
        title,
        items,
      },
    },
  ]);
}

function createConfirmationParts(text: string, data: object): string {
  return JSON.stringify([
    { type: 'text', text },
    {
      type: 'data-confirmation',
      data,
    },
  ]);
}

function createAcceptedReviewUserParts(turnId: number, selectedOptionIds: number[]): string {
  return JSON.stringify([
    { type: 'text', text: 'Accept review' },
    {
      type: 'data-turn-response',
      data: {
        turnId,
        selectedOptionIds,
        reviewAction: 'accept',
      },
    },
  ]);
}

const issueTrackerManifest = loadManifest('issue-tracker');

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

function appendFrontierTurn(
  scenario: ManifestScenario,
  phase: ManifestScenario['turns'][number]['phase'],
  turnKind: 'kickoff' | 'recovery',
): ManifestScenario {
  return {
    ...scenario,
    turns: [
      ...scenario.turns,
      {
        phase,
        turnKind,
        question: '',
        answer: null,
      },
    ],
  };
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
    user_parts: createConfirmationParts('Confirm grounding closure', {
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: scopeProposalTurn.id,
      phase: 'scope',
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
    user_parts: createConfirmationParts('Confirm elicitation closure', {
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: seededDesign.designTurn.id,
      phase: 'design',
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
    assistant_parts: createReviewSetAssistantParts({
      phase: 'requirements',
      title: 'Requirements',
      prompt: 'Please review the current requirement set.',
      items: [
        {
          referenceCode: 'R1',
          content: requirementCrud.content,
          rationale: 'Captures the core ticket lifecycle the tool must support from day one.',
          grounding: [{ code: 'GOAL1' }, { code: 'CTX1' }, { code: 'D1' }],
        },
        {
          referenceCode: 'R2',
          content: requirementAudit.content,
          rationale: 'Protects accountability and traceability for regulated workflows.',
          grounding: [{ code: 'CTX2' }, { code: 'CST1' }],
        },
        {
          referenceCode: 'R3',
          content: requirementPermissions.content,
          rationale: 'Ensures each role sees only the operations appropriate to its responsibility.',
          grounding: [{ code: 'GOAL2' }, { code: 'CST2' }],
          isRevised: true,
        },
      ],
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
    assistant_parts: createReviewSetAssistantParts({
      phase: 'requirements',
      title: 'Requirements',
      prompt: 'Please review the current requirement set.',
      items: [
        {
          referenceCode: 'R1',
          content: approvedRequirement.content,
          rationale: 'Keeps resume behavior explicit in the accepted requirement set.',
          grounding: [{ code: 'GOAL1' }, { code: 'CTX1' }],
        },
        {
          referenceCode: 'R2',
          content: supportingRequirement.content,
          rationale: 'Preserves the local-first persistence seam as a first-order concern.',
          grounding: [{ code: 'D1' }, { code: 'A1' }],
        },
      ],
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
    user_parts: createAcceptedReviewUserParts(reviewTurn.id, [acceptOption.id]),
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

  const criteriaKickoffTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: reviewTurn.id,
    turn_kind: 'kickoff',
    question: '',
    answer: null,
  });
  advanceHead(db, projectId, criteriaKickoffTurn.id);

  return {
    approvedRequirement,
    supportingRequirement,
    reviewTurn,
    requirementsConfirmationTurn: reviewTurn,
    criteriaKickoffTurn,
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
    linkKnowledgeItemToTurn(db, criterion.id, seededCriteria.criteriaKickoffTurn.id, 'captured');
  }

  const reviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: seededCriteria.criteriaKickoffTurn.id,
    question: 'Please review the current criterion set.',
    why: 'Review the whole criterion set before moving forward.',
    impact: 'high',
    answer: null,
    assistant_parts: createReviewSetAssistantParts({
      phase: 'criteria',
      title: 'Acceptance Criteria',
      prompt: 'Please review the current criterion set.',
      items: [
        {
          referenceCode: 'CRIT1',
          content: criterionAudit.content,
          rationale: 'Makes the audit requirement observable in a seeded acceptance check.',
          grounding: [{ code: 'R1' }, { code: 'CTX2' }],
        },
        {
          referenceCode: 'CRIT2',
          content: criterionPermissions.content,
          rationale: 'Verifies role-based visibility through a concrete denial path.',
          grounding: [{ code: 'R1' }, { code: 'CST2' }],
          isUserCreated: true,
        },
        {
          referenceCode: 'CRIT3',
          content: criterionPerformance.content,
          rationale: 'Pins the seeded demo to a legible performance target.',
          grounding: [{ code: 'R1' }, { code: 'A1' }],
          isRevised: true,
        },
      ],
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
    assistant_parts: createReviewSetAssistantParts({
      phase: 'criteria',
      title: 'Acceptance Criteria',
      prompt: 'Please review the current criterion set.',
      items: [
        {
          referenceCode: 'CRIT1',
          content: criterion.content,
          rationale: 'Provides a concise seeded acceptance check for the resume path.',
          grounding: [{ code: 'R1' }],
        },
        {
          referenceCode: 'CRIT2',
          content: supportingCriterion.content,
          rationale: 'Shows the user-visible reload behavior that proves persistence worked.',
          grounding: [{ code: 'R1' }, { code: 'CTX1' }],
        },
      ],
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
    user_parts: createAcceptedReviewUserParts(criterionReviewTurn.id, [acceptOption.id]),
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
  const reviewedCriteria = seedClosedCriteriaReview(db, projectId, seededCriteria.criteriaKickoffTurn.id);

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
    user_parts: createConfirmationParts('Force elicitation closure', {
      kind: 'force-close-active-phase',
      phase: 'design',
    }),
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
    reviewedRequirements.criteriaKickoffTurn.id,
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
    user_parts: createConfirmationParts('Confirm grounding closure', {
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: designTurn.id,
      phase: 'scope',
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
    user_parts: createConfirmationParts('Confirm elicitation closure', {
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: designProposalTurn.id,
      phase: 'design',
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
    reviewedRequirements.criteriaKickoffTurn.id,
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
    seedRequirementsReady(db, project.id);
    return project.id;
  },
  'criteria-ready': (db, name = 'Criteria Ready') => {
    const project = createProject(db, name);
    seedCriteriaReady(db, project.id);
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

const phaseTransitionScenarios: Record<string, ScenarioFn> = {
  'issue-tracker-scope-closure-pending': createManifestScenarioSeeder(
    sliceManifestScenario(issueTrackerManifest.scenarios['scope-closed']!, 6),
    'Issue Tracker (scope closure pending)',
  ),
  'issue-tracker-design-kickoff-ready': createManifestScenarioSeeder(
    appendFrontierTurn(
      sliceManifestScenario(issueTrackerManifest.scenarios['scope-closed']!, 7),
      'design',
      'kickoff',
    ),
    'Issue Tracker (design kickoff ready)',
  ),
  'issue-tracker-design-recovery': createManifestScenarioSeeder(
    appendFrontierTurn(issueTrackerManifest.scenarios['design-active']!, 'design', 'recovery'),
    'Issue Tracker (design recovery)',
  ),
  'issue-tracker-requirements-kickoff-ready': createManifestScenarioSeeder(
    appendFrontierTurn(
      sliceManifestScenario(issueTrackerManifest.scenarios['requirements-ready']!, 11),
      'requirements',
      'kickoff',
    ),
    'Issue Tracker (requirements kickoff ready)',
  ),
  'issue-tracker-criteria-kickoff-ready': createManifestScenarioSeeder(
    appendFrontierTurn(
      sliceManifestScenario(issueTrackerManifest.scenarios['requirements-ready']!, 18),
      'criteria',
      'kickoff',
    ),
    'Issue Tracker (criteria kickoff ready)',
  ),
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
  ...manifestScenarios,
  ...phaseTransitionScenarios,
};
export const publicScenarioNames = [
  ...walkthroughScenarioNames.filter((name) => name in publicScenarios),
  ...Object.keys(publicScenarios).filter((name) => !walkthroughScenarioNameSet.has(name)),
];
export const allScenarios: Record<string, ScenarioFn> = {
  ...publicScenarios,
  ...testOnlyScenarios,
};
export const scenarioNames = publicScenarioNames;
