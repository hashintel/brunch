import { describe, expect, it } from 'vitest';

import { projectDigestConfirmation, projectDigestQuestionnaire } from '../../../exchanges/projections/ask.js';
import { projectPresentCandidates } from '../../../exchanges/projections/present-candidates.js';
import { projectPresentDigest } from '../../../exchanges/projections/present-digest.js';
import { projectRequestReview } from '../../../exchanges/projections/request-response/review.js';
import { projectSessionPresentation } from '../session-presentation.js';

const target = { specId: 1, sessionId: 'session-1' };
const entry = (id: string, message: unknown) => ({ type: 'message', id, parentId: null, message });
const request = {
  schema: 'brunch.structured_exchange.request',
  v: 1,
  exchange_id: 'ask-1',
  tool_meta: { curr: 'ask', next: 'capture_answer' },
  question: { body: 'What is canonical?' },
  answered: { text: 'Canonical JSONL.' },
};

describe('session presentation', () => {
  it('projects ordinary messages and one ask to stable product identities', () => {
    const result = projectSessionPresentation(target, [
      entry('u1', { role: 'user', content: 'Why?', timestamp: 0 }),
      entry('a1', {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'private' },
          { type: 'text', text: 'Because.' },
        ],
        timestamp: 1,
      }),
      entry('r1', { role: 'toolResult', toolName: 'ask', details: request }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '2:r1',
        entries: [
          { id: 'u1', cursor: '0:u1', kind: 'message', role: 'user', text: 'Why?' },
          { id: 'a1', cursor: '1:a1', kind: 'message', role: 'assistant', text: 'Because.' },
          {
            id: 'r1',
            cursor: '2:r1',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'answered', value: { text: 'Canonical JSONL.' } },
          },
        ],
      },
    });
  });

  it('preserves every free-text ask terminal state without loss', () => {
    const terminals = [
      { answered: { text: 'Canonical JSONL.', comment: 'Keep the source visible.' } },
      { cancelled: { message: 'No longer needed.' } },
      { unavailable: { message: 'The source is unavailable.' } },
      { cancelled: {} },
    ] as const;
    const result = projectSessionPresentation(
      target,
      terminals.map((terminal, index) =>
        entry(`r${index}`, {
          role: 'toolResult',
          toolName: 'ask',
          details: {
            schema: request.schema,
            v: request.v,
            exchange_id: request.exchange_id,
            question: request.question,
            tool_meta: { curr: 'ask' },
            ...terminal,
          },
        }),
      ),
    );

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '3:r3',
        entries: [
          {
            id: 'r0',
            cursor: '0:r0',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: {
              status: 'answered',
              value: { text: 'Canonical JSONL.', comment: 'Keep the source visible.' },
            },
          },
          {
            id: 'r1',
            cursor: '1:r1',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'cancelled', value: { message: 'No longer needed.' } },
          },
          {
            id: 'r2',
            cursor: '2:r2',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'unavailable', value: { message: 'The source is unavailable.' } },
          },
          {
            id: 'r3',
            cursor: '3:r3',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'cancelled', value: {} },
          },
        ],
      },
    });
  });

  it('preserves a single-select ask, its selected choice, option echo, and Other comment without loss', () => {
    const options = [
      { id: 'fast', label: 'Fast path', description: 'Optimize for speed.' },
      { id: 'safe', label: 'Safe path' },
    ];
    const terminals = [
      {
        choice: { id: 'safe', label: 'Safe path', kind: 'listed' },
        options: [
          { id: 'fast', content: 'Fast path', rationale: 'Optimize for speed.' },
          { id: 'safe', content: 'Safe path' },
        ],
      },
      {
        choice: { id: 'other', label: 'A measured path', kind: 'other' },
        options: [
          { id: 'fast', content: 'Fast path', rationale: 'Optimize for speed.' },
          { id: 'safe', content: 'Safe path' },
        ],
        comment: 'Blend safety with a bounded experiment.',
      },
    ] as const;

    const result = projectSessionPresentation(
      target,
      terminals.map((answered, index) =>
        entry(`choice-${index}`, {
          role: 'toolResult',
          toolName: 'ask',
          details: {
            schema: request.schema,
            v: request.v,
            exchange_id: `choice-${index}`,
            tool_meta: { curr: 'ask', next: 'capture_choice' },
            question: { body: 'Pick the route', options },
            answered,
          },
        }),
      ),
    );

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '1:choice-1',
        entries: terminals.map((answered, index) => ({
          id: `choice-${index}`,
          cursor: `${index}:choice-${index}`,
          kind: 'ask',
          exchangeId: `choice-${index}`,
          question: 'Pick the route',
          options,
          terminal: { status: 'answered', value: answered },
        })),
      },
    });
  });

  it('preserves multi-select mode, choices, option echo, and Other comment without loss', () => {
    const options = [
      { id: 'fast', label: 'Fast path', description: 'Optimize for speed.' },
      { id: 'safe', label: 'Safe path' },
    ];
    const answered = {
      choices: [
        { id: 'fast', label: 'Fast path', kind: 'listed' as const },
        { id: 'other', label: 'A measured path', kind: 'other' as const },
      ],
      options: [
        { id: 'fast', content: 'Fast path', rationale: 'Optimize for speed.' },
        { id: 'safe', content: 'Safe path' },
      ],
      comment: 'Pair speed with a bounded experiment.',
    };

    const result = projectSessionPresentation(target, [
      entry('choices', {
        role: 'toolResult',
        toolName: 'ask',
        details: {
          schema: request.schema,
          v: request.v,
          exchange_id: 'choices',
          tool_meta: { curr: 'ask', next: 'capture_choices' },
          question: { body: 'Pick every route', options, multiple: true },
          answered,
        },
      }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '0:choices',
        entries: [
          {
            id: 'choices',
            cursor: '0:choices',
            kind: 'ask',
            exchangeId: 'choices',
            question: 'Pick every route',
            mode: 'multi-select',
            options,
            terminal: { status: 'answered', value: answered },
          },
        ],
      },
    });
  });

  it('preserves an ordered questionnaire with every keyed answer kind and accepted abstract', () => {
    const details = projectDigestQuestionnaire({
      exchangeId: 'questionnaire',
      acceptsDigest: 'digest-final',
      acceptedAbstract: 'The accepted digest abstract.',
      questions: [
        { id: 'goal', kind: 'free-text', prompt: 'What matters?' },
        {
          id: 'route',
          kind: 'single-select',
          prompt: 'Which route?',
          options: [
            { id: 'safe', label: 'Safe path' },
            { id: 'fast', label: 'Fast path' },
          ],
        },
        {
          id: 'checks',
          kind: 'multi-select',
          prompt: 'Which checks?',
          options: [
            { id: 'tests', label: 'Tests' },
            { id: 'types', label: 'Types' },
          ],
        },
      ],
      answers: [
        { questionId: 'checks', kind: 'multi-select', optionIds: ['types', 'tests'] },
        { questionId: 'goal', kind: 'free-text', text: 'Clarity' },
        { questionId: 'route', kind: 'single-select', optionId: 'safe' },
      ],
    });

    const result = projectSessionPresentation(target, [
      entry('questionnaire', { role: 'toolResult', toolName: 'ask', details }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '0:questionnaire',
        entries: [
          {
            id: 'questionnaire',
            cursor: '0:questionnaire',
            kind: 'ask',
            exchangeId: 'questionnaire',
            question: 'Digest questionnaire',
            terminal: {
              status: 'answered',
              value: {
                questionnaire: details.questionnaire,
                acceptsDigest: 'digest-final',
                acceptedAbstract: 'The accepted digest abstract.',
              },
            },
          },
        ],
      },
    });
  });

  it('preserves ordered candidate proposal cards and their declared request_choice continuation', () => {
    const details = projectPresentCandidates({
      exchangeId: 'candidate-direction',
      heading: 'Choose a direction',
      body: 'Compare the proposals.',
      candidates: [
        {
          id: 'local',
          title: 'Local workbench',
          user_rubric: {
            core_bet: 'Make local graph work the thesis.',
            best_fit: 'Focused POC.',
            cost_complexity: 'Own local state.',
            covers_well: 'Transcript and graph coherence.',
            main_risks: 'No cloud collaboration.',
            lock_in_constraints: 'Local-first semantics.',
            recommendation: 'Choose for the POC.',
          },
          meta_rubric: {
            legibility_cost_of_knowing: 'Easy to inspect.',
            failure_modes: 'May under-test teams.',
            coverage_range: 'Current assumptions.',
            commitment: 'Defers cloud.',
          },
          graph_refs: [{ node_id: 'node-1' }],
        },
        {
          id: 'hosted',
          title: 'Hosted workspace',
          user_rubric: {
            core_bet: 'Lead with collaboration.',
            best_fit: 'Distributed teams.',
            cost_complexity: 'Requires hosted infrastructure.',
            covers_well: 'Multi-user workflows.',
            main_risks: 'Widens the POC.',
            lock_in_constraints: 'Cloud operations.',
          },
          meta_rubric: {},
          graph_refs: [],
        },
      ],
    }).details;

    const result = projectSessionPresentation(target, [
      entry('candidates', { role: 'toolResult', toolName: 'present_candidates', details }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '0:candidates',
        entries: [
          {
            id: 'candidates',
            cursor: '0:candidates',
            kind: 'present_candidates',
            exchangeId: 'candidate-direction',
            heading: 'Choose a direction',
            body: 'Compare the proposals.',
            candidates: details.candidates,
            continuation: {
              tool: 'ask',
              request: 'request_choice',
              exchangeId: 'candidate-direction',
              question: details.continuation?.params.body,
              options: details.continuation?.params.options,
            },
          },
        ],
      },
    });
  });

  it('preserves digest prose, continuation, and confirmation/questionnaire/review terminals without loss', () => {
    const digest = projectPresentDigest({
      exchangeId: 'digest-final',
      heading: 'Review source digest',
      body: 'Confirm before capture.',
      digest: {
        abstract: 'The source requires a single semantic projection.',
        analysis: 'Independent browser decoding would drift.',
        recommendation: 'Render the projection.',
      },
    }).details;
    const confirmation = projectDigestConfirmation({
      exchangeId: 'digest-confirmation',
      acceptsDigest: 'digest-final',
      acceptedAbstract: digest.digest.abstract,
      question: {
        body: 'Does this understanding sound right?',
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'changes', label: 'Needs changes' },
        ],
      },
      choice: { id: 'yes', label: 'Yes', kind: 'listed' },
    });
    const questionnaire = projectDigestQuestionnaire({
      exchangeId: 'digest-questionnaire',
      acceptsDigest: 'digest-final',
      acceptedAbstract: digest.digest.abstract,
      questions: [{ id: 'risk', kind: 'free-text', prompt: 'What risk remains?' }],
      answers: [{ questionId: 'risk', kind: 'free-text', text: 'Adapter drift.' }],
    });
    const review = projectRequestReview({
      exchangeId: 'digest-final',
      status: 'answered',
      review: 'request_changes',
      comment: 'Keep the recommendation advisory.',
      respondsToPresentTool: 'present_digest',
    });

    const result = projectSessionPresentation(target, [
      entry('digest', { role: 'toolResult', toolName: 'present_digest', details: digest }),
      entry('confirmation', { role: 'toolResult', toolName: 'ask', details: confirmation }),
      entry('questionnaire', { role: 'toolResult', toolName: 'ask', details: questionnaire }),
      entry('review', { role: 'toolResult', toolName: 'ask', details: review }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '3:review',
        entries: [
          {
            id: 'digest',
            cursor: '0:digest',
            kind: 'present_digest',
            exchangeId: 'digest-final',
            heading: 'Review source digest',
            body: 'Confirm before capture.',
            digest: digest.digest,
            continuation: digest.continuation,
          },
          expect.objectContaining({
            kind: 'ask',
            exchangeId: 'digest-confirmation',
            terminal: {
              status: 'answered',
              value: expect.objectContaining({
                choice: { id: 'yes', label: 'Yes', kind: 'listed' },
                acceptsDigest: 'digest-final',
                acceptedAbstract: digest.digest.abstract,
              }),
            },
          }),
          expect.objectContaining({
            kind: 'ask',
            exchangeId: 'digest-questionnaire',
            terminal: {
              status: 'answered',
              value: expect.objectContaining({
                acceptsDigest: 'digest-final',
                acceptedAbstract: digest.digest.abstract,
              }),
            },
          }),
          {
            id: 'review',
            cursor: '3:review',
            kind: 'ask',
            exchangeId: 'digest-final',
            question: 'Digest review',
            terminal: {
              status: 'answered',
              value: { decision: 'request_changes', comment: 'Keep the recommendation advisory.' },
            },
          },
        ],
      },
    });
  });

  it('classifies malformed digest details instead of leaking them', () => {
    expect(
      projectSessionPresentation(target, [
        entry('bad-digest', {
          role: 'toolResult',
          toolName: 'present_digest',
          details: { digest: { abstract: '' } },
        }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'bad-digest', family: 'present_digest' });
  });

  it('classifies malformed candidate details instead of leaking them', () => {
    expect(
      projectSessionPresentation(target, [
        entry('bad-candidates', {
          role: 'toolResult',
          toolName: 'present_candidates',
          details: { candidates: 'raw pi' },
        }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'bad-candidates', family: 'present_candidates' });
  });

  it('classifies malformed Brunch ask details instead of leaking them', () => {
    expect(
      projectSessionPresentation(target, [
        entry('bad', {
          role: 'toolResult',
          toolName: 'ask',
          details: { raw: 'pi' },
        }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'bad', family: 'ask' });
  });
});
