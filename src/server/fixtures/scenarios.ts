import {
  advanceHead,
  confirmPhaseOutcome,
  createKnowledgeItem,
  createPhaseOutcome,
  createConfirmedPhaseOutcome,
  createProject,
  createTurn,
  linkKnowledgeItemToTurn,
  type DB,
  type WorkflowPhaseStatus,
} from '../db.js';
import { loadManifestScenarios } from './manifest.js';

function createConfirmationParts(text: string, data: object): string {
  return JSON.stringify([
    { type: 'text', text },
    {
      type: 'data-confirmation',
      data,
    },
  ]);
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

function seedClosedRequirementsReview(db: DB, projectId: number, parentTurnId: number) {
  const approvedRequirement = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Resume the interview from SQLite after restart',
  );
  const rejectedRequirement = createKnowledgeItem(
    db,
    projectId,
    'requirement',
    'Support exporting the spec as a PDF',
  );

  const reviewTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: parentTurnId,
    question: 'Are these requirements all reviewed now?',
    answer: 'Yes — approve resume and reject PDF export',
  });
  linkKnowledgeItemToTurn(db, approvedRequirement.id, reviewTurn.id, 'reviewed');
  linkKnowledgeItemToTurn(db, rejectedRequirement.id, reviewTurn.id, 'rejected');
  advanceHead(db, projectId, reviewTurn.id);

  const requirementsProposalTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: reviewTurn.id,
    question: '',
    answer: 'The requirement set has explicit review coverage and is ready to move into criteria.',
  });
  advanceHead(db, projectId, requirementsProposalTurn.id);

  const requirementsOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'requirements',
    proposal_turn_id: requirementsProposalTurn.id,
    summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
  });

  const requirementsConfirmationTurn = createTurn(db, projectId, {
    phase: 'requirements',
    parent_turn_id: requirementsProposalTurn.id,
    question: '',
    answer: 'Confirm requirements closure',
    user_parts: createConfirmationParts('Confirm requirements closure', {
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: requirementsProposalTurn.id,
      phase: 'requirements',
    }),
  });
  confirmPhaseOutcome(db, requirementsOutcome.id, requirementsConfirmationTurn.id);
  advanceHead(db, projectId, requirementsConfirmationTurn.id);

  return {
    approvedRequirement,
    rejectedRequirement,
    reviewTurn,
    requirementsProposalTurn,
    requirementsConfirmationTurn,
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

function seedClosedCriteriaReview(db: DB, projectId: number, parentTurnId: number) {
  const criterion = createKnowledgeItem(db, projectId, 'criterion', 'Verify SQLite resume');
  const criterionReviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: parentTurnId,
    question: 'Are these criteria reviewed?',
    answer: 'Yes — approve the criterion',
  });
  linkKnowledgeItemToTurn(db, criterion.id, criterionReviewTurn.id, 'reviewed');
  advanceHead(db, projectId, criterionReviewTurn.id);

  const criteriaProposalTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: criterionReviewTurn.id,
    question: '',
    answer: 'Criteria review coverage is complete.',
  });
  advanceHead(db, projectId, criteriaProposalTurn.id);

  const criteriaOutcome = createPhaseOutcome(db, {
    projectId,
    phase: 'criteria',
    proposal_turn_id: criteriaProposalTurn.id,
    summary: 'Criteria review coverage is complete.',
  });

  const criteriaConfirmationTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: criteriaProposalTurn.id,
    question: '',
    answer: 'Confirm acceptance criteria closure',
    user_parts: createConfirmationParts('Confirm acceptance criteria closure', {
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: criteriaProposalTurn.id,
      phase: 'criteria',
    }),
  });
  confirmPhaseOutcome(db, criteriaOutcome.id, criteriaConfirmationTurn.id);
  advanceHead(db, projectId, criteriaConfirmationTurn.id);

  return { criterion, criterionReviewTurn, criteriaProposalTurn, criteriaConfirmationTurn };
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
    scenarioName: 'issue-tracker-scope-closed',
    label: 'Post-scope handoff',
    source: 'manifest',
    inspectionFocus: 'Scope summary/confirmation artifacts and the first design-ready workspace.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'in_progress', 'unstarted', 'unstarted'),
    manifestScenarioKey: 'scope-closed',
  },
  {
    scenarioName: 'issue-tracker-design-active',
    label: 'In-flight design',
    source: 'manifest',
    inspectionFocus: 'Design-phase transcript state with scope already closed and resumable.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'in_progress', 'unstarted', 'unstarted'),
    manifestScenarioKey: 'design-active',
  },
  {
    scenarioName: 'issue-tracker-requirements-ready',
    label: 'Criteria handoff',
    source: 'manifest',
    inspectionFocus:
      'Requirements closure artifacts, criteria handoff, and resume behavior between review phases.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'in_progress'),
    manifestScenarioKey: 'requirements-ready',
  },
  {
    scenarioName: 'issue-tracker-criteria-ready',
    label: 'Criteria review-ready',
    source: 'manifest',
    inspectionFocus: 'Criteria review turns, mixed approval state, and export-not-yet-ready gating.',
    expectedWorkflowSummary: createWorkflowSummary('closed', 'closed', 'closed', 'in_progress'),
    manifestScenarioKey: 'criteria-ready',
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

export const publicScenarios: Record<string, ScenarioFn> = { ...scenarios, ...manifestScenarios };
export const publicScenarioNames = [
  ...walkthroughScenarioNames.filter((name) => name in publicScenarios),
  ...Object.keys(publicScenarios).filter((name) => !walkthroughScenarioNameSet.has(name)),
];
export const allScenarios: Record<string, ScenarioFn> = {
  ...publicScenarios,
  ...testOnlyScenarios,
};
export const scenarioNames = publicScenarioNames;
