import { randomUUID } from 'crypto';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  createDb,
  getOrCreateProject,
  createTurn,
  updateTurn,
  createOption,
  getActivePath,
  advanceHead,
  listProjects,
  createProject,
  getProject,
  createDecision,
  createAssumption,
  createKnowledgeItem,
  linkDecisionToTurn,
  linkAssumptionToTurn,
  linkKnowledgeItemToTurn,
  createConfirmedPhaseOutcome,
  addDecisionParentDecision,
  addDecisionParentAssumption,
  addAssumptionParentAssumption,
  getEntitiesForProjectByMode,
  getEntitiesForProject,
  getEntitiesForProjectOnActivePath,
  getCapturedItemsForTurns,
  getScopeBundleForProject,
  listPhaseOutcomesForProject,
  getCurrentWorkflowState,
  type DB,
} from './db.js';

let db: DB;

beforeEach(() => {
  db = createDb(); // :memory:
});

afterEach(() => {
  db.$client.close();
});

describe('createDb', () => {
  it('creates all schema tables, including the generic knowledge edge seam', () => {
    const tables = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    const expected = [
      'project',
      'turn',
      'option',
      'decision',
      'assumption',
      'requirement',
      'criterion',
      'knowledge_item',
      'knowledge_edge',
      'turn_decision',
      'turn_assumption',
      'turn_knowledge_item',
      'decision_parent_decision',
      'decision_parent_assumption',
      'assumption_parent_assumption',
      'requirement_decision',
      'phase_outcome',
    ];
    for (const table of expected) {
      expect(names).toContain(table);
    }

    const phaseOutcomeColumns = db.$client.prepare("PRAGMA table_info('phase_outcome')").all() as Array<{
      name: string;
    }>;
    expect(phaseOutcomeColumns.map((column) => column.name)).toContain('closure_basis');

    const turnColumns = db.$client.prepare("PRAGMA table_info('turn')").all() as Array<{ name: string }>;
    expect(turnColumns.map((column) => column.name)).toContain('turn_kind');
  });

  it('project table has mode and cwd columns', () => {
    const columns = db.$client.prepare("PRAGMA table_info('project')").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('mode');
    expect(names).toContain('cwd');
  });

  it('creates database file on disk when given a path', () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'test.db');
    const diskDb = createDb(dbPath);
    expect(existsSync(dbPath)).toBe(true);
    diskDb.$client.close();
    unlinkSync(dbPath);
  });

  it('enables WAL journal mode for file-backed databases', () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'wal-test.db');
    const fileDb = createDb(dbPath);
    const row = fileDb.$client.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(row.journal_mode).toBe('wal');
    fileDb.$client.close();
    unlinkSync(dbPath);
  });
});

describe('getOrCreateProject', () => {
  it('creates a default project with null active_turn_id', () => {
    const project = getOrCreateProject(db);
    expect(project).toMatchObject({ name: 'default', active_turn_id: null });
    expect(project.id).toBeDefined();
    expect(project.created_at).toBeDefined();
  });

  it('returns the existing project on subsequent calls', () => {
    const first = getOrCreateProject(db);
    const second = getOrCreateProject(db);
    expect(second.id).toBe(first.id);
  });
});

describe('turn CRUD', () => {
  it('creates a root turn with no parent', () => {
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What is the project about?',
      answer: 'A chat app',
    });
    expect(turn.id).toBeDefined();
    expect(turn.parent_turn_id).toBeNull();
    expect(turn.phase).toBe('scope');
    expect(turn.question).toBe('What is the project about?');
    expect(turn.answer).toBe('A chat app');
    expect(turn.turn_kind).toBe('question');
    expect(turn.is_resolution).toBe(false);
  });

  it('creates child turns with parent chain', () => {
    const project = getOrCreateProject(db);
    const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const t2 = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    const t3 = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q3',
      answer: 'A3',
      parent_turn_id: t2.id,
    });
    expect(t2.parent_turn_id).toBe(t1.id);
    expect(t3.parent_turn_id).toBe(t2.id);
  });

  it('creates options for a turn', () => {
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Pick one' });
    const opt1 = createOption(db, turn.id, {
      position: 0,
      content: 'Option A',
      is_recommended: true,
    });
    const opt2 = createOption(db, turn.id, { position: 1, content: 'Option B' });
    expect(opt1.is_recommended).toBe(true);
    expect(opt1.content).toBe('Option A');
    expect(opt2.is_recommended).toBe(false);
  });

  it('enforces unique (turn_id, position) on options', () => {
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Pick one' });
    createOption(db, turn.id, { position: 0, content: 'Option A' });
    expect(() => createOption(db, turn.id, { position: 0, content: 'Duplicate' })).toThrow();
  });

  it('updates turn answer and question', () => {
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, { phase: 'scope', question: '' });
    updateTurn(db, turn.id, { question: 'Updated Q', answer: 'User said this' });
    const updated = db.$client.prepare('SELECT * FROM turn WHERE id = ?').get(turn.id) as any;
    expect(updated.question).toBe('Updated Q');
    expect(updated.answer).toBe('User said this');
  });

  it('partial update only changes specified fields', () => {
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Original Q',
      answer: 'Original A',
    });
    updateTurn(db, turn.id, { question: 'New Q' });
    const updated = db.$client.prepare('SELECT * FROM turn WHERE id = ?').get(turn.id) as any;
    expect(updated.question).toBe('New Q');
    expect(updated.answer).toBe('Original A');
  });
});

describe('phase outcome lifecycle', () => {
  it('persists explicit scope outcomes and supersedes them when the active path changes upstream', async () => {
    const project = getOrCreateProject(db);
    const root = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    const closureTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'We have enough scope context',
      parent_turn_id: root.id,
    });
    advanceHead(db, project.id, closureTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState, listPhaseOutcomesForProject } =
      await import('./db.js');

    const proposed = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: closureTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    expect(getCurrentWorkflowState(db, project.id).phases.scope).toMatchObject({
      status: 'in_progress',
      proposalPending: true,
      summary: proposed.summary,
      turnId: closureTurn.id,
      closeability: true,
      readiness: 'medium',
      closureBasis: null,
    });

    const confirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'Confirm grounding closure',
      parent_turn_id: closureTurn.id,
    });
    confirmPhaseOutcome(db, proposed.id, confirmationTurn.id);
    advanceHead(db, project.id, confirmationTurn.id);

    const confirmedWorkflow = getCurrentWorkflowState(db, project.id);
    expect(confirmedWorkflow.phases.scope).toMatchObject({
      status: 'closed',
      proposalPending: false,
      summary: proposed.summary,
      turnId: closureTurn.id,
      closeability: false,
      readiness: 'medium',
      closureBasis: 'interviewer_recommended',
    });
    expect(listPhaseOutcomesForProject(db, project.id)[0]).toMatchObject({
      id: proposed.id,
      closure_basis: 'interviewer_recommended',
    });
    expect(confirmedWorkflow.phases.design).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
      closeability: false,
      readiness: 'low',
      closureBasis: null,
    });

    const alternateTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What should we revisit?',
      answer: 'Target audience',
      parent_turn_id: root.id,
    });
    advanceHead(db, project.id, alternateTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.scope).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
      summary: null,
      turnId: null,
      closeability: true,
      closureBasis: null,
    });
    expect(listPhaseOutcomesForProject(db, project.id)[0]).toMatchObject({
      id: proposed.id,
      status: 'superseded',
    });
  });

  it('projects a user-forced design close from the confirmation turn and advances requirements', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const scopeProposalTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'We have enough scope context',
      parent_turn_id: scopeTurn.id,
    });
    advanceHead(db, project.id, scopeProposalTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'Confirm grounding closure',
      parent_turn_id: scopeProposalTurn.id,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Confirm grounding closure' },
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
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
      parent_turn_id: scopeConfirmationTurn.id,
    });
    advanceHead(db, project.id, designTurn.id);

    const designForceCloseTurn = createTurn(db, project.id, {
      phase: 'design',
      question: '',
      answer: 'Force elicitation closure',
      parent_turn_id: designTurn.id,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Force elicitation closure' },
        {
          type: 'data-confirmation',
          data: { kind: 'force-close-active-phase', phase: 'design' },
        },
      ]),
    });

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designForceCloseTurn.id,
      summary: 'Elicitation closed by user without an interviewer recommendation.',
    });
    confirmPhaseOutcome(db, designOutcome.id, designForceCloseTurn.id);
    advanceHead(db, project.id, designForceCloseTurn.id);

    const workflow = getCurrentWorkflowState(db, project.id);
    expect(workflow.phases.design).toMatchObject({
      status: 'closed',
      proposalPending: false,
      turnId: designForceCloseTurn.id,
      summary: 'Elicitation closed by user without an interviewer recommendation.',
      closeability: false,
      readiness: 'medium',
      closureBasis: 'user_forced',
    });
    expect(listPhaseOutcomesForProject(db, project.id)[0]).toMatchObject({
      id: designOutcome.id,
      closure_basis: 'user_forced',
    });
    expect(workflow.phases.requirements).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
      closeability: false,
      readiness: 'low',
      closureBasis: null,
    });
  });

  it('keeps requirements in progress and not yet closeable after the first requirements review interaction', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const scopeProposalTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'We have enough scope context',
      parent_turn_id: scopeTurn.id,
    });
    advanceHead(db, project.id, scopeProposalTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'Confirm grounding closure',
      parent_turn_id: scopeProposalTurn.id,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Confirm grounding closure' },
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
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
      parent_turn_id: scopeConfirmationTurn.id,
    });
    advanceHead(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });

    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      question: '',
      answer: 'Confirm elicitation closure',
      parent_turn_id: designTurn.id,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Confirm elicitation closure' },
        {
          type: 'data-confirmation',
          data: {
            kind: 'confirm-proposed-phase-closure',
            proposalTurnId: designTurn.id,
            phase: 'design',
          },
        },
      ]),
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    advanceHead(db, project.id, designConfirmationTurn.id);

    const requirementsReviewTurn = createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Which requirements are still missing?',
      answer: 'A requirement is missing — Export the reviewed spec as markdown',
      parent_turn_id: designConfirmationTurn.id,
    });
    advanceHead(db, project.id, requirementsReviewTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
      closureBasis: null,
    });
  });

  it('keeps requirements non-closeable until an accepted review closes the phase', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
    });
    advanceHead(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });
    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    advanceHead(db, project.id, designConfirmationTurn.id);

    const approvedRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Export the reviewed spec',
    );
    const rejectedRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    const pendingRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Resume the interview from SQLite after restart',
    );

    const approvalTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Should we approve the export requirement?',
      answer: 'Approve this requirement',
    });
    linkKnowledgeItemToTurn(db, approvedRequirement.id, approvalTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedRequirement.id, approvalTurn.id, 'rejected');
    advanceHead(db, project.id, approvalTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });

    const finalReviewTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: approvalTurn.id,
      question: 'Should we approve the resume requirement?',
      answer: 'Approve this requirement',
    });
    linkKnowledgeItemToTurn(db, pendingRequirement.id, finalReviewTurn.id, 'reviewed');
    advanceHead(db, project.id, finalReviewTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });
  });

  it('projects criteria without per-item review status on the project-wide read model', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeTurn.id,
      summary: 'Scope captured.',
    });
    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Tradeoff?',
      answer: 'Keep it small',
    });
    advanceHead(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'Design captured.',
    });
    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    advanceHead(db, project.id, designConfirmationTurn.id);

    const requirement = createKnowledgeItem(db, project.id, 'requirement', 'Export the spec');
    const reqReviewTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Review?',
      answer: 'Approve',
    });
    linkKnowledgeItemToTurn(db, requirement.id, reqReviewTurn.id, 'reviewed');
    advanceHead(db, project.id, reqReviewTurn.id);

    const reqProposalTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqReviewTurn.id,
      question: '',
      answer: 'Close requirements',
    });
    advanceHead(db, project.id, reqProposalTurn.id);
    const reqOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'requirements',
      proposal_turn_id: reqProposalTurn.id,
      summary: 'Requirements reviewed.',
    });
    const reqConfirmationTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqProposalTurn.id,
      question: '',
      answer: 'Confirm requirements closure',
    });
    confirmPhaseOutcome(db, reqOutcome.id, reqConfirmationTurn.id);
    advanceHead(db, project.id, reqConfirmationTurn.id);

    const approvedCriterion = createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const rejectedCriterion = createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'PDF export renders the reviewed requirements',
    );
    const pendingCriterion = createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Restarting the browser resumes the active path',
    );

    const criteriaReviewTurn = createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: reqConfirmationTurn.id,
      question: 'Review these criteria?',
      answer: 'Approve markdown, reject PDF',
    });
    linkKnowledgeItemToTurn(db, approvedCriterion.id, criteriaReviewTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedCriterion.id, criteriaReviewTurn.id, 'rejected');
    advanceHead(db, project.id, criteriaReviewTurn.id);

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: approvedCriterion.id, content: approvedCriterion.content }),
        expect.objectContaining({ id: rejectedCriterion.id, content: rejectedCriterion.content }),
        expect.objectContaining({ id: pendingCriterion.id, content: pendingCriterion.content }),
      ]),
    );
    for (const criterion of entities.criteria) {
      expect(criterion).not.toHaveProperty('reviewStatus');
    }
  });

  it('keeps criteria non-closeable until an accepted review closes the phase', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeTurn.id,
      summary: 'Scope captured.',
    });
    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Tradeoff?',
      answer: 'Keep it small',
    });
    advanceHead(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'Design captured.',
    });
    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    advanceHead(db, project.id, designConfirmationTurn.id);

    const requirement = createKnowledgeItem(db, project.id, 'requirement', 'Export the spec');
    const reqReviewTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Review?',
      answer: 'Approve',
    });
    linkKnowledgeItemToTurn(db, requirement.id, reqReviewTurn.id, 'reviewed');
    advanceHead(db, project.id, reqReviewTurn.id);

    const reqProposalTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqReviewTurn.id,
      question: '',
      answer: 'Close requirements',
    });
    advanceHead(db, project.id, reqProposalTurn.id);
    const reqOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'requirements',
      proposal_turn_id: reqProposalTurn.id,
      summary: 'Requirements reviewed.',
    });
    const reqConfirmationTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqProposalTurn.id,
      question: '',
      answer: 'Confirm requirements closure',
    });
    confirmPhaseOutcome(db, reqOutcome.id, reqConfirmationTurn.id);
    advanceHead(db, project.id, reqConfirmationTurn.id);

    const criterion1 = createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const criterion2 = createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Restarting the browser resumes the active path',
    );

    const partialReviewTurn = createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: reqConfirmationTurn.id,
      question: 'Review this criterion?',
      answer: 'Approve markdown preview',
    });
    linkKnowledgeItemToTurn(db, criterion1.id, partialReviewTurn.id, 'reviewed');
    advanceHead(db, project.id, partialReviewTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });

    const finalReviewTurn = createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: partialReviewTurn.id,
      question: 'Review the remaining criterion?',
      answer: 'Approve browser resume',
    });
    linkKnowledgeItemToTurn(db, criterion2.id, finalReviewTurn.id, 'reviewed');
    advanceHead(db, project.id, finalReviewTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });
  });

  it('projects only the accepted requirements on the active path after requirements review closes', () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const scopeOutcome = createConfirmedPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeTurn.id,
      confirmation_turn_id: scopeTurn.id,
      summary: 'Scope captured.',
    });
    expect(scopeOutcome.phase).toBe('scope');

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeTurn.id,
      question: 'Tradeoff?',
      answer: 'Keep it small',
    });
    advanceHead(db, project.id, designTurn.id);

    const designOutcome = createConfirmedPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      confirmation_turn_id: designTurn.id,
      summary: 'Design captured.',
    });
    expect(designOutcome.phase).toBe('design');

    const acceptedRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Export the reviewed spec',
    );
    const staleRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    linkKnowledgeItemToTurn(db, acceptedRequirement.id, designTurn.id, 'captured');
    linkKnowledgeItemToTurn(db, staleRequirement.id, designTurn.id, 'captured');

    const reviewTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designTurn.id,
      question: 'Please review the current requirement set.',
      answer: 'Accept review',
    });
    linkKnowledgeItemToTurn(db, acceptedRequirement.id, reviewTurn.id, 'reviewed');
    advanceHead(db, project.id, reviewTurn.id);

    createConfirmedPhaseOutcome(db, {
      projectId: project.id,
      phase: 'requirements',
      proposal_turn_id: reviewTurn.id,
      confirmation_turn_id: reviewTurn.id,
      summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
    });

    const criteriaKickoffTurn = createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: reviewTurn.id,
      turn_kind: 'kickoff',
      question: '',
      answer: null,
    });
    advanceHead(db, project.id, criteriaKickoffTurn.id);

    const entities = getEntitiesForProjectOnActivePath(db, project.id);
    expect(entities.requirements).toEqual([
      expect.objectContaining({ id: acceptedRequirement.id, content: 'Export the reviewed spec' }),
    ]);
  });

  it('confirms a proposed requirements outcome, clears the pending proposal, and keeps criteria active', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
    });
    advanceHead(db, project.id, designTurn.id);

    const designOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });
    const designConfirmationTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    advanceHead(db, project.id, designConfirmationTurn.id);

    const approvedRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Export the reviewed spec',
    );
    const rejectedRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );

    const requirementsReviewTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Are these requirements all reviewed now?',
      answer: 'Yes — approve export and reject PDF export',
    });
    linkKnowledgeItemToTurn(db, approvedRequirement.id, requirementsReviewTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedRequirement.id, requirementsReviewTurn.id, 'rejected');
    advanceHead(db, project.id, requirementsReviewTurn.id);

    const requirementsProposalTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: requirementsReviewTurn.id,
      question: '',
      answer: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    advanceHead(db, project.id, requirementsProposalTurn.id);

    const requirementsOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'requirements',
      proposal_turn_id: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });

    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: true,
      turnId: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    expect(getCurrentWorkflowState(db, project.id).phases.criteria).toMatchObject({
      status: 'unstarted',
      proposalPending: false,
    });

    const requirementsConfirmationTurn = createTurn(db, project.id, {
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
    advanceHead(db, project.id, requirementsConfirmationTurn.id);

    expect(
      listPhaseOutcomesForProject(db, project.id).find((outcome) => outcome.id === requirementsOutcome.id),
    ).toMatchObject({
      status: 'confirmed',
      confirmation_turn_id: requirementsConfirmationTurn.id,
      closure_basis: 'interviewer_recommended',
    });

    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'closed',
      closeability: false,
      proposalPending: false,
      closureBasis: 'interviewer_recommended',
      turnId: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    expect(getCurrentWorkflowState(db, project.id).phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
      closureBasis: null,
    });

    const criteriaTurn = createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: requirementsConfirmationTurn.id,
      question: 'Which acceptance criterion proves export works?',
      answer: 'Markdown preview renders the reviewed requirements',
    });
    advanceHead(db, project.id, criteriaTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'closed',
      proposalPending: false,
    });
    expect(getCurrentWorkflowState(db, project.id).phases.criteria).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
    });
    expect(
      listPhaseOutcomesForProject(db, project.id).filter(
        (outcome) => outcome.phase === 'requirements' && outcome.status === 'proposed',
      ),
    ).toHaveLength(0);
  });

  it('projects no closure basis when a confirmed phase outcome lacks durable closure provenance', async () => {
    const project = getOrCreateProject(db);

    const scopeTurn = createTurn(db, project.id, { phase: 'scope', question: 'Goal?', answer: 'Spec tool' });
    advanceHead(db, project.id, scopeTurn.id);

    const scopeProposalTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'We have enough scope context',
      parent_turn_id: scopeTurn.id,
    });
    advanceHead(db, project.id, scopeProposalTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState } = await import('./db.js');

    const scopeOutcome = createPhaseOutcome(db, {
      projectId: project.id,
      phase: 'scope',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'Confirm grounding closure',
      parent_turn_id: scopeProposalTurn.id,
      user_parts: JSON.stringify([
        { type: 'text', text: 'Confirm grounding closure' },
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
    advanceHead(db, project.id, scopeConfirmationTurn.id);

    db.$client.prepare('UPDATE phase_outcome SET closure_basis = NULL WHERE id = ?').run(scopeOutcome.id);

    expect(getCurrentWorkflowState(db, project.id).phases.scope).toMatchObject({
      closureBasis: null,
    });
  });
});

describe('active path resolution', () => {
  it('returns empty array when no HEAD is set', () => {
    const project = getOrCreateProject(db);
    const path = getActivePath(db, project.id);
    expect(path).toEqual([]);
  });

  it('resolves linear chain from root to HEAD', () => {
    const project = getOrCreateProject(db);
    const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const t2 = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    const t3 = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q3',
      answer: 'A3',
      parent_turn_id: t2.id,
    });
    advanceHead(db, project.id, t3.id);

    const path = getActivePath(db, project.id);
    expect(path).toHaveLength(3);
    expect(path.map((t) => t.id)).toEqual([t1.id, t2.id, t3.id]);
  });

  it('resolves correct branch after fork', () => {
    const project = getOrCreateProject(db);
    const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const t2a = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q2a',
      answer: 'A2a',
      parent_turn_id: t1.id,
    });
    const t2b = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q2b',
      answer: 'A2b',
      parent_turn_id: t1.id,
    });

    // HEAD at branch b
    advanceHead(db, project.id, t2b.id);
    const pathB = getActivePath(db, project.id);
    expect(pathB.map((t) => t.id)).toEqual([t1.id, t2b.id]);

    // Switch HEAD to branch a
    advanceHead(db, project.id, t2a.id);
    const pathA = getActivePath(db, project.id);
    expect(pathA.map((t) => t.id)).toEqual([t1.id, t2a.id]);
  });

  it('handles single-turn tree (root = HEAD)', () => {
    const project = getOrCreateProject(db);
    const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    advanceHead(db, project.id, t1.id);
    const path = getActivePath(db, project.id);
    expect(path).toHaveLength(1);
    expect(path[0].id).toBe(t1.id);
  });

  it('resolves deep fork correctly', () => {
    const project = getOrCreateProject(db);
    const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const t2 = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    const _t3 = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q3',
      answer: 'A3',
      parent_turn_id: t2.id,
    });
    // Fork from t2 (not from _t3)
    const t4 = createTurn(db, project.id, {
      phase: 'design',
      question: 'Q4',
      answer: 'A4',
      parent_turn_id: t2.id,
    });
    const t5 = createTurn(db, project.id, {
      phase: 'design',
      question: 'Q5',
      answer: 'A5',
      parent_turn_id: t4.id,
    });

    advanceHead(db, project.id, t5.id);
    const path = getActivePath(db, project.id);
    expect(path.map((t) => t.id)).toEqual([t1.id, t2.id, t4.id, t5.id]);
    // t3 is on the other branch — not in the active path
  });
});

describe('advanceHead', () => {
  it('updates project active_turn_id', () => {
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q1' });
    advanceHead(db, project.id, turn.id);
    const updated = getOrCreateProject(db);
    expect(updated.active_turn_id).toBe(turn.id);
  });
});

describe('listProjects', () => {
  it('returns all projects', () => {
    createProject(db, 'Alpha');
    createProject(db, 'Beta');
    createProject(db, 'Gamma');
    const projects = listProjects(db);
    expect(projects).toHaveLength(3);
    const names = projects.map((p) => p.name).sort();
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('returns empty array when no projects exist', () => {
    expect(listProjects(db)).toEqual([]);
  });
});

describe('createProject', () => {
  it('creates a named project and returns it', () => {
    const project = createProject(db, 'My Spec');
    expect(project.name).toBe('My Spec');
    expect(project.id).toBeDefined();
    expect(project.active_turn_id).toBeNull();
    expect(project.created_at).toBeDefined();
  });

  it('creates multiple projects with distinct IDs', () => {
    const p1 = createProject(db, 'First');
    const p2 = createProject(db, 'Second');
    expect(p1.id).not.toBe(p2.id);
  });

  it('defaults to greenfield mode with null cwd', () => {
    const project = createProject(db, 'Greenfield');
    expect(project.mode).toBe('greenfield');
    expect(project.cwd).toBeNull();
  });

  it('creates a brownfield project with mode and cwd', () => {
    const project = createProject(db, 'Brownfield', { mode: 'brownfield', cwd: '/path/to/repo' });
    expect(project.mode).toBe('brownfield');
    expect(project.cwd).toBe('/path/to/repo');
  });
});

describe('getProject', () => {
  it('returns project by ID', () => {
    const created = createProject(db, 'Test');
    const found = getProject(db, created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Test');
  });

  it('returns undefined for non-existent ID', () => {
    expect(getProject(db, 9999)).toBeUndefined();
  });
});

describe('DB lifecycle — parts persistence', () => {
  it('create → persist parts → close → reopen → parts intact', () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'parts-lifecycle.db');

    const db1 = createDb(dbPath);
    const project = getOrCreateProject(db1);
    const turn = createTurn(db1, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const parts = JSON.stringify([
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'answer' },
    ]);
    const userParts = JSON.stringify([
      { type: 'data-turn-response', data: { turnId: turn.id, selectedOptionIds: [0] } },
    ]);
    updateTurn(db1, turn.id, { assistant_parts: parts, user_parts: userParts });
    advanceHead(db1, project.id, turn.id);
    db1.$client.close();

    const db2 = createDb(dbPath);
    const reopened = getOrCreateProject(db2);
    const path = getActivePath(db2, reopened.id);
    expect(path).toHaveLength(1);
    expect(path[0].assistant_parts).toBe(parts);
    expect(path[0].user_parts).toBe(userParts);
    db2.$client.close();

    unlinkSync(dbPath);
  });
});

describe('DB lifecycle — turn tree persistence', () => {
  it('create → persist turns → close → reopen → state intact', () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'lifecycle.db');

    // Create and populate
    const db1 = createDb(dbPath);
    const project = getOrCreateProject(db1);
    const t1 = createTurn(db1, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const t2 = createTurn(db1, project.id, {
      phase: 'scope',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    createOption(db1, t1.id, { position: 0, content: 'Opt A', is_recommended: true });
    createOption(db1, t1.id, { position: 1, content: 'Opt B' });
    advanceHead(db1, project.id, t2.id);
    db1.$client.close();

    // Reopen and verify
    const db2 = createDb(dbPath);
    const reopened = getOrCreateProject(db2);
    expect(reopened.id).toBe(project.id);
    expect(reopened.active_turn_id).toBe(t2.id);
    const path = getActivePath(db2, reopened.id);
    expect(path).toHaveLength(2);
    expect(path[0].question).toBe('Q1');
    expect(path[1].question).toBe('Q2');
    // Verify options survived
    const options = db2.$client
      .prepare('SELECT * FROM option WHERE turn_id = ? ORDER BY position')
      .all(t1.id) as any[];
    expect(options).toHaveLength(2);
    expect(options[0].content).toBe('Opt A');
    db2.$client.close();

    unlinkSync(dbPath);
  });
});

describe('entity persistence — decisions, assumptions, and generic knowledge items', () => {
  it('creates a decision as a generic knowledge item with project linkage', () => {
    const project = createProject(db, 'Test');
    const d = createDecision(db, project.id, 'Use SQLite for persistence');
    expect(d.id).toBeDefined();
    expect(d.content).toBe('Use SQLite for persistence');
    expect(d.project_id).toBe(project.id);

    const stored = db.$client.prepare('SELECT kind, content FROM knowledge_item WHERE id = ?').get(d.id) as {
      kind: string;
      content: string;
    };
    expect(stored).toEqual({ kind: 'decision', content: 'Use SQLite for persistence' });
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM decision').get()).toEqual({ count: 0 });
  });

  it('creates an assumption as a generic knowledge item with project linkage', () => {
    const project = createProject(db, 'Test');
    const a = createAssumption(db, project.id, 'SQLite handles concurrent writes');
    expect(a.id).toBeDefined();
    expect(a.content).toBe('SQLite handles concurrent writes');
    expect(a.project_id).toBe(project.id);

    const stored = db.$client.prepare('SELECT kind, content FROM knowledge_item WHERE id = ?').get(a.id) as {
      kind: string;
      content: string;
    };
    expect(stored).toEqual({ kind: 'assumption', content: 'SQLite handles concurrent writes' });
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM assumption').get()).toEqual({ count: 0 });
  });

  it('links a decision to a turn through generic provenance', () => {
    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });
    const d = createDecision(db, project.id, 'Use React');
    linkDecisionToTurn(db, d.id, turn.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(1);
    expect(entities.decisions[0].content).toBe('Use React');
    expect(
      db.$client
        .prepare('SELECT relation FROM turn_knowledge_item WHERE turn_id = ? AND item_id = ?')
        .get(turn.id, d.id),
    ).toEqual({ relation: 'captured' });
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM turn_decision').get()).toEqual({ count: 0 });
  });

  it('links an assumption to a turn through generic provenance', () => {
    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });
    const a = createAssumption(db, project.id, 'Users have API keys');
    linkAssumptionToTurn(db, a.id, turn.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.assumptions).toHaveLength(1);
    expect(entities.assumptions[0].content).toBe('Users have API keys');
    expect(
      db.$client
        .prepare('SELECT relation FROM turn_knowledge_item WHERE turn_id = ? AND item_id = ?')
        .get(turn.id, a.id),
    ).toEqual({ relation: 'captured' });
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM turn_assumption').get()).toEqual({ count: 0 });
  });

  it('projects captured items for replay through one collection-driven seam', () => {
    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });
    const goal = createKnowledgeItem(db, project.id, 'goal', 'Ship a trustworthy spec handoff');
    const decision = createDecision(db, project.id, 'Start with the web app', 'Fastest path to feedback');
    const assumption = createAssumption(db, project.id, 'Users can work in a browser');

    linkKnowledgeItemToTurn(db, goal.id, turn.id);
    linkDecisionToTurn(db, decision.id, turn.id);
    linkAssumptionToTurn(db, assumption.id, turn.id);

    expect(getCapturedItemsForTurns(db, project.id, [turn.id]).get(turn.id)).toEqual([
      {
        collection: 'knowledge_item',
        kind: 'goal',
        id: goal.id,
        content: 'Ship a trustworthy spec handoff',
        referenceCode: 'GOAL1',
      },
      {
        collection: 'decision',
        kind: 'decision',
        id: decision.id,
        content: 'Start with the web app',
        referenceCode: 'D1',
      },
      {
        collection: 'assumption',
        kind: 'assumption',
        id: assumption.id,
        content: 'Users can work in a browser',
        referenceCode: 'A1',
      },
    ]);
  });

  it('persists canonical scope kinds plus later generic knowledge kinds with project linkage, metadata, and turn provenance', () => {
    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });
    const goal = createKnowledgeItem(
      db,
      project.id,
      'goal',
      'Help teams reach a clean implementation brief',
      {
        rationale: 'The project should produce a trustworthy handoff',
      },
    );
    const term = createKnowledgeItem(db, project.id, 'term', 'implementation brief', {
      rationale: 'The conversation introduced a named artifact that needs stable meaning',
    });
    const context = createKnowledgeItem(
      db,
      project.id,
      'context',
      'The first users are solo builders refining ideas',
      {
        rationale: 'Audience and workflow context shape the scope',
      },
    );
    const constraint = createKnowledgeItem(db, project.id, 'constraint', 'Must run locally', {
      subtype: 'non-goal',
      rationale: 'Keep setup instant',
    });
    const requirement = createKnowledgeItem(db, project.id, 'requirement', 'Support resumable interviews', {
      rationale: 'Users will leave and come back',
    });
    const criterion = createKnowledgeItem(db, project.id, 'criterion', 'Resume works after browser restart', {
      subtype: 'acceptance',
      rationale: 'Protects the persistence seam',
    });
    linkKnowledgeItemToTurn(db, goal.id, turn.id);
    linkKnowledgeItemToTurn(db, term.id, turn.id);
    linkKnowledgeItemToTurn(db, context.id, turn.id);
    linkKnowledgeItemToTurn(db, constraint.id, turn.id);
    linkKnowledgeItemToTurn(db, requirement.id, turn.id);
    linkKnowledgeItemToTurn(db, criterion.id, turn.id);

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.goals).toEqual([
      expect.objectContaining({
        project_id: project.id,
        kind: 'goal',
        content: 'Help teams reach a clean implementation brief',
        rationale: 'The project should produce a trustworthy handoff',
      }),
    ]);
    expect(entities.terms).toEqual([
      expect.objectContaining({
        project_id: project.id,
        kind: 'term',
        content: 'implementation brief',
        rationale: 'The conversation introduced a named artifact that needs stable meaning',
      }),
    ]);
    expect(entities.contexts).toEqual([
      expect.objectContaining({
        project_id: project.id,
        kind: 'context',
        content: 'The first users are solo builders refining ideas',
        rationale: 'Audience and workflow context shape the scope',
      }),
    ]);
    expect(entities.constraints).toEqual([
      expect.objectContaining({
        project_id: project.id,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Must run locally',
        rationale: 'Keep setup instant',
      }),
    ]);
    expect(entities.requirements).toEqual([
      expect.objectContaining({
        project_id: project.id,
        kind: 'requirement',
        subtype: null,
        content: 'Support resumable interviews',
        rationale: 'Users will leave and come back',
      }),
    ]);
    expect(entities.criteria).toEqual([
      expect.objectContaining({
        project_id: project.id,
        kind: 'criterion',
        subtype: 'acceptance',
        content: 'Resume works after browser restart',
        rationale: 'Protects the persistence seam',
      }),
    ]);

    const provenanceRows = db.$client
      .prepare('SELECT relation FROM turn_knowledge_item WHERE turn_id = ? ORDER BY item_id')
      .all(turn.id) as Array<{ relation: string }>;
    expect(provenanceRows.map((row) => row.relation)).toEqual([
      'captured',
      'captured',
      'captured',
      'captured',
      'captured',
      'captured',
    ]);
  });

  it('projects requirements without per-item review status from active-path review links', () => {
    const project = createProject(db, 'Test');
    const rejectedRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    const pendingRequirement = createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Resume the interview from SQLite after restart',
    );
    const approvalTurn = createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Should we approve the PDF export requirement?',
      answer: 'Approve this requirement',
    });
    const rejectionTurn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: approvalTurn.id,
      question: 'Should we reject the PDF export requirement after review?',
      answer: 'Reject this requirement',
    });

    linkKnowledgeItemToTurn(db, rejectedRequirement.id, approvalTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedRequirement.id, rejectionTurn.id, 'rejected');
    advanceHead(db, project.id, rejectionTurn.id);

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rejectedRequirement.id, content: rejectedRequirement.content }),
        expect.objectContaining({ id: pendingRequirement.id, content: pendingRequirement.content }),
      ]),
    );
    for (const requirement of entities.requirements) {
      expect(requirement).not.toHaveProperty('reviewStatus');
    }
    expect(getCurrentWorkflowState(db, project.id).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });
  });

  it('creates dependency edges between decisions through generic edge storage', () => {
    const project = createProject(db, 'Test');
    const d1 = createDecision(db, project.id, 'Use Express');
    const d2 = createDecision(db, project.id, 'Use SSE for streaming');
    addDecisionParentDecision(db, d2.id, d1.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(2);
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM knowledge_edge').get()).toEqual({ count: 1 });
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM decision_parent_decision').get()).toEqual({
      count: 0,
    });
  });

  it('projects generic parent links through one typed relationship read model', () => {
    const project = createProject(db, 'Test');
    const parentDecision = createDecision(db, project.id, 'Use Express');
    const dependentDecision = createDecision(db, project.id, 'Use SSE for streaming');
    const parentAssumption = createAssumption(db, project.id, 'SDK supports streaming');
    const dependentAssumption = createAssumption(db, project.id, 'Single-user tool');

    addDecisionParentDecision(db, dependentDecision.id, parentDecision.id);
    addDecisionParentAssumption(db, dependentDecision.id, parentAssumption.id);
    addAssumptionParentAssumption(db, dependentAssumption.id, parentAssumption.id);

    const entities = getEntitiesForProject(db, project.id);

    expect(entities.relationships).toEqual([
      {
        type: 'depends_on',
        source: { collection: 'decision', kind: 'decision', id: dependentDecision.id },
        target: { collection: 'decision', kind: 'decision', id: parentDecision.id },
      },
      {
        type: 'depends_on',
        source: { collection: 'decision', kind: 'decision', id: dependentDecision.id },
        target: { collection: 'assumption', kind: 'assumption', id: parentAssumption.id },
      },
      {
        type: 'depends_on',
        source: { collection: 'assumption', kind: 'assumption', id: dependentAssumption.id },
        target: { collection: 'assumption', kind: 'assumption', id: parentAssumption.id },
      },
    ]);
  });

  it('keeps derived reference codes stable across project-wide and active-path entity projections', () => {
    const project = createProject(db, 'Test');
    const rootTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What storage options are on the table?',
      answer: 'SQLite and Postgres are both possible.',
    });
    const abandonedBranchTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: rootTurn.id,
      question: 'Which storage branch should we explore?',
      answer: 'Explore the SQLite branch.',
    });
    const activeBranchTurn = createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: rootTurn.id,
      question: 'Which storage branch should we explore?',
      answer: 'Explore the Postgres branch.',
    });
    advanceHead(db, project.id, activeBranchTurn.id);

    const abandonedDecision = createKnowledgeItem(db, project.id, 'decision', 'Use SQLite for persistence');
    const activeDecision = createKnowledgeItem(db, project.id, 'decision', 'Use Postgres for persistence');
    linkKnowledgeItemToTurn(db, abandonedDecision.id, abandonedBranchTurn.id);
    linkKnowledgeItemToTurn(db, activeDecision.id, activeBranchTurn.id);

    expect(getEntitiesForProjectByMode(db, project.id, 'project-wide')).toEqual(
      getEntitiesForProject(db, project.id),
    );
    expect(getEntitiesForProjectByMode(db, project.id, 'active-path')).toEqual(
      getEntitiesForProjectOnActivePath(db, project.id),
    );

    expect(getEntitiesForProjectByMode(db, project.id, 'project-wide').decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Use SQLite for persistence', referenceCode: 'D1' }),
        expect.objectContaining({ content: 'Use Postgres for persistence', referenceCode: 'D2' }),
      ]),
    );
    expect(getEntitiesForProjectByMode(db, project.id, 'active-path').decisions).toEqual([
      expect.objectContaining({ content: 'Use Postgres for persistence', referenceCode: 'D2' }),
    ]);
  });

  it('projects the full persisted edge relation vocabulary through the entity seam', () => {
    const project = createProject(db, 'Test');
    const goal = createKnowledgeItem(db, project.id, 'goal', 'Track work from creation to completion');
    const term = createKnowledgeItem(db, project.id, 'term', 'ticket');
    const context = createKnowledgeItem(db, project.id, 'context', 'The team currently uses a spreadsheet');
    const constraint = createKnowledgeItem(
      db,
      project.id,
      'constraint',
      'Keep the first release simpler than Jira',
    );
    const criterion = createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Export preserves the trusted graph state',
    );

    const insertEdge = db.$client.prepare(
      'INSERT INTO knowledge_edge (from_item_id, to_item_id, relation) VALUES (?, ?, ?)',
    );
    insertEdge.run(term.id, context.id, 'depends_on');
    insertEdge.run(context.id, goal.id, 'derived_from');
    insertEdge.run(constraint.id, goal.id, 'constrains');
    insertEdge.run(criterion.id, goal.id, 'verifies');
    insertEdge.run(criterion.id, term.id, 'refines');

    const entities = getEntitiesForProject(db, project.id);

    expect(entities.relationships).toEqual(
      expect.arrayContaining([
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'term', id: term.id },
          target: { collection: 'knowledge_item', kind: 'context', id: context.id },
        },
        {
          type: 'derived_from',
          source: { collection: 'knowledge_item', kind: 'context', id: context.id },
          target: { collection: 'knowledge_item', kind: 'goal', id: goal.id },
        },
        {
          type: 'constrains',
          source: { collection: 'knowledge_item', kind: 'constraint', id: constraint.id },
          target: { collection: 'knowledge_item', kind: 'goal', id: goal.id },
        },
        {
          type: 'verifies',
          source: { collection: 'knowledge_item', kind: 'criterion', id: criterion.id },
          target: { collection: 'knowledge_item', kind: 'goal', id: goal.id },
        },
        {
          type: 'refines',
          source: { collection: 'knowledge_item', kind: 'criterion', id: criterion.id },
          target: { collection: 'knowledge_item', kind: 'term', id: term.id },
        },
      ]),
    );
  });

  it('creates dependency edges between assumptions through generic edge storage', () => {
    const project = createProject(db, 'Test');
    const a1 = createAssumption(db, project.id, 'Single user');
    const a2 = createAssumption(db, project.id, 'No concurrent writes');
    addAssumptionParentAssumption(db, a2.id, a1.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.assumptions).toHaveLength(2);
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM knowledge_edge').get()).toEqual({ count: 1 });
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM assumption_parent_assumption').get()).toEqual({
      count: 0,
    });
  });

  it('projects a canonical scope bundle without consulting legacy commitment storage', () => {
    const project = createProject(db, 'Test');
    createKnowledgeItem(db, project.id, 'goal', 'Ship a trustworthy spec handoff');
    createKnowledgeItem(db, project.id, 'term', 'implementation brief');
    createKnowledgeItem(db, project.id, 'context', 'The first users are solo builders');
    createKnowledgeItem(db, project.id, 'constraint', 'Do not require hosted setup', { subtype: 'non-goal' });
    createDecision(db, project.id, 'Start with the web app');
    createAssumption(db, project.id, 'Users can work in a browser');

    expect(getScopeBundleForProject(db, project.id)).toMatchObject({
      goals: [expect.objectContaining({ kind: 'goal', content: 'Ship a trustworthy spec handoff' })],
      terms: [expect.objectContaining({ kind: 'term', content: 'implementation brief' })],
      contexts: [expect.objectContaining({ kind: 'context', content: 'The first users are solo builders' })],
      constraints: [
        expect.objectContaining({
          kind: 'constraint',
          content: 'Do not require hosted setup',
          subtype: 'non-goal',
        }),
      ],
    });
  });
});
