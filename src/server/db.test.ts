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
  addDecisionParentDecision,
  addDecisionParentAssumption,
  addAssumptionParentAssumption,
  getEntitiesForProject,
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
  it('creates all 15 tables from schema.dbml', () => {
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
      status: 'proposed',
      summary: proposed.summary,
      turnId: closureTurn.id,
    });

    const confirmationTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: '',
      answer: 'Confirm scope closure',
      parent_turn_id: closureTurn.id,
    });
    confirmPhaseOutcome(db, proposed.id, confirmationTurn.id);
    advanceHead(db, project.id, confirmationTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.scope).toMatchObject({
      status: 'confirmed',
      summary: proposed.summary,
      turnId: closureTurn.id,
    });

    const alternateTurn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What should we revisit?',
      answer: 'Target audience',
      parent_turn_id: root.id,
    });
    advanceHead(db, project.id, alternateTurn.id);

    expect(getCurrentWorkflowState(db, project.id).phases.scope).toMatchObject({
      status: 'open',
      summary: null,
      turnId: null,
    });
    expect(listPhaseOutcomesForProject(db, project.id)[0]).toMatchObject({
      id: proposed.id,
      status: 'superseded',
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
  it('creates a decision with project linkage', () => {
    const project = createProject(db, 'Test');
    const d = createDecision(db, project.id, 'Use SQLite for persistence');
    expect(d.id).toBeDefined();
    expect(d.content).toBe('Use SQLite for persistence');
    expect(d.project_id).toBe(project.id);
  });

  it('creates an assumption with project linkage', () => {
    const project = createProject(db, 'Test');
    const a = createAssumption(db, project.id, 'SQLite handles concurrent writes');
    expect(a.id).toBeDefined();
    expect(a.content).toBe('SQLite handles concurrent writes');
    expect(a.project_id).toBe(project.id);
  });

  it('links a decision to a turn', () => {
    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });
    const d = createDecision(db, project.id, 'Use React');
    linkDecisionToTurn(db, d.id, turn.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(1);
    expect(entities.decisions[0].content).toBe('Use React');
  });

  it('links an assumption to a turn', () => {
    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });
    const a = createAssumption(db, project.id, 'Users have API keys');
    linkAssumptionToTurn(db, a.id, turn.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.assumptions).toHaveLength(1);
    expect(entities.assumptions[0].content).toBe('Users have API keys');
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

  it('creates dependency edges between decisions', () => {
    const project = createProject(db, 'Test');
    const d1 = createDecision(db, project.id, 'Use Express');
    const d2 = createDecision(db, project.id, 'Use SSE for streaming');
    addDecisionParentDecision(db, d2.id, d1.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(2);
  });

  it('projects legacy parent links through one typed relationship read model', () => {
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

  it('creates dependency edges between assumptions', () => {
    const project = createProject(db, 'Test');
    const a1 = createAssumption(db, project.id, 'Single user');
    const a2 = createAssumption(db, project.id, 'No concurrent writes');
    addAssumptionParentAssumption(db, a2.id, a1.id);
    const entities = getEntitiesForProject(db, project.id);
    expect(entities.assumptions).toHaveLength(2);
  });
});
