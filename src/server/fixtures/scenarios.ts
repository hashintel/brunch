import {
  advanceHead,
  confirmPhaseOutcome,
  createKnowledgeItem,
  createPhaseOutcome,
  createProject,
  createTurn,
  linkKnowledgeItemToTurn,
  type DB,
} from '../db.js';

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
    answer: 'Confirm scope closure',
    user_parts: JSON.stringify([
      { type: 'text', text: 'Confirm scope closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: scopeProposalTurn.id,
          phase: 'scope',
        },
      },
    ]),
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
    answer: 'Confirm design closure',
    user_parts: JSON.stringify([
      { type: 'text', text: 'Confirm design closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: seededDesign.designTurn.id,
          phase: 'design',
        },
      },
    ]),
  });
  confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
  advanceHead(db, projectId, designConfirmationTurn.id);

  return { ...seededDesign, designConfirmationTurn };
}

export function seedCriteriaReady(db: DB, projectId: number) {
  const seededRequirements = seedRequirementsReady(db, projectId);

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
    parent_turn_id: seededRequirements.designConfirmationTurn.id,
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
    user_parts: JSON.stringify([
      { type: 'text', text: 'Confirm requirements closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: requirementsProposalTurn.id,
          phase: 'requirements',
        },
      },
    ]),
  });
  confirmPhaseOutcome(db, requirementsOutcome.id, requirementsConfirmationTurn.id);
  advanceHead(db, projectId, requirementsConfirmationTurn.id);

  return {
    ...seededRequirements,
    approvedRequirement,
    rejectedRequirement,
    reviewTurn,
    requirementsProposalTurn,
    requirementsConfirmationTurn,
  };
}

export function seedAllPhasesClosed(db: DB, projectId: number) {
  const seededCriteria = seedCriteriaReady(db, projectId);

  const criterion = createKnowledgeItem(db, projectId, 'criterion', 'Verify SQLite resume');
  const criterionReviewTurn = createTurn(db, projectId, {
    phase: 'criteria',
    parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
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
    answer: 'Confirm criteria closure',
    user_parts: JSON.stringify([
      { type: 'text', text: 'Confirm criteria closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: criteriaProposalTurn.id,
          phase: 'criteria',
        },
      },
    ]),
  });
  confirmPhaseOutcome(db, criteriaOutcome.id, criteriaConfirmationTurn.id);
  advanceHead(db, projectId, criteriaConfirmationTurn.id);

  return {
    ...seededCriteria,
    criterion,
    criterionReviewTurn,
    criteriaProposalTurn,
    criteriaConfirmationTurn,
  };
}

export type ScenarioFn = (db: DB, projectName?: string) => number;

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
};

export const scenarioNames = Object.keys(scenarios);
