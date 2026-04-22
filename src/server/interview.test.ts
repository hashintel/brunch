import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { structuredQuestionSchema, type StructuredQuestion } from '@/shared/chat.js';

import { createDb, createSpecification, createTurn, getOptionsForTurn, getTurn, type DB } from './db.js';
import {
  buildReviewSetForPhase,
  canProposePhaseClosure,
  getBrownfieldGroundingPrompt,
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

  it('accepts a grounding question with no options', () => {
    const freeTextQuestion = {
      question: 'What is the main problem you are trying to solve?',
      why: 'Understanding the core problem grounds all downstream decisions.',
      impact: 'high' as const,
      options: [],
    };

    expect(structuredQuestionSchema.parse(freeTextQuestion)).toEqual(freeTextQuestion);
  });

  it('rejects a question with exactly one option (ambiguous — neither free-text nor multi-option)', () => {
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
            reviewItemId: 'requirements:1',
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
    expect(getSystemPrompt('grounding')).not.toBe(getSystemPrompt('design'));
  });

  it('keeps the grounding prompt hint-guided with topic priorities and free-text format', () => {
    const prompt = getSystemPrompt('grounding');
    expect(prompt).toContain('ask_question');
    expect(prompt).toContain('free-text');
    expect(prompt).toContain('Concept');
    expect(prompt).toContain('constraints');
    expect(prompt).toContain('Scope');
    expect(prompt).not.toContain('Include 2-4 options');
    expect(prompt).not.toContain('Mark exactly one option as recommended');
  });

  it('teaches the design prompt to propose closure when enough design direction is captured', () => {
    expect(getSystemPrompt('design')).toContain('propose_phase_closure');
  });

  it('grounds the requirements prompt in a full-set review turn', () => {
    expect(getSystemPrompt('requirements')).toContain('current requirement inventory');
    expect(getSystemPrompt('requirements')).toContain('Accept review');
    expect(getSystemPrompt('requirements')).toContain('Request changes');
    expect(getSystemPrompt('requirements')).toContain('reviewSet');
    expect(getSystemPrompt('requirements')).toContain('grounding refs');
    expect(getSystemPrompt('requirements')).toContain('isUserCreated');
    expect(getSystemPrompt('requirements')).toContain('isRevised');
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
    expect(getSystemPrompt('criteria')).toContain('grounding refs');
    expect(getSystemPrompt('criteria')).toContain('isUserCreated');
    expect(getSystemPrompt('criteria')).toContain('isRevised');
    expect(getSystemPrompt('criteria')).not.toContain('criterionReview');
  });

  it('uses workspace wording for brownfield grounding prompts', () => {
    const prompt = getBrownfieldGroundingPrompt('/tmp/repo');

    expect(prompt).toContain('The workspace directory is: /tmp/repo');
    expect(prompt).toContain('workspace manifest files');
    expect(prompt).toContain('workspace layout');
    expect(prompt).not.toContain('The project directory is:');
  });
});

describe('canProposePhaseClosure', () => {
  it('enables closure proposals only for grounding and design', () => {
    expect(canProposePhaseClosure('grounding')).toBe(true);
    expect(canProposePhaseClosure('design')).toBe(true);
    expect(canProposePhaseClosure('requirements', false)).toBe(false);
    expect(canProposePhaseClosure('requirements', true)).toBe(false);
    expect(canProposePhaseClosure('criteria')).toBe(false);
  });
});

describe('createAskQuestionTool phase-aware options enforcement', () => {
  it('allows zero options for grounding turns', async () => {
    const project = createSpecification(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'grounding', question: '', answer: '' });
    const askTool = getInterviewerTools(db, turn.id, 'grounding', project.id).ask_question;

    const result = await askTool.execute!(
      {
        question: 'What problem are you solving?',
        why: 'Core problem grounds everything.',
        impact: 'high',
        options: [],
      },
      { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({ ok: true, turnId: turn.id, optionCount: 0 });
    expect(getOptionsForTurn(db, turn.id)).toHaveLength(0);
  });

  it('rejects zero options for design turns', async () => {
    const project = createSpecification(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'design', question: '', answer: '' });
    const askTool = getInterviewerTools(db, turn.id, 'design', project.id).ask_question;

    await expect(
      askTool.execute!(
        {
          question: 'Which architecture?',
          why: 'Architecture shapes everything.',
          impact: 'high',
          options: [],
        },
        { toolCallId: 'tc-2', messages: [], abortSignal: new AbortController().signal },
      ),
    ).rejects.toThrow(/options/i);
  });
});

describe('persistStructuredQuestion', () => {
  it('stores question metadata and options on the turn', () => {
    const project = createSpecification(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'grounding', question: '', answer: 'hello' });

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
    const { listPhaseOutcomesForSpecification } = await import('./db.js');

    const project = createSpecification(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'design', question: '', answer: '' });

    const tool = createProposePhaseClosureTool(db, turn.id, 'design', project.id);
    expect(tool.execute).toBeDefined();
    await tool.execute!(
      { phase: 'grounding', summary: 'LLM hallucinated wrong phase' },
      { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal },
    );

    const outcomes = listPhaseOutcomesForSpecification(db, project.id);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].phase).toBe('design');
  });
});

describe('brownfield interviewer configuration', () => {
  it('adds read-only exploration tools during brownfield grounding', () => {
    const project = createSpecification(db, 'BF', { mode: 'brownfield' });
    const turn = createTurn(db, project.id, { phase: 'grounding', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'grounding', project.id, {
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
    const project = createSpecification(db, 'BF', { mode: 'brownfield' });
    const turn = createTurn(db, project.id, { phase: 'grounding', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'grounding', project.id, {
      mode: 'brownfield',
      cwd: '/tmp/repo',
    });
    const toolNames = Object.keys(tools);

    expect(toolNames).not.toContain('write_file');
    expect(toolNames).not.toContain('edit_file');
    expect(toolNames).not.toContain('bash');
  });

  it('removes brownfield exploration tools after grounding', () => {
    const project = createSpecification(db, 'BF', { mode: 'brownfield' });
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
    const project = createSpecification(db, 'GF');
    const turn = createTurn(db, project.id, { phase: 'grounding', question: '', answer: '' });
    const tools = getInterviewerTools(db, turn.id, 'grounding', project.id);
    const toolNames = Object.keys(tools);
    expect(toolNames).not.toContain('read_file');
    expect(toolNames).not.toContain('grep');
    expect(toolNames).toContain('ask_question');
  });

  it('uses a distinct brownfield system prompt for grounding phase without mandating options', () => {
    const brownfieldPrompt = getBrownfieldGroundingPrompt('/tmp/repo');
    const greenfieldPrompt = getSystemPrompt('grounding');
    expect(brownfieldPrompt).not.toBe(greenfieldPrompt);
    expect(brownfieldPrompt).toContain('explore');
    expect(brownfieldPrompt).toContain('/tmp/repo');
    expect(brownfieldPrompt).toContain('present_grounding_card');
    expect(brownfieldPrompt).toContain('bounded feature area');
    expect(brownfieldPrompt).toContain('partial');
    expect(brownfieldPrompt).toContain('call BOTH tools in sequence');
    expect(brownfieldPrompt).not.toContain('Include 2-4 options');
    expect(brownfieldPrompt).not.toContain('Mark exactly one option as recommended');
    expect(brownfieldPrompt).toContain('free-text');
  });

  it('limits brownfield exploration instructions to the grounding phase and makes post-kickoff grounding state-aware', () => {
    expect(getInterviewerInstructions('grounding', { mode: 'brownfield', cwd: '/tmp/repo' })).toContain(
      'Before asking your first grounding question',
    );
    expect(
      getInterviewerInstructions('grounding', {
        mode: 'brownfield',
        cwd: '/tmp/repo',
        brownfieldGroundingStage: 'ongoing',
      }),
    ).toContain('ongoing brownfield grounding conversation');
    expect(
      getInterviewerInstructions('grounding', {
        mode: 'brownfield',
        cwd: '/tmp/repo',
        brownfieldGroundingStage: 'ongoing',
      }),
    ).not.toContain('Before asking your first grounding question');
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
            specification_id: 1,
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
          reviewItemId: 'requirements:1',
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
            specification_id: 1,
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
          reviewItemId: 'criteria:2',
          content: 'Restarting restores the active path',
          rationale: 'Proves the persisted branch resumes cleanly.',
          referenceCode: 'AC1',
        },
      ],
    });
  });

  it('returns null outside the review phases', () => {
    expect(buildReviewSetForPhase('grounding', { requirements: [], criteria: [] })).toBeNull();
    expect(buildReviewSetForPhase('design', { requirements: [], criteria: [] })).toBeNull();
  });
});

describe('persistFallbackQuestionText', () => {
  it('fills the question only when the turn does not already have one', () => {
    const project = createSpecification(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'grounding', question: '', answer: 'hello' });

    persistFallbackQuestionText(db, turn.id, 'Fallback question');
    expect(getTurn(db, turn.id)?.question).toBe('Fallback question');

    persistFallbackQuestionText(db, turn.id, 'Replacement question');
    expect(getTurn(db, turn.id)?.question).toBe('Fallback question');
  });
});
