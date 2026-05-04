import { randomUUID } from 'crypto';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

import {
  createDb,
  getOrCreateSpecification,
  createTurn,
  updateTurn,
  createOption,
  getActivePath,
  advanceHead,
  listSpecifications,
  createSpecification,
  getSpecification,
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
  getEntitiesForSpecificationByMode,
  getEntitiesForSpecification,
  getEntitiesForSpecificationOnActivePath,
  getCapturedItemsForTurns,
  getGroundingBundleForSpecification,
  listPhaseOutcomesForSpecification,
  getCurrentWorkflowState,
  readWorkflowProjectionSnapshot,
  type DB,
} from './db.js';

let db: DB;

beforeEach(async () => {
  db = await createDb(); // :memory:
});

afterEach(() => {
  db.$client.close();
});

describe('createDb', () => {
  it('creates only the canonical schema tables, including the generic knowledge edge seam', () => {
    const tables = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    const expected = [
      'specification',
      'turn',
      'option',
      'knowledge_item',
      'knowledge_edge',
      'turn_knowledge_item',
      'phase_outcome',
    ];
    for (const table of expected) {
      expect(names).toContain(table);
    }

    const retired = [
      'decision',
      'assumption',
      'requirement',
      'criterion',
      'turn_decision',
      'turn_assumption',
      'decision_parent_decision',
      'decision_parent_assumption',
      'assumption_parent_assumption',
      'requirement_decision',
    ];
    for (const table of retired) {
      expect(names).not.toContain(table);
    }

    const phaseOutcomeColumns = db.$client.prepare("PRAGMA table_info('phase_outcome')").all() as Array<{
      name: string;
    }>;
    expect(phaseOutcomeColumns.map((column) => column.name)).toContain('closure_basis');

    const turnColumns = db.$client.prepare("PRAGMA table_info('turn')").all() as Array<{ name: string }>;
    expect(turnColumns.map((column) => column.name)).toContain('turn_kind');
  });

  it('specification table has mode but no persisted cwd column', () => {
    const columns = db.$client.prepare("PRAGMA table_info('specification')").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('mode');
    expect(names).not.toContain('cwd');
  });

  it('creates database file on disk when given a path', async () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'test.db');
    const diskDb = await createDb(dbPath);
    expect(existsSync(dbPath)).toBe(true);
    diskDb.$client.close();
    unlinkSync(dbPath);
  });

  it('enables WAL journal mode for file-backed databases', async () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'wal-test.db');
    const fileDb = await createDb(dbPath);
    const row = fileDb.$client.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(row.journal_mode).toBe('wal');
    fileDb.$client.close();
    unlinkSync(dbPath);
  });
});

describe('getOrCreateSpecification', () => {
  it('creates a default project with null active_turn_id', async () => {
    const project = await getOrCreateSpecification(db);
    expect(project).toMatchObject({ name: 'default', active_turn_id: null });
    expect(project.id).toBeDefined();
    expect(project.created_at).toBeDefined();
  });

  it('returns the existing project on subsequent calls', async () => {
    const first = await getOrCreateSpecification(db);
    const second = await getOrCreateSpecification(db);
    expect(second.id).toBe(first.id);
  });
});

describe('turn CRUD', () => {
  it('creates a root turn with no parent', async () => {
    const project = await getOrCreateSpecification(db);
    const turn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What is the project about?',
      answer: 'A chat app',
    });
    expect(turn.id).toBeDefined();
    expect(turn.parent_turn_id).toBeNull();
    expect(turn.phase).toBe('grounding');
    expect(turn.question).toBe('What is the project about?');
    expect(turn.answer).toBe('A chat app');
    expect(turn.turn_kind).toBe('question');
    expect(turn.is_resolution).toBe(false);
  });

  it('creates child turns with parent chain', async () => {
    const project = await getOrCreateSpecification(db);
    const t1 = await createTurn(db, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    const t2 = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    const t3 = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q3',
      answer: 'A3',
      parent_turn_id: t2.id,
    });
    expect(t2.parent_turn_id).toBe(t1.id);
    expect(t3.parent_turn_id).toBe(t2.id);
  });

  it('creates options for a turn', async () => {
    const project = await getOrCreateSpecification(db);
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Pick one' });
    const opt1 = await createOption(db, turn.id, {
      position: 0,
      content: 'Option A',
      is_recommended: true,
    });
    const opt2 = await createOption(db, turn.id, { position: 1, content: 'Option B' });
    expect(opt1.is_recommended).toBe(true);
    expect(opt1.content).toBe('Option A');
    expect(opt2.is_recommended).toBe(false);
  });

  it('enforces unique (turn_id, position) on options', async () => {
    const project = await getOrCreateSpecification(db);
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Pick one' });
    await createOption(db, turn.id, { position: 0, content: 'Option A' });
    await expect(createOption(db, turn.id, { position: 0, content: 'Duplicate' })).rejects.toThrow();
  });

  it('updates turn answer and question', async () => {
    const project = await getOrCreateSpecification(db);
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: '' });
    await updateTurn(db, turn.id, { question: 'Updated Q', answer: 'User said this' });
    const updated = db.$client.prepare('SELECT * FROM turn WHERE id = ?').get(turn.id) as any;
    expect(updated.question).toBe('Updated Q');
    expect(updated.answer).toBe('User said this');
  });

  it('partial update only changes specified fields', async () => {
    const project = await getOrCreateSpecification(db);
    const turn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Original Q',
      answer: 'Original A',
    });
    await updateTurn(db, turn.id, { question: 'New Q' });
    const updated = db.$client.prepare('SELECT * FROM turn WHERE id = ?').get(turn.id) as any;
    expect(updated.question).toBe('New Q');
    expect(updated.answer).toBe('Original A');
  });
});

describe('phase outcome lifecycle', () => {
  it('counts only answered substantive turns toward readiness', async () => {
    const project = await getOrCreateSpecification(db);
    const frontierTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What problem are we solving?',
      answer: null,
    });
    await createOption(db, frontierTurn.id, { position: 0, content: 'Internal tool' });
    await advanceHead(db, project.id, frontierTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.grounding).toMatchObject({
      status: 'in_progress',
      readiness: 'low',
      closeability: true,
    });

    await updateTurn(db, frontierTurn.id, { answer: 'Internal tool' });

    expect((await getCurrentWorkflowState(db, project.id)).phases.grounding).toMatchObject({
      status: 'in_progress',
      readiness: 'medium',
      closeability: true,
    });
  });

  it('persists explicit grounding outcomes and supersedes them when the active path changes upstream', async () => {
    const project = await getOrCreateSpecification(db);
    const root = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    const closureTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
      parent_turn_id: root.id,
    });
    await advanceHead(db, project.id, closureTurn.id);

    const {
      createPhaseOutcome,
      confirmPhaseOutcome,
      getCurrentWorkflowState,
      listPhaseOutcomesForSpecification,
    } = await import('./db.js');

    const proposed = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: closureTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    expect((await getCurrentWorkflowState(db, project.id)).phases.grounding).toMatchObject({
      status: 'in_progress',
      proposalPending: true,
      summary: proposed.summary,
      turnId: closureTurn.id,
      closeability: true,
      readiness: 'medium',
      closureBasis: null,
    });

    const confirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'Confirm grounding closure',
      parent_turn_id: closureTurn.id,
    });
    await confirmPhaseOutcome(db, proposed.id, confirmationTurn.id);
    await advanceHead(db, project.id, confirmationTurn.id);

    const confirmedWorkflow = await getCurrentWorkflowState(db, project.id);
    expect(confirmedWorkflow.phases.grounding).toMatchObject({
      status: 'closed',
      proposalPending: false,
      summary: proposed.summary,
      turnId: closureTurn.id,
      closeability: false,
      readiness: 'medium',
      closureBasis: 'interviewer_recommended',
    });
    expect((await listPhaseOutcomesForSpecification(db, project.id))[0]).toMatchObject({
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

    const alternateTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What should we revisit?',
      answer: 'Target audience',
      parent_turn_id: root.id,
    });
    await advanceHead(db, project.id, alternateTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.grounding).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
      summary: null,
      turnId: null,
      closeability: true,
      closureBasis: null,
    });
    expect((await listPhaseOutcomesForSpecification(db, project.id))[0]).toMatchObject({
      id: proposed.id,
      status: 'superseded',
    });
  });

  it('reads a durable workflow snapshot with raw turn facts and active-path outcome flags', async () => {
    const project = await getOrCreateSpecification(db);
    const root = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    const closureTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
      parent_turn_id: root.id,
    });
    await advanceHead(db, project.id, closureTurn.id);

    const { createPhaseOutcome } = await import('./db.js');

    await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: closureTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const alternateTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What should we revisit?',
      answer: 'Target audience',
      parent_turn_id: root.id,
    });
    await advanceHead(db, project.id, alternateTurn.id);

    const snapshot = await readWorkflowProjectionSnapshot(db, project.id);

    expect(snapshot.turns).toEqual([
      expect.objectContaining({
        phase: 'grounding',
        question: 'Goal?',
        answer: 'Spec tool',
        optionCount: 0,
      }),
      expect.objectContaining({
        phase: 'grounding',
        question: 'What should we revisit?',
        answer: 'Target audience',
        optionCount: 0,
      }),
    ]);
    expect(snapshot.phaseOutcomes).toEqual([
      expect.objectContaining({
        phase: 'grounding',
        status: 'superseded',
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
        onActivePath: false,
      }),
    ]);
    expect(snapshot.acceptedReviewItemCounts).toEqual({
      requirements: 0,
      criteria: 0,
    });
  });

  it('projects a user-forced design close from the confirmation turn and advances requirements', async () => {
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const scopeProposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
      parent_turn_id: scopeTurn.id,
    });
    await advanceHead(db, project.id, scopeProposalTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
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
            phase: 'grounding',
          },
        },
      ]),
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
      parent_turn_id: scopeConfirmationTurn.id,
    });
    await advanceHead(db, project.id, designTurn.id);

    const designForceCloseTurn = await createTurn(db, project.id, {
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

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designForceCloseTurn.id,
      summary: 'Elicitation closed by user without an interviewer recommendation.',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designForceCloseTurn.id);
    await advanceHead(db, project.id, designForceCloseTurn.id);

    const workflow = await getCurrentWorkflowState(db, project.id);
    expect(workflow.phases.design).toMatchObject({
      status: 'closed',
      proposalPending: false,
      turnId: designForceCloseTurn.id,
      summary: 'Elicitation closed by user without an interviewer recommendation.',
      closeability: false,
      readiness: 'medium',
      closureBasis: 'user_forced',
    });
    expect((await listPhaseOutcomesForSpecification(db, project.id))[0]).toMatchObject({
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
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const scopeProposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
      parent_turn_id: scopeTurn.id,
    });
    await advanceHead(db, project.id, scopeProposalTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
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
            phase: 'grounding',
          },
        },
      ]),
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
      parent_turn_id: scopeConfirmationTurn.id,
    });
    await advanceHead(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });

    const designConfirmationTurn = await createTurn(db, project.id, {
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
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await advanceHead(db, project.id, designConfirmationTurn.id);

    const requirementsReviewTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Which requirements are still missing?',
      answer: 'A requirement is missing — Export the reviewed spec as markdown',
      parent_turn_id: designConfirmationTurn.id,
    });
    await advanceHead(db, project.id, requirementsReviewTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
      closureBasis: null,
    });
  });

  it('keeps requirements non-closeable until an accepted review closes the phase', async () => {
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
    });
    await advanceHead(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });
    const designConfirmationTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await advanceHead(db, project.id, designConfirmationTurn.id);

    const approvedRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Export the reviewed spec',
    );
    const rejectedRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    const pendingRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Resume the interview from SQLite after restart',
    );

    const approvalTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Should we approve the export requirement?',
      answer: 'Approve this requirement',
    });
    await linkKnowledgeItemToTurn(db, approvedRequirement.id, approvalTurn.id, 'reviewed');
    await linkKnowledgeItemToTurn(db, rejectedRequirement.id, approvalTurn.id, 'rejected');
    await advanceHead(db, project.id, approvalTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });

    const finalReviewTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: approvalTurn.id,
      question: 'Should we approve the resume requirement?',
      answer: 'Approve this requirement',
    });
    await linkKnowledgeItemToTurn(db, pendingRequirement.id, finalReviewTurn.id, 'reviewed');
    await advanceHead(db, project.id, finalReviewTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });
  });

  it('projects criteria without per-item review status on the project-wide read model', async () => {
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeTurn.id,
      summary: 'Scope captured.',
    });
    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Tradeoff?',
      answer: 'Keep it small',
    });
    await advanceHead(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'Design captured.',
    });
    const designConfirmationTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await advanceHead(db, project.id, designConfirmationTurn.id);

    const requirement = await createKnowledgeItem(db, project.id, 'requirement', 'Export the spec');
    const reqReviewTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Review?',
      answer: 'Approve',
    });
    await linkKnowledgeItemToTurn(db, requirement.id, reqReviewTurn.id, 'reviewed');
    await advanceHead(db, project.id, reqReviewTurn.id);

    const reqProposalTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqReviewTurn.id,
      question: '',
      answer: 'Close requirements',
    });
    await advanceHead(db, project.id, reqProposalTurn.id);
    const reqOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'requirements',
      proposal_turn_id: reqProposalTurn.id,
      summary: 'Requirements reviewed.',
    });
    const reqConfirmationTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqProposalTurn.id,
      question: '',
      answer: 'Confirm requirements closure',
    });
    await confirmPhaseOutcome(db, reqOutcome.id, reqConfirmationTurn.id);
    await advanceHead(db, project.id, reqConfirmationTurn.id);

    const approvedCriterion = await createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const rejectedCriterion = await createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'PDF export renders the reviewed requirements',
    );
    const pendingCriterion = await createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Restarting the browser resumes the active path',
    );

    const criteriaReviewTurn = await createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: reqConfirmationTurn.id,
      question: 'Review these criteria?',
      answer: 'Approve markdown, reject PDF',
    });
    await linkKnowledgeItemToTurn(db, approvedCriterion.id, criteriaReviewTurn.id, 'reviewed');
    await linkKnowledgeItemToTurn(db, rejectedCriterion.id, criteriaReviewTurn.id, 'rejected');
    await advanceHead(db, project.id, criteriaReviewTurn.id);

    const entities = await getEntitiesForSpecification(db, project.id);
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
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeTurn.id,
      summary: 'Scope captured.',
    });
    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Tradeoff?',
      answer: 'Keep it small',
    });
    await advanceHead(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'Design captured.',
    });
    const designConfirmationTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await advanceHead(db, project.id, designConfirmationTurn.id);

    const requirement = await createKnowledgeItem(db, project.id, 'requirement', 'Export the spec');
    const reqReviewTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Review?',
      answer: 'Approve',
    });
    await linkKnowledgeItemToTurn(db, requirement.id, reqReviewTurn.id, 'reviewed');
    await advanceHead(db, project.id, reqReviewTurn.id);

    const reqProposalTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqReviewTurn.id,
      question: '',
      answer: 'Close requirements',
    });
    await advanceHead(db, project.id, reqProposalTurn.id);
    const reqOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'requirements',
      proposal_turn_id: reqProposalTurn.id,
      summary: 'Requirements reviewed.',
    });
    const reqConfirmationTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: reqProposalTurn.id,
      question: '',
      answer: 'Confirm requirements closure',
    });
    await confirmPhaseOutcome(db, reqOutcome.id, reqConfirmationTurn.id);
    await advanceHead(db, project.id, reqConfirmationTurn.id);

    const criterion1 = await createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const criterion2 = await createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Restarting the browser resumes the active path',
    );

    const partialReviewTurn = await createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: reqConfirmationTurn.id,
      question: 'Review this criterion?',
      answer: 'Approve markdown preview',
    });
    await linkKnowledgeItemToTurn(db, criterion1.id, partialReviewTurn.id, 'reviewed');
    await advanceHead(db, project.id, partialReviewTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });

    const finalReviewTurn = await createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: partialReviewTurn.id,
      question: 'Review the remaining criterion?',
      answer: 'Approve browser resume',
    });
    await linkKnowledgeItemToTurn(db, criterion2.id, finalReviewTurn.id, 'reviewed');
    await advanceHead(db, project.id, finalReviewTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });
  });

  it('projects only the accepted requirements on the active path after requirements review closes', async () => {
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const scopeOutcome = await createConfirmedPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeTurn.id,
      confirmation_turn_id: scopeTurn.id,
      summary: 'Scope captured.',
    });
    expect(scopeOutcome.phase).toBe('grounding');

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeTurn.id,
      question: 'Tradeoff?',
      answer: 'Keep it small',
    });
    await advanceHead(db, project.id, designTurn.id);

    const designOutcome = await createConfirmedPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      confirmation_turn_id: designTurn.id,
      summary: 'Design captured.',
    });
    expect(designOutcome.phase).toBe('design');

    const acceptedRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Export the reviewed spec',
    );
    const staleRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    await linkKnowledgeItemToTurn(db, acceptedRequirement.id, designTurn.id, 'captured');
    await linkKnowledgeItemToTurn(db, staleRequirement.id, designTurn.id, 'captured');

    const reviewTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designTurn.id,
      question: 'Please review the current requirement set.',
      answer: 'Accept review',
    });
    await linkKnowledgeItemToTurn(db, acceptedRequirement.id, reviewTurn.id, 'reviewed');
    await advanceHead(db, project.id, reviewTurn.id);

    await createConfirmedPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'requirements',
      proposal_turn_id: reviewTurn.id,
      confirmation_turn_id: reviewTurn.id,
      summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
    });

    const criteriaKickoffTurn = await createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: reviewTurn.id,
      turn_kind: 'kickoff',
      question: '',
      answer: null,
    });
    await advanceHead(db, project.id, criteriaKickoffTurn.id);

    const entities = await getEntitiesForSpecificationOnActivePath(db, project.id);
    expect(entities.requirements).toEqual([
      expect.objectContaining({ id: acceptedRequirement.id, content: 'Export the reviewed spec' }),
    ]);
  });

  it('confirms a proposed requirements outcome, clears the pending proposal, and keeps criteria active', async () => {
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      parent_turn_id: scopeTurn.id,
      question: '',
      answer: 'Confirm grounding closure',
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    const designTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: scopeConfirmationTurn.id,
      question: 'Which tradeoff matters most?',
      answer: 'Keep the repository seam small',
    });
    await advanceHead(db, project.id, designTurn.id);

    const designOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'design',
      proposal_turn_id: designTurn.id,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });
    const designConfirmationTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: designTurn.id,
      question: '',
      answer: 'Confirm elicitation closure',
    });
    await confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
    await advanceHead(db, project.id, designConfirmationTurn.id);

    const approvedRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Export the reviewed spec',
    );
    const rejectedRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );

    const requirementsReviewTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: designConfirmationTurn.id,
      question: 'Are these requirements all reviewed now?',
      answer: 'Yes — approve export and reject PDF export',
    });
    await linkKnowledgeItemToTurn(db, approvedRequirement.id, requirementsReviewTurn.id, 'reviewed');
    await linkKnowledgeItemToTurn(db, rejectedRequirement.id, requirementsReviewTurn.id, 'rejected');
    await advanceHead(db, project.id, requirementsReviewTurn.id);

    const requirementsProposalTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: requirementsReviewTurn.id,
      question: '',
      answer: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    await advanceHead(db, project.id, requirementsProposalTurn.id);

    const requirementsOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'requirements',
      proposal_turn_id: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });

    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: true,
      turnId: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    expect((await getCurrentWorkflowState(db, project.id)).phases.criteria).toMatchObject({
      status: 'unstarted',
      proposalPending: false,
    });

    const requirementsConfirmationTurn = await createTurn(db, project.id, {
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
    await confirmPhaseOutcome(db, requirementsOutcome.id, requirementsConfirmationTurn.id);
    await advanceHead(db, project.id, requirementsConfirmationTurn.id);

    expect(
      (await listPhaseOutcomesForSpecification(db, project.id)).find(
        (outcome) => outcome.id === requirementsOutcome.id,
      ),
    ).toMatchObject({
      status: 'confirmed',
      confirmation_turn_id: requirementsConfirmationTurn.id,
      closure_basis: 'interviewer_recommended',
    });

    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'closed',
      closeability: false,
      proposalPending: false,
      closureBasis: 'interviewer_recommended',
      turnId: requirementsProposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    expect((await getCurrentWorkflowState(db, project.id)).phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
      closureBasis: null,
    });

    const criteriaTurn = await createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: requirementsConfirmationTurn.id,
      question: 'Which acceptance criterion proves export works?',
      answer: 'Markdown preview renders the reviewed requirements',
    });
    await advanceHead(db, project.id, criteriaTurn.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'closed',
      proposalPending: false,
    });
    expect((await getCurrentWorkflowState(db, project.id)).phases.criteria).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
    });
    expect(
      (await listPhaseOutcomesForSpecification(db, project.id)).filter(
        (outcome) => outcome.phase === 'requirements' && outcome.status === 'proposed',
      ),
    ).toHaveLength(0);
  });

  it('projects no closure basis when a confirmed phase outcome lacks durable closure provenance', async () => {
    const project = await getOrCreateSpecification(db);

    const scopeTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Goal?',
      answer: 'Spec tool',
    });
    await advanceHead(db, project.id, scopeTurn.id);

    const scopeProposalTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: '',
      answer: 'We have enough grounding context',
      parent_turn_id: scopeTurn.id,
    });
    await advanceHead(db, project.id, scopeProposalTurn.id);

    const { createPhaseOutcome, confirmPhaseOutcome, getCurrentWorkflowState } = await import('./db.js');

    const scopeOutcome = await createPhaseOutcome(db, {
      specificationId: project.id,
      phase: 'grounding',
      proposal_turn_id: scopeProposalTurn.id,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });

    const scopeConfirmationTurn = await createTurn(db, project.id, {
      phase: 'grounding',
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
            phase: 'grounding',
          },
        },
      ]),
    });
    await confirmPhaseOutcome(db, scopeOutcome.id, scopeConfirmationTurn.id);
    await advanceHead(db, project.id, scopeConfirmationTurn.id);

    db.$client.prepare('UPDATE phase_outcome SET closure_basis = NULL WHERE id = ?').run(scopeOutcome.id);

    expect((await getCurrentWorkflowState(db, project.id)).phases.grounding).toMatchObject({
      closureBasis: null,
    });
  });
});

describe('active path resolution', () => {
  it('returns empty array when no HEAD is set', async () => {
    const project = await getOrCreateSpecification(db);
    const path = await getActivePath(db, project.id);
    expect(path).toEqual([]);
  });

  it('resolves linear chain from root to HEAD', async () => {
    const project = await getOrCreateSpecification(db);
    const t1 = await createTurn(db, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    const t2 = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    const t3 = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q3',
      answer: 'A3',
      parent_turn_id: t2.id,
    });
    await advanceHead(db, project.id, t3.id);

    const path = await getActivePath(db, project.id);
    expect(path).toHaveLength(3);
    expect(path.map((t) => t.id)).toEqual([t1.id, t2.id, t3.id]);
  });

  it('resolves correct branch after fork', async () => {
    const project = await getOrCreateSpecification(db);
    const t1 = await createTurn(db, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    const t2a = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q2a',
      answer: 'A2a',
      parent_turn_id: t1.id,
    });
    const t2b = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q2b',
      answer: 'A2b',
      parent_turn_id: t1.id,
    });

    // HEAD at branch b
    await advanceHead(db, project.id, t2b.id);
    const pathB = await getActivePath(db, project.id);
    expect(pathB.map((t) => t.id)).toEqual([t1.id, t2b.id]);

    // Switch HEAD to branch a
    await advanceHead(db, project.id, t2a.id);
    const pathA = await getActivePath(db, project.id);
    expect(pathA.map((t) => t.id)).toEqual([t1.id, t2a.id]);
  });

  it('handles single-turn tree (root = HEAD)', async () => {
    const project = await getOrCreateSpecification(db);
    const t1 = await createTurn(db, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    await advanceHead(db, project.id, t1.id);
    const path = await getActivePath(db, project.id);
    expect(path).toHaveLength(1);
    expect(path[0].id).toBe(t1.id);
  });

  it('resolves deep fork correctly', async () => {
    const project = await getOrCreateSpecification(db);
    const t1 = await createTurn(db, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    const t2 = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    const _t3 = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Q3',
      answer: 'A3',
      parent_turn_id: t2.id,
    });
    // Fork from t2 (not from _t3)
    const t4 = await createTurn(db, project.id, {
      phase: 'design',
      question: 'Q4',
      answer: 'A4',
      parent_turn_id: t2.id,
    });
    const t5 = await createTurn(db, project.id, {
      phase: 'design',
      question: 'Q5',
      answer: 'A5',
      parent_turn_id: t4.id,
    });

    await advanceHead(db, project.id, t5.id);
    const path = await getActivePath(db, project.id);
    expect(path.map((t) => t.id)).toEqual([t1.id, t2.id, t4.id, t5.id]);
    // t3 is on the other branch — not in the active path
  });
});

describe('advanceHead', () => {
  it('updates project active_turn_id', async () => {
    const project = await getOrCreateSpecification(db);
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Q1' });
    await advanceHead(db, project.id, turn.id);
    const updated = await getOrCreateSpecification(db);
    expect(updated.active_turn_id).toBe(turn.id);
  });
});

describe('listSpecifications', () => {
  it('returns all projects', async () => {
    await createSpecification(db, 'Alpha');
    await createSpecification(db, 'Beta');
    await createSpecification(db, 'Gamma');
    const projects = await listSpecifications(db);
    expect(projects).toHaveLength(3);
    const names = projects.map((p) => p.name).sort();
    expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('returns empty array when no projects exist', async () => {
    expect(await listSpecifications(db)).toEqual([]);
  });
});

describe('createSpecification', () => {
  it('creates a named project and returns it', async () => {
    const project = await createSpecification(db, 'My Spec');
    expect(project.name).toBe('My Spec');
    expect(project.id).toBeDefined();
    expect(project.active_turn_id).toBeNull();
    expect(project.created_at).toBeDefined();
  });

  it('creates multiple projects with distinct IDs', async () => {
    const p1 = await createSpecification(db, 'First');
    const p2 = await createSpecification(db, 'Second');
    expect(p1.id).not.toBe(p2.id);
  });

  it('defaults to greenfield mode', async () => {
    const project = await createSpecification(db, 'Greenfield');
    expect(project.mode).toBe('greenfield');
  });

  it('creates a brownfield project with mode', async () => {
    const project = await createSpecification(db, 'Brownfield', { mode: 'brownfield' });
    expect(project.mode).toBe('brownfield');
  });
});

describe('getSpecification', () => {
  it('returns project by ID', async () => {
    const created = await createSpecification(db, 'Test');
    const found = await getSpecification(db, created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Test');
  });

  it('returns undefined for non-existent ID', async () => {
    expect(await getSpecification(db, 9999)).toBeUndefined();
  });
});

describe('DB lifecycle — parts persistence', () => {
  it('create → persist parts → close → reopen → parts intact', async () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'parts-lifecycle.db');

    const db1 = await createDb(dbPath);
    const project = await getOrCreateSpecification(db1);
    const turn = await createTurn(db1, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    const parts = JSON.stringify([
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'answer' },
    ]);
    const userParts = JSON.stringify([
      { type: 'data-turn-response', data: { turnId: turn.id, selectedOptionIds: [0] } },
    ]);
    await updateTurn(db1, turn.id, { assistant_parts: parts, user_parts: userParts });
    await advanceHead(db1, project.id, turn.id);
    db1.$client.close();

    const db2 = await createDb(dbPath);
    const reopened = await getOrCreateSpecification(db2);
    const path = await getActivePath(db2, reopened.id);
    expect(path).toHaveLength(1);
    expect(path[0].assistant_parts).toBe(parts);
    expect(path[0].user_parts).toBe(userParts);
    db2.$client.close();

    unlinkSync(dbPath);
  });
});

describe('DB lifecycle — turn tree persistence', () => {
  it('create → persist turns → close → reopen → state intact', async () => {
    const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, 'lifecycle.db');

    // Create and populate
    const db1 = await createDb(dbPath);
    const project = await getOrCreateSpecification(db1);
    const t1 = await createTurn(db1, project.id, { phase: 'grounding', question: 'Q1', answer: 'A1' });
    const t2 = await createTurn(db1, project.id, {
      phase: 'grounding',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: t1.id,
    });
    await createOption(db1, t1.id, { position: 0, content: 'Opt A', is_recommended: true });
    await createOption(db1, t1.id, { position: 1, content: 'Opt B' });
    await advanceHead(db1, project.id, t2.id);
    db1.$client.close();

    // Reopen and verify
    const db2 = await createDb(dbPath);
    const reopened = await getOrCreateSpecification(db2);
    expect(reopened.id).toBe(project.id);
    expect(reopened.active_turn_id).toBe(t2.id);
    const path = await getActivePath(db2, reopened.id);
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

describe('entity persistence — decisions, assumptions, and generic knowledge items', async () => {
  it('creates a decision as a generic knowledge item with project linkage', async () => {
    const project = await createSpecification(db, 'Test');
    const d = await createDecision(db, project.id, 'Use SQLite for persistence');
    expect(d.id).toBeDefined();
    expect(d.content).toBe('Use SQLite for persistence');
    expect(d.specification_id).toBe(project.id);

    const stored = db.$client.prepare('SELECT kind, content FROM knowledge_item WHERE id = ?').get(d.id) as {
      kind: string;
      content: string;
    };
    expect(stored).toEqual({ kind: 'decision', content: 'Use SQLite for persistence' });
    expect(
      db.$client
        .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'decision'")
        .get(),
    ).toEqual({ count: 0 });
  });

  it('creates an assumption as a generic knowledge item with project linkage', async () => {
    const project = await createSpecification(db, 'Test');
    const a = await createAssumption(db, project.id, 'SQLite handles concurrent writes');
    expect(a.id).toBeDefined();
    expect(a.content).toBe('SQLite handles concurrent writes');
    expect(a.specification_id).toBe(project.id);

    const stored = db.$client.prepare('SELECT kind, content FROM knowledge_item WHERE id = ?').get(a.id) as {
      kind: string;
      content: string;
    };
    expect(stored).toEqual({ kind: 'assumption', content: 'SQLite handles concurrent writes' });
    expect(
      db.$client
        .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'assumption'")
        .get(),
    ).toEqual({ count: 0 });
  });

  it('links a decision to a turn through generic provenance', async () => {
    const project = await createSpecification(db, 'Test');
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Q', answer: 'A' });
    const d = await createDecision(db, project.id, 'Use React');
    await linkDecisionToTurn(db, d.id, turn.id);
    const entities = await getEntitiesForSpecification(db, project.id);
    expect(entities.decisions).toHaveLength(1);
    expect(entities.decisions[0].content).toBe('Use React');
    expect(
      db.$client
        .prepare('SELECT relation FROM turn_knowledge_item WHERE turn_id = ? AND item_id = ?')
        .get(turn.id, d.id),
    ).toEqual({ relation: 'captured' });
    expect(
      db.$client
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'turn_decision'",
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it('links an assumption to a turn through generic provenance', async () => {
    const project = await createSpecification(db, 'Test');
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Q', answer: 'A' });
    const a = await createAssumption(db, project.id, 'Users have API keys');
    await linkAssumptionToTurn(db, a.id, turn.id);
    const entities = await getEntitiesForSpecification(db, project.id);
    expect(entities.assumptions).toHaveLength(1);
    expect(entities.assumptions[0].content).toBe('Users have API keys');
    expect(
      db.$client
        .prepare('SELECT relation FROM turn_knowledge_item WHERE turn_id = ? AND item_id = ?')
        .get(turn.id, a.id),
    ).toEqual({ relation: 'captured' });
    expect(
      db.$client
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'turn_assumption'",
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it('projects captured items for replay through one collection-driven seam', async () => {
    const project = await createSpecification(db, 'Test');
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Q', answer: 'A' });
    const goal = await createKnowledgeItem(db, project.id, 'goal', 'Ship a trustworthy spec handoff');
    const decision = await createDecision(
      db,
      project.id,
      'Start with the web app',
      'Fastest path to feedback',
    );
    const assumption = await createAssumption(db, project.id, 'Users can work in a browser');

    await linkKnowledgeItemToTurn(db, goal.id, turn.id);
    await linkDecisionToTurn(db, decision.id, turn.id);
    await linkAssumptionToTurn(db, assumption.id, turn.id);

    expect((await getCapturedItemsForTurns(db, project.id, [turn.id])).get(turn.id)).toEqual([
      {
        collection: 'knowledge_item',
        kind: 'goal',
        id: goal.id,
        content: 'Ship a trustworthy spec handoff',
        referenceCode: createKnowledgeReferenceCode('goal', 1),
      },
      {
        collection: 'knowledge_item',
        kind: 'decision',
        id: decision.id,
        content: 'Start with the web app',
        referenceCode: createKnowledgeReferenceCode('decision', 1),
      },
      {
        collection: 'knowledge_item',
        kind: 'assumption',
        id: assumption.id,
        content: 'Users can work in a browser',
        referenceCode: createKnowledgeReferenceCode('assumption', 1),
      },
    ]);
  });

  it('persists canonical grounding kinds plus later generic knowledge kinds with project linkage, metadata, and turn provenance', async () => {
    const project = await createSpecification(db, 'Test');
    const turn = await createTurn(db, project.id, { phase: 'grounding', question: 'Q', answer: 'A' });
    const goal = await createKnowledgeItem(
      db,
      project.id,
      'goal',
      'Help teams reach a clean implementation brief',
      {
        rationale: 'The project should produce a trustworthy handoff',
      },
    );
    const term = await createKnowledgeItem(db, project.id, 'term', 'implementation brief', {
      rationale: 'The conversation introduced a named artifact that needs stable meaning',
    });
    const context = await createKnowledgeItem(
      db,
      project.id,
      'context',
      'The first users are solo builders refining ideas',
      {
        rationale: 'Audience and workflow context shape the scope',
      },
    );
    const constraint = await createKnowledgeItem(db, project.id, 'constraint', 'Must run locally', {
      subtype: 'non-goal',
      rationale: 'Keep setup instant',
    });
    const requirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support resumable interviews',
      {
        rationale: 'Users will leave and come back',
      },
    );
    const criterion = await createKnowledgeItem(
      db,
      project.id,
      'criterion',
      'Resume works after browser restart',
      {
        subtype: 'acceptance',
        rationale: 'Protects the persistence seam',
      },
    );
    await linkKnowledgeItemToTurn(db, goal.id, turn.id);
    await linkKnowledgeItemToTurn(db, term.id, turn.id);
    await linkKnowledgeItemToTurn(db, context.id, turn.id);
    await linkKnowledgeItemToTurn(db, constraint.id, turn.id);
    await linkKnowledgeItemToTurn(db, requirement.id, turn.id);
    await linkKnowledgeItemToTurn(db, criterion.id, turn.id);

    const entities = await getEntitiesForSpecification(db, project.id);
    expect(entities.goals).toEqual([
      expect.objectContaining({
        specification_id: project.id,
        kind: 'goal',
        content: 'Help teams reach a clean implementation brief',
        rationale: 'The project should produce a trustworthy handoff',
      }),
    ]);
    expect(entities.terms).toEqual([
      expect.objectContaining({
        specification_id: project.id,
        kind: 'term',
        content: 'implementation brief',
        rationale: 'The conversation introduced a named artifact that needs stable meaning',
      }),
    ]);
    expect(entities.contexts).toEqual([
      expect.objectContaining({
        specification_id: project.id,
        kind: 'context',
        content: 'The first users are solo builders refining ideas',
        rationale: 'Audience and workflow context shape the scope',
      }),
    ]);
    expect(entities.constraints).toEqual([
      expect.objectContaining({
        specification_id: project.id,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Must run locally',
        rationale: 'Keep setup instant',
      }),
    ]);
    expect(entities.requirements).toEqual([
      expect.objectContaining({
        specification_id: project.id,
        kind: 'requirement',
        subtype: null,
        content: 'Support resumable interviews',
        rationale: 'Users will leave and come back',
      }),
    ]);
    expect(entities.criteria).toEqual([
      expect.objectContaining({
        specification_id: project.id,
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

  it('projects requirements without per-item review status from active-path review links', async () => {
    const project = await createSpecification(db, 'Test');
    const rejectedRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    const pendingRequirement = await createKnowledgeItem(
      db,
      project.id,
      'requirement',
      'Resume the interview from SQLite after restart',
    );
    const approvalTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Should we approve the PDF export requirement?',
      answer: 'Approve this requirement',
    });
    const rejectionTurn = await createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: approvalTurn.id,
      question: 'Should we reject the PDF export requirement after review?',
      answer: 'Reject this requirement',
    });

    await linkKnowledgeItemToTurn(db, rejectedRequirement.id, approvalTurn.id, 'reviewed');
    await linkKnowledgeItemToTurn(db, rejectedRequirement.id, rejectionTurn.id, 'rejected');
    await advanceHead(db, project.id, rejectionTurn.id);

    const entities = await getEntitiesForSpecification(db, project.id);
    expect(entities.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rejectedRequirement.id, content: rejectedRequirement.content }),
        expect.objectContaining({ id: pendingRequirement.id, content: pendingRequirement.content }),
      ]),
    );
    for (const requirement of entities.requirements) {
      expect(requirement).not.toHaveProperty('reviewStatus');
    }
    expect((await getCurrentWorkflowState(db, project.id)).phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: false,
      proposalPending: false,
    });
  });

  it('creates dependency edges between decisions through generic edge storage', async () => {
    const project = await createSpecification(db, 'Test');
    const d1 = await createDecision(db, project.id, 'Use Express');
    const d2 = await createDecision(db, project.id, 'Use SSE for streaming');
    await addDecisionParentDecision(db, d2.id, d1.id);
    const entities = await getEntitiesForSpecification(db, project.id);
    expect(entities.decisions).toHaveLength(2);
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM knowledge_edge').get()).toEqual({ count: 1 });
    expect(
      db.$client
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'decision_parent_decision'",
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it('projects generic parent links through one typed relationship read model', async () => {
    const project = await createSpecification(db, 'Test');
    const parentDecision = await createDecision(db, project.id, 'Use Express');
    const dependentDecision = await createDecision(db, project.id, 'Use SSE for streaming');
    const parentAssumption = await createAssumption(db, project.id, 'SDK supports streaming');
    const dependentAssumption = await createAssumption(db, project.id, 'Single-user tool');

    await addDecisionParentDecision(db, dependentDecision.id, parentDecision.id);
    await addDecisionParentAssumption(db, dependentDecision.id, parentAssumption.id);
    await addAssumptionParentAssumption(db, dependentAssumption.id, parentAssumption.id);

    const entities = await getEntitiesForSpecification(db, project.id);

    expect(entities.relationships).toEqual([
      {
        type: 'depends_on',
        source: { collection: 'knowledge_item', kind: 'decision', id: dependentDecision.id },
        target: { collection: 'knowledge_item', kind: 'decision', id: parentDecision.id },
      },
      {
        type: 'depends_on',
        source: { collection: 'knowledge_item', kind: 'decision', id: dependentDecision.id },
        target: { collection: 'knowledge_item', kind: 'assumption', id: parentAssumption.id },
      },
      {
        type: 'depends_on',
        source: { collection: 'knowledge_item', kind: 'assumption', id: dependentAssumption.id },
        target: { collection: 'knowledge_item', kind: 'assumption', id: parentAssumption.id },
      },
    ]);
  });

  it('keeps derived reference codes stable across project-wide and active-path entity projections', async () => {
    const project = await createSpecification(db, 'Test');
    const rootTurn = await createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What storage options are on the table?',
      answer: 'SQLite and Postgres are both possible.',
    });
    const abandonedBranchTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: rootTurn.id,
      question: 'Which storage branch should we explore?',
      answer: 'Explore the SQLite branch.',
    });
    const activeBranchTurn = await createTurn(db, project.id, {
      phase: 'design',
      parent_turn_id: rootTurn.id,
      question: 'Which storage branch should we explore?',
      answer: 'Explore the Postgres branch.',
    });
    await advanceHead(db, project.id, activeBranchTurn.id);

    const abandonedDecision = await createKnowledgeItem(
      db,
      project.id,
      'decision',
      'Use SQLite for persistence',
    );
    const activeDecision = await createKnowledgeItem(
      db,
      project.id,
      'decision',
      'Use Postgres for persistence',
    );
    await linkKnowledgeItemToTurn(db, abandonedDecision.id, abandonedBranchTurn.id);
    await linkKnowledgeItemToTurn(db, activeDecision.id, activeBranchTurn.id);

    expect(await getEntitiesForSpecificationByMode(db, project.id, 'project-wide')).toEqual(
      await getEntitiesForSpecification(db, project.id),
    );
    expect(await getEntitiesForSpecificationByMode(db, project.id, 'active-path')).toEqual(
      await getEntitiesForSpecificationOnActivePath(db, project.id),
    );

    expect((await getEntitiesForSpecificationByMode(db, project.id, 'project-wide')).decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Use SQLite for persistence',
          referenceCode: createKnowledgeReferenceCode('decision', 1),
        }),
        expect.objectContaining({
          content: 'Use Postgres for persistence',
          referenceCode: createKnowledgeReferenceCode('decision', 2),
        }),
      ]),
    );
    expect((await getEntitiesForSpecificationByMode(db, project.id, 'active-path')).decisions).toEqual([
      expect.objectContaining({
        content: 'Use Postgres for persistence',
        referenceCode: createKnowledgeReferenceCode('decision', 2),
      }),
    ]);
  });

  it('projects the full persisted edge relation vocabulary through the entity seam', async () => {
    const project = await createSpecification(db, 'Test');
    const goal = await createKnowledgeItem(db, project.id, 'goal', 'Track work from creation to completion');
    const term = await createKnowledgeItem(db, project.id, 'term', 'ticket');
    const context = await createKnowledgeItem(
      db,
      project.id,
      'context',
      'The team currently uses a spreadsheet',
    );
    const constraint = await createKnowledgeItem(
      db,
      project.id,
      'constraint',
      'Keep the first release simpler than Jira',
    );
    const criterion = await createKnowledgeItem(
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

    const entities = await getEntitiesForSpecification(db, project.id);

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

  it('creates dependency edges between assumptions through generic edge storage', async () => {
    const project = await createSpecification(db, 'Test');
    const a1 = await createAssumption(db, project.id, 'Single user');
    const a2 = await createAssumption(db, project.id, 'No concurrent writes');
    await addAssumptionParentAssumption(db, a2.id, a1.id);
    const entities = await getEntitiesForSpecification(db, project.id);
    expect(entities.assumptions).toHaveLength(2);
    expect(db.$client.prepare('SELECT COUNT(*) AS count FROM knowledge_edge').get()).toEqual({ count: 1 });
    expect(
      db.$client
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'assumption_parent_assumption'",
        )
        .get(),
    ).toEqual({ count: 0 });
  });

  it('projects a canonical grounding bundle without consulting legacy commitment storage', async () => {
    const project = await createSpecification(db, 'Test');
    await createKnowledgeItem(db, project.id, 'goal', 'Ship a trustworthy spec handoff');
    await createKnowledgeItem(db, project.id, 'term', 'implementation brief');
    await createKnowledgeItem(db, project.id, 'context', 'The first users are solo builders');
    await createKnowledgeItem(db, project.id, 'constraint', 'Do not require hosted setup', {
      subtype: 'non-goal',
    });
    await createDecision(db, project.id, 'Start with the web app');
    await createAssumption(db, project.id, 'Users can work in a browser');

    expect(await getGroundingBundleForSpecification(db, project.id)).toMatchObject({
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
