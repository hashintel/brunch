import { describe, expect, it } from 'vitest';

import { projectDigestConfirmation, projectDigestQuestionnaire } from '../../../exchanges/projections/ask.js';
import { projectPresentCandidates } from '../../../exchanges/projections/present-candidates.js';
import { projectPresentDigest } from '../../../exchanges/projections/present-digest.js';
import { projectPresentReviewSet } from '../../../exchanges/projections/present-review-set.js';
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

  it('preserves an ordered review set, declared continuation, and every terminal outcome without loss', () => {
    const offer = projectPresentReviewSet({
      exchangeId: 'review-set',
      payload: {
        schemaVersion: 1,
        lens: 'intent',
        epistemicStatus: 'asserted',
        grounding: { summary: 'User-approved proposal.', support: [] },
        pitch: { title: 'Approve graph changes', narrative: 'One cohesive set.' },
        entityDrafts: [
          {
            draftId: 'goal',
            proposedCode: 'G1',
            settlement: 'settled' as const,
            plane: 'intent',
            kind: 'goal',
            title: 'Clear outcome',
          },
          {
            draftId: 'req',
            proposedCode: 'REQ1',
            settlement: 'settled' as const,
            plane: 'intent',
            kind: 'requirement',
            title: 'Atomic approval',
            body: 'Commit once.',
            detail: { priority: 'high' },
          },
        ],
        edgeDrafts: [
          {
            category: 'dependency',
            settlement: 'settled' as const,
            dependency: { draftId: 'goal' },
            dependent: { draftId: 'req' },
            rationale: 'Requirement serves goal.',
          },
        ],
      },
    }).details;
    const receipt = {
      status: 'success' as const,
      lsn: 7,
      createdNodes: { req: { id: 2, code: 'REQ1' } },
      createdEdges: [3],
      updatedNodes: [],
      updatedEdges: [],
      deletedNodes: [],
      deletedEdges: [],
    };
    const terminals = [
      projectRequestReview({
        exchangeId: 'review-set',
        status: 'answered',
        review: 'approve',
        respondsToPresentTool: 'present_review_set',
        receipt,
      }),
      projectRequestReview({
        exchangeId: 'review-set',
        status: 'answered',
        review: 'request_changes',
        comment: 'Clarify the boundary.',
        respondsToPresentTool: 'present_review_set',
      }),
      projectRequestReview({
        exchangeId: 'review-set',
        status: 'answered',
        review: 'reject',
        comment: 'Wrong set.',
        respondsToPresentTool: 'present_review_set',
      }),
      projectRequestReview({
        exchangeId: 'review-set',
        status: 'cancelled',
        respondsToPresentTool: 'present_review_set',
      }),
      projectRequestReview({
        exchangeId: 'review-set',
        status: 'unavailable',
        message: 'No reviewer.',
        respondsToPresentTool: 'present_review_set',
      }),
    ];
    const result = projectSessionPresentation(target, [
      entry('offer', { role: 'toolResult', toolName: 'present_review_set', details: offer }),
      ...terminals.map((details, index) =>
        entry(`terminal-${index}`, { role: 'toolResult', toolName: 'ask', details }),
      ),
    ]);

    expect(result).toMatchObject({ status: 'ready' });
    if (result.status !== 'ready') return;
    expect(result.presentation.entries[0]).toEqual({
      id: 'offer',
      cursor: '0:offer',
      kind: 'present_review_set',
      exchangeId: 'review-set',
      heading: 'Approve graph changes',
      body: 'One cohesive set.',
      reviewSet: offer.review_set,
      continuation: offer.continuation,
    });
    expect(
      result.presentation.entries
        .slice(1)
        .map((value) => (value.kind === 'ask' ? value.terminal : undefined)),
    ).toEqual([
      { status: 'answered', value: { decision: 'approve', receipt } },
      { status: 'answered', value: { decision: 'request_changes', comment: 'Clarify the boundary.' } },
      { status: 'answered', value: { decision: 'reject', comment: 'Wrong set.' } },
      { status: 'cancelled', value: {} },
      { status: 'unavailable', value: { message: 'No reviewer.' } },
    ]);
  });

  it('classifies malformed review-set offers and terminals instead of leaking them', () => {
    expect(
      projectSessionPresentation(target, [
        entry('bad-offer', {
          role: 'toolResult',
          toolName: 'present_review_set',
          details: { review_set: 'raw' },
        }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'bad-offer', family: 'present_review_set' });
    expect(
      projectSessionPresentation(target, [
        entry('bad-terminal', {
          role: 'toolResult',
          toolName: 'ask',
          details: {
            schema: request.schema,
            v: 1,
            exchange_id: 'review-set',
            tool_meta: { prev: 'present_review_set', curr: 'request_review' },
            answered: { decision: 'approve' },
          },
        }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'bad-terminal', family: 'ask' });
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

  it('keeps a persisted offer-derived Brunch synthetic ask pair out of provider recovery', () => {
    const digest = projectPresentDigest({
      exchangeId: 'synthetic-offer',
      heading: 'Review source digest',
      body: 'Confirm before capture.',
      digest: { abstract: 'Persist one canonical answer.' },
    }).details;
    const review = projectRequestReview({
      exchangeId: 'synthetic-offer',
      status: 'answered',
      review: 'approve',
      acceptedAbstract: digest.digest.abstract,
      respondsToPresentTool: 'present_digest',
    });

    const result = projectSessionPresentation(target, [
      entry('offer', { role: 'toolResult', toolName: 'present_digest', details: digest }),
      entry('synthetic-call', {
        role: 'assistant',
        provider: 'brunch',
        content: [
          {
            type: 'toolCall',
            id: 'synthetic-offer__ask',
            name: 'ask',
            arguments: { exchangeId: 'synthetic-offer', body: 'Digest review' },
          },
        ],
      }),
      entry('answer', {
        role: 'toolResult',
        toolName: 'ask',
        toolCallId: 'synthetic-offer__ask',
        details: review,
      }),
    ]);

    expect(result).toMatchObject({
      status: 'ready',
      presentation: {
        entries: [
          { id: 'offer', kind: 'present_digest', exchangeId: 'synthetic-offer' },
          { id: 'answer', kind: 'ask', exchangeId: 'synthetic-offer', terminal: { status: 'answered' } },
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

  it('projects only one globally unresolved validated provider ask and correlates terminals by both identities', () => {
    const call = (id: string, exchangeId: string, provider?: string) =>
      entry(`entry-${id}`, {
        role: 'assistant',
        ...(provider === undefined ? {} : { provider }),
        content: [
          { type: 'text', text: `Ask ${exchangeId}.` },
          { type: 'toolCall', id, name: 'ask', arguments: { exchangeId, body: `Question ${exchangeId}?` } },
        ],
      });
    const terminal = (id: string, toolCallId: string, exchangeId: string, details?: unknown) =>
      entry(id, {
        role: 'toolResult',
        toolName: 'ask',
        toolCallId,
        details: details ?? {
          ...request,
          exchange_id: exchangeId,
          question: { body: `Question ${exchangeId}?` },
        },
      });
    const asks = (entries: readonly unknown[]) => {
      const result = projectSessionPresentation(target, entries);
      expect(result.status).toBe('ready');
      return result.status === 'ready'
        ? result.presentation.entries.filter((item) => item.kind === 'ask')
        : [];
    };

    expect(asks([call('call-a', 'a'), call('call-b', 'b')])).toEqual([]);
    expect(
      projectSessionPresentation(target, [
        call('call-a', 'a', 'anthropic'),
        terminal('wrong', 'call-a', 'other'),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'wrong', family: 'ask' });
    expect(
      projectSessionPresentation(target, [
        call('call-a', 'a', 'anthropic'),
        terminal('malformed', 'call-a', 'a', { raw: 'pi' }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'malformed', family: 'ask' });
    expect(asks([call('call-a', 'a'), terminal('answer', 'call-a', 'a')])).toEqual([
      expect.objectContaining({ id: 'answer', exchangeId: 'a', terminal: expect.any(Object) }),
    ]);
    expect(asks([terminal('orphan', 'historical-call', 'historical')])).toEqual([
      expect.objectContaining({ id: 'orphan', exchangeId: 'historical', terminal: expect.any(Object) }),
    ]);
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

  it('omits an exact present_review_set structural failure and projects the later standalone ask', () => {
    const result = projectSessionPresentation(target, [
      entry('u1', { role: 'user', content: 'Begin.', timestamp: 0 }),
      entry('failed-review', {
        role: 'toolResult',
        toolName: 'present_review_set',
        details: {
          status: 'structural_illegal',
          diagnostics: [{ field: 'edgeDrafts', message: 'edgeDrafts must be an array' }],
        },
      }),
      entry('ask-call', {
        role: 'assistant',
        provider: 'anthropic',
        content: [
          { type: 'text', text: 'One later question.' },
          {
            type: 'toolCall',
            id: 'later-ask',
            name: 'ask',
            arguments: { exchangeId: 'later', body: 'Continue?' },
          },
        ],
      }),
    ]);

    expect(result).toMatchObject({
      status: 'ready',
      presentation: {
        entries: [
          { id: 'u1', kind: 'message' },
          { id: 'ask-call', kind: 'message' },
          { id: 'ask-call:ask', kind: 'ask', exchangeId: 'later', question: 'Continue?' },
        ],
      },
    });
  });

  it('omits exact matching present-tool validation failures', () => {
    for (const toolName of ['present_review_set', 'present_candidates', 'present_digest'] as const) {
      expect(
        projectSessionPresentation(target, [
          entry(`invalid-${toolName}`, {
            role: 'toolResult',
            toolName,
            details: {
              status: 'validation_failed',
              tool: toolName,
              diagnostics: [{ field: 'payload', message: 'Expected object.' }],
            },
          }),
        ]),
      ).toEqual({ status: 'ready', presentation: { target, cursor: null, entries: [] } });
    }
  });

  it('fails closed on empty-diagnostic present-tool validation failures', () => {
    const failures = [
      ['present_review_set', { status: 'validation_failed', tool: 'present_review_set', diagnostics: [] }],
      ['present_candidates', { status: 'validation_failed', tool: 'present_candidates', diagnostics: [] }],
      ['present_digest', { status: 'validation_failed', tool: 'present_digest', diagnostics: [] }],
      ['present_review_set', { status: 'structural_illegal', diagnostics: [] }],
    ] as const;

    for (const [toolName, details] of failures) {
      const id = `empty-diagnostics-${toolName}-${details.status}`;
      expect(
        projectSessionPresentation(target, [entry(id, { role: 'toolResult', toolName, details })]),
      ).toEqual({ status: 'malformed_detail', entryId: id, family: toolName });
    }
  });

  it('fails closed on non-exact present-tool failure rivals', () => {
    const rivals = [
      ['present_review_set', { status: 'validation_failed', tool: 'present_digest', diagnostics: [] }],
      [
        'present_digest',
        { status: 'validation_failed', tool: 'present_digest', diagnostics: [], extra: true },
      ],
      [
        'present_candidates',
        { status: 'validation_failed', tool: 'present_candidates', diagnostics: [{ field: 'x' }] },
      ],
      ['present_digest', { status: 'structural_illegal', diagnostics: [] }],
      ['present_review_set', { status: 'future_failure', diagnostics: [] }],
      [
        'present_review_set',
        { status: 'structural_illegal', diagnostics: [{ field: 'x', message: 'bad', extra: true }] },
      ],
      ['present_candidates', { candidates: 'malformed offer' }],
    ] as const;

    for (const [toolName, details] of rivals) {
      const id = `bad-${toolName}`;
      expect(
        projectSessionPresentation(target, [entry(id, { role: 'toolResult', toolName, details })]),
      ).toEqual({ status: 'malformed_detail', entryId: id, family: toolName });
    }
  });

  it('ignores an ask input-validation failure without collapsing surrounding transcript projection', () => {
    expect(
      projectSessionPresentation(target, [
        entry('u1', { role: 'user', content: 'Begin.', timestamp: 0 }),
        entry('invalid-ask', {
          role: 'toolResult',
          toolName: 'ask',
          content: [{ type: 'text', text: '# TOOL_INPUT_INVALID' }],
          details: {
            status: 'validation_failed',
            tool: 'ask',
            diagnostics: [{ field: 'question.body', message: 'Expected string.' }],
          },
        }),
        entry('a1', { role: 'assistant', content: 'Recovered.', timestamp: 1 }),
      ]),
    ).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '2:a1',
        entries: [
          { id: 'u1', cursor: '0:u1', kind: 'message', role: 'user', text: 'Begin.' },
          { id: 'a1', cursor: '2:a1', kind: 'message', role: 'assistant', text: 'Recovered.' },
        ],
      },
    });
  });
});
