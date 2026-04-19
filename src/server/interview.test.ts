import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { structuredQuestionSchema, type StructuredQuestion } from '@/shared/chat.js';

import { createDb, createProject, createTurn, getOptionsForTurn, getTurn, type DB } from './db.js';
import {
  buildReviewSetForPhase,
  canProposePhaseClosure,
  getBrownfieldScopePrompt,
  getInterviewerInstructions,
  getInterviewerTools,
  getSystemPrompt,
  persistFallbackQuestionText,
  persistStructuredQuestion,
} from './interview.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('structuredQuestionSchema', () => {
  it('parses a valid structured question', () => {
    const valid: StructuredQuestion = {
      question: 'What is the primary goal of your project?',
      why: 'Understanding the goal shapes all downstream decisions.',
      impact: 'high',
      options: [
        { content: 'Build a new product from scratch', is_recommended: false },
        { content: 'Improve an existing product', is_recommended: true },
      ],
    };

    expect(structuredQuestionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a question with fewer than two options', () => {
    expect(() =>
      structuredQuestionSchema.parse({
        question: 'What?',
        why: 'Because.',
        impact: 'high',
        options: [{ content: 'Only one', is_recommended: false }],
      }),
    ).toThrow();
  });

  it('rejects the legacy review field now that requirement review is explicit', () => {
    expect(() =>
      structuredQuestionSchema.parse({
        question: 'Should we approve this requirement?',
        why: 'Review turns should carry explicit review action metadata in the tool payload.',
        impact: 'high',
        options: [
          { content: 'Approve', is_recommended: true },
          { content: 'Reject', is_recommended: false },
        ],
        requirementReview: {
          kind: 'requirement-approval',
          requirementId: 42,
          approveOptionPosition: 0,
        },
      }),
    ).toThrow();
  });

  it('accepts explicit reviewActions metadata and interviewer-owned reviewSet payloads for full-set review turns', () => {
    const validReviewTurn: StructuredQuestion = {
      question: 'Please review the current requirement set.',
      why: 'We need an explicit accept/request-changes seam before closing the phase.',
      impact: 'high',
      options: [
        { content: 'Accept review', is_recommended: true },
        { content: 'Request changes', is_recommended: false },
      ],
      reviewActions: [
        { action: 'accept', optionPosition: 0 },
        { action: 'request-changes', optionPosition: 1 },
      ],
      reviewSet: {
        phase: 'requirements',
        title: 'Requirements',
        items: [
          {
            referenceCode: 'R1',
            content: 'Resume the interview from SQLite after restart',
            rationale: 'Lets users continue after a restart.',
          },
        ],
      },
    };

    expect(structuredQuestionSchema.parse(validReviewTurn)).toEqual(validReviewTurn);
  });
});

describe('getSystemPrompt', () => {
  it('returns distinct prompts for different phases', () => {
    expect(getSystemPrompt('scope')).not.toBe(getSystemPrompt('design'));
  });

  it('keeps the scope prompt specific to structured questioning', () => {
    expect(getSystemPrompt('scope')).toContain('ask_question');
    expect(getSystemPrompt('scope')).toContain('structured questions');
  });

  it('teaches the design prompt to propose closure when enough design direction is captured', () => {
    expect(getSystemPrompt('design')).toContain('propose_phase_closure');
  });

  it('grounds the requirements prompt in a full-set review turn', () => {
    expect(getSystemPrompt('requirements')).toContain('current requirement inventory');
    expect(getSystemPrompt('requirements')).toContain('Accept review');
    expect(getSystemPrompt('requirements')).toContain('Request changes');
    expect(getSystemPrompt('requirements')).toContain('reviewSet');
    expect(getSystemPrompt('requirements')).not.toContain('requirementReview');
    expect(getSystemPrompt('requirements')).not.toContain('propose_phase_closure');
    expect(getSystemPrompt('requirements')).toContain('phase-closing action');
  });

  it('grounds the criteria prompt in a full-set review turn', () => {
    expect(getSystemPrompt('criteria')).toContain('current criterion inventory');
    expect(getSystemPrompt('criteria')).toContain('accepted requirements');
    expect(getSystemPrompt('criteria')).toContain('Accept review');
    expect(getSystemPrompt('criteria')).toContain('Request changes');
    expect(getSystemPrompt('criteria')).toContain('reviewSet');
    expect(getSystemPrompt('criteria')).not.toContain('criterionReview');
  });
});

describe('canProposePhaseClosure', () => {
  it('enables closure proposals only for scope and design', () => {
    expect(canProposePhaseClosure('scope')).toBe(true);
    expect(canProposePhaseClosure('design')).toBe(true);
    expect(canProposePhaseClosure('requirements', false)).toBe(false);
    expect(canProposePhaseClosure('requirements', true)).toBe(false);
    expect(canProposePhaseClosure('criteria')).toBe(false);
  });
});

describe('persistStructuredQuestion', () => {
  it('stores question metadata and options on the turn', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: 'hello' });

    persistStructuredQuestion(db, turn.id, {
      question: 'What platform should we support first?',
      why: 'Platform determines initial architecture.',
      impact: 'high',
      options: [
        { content: 'Web', is_recommended: true },
        { content: 'Desktop', is_recommended: false },
      ],
    });

    const updatedTurn = getTurn(db, turn.id);
    const options = getOptionsForTurn(db, turn.id);

    expect(updatedTurn?.question).toBe('What platform should we support first?');
    expect(updatedTurn?.why).toBe('Platform determines initial architecture.');
    expect(updatedTurn?.impact).toBe('high');
    expect(options).toHaveLength(2);
    expect(options[0].content).toBe('Web');
    expect(options[0].is_recommended).toBe(true);
  });
});

describe('createProposePhaseClosureTool', () => {
  it('persists the server-known phase, not the LLM-provided input phase', async () => {
    const { createProposePhaseClosureTool } = await import('./interview.js');
    const { listPhaseOutcomesForProject } = await import('./db.js');

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'design', question: '', answer: '' });

    const tool = createProposePhaseClosureTool(db, turn.id, 'design', project.id);
    expect(tool.execute).toBeDefined();
    await tool.execute!(
      { phase: 'scope', summary: 'LLM hallucinated wrong phase' },
      { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal },
    );

    const outcomes = listPhaseOutcomesForProject(db, project.id);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].phase).toBe('design');
  });
});

describe('brownfield interviewer configuration', () => {
  it('adds read-only exploration tools during brownfield scope', () => {
    const project = createProject(db, 'BF', { mode: 'brownfield', cwd: '/tmp/repo' });
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'scope', project.id, {
      mode: 'brownfield',
      cwd: '/tmp/repo',
    });
    const toolNames = Object.keys(tools);
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('grep');
    expect(toolNames).toContain('find_files');
    expect(toolNames).toContain('list_directory');
    expect(toolNames).toContain('present_grounding_card');
    expect(toolNames).toContain('ask_question');
  });

  it('keeps brownfield exploration tools read-only', () => {
    const project = createProject(db, 'BF', { mode: 'brownfield', cwd: '/tmp/repo' });
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'scope', project.id, {
      mode: 'brownfield',
      cwd: '/tmp/repo',
    });
    const toolNames = Object.keys(tools);

    expect(toolNames).not.toContain('write_file');
    expect(toolNames).not.toContain('edit_file');
    expect(toolNames).not.toContain('bash');
  });

  it('removes brownfield exploration tools after scope', () => {
    const project = createProject(db, 'BF', { mode: 'brownfield', cwd: '/tmp/repo' });
    const turn = createTurn(db, project.id, { phase: 'design', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'design', project.id, {
      mode: 'brownfield',
      cwd: '/tmp/repo',
    });
    const toolNames = Object.keys(tools);

    expect(toolNames).not.toContain('read_file');
    expect(toolNames).not.toContain('grep');
    expect(toolNames).not.toContain('find_files');
    expect(toolNames).not.toContain('list_directory');
    expect(toolNames).toContain('ask_question');
  });

  it('excludes core tools when mode is greenfield', () => {
    const project = createProject(db, 'GF');
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'scope', project.id);
    const toolNames = Object.keys(tools);
    expect(toolNames).not.toContain('read_file');
    expect(toolNames).not.toContain('grep');
    expect(toolNames).toContain('ask_question');
  });

  it('uses a distinct brownfield system prompt for scope phase', () => {
    const brownfieldPrompt = getBrownfieldScopePrompt('/tmp/repo');
    const greenfieldPrompt = getSystemPrompt('scope');
    expect(brownfieldPrompt).not.toBe(greenfieldPrompt);
    expect(brownfieldPrompt).toContain('explore');
    expect(brownfieldPrompt).toContain('/tmp/repo');
    expect(brownfieldPrompt).toContain('present_grounding_card');
    expect(brownfieldPrompt).toContain('bounded feature area');
    expect(brownfieldPrompt).toContain('partial');
    expect(brownfieldPrompt).toContain('FIRST durable turn');
  });

  it('limits brownfield exploration instructions to the scope phase', () => {
    expect(getInterviewerInstructions('scope', { mode: 'brownfield', cwd: '/tmp/repo' })).toContain(
      'explore',
    );
    expect(getInterviewerInstructions('design', { mode: 'brownfield', cwd: '/tmp/repo' })).toBe(
      getSystemPrompt('design'),
    );
    expect(getInterviewerInstructions('requirements', { mode: 'brownfield', cwd: '/tmp/repo' })).toBe(
      getSystemPrompt('requirements'),
    );
  });
});

describe('buildReviewSetForPhase', () => {
  it('builds persisted review-set payloads for requirements and criteria from the current review inventory', () => {
    expect(
      buildReviewSetForPhase('requirements', {
        requirements: [
          {
            id: 1,
            project_id: 1,
            kind: 'requirement',
            subtype: null,
            content: 'Resume the interview from SQLite after restart',
            rationale: 'Lets users continue after a restart.',
            referenceCode: 'R1',
          },
        ],
        criteria: [],
      }),
    ).toEqual({
      phase: 'requirements',
      title: 'Requirements',
      items: [
        {
          content: 'Resume the interview from SQLite after restart',
          rationale: 'Lets users continue after a restart.',
          referenceCode: 'R1',
        },
      ],
    });

    expect(
      buildReviewSetForPhase('criteria', {
        requirements: [],
        criteria: [
          {
            id: 2,
            project_id: 1,
            kind: 'criterion',
            subtype: null,
            content: 'Restarting restores the active path',
            rationale: 'Proves the persisted branch resumes cleanly.',
            referenceCode: 'AC1',
          },
        ],
      }),
    ).toEqual({
      phase: 'criteria',
      title: 'Acceptance Criteria',
      items: [
        {
          content: 'Restarting restores the active path',
          rationale: 'Proves the persisted branch resumes cleanly.',
          referenceCode: 'AC1',
        },
      ],
    });
  });

  it('returns null outside the review phases', () => {
    expect(buildReviewSetForPhase('scope', { requirements: [], criteria: [] })).toBeNull();
    expect(buildReviewSetForPhase('design', { requirements: [], criteria: [] })).toBeNull();
  });
});

describe('persistFallbackQuestionText', () => {
  it('fills the question only when the turn does not already have one', () => {
    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'scope', question: '', answer: 'hello' });

    persistFallbackQuestionText(db, turn.id, 'Fallback question');
    expect(getTurn(db, turn.id)?.question).toBe('Fallback question');

    persistFallbackQuestionText(db, turn.id, 'Replacement question');
    expect(getTurn(db, turn.id)?.question).toBe('Fallback question');
  });
});
